"""
Book Scraper Module
Scrapes book data from books.toscrape.com using requests + BeautifulSoup.
Supports multi-page scraping and caching.
"""

import requests
from bs4 import BeautifulSoup
import logging
import time
from django.core.cache import cache

logger = logging.getLogger(__name__)

BASE_URL = "https://books.toscrape.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

RATING_WORDS = {
    "One": 1.0,
    "Two": 2.0,
    "Three": 3.0,
    "Four": 4.0,
    "Five": 5.0,
}


def _get_page(url: str) -> BeautifulSoup | None:
    """Fetch and parse a page, with simple retry logic."""
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as exc:
            logger.warning("Attempt %d failed for %s: %s", attempt + 1, url, exc)
            time.sleep(2 ** attempt)
    return None


def _parse_rating(word_rating: str) -> float:
    """Convert word-based rating (e.g. 'Three') to float."""
    return RATING_WORDS.get(word_rating, 0.0)


def _parse_book_detail(detail_url: str) -> dict:
    """
    Scrape individual book detail page for description, UPC, and more.
    Returns a dict with extra fields.
    """
    cache_key = f"book_detail_{detail_url}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    soup = _get_page(detail_url)
    if not soup:
        return {}

    # Description
    desc_tag = soup.find("div", id="product_description")
    description = ""
    if desc_tag:
        next_p = desc_tag.find_next_sibling("p")
        if next_p:
            description = next_p.get_text(strip=True)

    # Product info table
    table = soup.find("table", class_="table-striped")
    info = {}
    if table:
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) == 2:
                key = row.find("th").get_text(strip=True)
                val = cells[1].get_text(strip=True)
                info[key] = val

    result = {
        "description": description,
        "isbn": info.get("UPC", ""),
        "price": info.get("Price (excl. tax)", ""),
        "availability": info.get("Availability", ""),
    }
    cache.set(cache_key, result, 3600)  # Cache for 1 hour
    return result


def scrape_books(max_pages: int = 5) -> list[dict]:
    """
    Scrape books from books.toscrape.com.

    Args:
        max_pages: Maximum number of catalogue pages to scrape.

    Returns:
        List of book dicts with title, author, rating, description,
        book_url, cover_image_url, genre.
    """
    cache_key = f"scraped_books_pages_{max_pages}"
    cached_books = cache.get(cache_key)
    if cached_books:
        logger.info("Returning %d books from cache.", len(cached_books))
        return cached_books

    books = []
    next_url = f"{BASE_URL}/catalogue/page-1.html"
    pages_scraped = 0

    while next_url and pages_scraped < max_pages:
        logger.info("Scraping page: %s", next_url)
        soup = _get_page(next_url)
        if not soup:
            logger.error("Failed to fetch page: %s", next_url)
            break

        for article in soup.select("ol.row > li > article.product_pod"):
            try:
                # Title
                title_tag = article.select_one("h3 > a")
                title = title_tag["title"] if title_tag else "Unknown"

                # Book URL
                relative_href = title_tag["href"] if title_tag else ""
                # Href looks like "../../../book/book-name_id/index.html"
                book_url = BASE_URL + "/catalogue/" + relative_href.replace("../", "")

                # Rating
                star_tag = article.select_one("p.star-rating")
                rating_word = star_tag["class"][1] if star_tag else "One"
                rating = _parse_rating(rating_word)

                # Cover image
                img_tag = article.select_one("div.image_container img")
                img_src = img_tag["src"] if img_tag else ""
                cover_image_url = BASE_URL + "/" + img_src.replace("../", "")

                # Genre from breadcrumb (fetch from detail page)
                detail = _parse_book_detail(book_url)

                books.append({
                    "title": title,
                    "author": "Unknown",          # Site doesn't expose author on listing
                    "rating": rating,
                    "review_count": 0,
                    "description": detail.get("description", ""),
                    "book_url": book_url,
                    "cover_image_url": cover_image_url,
                    "isbn": detail.get("isbn", ""),
                    "genre": "",                  # Will be filled by AI genre classifier
                })

                time.sleep(0.2)   # Polite crawl delay
            except Exception as exc:
                logger.warning("Error parsing article: %s", exc)

        # Next page
        next_btn = soup.select_one("li.next > a")
        if next_btn:
            # Handle relative URL
            current_dir = next_url.rsplit("/", 1)[0]
            next_url = current_dir + "/" + next_btn["href"]
        else:
            next_url = None

        pages_scraped += 1

    # Cache the result for 30 minutes
    cache.set(cache_key, books, 1800)
    logger.info("Scraped %d books across %d pages.", len(books), pages_scraped)
    return books
