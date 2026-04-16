"""
Books App Views
Provides REST API endpoints for the Book Intelligence Platform.

Endpoints:
  GET  /api/books/              - List all books
  GET  /api/books/{id}/         - Book detail
  POST /api/books/upload_book/  - Upload a single book entry
  POST /api/books/scrape_books/ - Scrape + process books from the web
  GET  /api/books/{id}/recommend/ - Get recommendations for a book
  POST /api/books/ask_question/ - RAG Q&A endpoint
"""

import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import JSONParser
from django.core.cache import cache

from .models import Book
from .serializers import BookSerializer, BookListSerializer, BookDetailSerializer

logger = logging.getLogger(__name__)


class BookViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Book CRUD + custom actions.
    Uses caching on list to reduce DB load.
    """

    queryset = Book.objects.all()
    serializer_class = BookSerializer
    parser_classes = [JSONParser]

    def get_serializer_class(self):
        if self.action == "list":
            return BookListSerializer
        if self.action == "retrieve":
            return BookDetailSerializer
        return BookSerializer

    # ── GET /api/books/ ────────────────────────────────────────────────────
    def list(self, request, *args, **kwargs):
        """List all books with caching (5-minute TTL)."""
        cache_key = "book_list"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, 300)
        return response

    # ── GET /api/books/{id}/ ───────────────────────────────────────────────
    def retrieve(self, request, *args, **kwargs):
        """Retrieve full book detail (includes chunks)."""
        return super().retrieve(request, *args, **kwargs)

    # ── POST /api/books/upload_book/ ───────────────────────────────────────
    @action(detail=False, methods=["post"])
    def upload_book(self, request):
        """
        Upload and process a single book.
        Generates AI insights (summary, genre, sentiment) and indexes embeddings.
        Expects JSON body matching bookFields.
        """
        serializer = BookSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        book = serializer.save()
        _process_book(book)

        # Invalidate list cache after new book
        cache.delete("book_list")

        return Response(
            BookDetailSerializer(book).data,
            status=status.HTTP_201_CREATED,
        )

    # ── POST /api/books/scrape_books/ ─────────────────────────────────────
    @action(detail=False, methods=["post"])
    def scrape_books(self, request):
        """
        Scrape books from books.toscrape.com, store them in DB,
        generate AI insights, and index embeddings.

        Body (optional): {"max_pages": 3}  (default: 3)
        """
        max_pages = int(request.data.get("max_pages", 3))
        max_pages = min(max(max_pages, 1), 20)  # Clamp 1-20

        try:
            # Use Selenium scraper to satisfy the specific "Automation: Selenium" requirement
            from scraping.selenium_scraper import scrape_books_selenium
            logger.info("Starting Selenium-based scraping for %d pages...", max_pages)
            scraped = scrape_books_selenium(max_pages=max_pages)
        except Exception as exc:
            logger.error("Scraping failed: %s", exc)
            # Fallback to requests if selenium fails (bonus robustness)
            try:
                from scraping.scraper import scrape_books
                logger.info("Selenium failed, falling back to basic requests scraper.")
                scraped = scrape_books(max_pages=max_pages)
            except Exception as e2:
                return Response(
                    {"error": f"All scraping methods failed: {exc} | {e2}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        new_books = []
        skipped = 0

        for book_data in scraped:
            # Skip if already in DB (by URL)
            if Book.objects.filter(book_url=book_data.get("book_url", "")).exists():
                skipped += 1
                continue

            try:
                serializer = BookSerializer(data=book_data)
                if serializer.is_valid():
                    book = serializer.save()
                    _process_book(book)
                    new_books.append(book.id)
                else:
                    logger.warning("Invalid book data: %s", serializer.errors)
            except Exception as exc:
                logger.warning("Failed to save book: %s", exc)

        # Invalidate list cache
        cache.delete("book_list")

        return Response(
            {
                "message": f"Scraping complete. {len(new_books)} new books added, {skipped} skipped.",
                "new_book_ids": new_books,
                "total_scraped": len(scraped),
            },
            status=status.HTTP_200_OK,
        )

    # ── GET /api/books/{id}/recommend/ ────────────────────────────────────
    @action(detail=True, methods=["get"])
    def recommend(self, request, pk=None):
        """
        Get book recommendations using embedding similarity.
        Falls back to genre-based filtering if embeddings unavailable.
        """
        book = self.get_object()
        cache_key = f"recommendations_{book.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            from rag.pipeline import get_recommendations
            recs = get_recommendations(
                book_id=book.id,
                title=book.title,
                genre=book.genre or "",
            )
        except Exception as exc:
            logger.warning("Recommendation engine failed: %s", exc)
            # Basic fallback
            fallback = Book.objects.filter(genre=book.genre).exclude(id=book.id)[:5]
            recs = BookListSerializer(fallback, many=True).data

        cache.set(cache_key, recs, 600)  # Cache 10 min
        return Response(recs)

    # ── POST /api/books/ask_question/ ─────────────────────────────────────
    @action(detail=False, methods=["post"])
    def ask_question(self, request):
        """
        RAG Q&A endpoint.
        Body: {"question": "...", "book_id": <optional>}
        Returns: {answer, citations, sources, confidence, context_used}
        """
        question = request.data.get("question", "").strip()
        if not question:
            return Response(
                {"error": "Question is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from rag.pipeline import query_rag
            result = query_rag(question)
        except Exception as exc:
            logger.error("RAG query failed: %s", exc)
            return Response(
                {"error": f"RAG query failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────

def _process_book(book: Book) -> None:
    """
    Post-save processing pipeline:
      1. Generate AI insights (summary, genre, sentiment).
      2. Embed and index in ChromaDB.
    Runs synchronously; move to Celery task for async processing.
    """
    try:
        from rag.ai_insights import generate_all_insights
        insights = generate_all_insights(
            title=book.title,
            description=book.description or "",
            author=book.author,
        )
        book.summary = insights.get("summary", "")
        book.genre = insights.get("genre", "") or book.genre or ""
        book.sentiment_score = insights.get("sentiment_score", 0.0)
        book.save(update_fields=["summary", "genre", "sentiment_score"])
        logger.info("AI insights generated for book '%s'.", book.title)
    except Exception as exc:
        logger.warning("AI insight generation failed for book '%s': %s", book.title, exc)

    try:
        from rag.pipeline import embed_and_store_book
        embed_and_store_book(
            book_id=book.id,
            title=book.title,
            description=book.description or "",
            summary=book.summary or "",
        )
        logger.info("Embeddings stored for book '%s'.", book.title)
    except Exception as exc:
        logger.warning("Embedding failed for book '%s': %s", book.title, exc)
