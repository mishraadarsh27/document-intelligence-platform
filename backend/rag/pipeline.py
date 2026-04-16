"""
RAG Pipeline
Implements a complete Retrieval-Augmented Generation pipeline:
  1. Text chunking  — overlapping windows for context preservation
  2. Embedding      — sentence-transformers (all-MiniLM-L6-v2)
  3. Vector storage — custom numpy-based store (rag/vector_store.py)
  4. Retrieval      — cosine similarity search
  5. Answer gen     — LLM with context + source citations

No external native dependencies required — works out of the box on Windows.
"""

import logging
import hashlib
from typing import Optional

from django.core.cache import cache

logger = logging.getLogger(__name__)

# ── Lazy globals ────────────────────────────────────────────────────────────
_embedder = None


def _get_embedder():
    """Lazy-load sentence transformer (downloads model on first call ~80 MB)."""
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer model loaded.")
        except Exception as exc:
            logger.error("Failed to load SentenceTransformer: %s", exc)
    return _embedder


# ── Chunking ────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 300, overlap: int = 60) -> list[str]:
    """
    Overlapping sliding-window chunking by word count.
    Uses overlap to preserve context at chunk boundaries (bonus feature).

    Args:
        text:       Input text.
        chunk_size: Target words per chunk.
        overlap:    Words shared between consecutive chunks.
    Returns:
        List of text chunk strings.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    if len(words) <= chunk_size:
        return [text.strip()]

    chunks, start = [], 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end >= len(words):
            break
        start += chunk_size - overlap  # Slide forward with overlap

    return chunks


# ── Indexing ────────────────────────────────────────────────────────────────

def embed_and_store_book(
    book_id: int,
    title: str,
    description: str,
    summary: str = "",
) -> list[str]:
    """
    Chunk a book's text, generate embeddings, and store in the vector store.
    Also persists BookChunk records to the database.

    Returns list of vector IDs stored (empty on failure).
    """
    from books.models import BookChunk
    import rag.vector_store as vs

    embedder = _get_embedder()
    if embedder is None:
        logger.warning("Embedder unavailable — skipping indexing for book %d.", book_id)
        return []

    # Build text: title + description + summary for richer representation
    full_text = f"{title}. {description} {summary}".strip()
    chunks = chunk_text(full_text)

    if not chunks:
        logger.warning("No chunks generated for book %d.", book_id)
        return []

    # Generate embeddings (batched for efficiency)
    try:
        embeddings = embedder.encode(chunks, show_progress_bar=False).tolist()
    except Exception as exc:
        logger.error("Embedding generation failed for book %d: %s", book_id, exc)
        return []

    ids = [f"book_{book_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {"book_id": str(book_id), "title": title, "chunk_index": str(i)}
        for i in range(len(chunks))
    ]

    # Remove old vectors for this book then insert fresh ones
    vs.delete_by_metadata("book_id", str(book_id))
    vs.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)

    # Persist chunk records in the relational DB
    BookChunk.objects.filter(book_id=book_id).delete()
    BookChunk.objects.bulk_create([
        BookChunk(
            book_id=book_id,
            chunk_text=chunk,
            chunk_index=i,
            embedding_id=ids[i],
        )
        for i, chunk in enumerate(chunks)
    ])

    logger.info("Indexed %d chunks for book %d.", len(chunks), book_id)
    return ids


# ── Retrieval & Generation ───────────────────────────────────────────────────

def query_rag(question: str, top_k: int = 5) -> dict:
    """
    Full RAG pipeline query.

    Steps:
      1. Embed the question.
      2. Cosine similarity search against all book chunks.
      3. Construct context from top-k results.
      4. Generate answer via LLM with source citations.

    Caches results for 1 hour to avoid repeated LLM calls.

    Returns:
        {
          answer:       str,
          citations:    list[str],
          sources:      list[{book_id, title, chunk, similarity}],
          confidence:   "High" | "Medium" | "Low" | "None",
          context_used: int,
        }
    """
    import rag.vector_store as vs

    # Cache lookup
    cache_key = "rag_" + hashlib.md5(question.encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        logger.info("RAG cache hit.")
        return cached

    embedder = _get_embedder()
    if embedder is None or vs.count() == 0:
        return _rag_fallback(
            "RAG components unavailable or no books indexed. "
            "Please scrape books first."
        )

    # ── Step 1: Embed question ──────────────────────────────────────────────
    try:
        q_embedding = embedder.encode([question], show_progress_bar=False).tolist()[0]
    except Exception as exc:
        logger.error("Question embedding failed: %s", exc)
        return _rag_fallback(str(exc))

    # ── Step 2: Similarity search ───────────────────────────────────────────
    try:
        results = vs.query(q_embedding, n_results=top_k)
    except Exception as exc:
        logger.error("Vector store query failed: %s", exc)
        return _rag_fallback(str(exc))

    docs      = results["documents"][0]
    metas     = results["metadatas"][0]
    distances = results["distances"][0]

    if not docs:
        return _rag_fallback("No relevant content found. Add books first.")

    # ── Step 3: Build context ───────────────────────────────────────────────
    context_parts, citations, sources = [], [], []
    for i, (doc, meta, dist) in enumerate(zip(docs, metas, distances)):
        title      = meta.get("title", "Unknown Book")
        book_id    = meta.get("book_id", "")
        similarity = round(max(0.0, 1 - dist), 3)

        context_parts.append(f"[{i+1}] From '{title}':\n{doc}")
        citations.append(f"[{i+1}] {title}")
        sources.append({
            "book_id":    book_id,
            "title":      title,
            "chunk":      doc[:250] + "…" if len(doc) > 250 else doc,
            "similarity": similarity,
        })

    context = "\n\n".join(context_parts)

    # ── Step 4: LLM generation ──────────────────────────────────────────────
    from rag.ai_insights import _call_llm

    system = (
        "You are an intelligent book assistant. "
        "Use ONLY the context excerpts provided to answer the user's question. "
        "Always cite your sources using [N] notation. "
        "If the context is insufficient, say so honestly."
    )
    user = (
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        "Answer (with [N] citations):"
    )
    answer = _call_llm(system, user, max_tokens=500)

    # ── Confidence from average similarity ─────────────────────────────────
    avg_sim = sum(1 - d for d in distances) / len(distances) if distances else 0
    confidence = "High" if avg_sim > 0.65 else "Medium" if avg_sim > 0.35 else "Low"

    result = {
        "answer":       answer,
        "citations":    citations,
        "sources":      sources,
        "confidence":   confidence,
        "context_used": len(docs),
    }

    cache.set(cache_key, result, 3600)  # Cache 1 hour
    return result


def _rag_fallback(reason: str) -> dict:
    return {
        "answer": (
            "I couldn't find relevant information to answer your question.\n\n"
            f"Reason: {reason}\n\n"
            "💡 Tip: Make sure books have been scraped and indexed first "
            "(click 'Scrape Books' on the dashboard, or ensure LM Studio is running)."
        ),
        "citations":    [],
        "sources":      [],
        "confidence":   "None",
        "context_used": 0,
    }


# ── Embedding-based Recommendations ─────────────────────────────────────────

def get_recommendations(book_id: int, title: str, genre: str, top_k: int = 5) -> list[dict]:
    """
    Find similar books via average embedding of the book's chunks.
    Falls back to genre-based DB query when embeddings are unavailable.
    """
    import rag.vector_store as vs
    from books.models import Book

    embedder = _get_embedder()
    if embedder is None or vs.count() == 0:
        return _genre_fallback(book_id, genre, top_k)

    try:
        # Retrieve this book's stored chunk embeddings
        book_data = vs.get_by_metadata("book_id", str(book_id))
        if not book_data["embeddings"]:
            return _genre_fallback(book_id, genre, top_k)

        # Average pooling over chunks → single book embedding
        import numpy as np
        book_embedding = np.mean(book_data["embeddings"], axis=0).tolist()

        # Similarity search
        results = vs.query(book_embedding, n_results=top_k + 20)

        seen, rec_books = {str(book_id)}, []
        metas     = results["metadatas"][0]
        distances = results["distances"][0]

        for meta, dist in zip(metas, distances):
            bid = meta.get("book_id", "")
            if bid in seen:
                continue
            seen.add(bid)
            try:
                b = Book.objects.get(id=int(bid))
                rec_books.append({
                    "id":              b.id,
                    "title":          b.title,
                    "author":         b.author,
                    "rating":         b.rating,
                    "cover_image_url": b.cover_image_url,
                    "genre":          b.genre,
                    "similarity":     round(max(0.0, 1 - dist), 3),
                })
            except Book.DoesNotExist:
                pass
            if len(rec_books) >= top_k:
                break

        return rec_books if rec_books else _genre_fallback(book_id, genre, top_k)

    except Exception as exc:
        logger.warning("Embedding recommendation failed: %s", exc)
        return _genre_fallback(book_id, genre, top_k)


def _genre_fallback(book_id: int, genre: str, top_k: int) -> list[dict]:
    """Return simple genre-filtered book list as recommendation fallback."""
    from books.models import Book
    qs = Book.objects.filter(genre=genre).exclude(id=book_id)[:top_k]
    return [
        {
            "id":    b.id,
            "title": b.title,
            "author": b.author,
            "rating": b.rating,
            "cover_image_url": b.cover_image_url,
            "genre": b.genre,
        }
        for b in qs
    ]
