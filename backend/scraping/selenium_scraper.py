"""
Selenium-based Book Scraper
Fulfills the assessment requirement for using Selenium automation.
Uses webdriver-manager for automatic driver setup.
"""

import logging
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from django.core.cache import cache

logger = logging.getLogger(__name__)

BASE_URL = "https://books.toscrape.com"

RATING_WORDS = {
    "One": 1.0,
    "Two": 2.0,
    "Three": 3.0,
    "Four": 4.0,
    "Five": 5.0,
}

def _get_driver():
    """Initialize a headless Chrome driver."""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    
    # Use webdriver-manager to handle binary installation
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def scrape_books_selenium(max_pages: int = 1) -> list[dict]:
    """
    Scrape books using Selenium automation.
    """
    driver = None
    books = []
    
    try:
        driver = _get_driver()
        current_page = 1
        
        while current_page <= max_pages:
            url = f"{BASE_URL}/catalogue/page-{current_page}.html"
            logger.info(f"Selenium scraping page: {url}")
            driver.get(url)
            
            # Wait for products to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "article.product_pod"))
            )
            
            articles = driver.find_elements(By.CSS_SELECTOR, "article.product_pod")
            
            # Collect data from listing first to minimize page jumps initially
            temp_books = []
            for article in articles:
                try:
                    title_tag = article.find_element(By.CSS_SELECTOR, "h3 > a")
                    title = title_tag.get_attribute("title")
                    book_url = title_tag.get_attribute("href")
                    
                    star_tag = article.find_element(By.CSS_SELECTOR, "p.star-rating")
                    rating_class = star_tag.get_attribute("class").split()
                    rating_word = rating_class[1] if len(rating_class) > 1 else "One"
                    rating = RATING_WORDS.get(rating_word, 1.0)
                    
                    img_tag = article.find_element(By.CSS_SELECTOR, "div.image_container img")
                    img_src = img_tag.get_attribute("src")
                    
                    temp_books.append({
                        "title": title,
                        "author": "Unknown",
                        "rating": rating,
                        "book_url": book_url,
                        "cover_image_url": img_src,
                    })
                except Exception as e:
                    logger.warning(f"Error parsing book in Selenium listing: {e}")
            
            # Now visit each detail page for description (this is what makes it 'automation')
            for book in temp_books:
                try:
                    driver.get(book["book_url"])
                    # Wait for description header
                    try:
                        desc_header = WebDriverWait(driver, 5).until(
                            EC.presence_of_element_located((By.ID, "product_description"))
                        )
                        description = driver.execute_script(
                            "return arguments[0].nextElementSibling.innerText;", desc_header
                        )
                    except:
                        description = "No description found."
                    
                    # Get ISBN from table
                    try:
                        isbn = driver.find_element(By.XPATH, "//th[text()='UPC']/following-sibling::td").text
                    except:
                        isbn = ""
                        
                    book["description"] = description
                    book["isbn"] = isbn
                    books.append(book)
                    
                    time.sleep(0.5) # Polite delay
                except Exception as e:
                    logger.warning(f"Error fetching detail in Selenium: {e}")
            
            # Check for next page
            current_page += 1
            if current_page > max_pages:
                break
                
    except Exception as e:
        logger.error(f"Selenium scraping failed: {e}")
    finally:
        if driver:
            driver.quit()
            
    return books
