"""
Lightweight Vector Store
A pure-Python/NumPy implementation of a vector store for book chunk embeddings.
Replaces ChromaDB to avoid native compilation requirements on Windows.

Storage layout (JSON):
  vector_store.json  ←  { "ids": [...], "documents": [...], "metadatas": [...], "embeddings": [[...]] }

Features:
  - Cosine similarity search
  - Persistent JSON storage (survives restarts)
  - Filter by metadata field (e.g. book_id)
  - O(n) brute-force search — fast enough for thousands of chunks
"""

import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional

import numpy as np
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────
BASE_DIR = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parent.parent))
STORE_PATH = BASE_DIR / "vector_store.json"

# ── Thread-safe in-memory store ────────────────────────────────────────────
_lock = threading.Lock()
_store: dict = {
    "ids":        [],   # list[str]
    "documents":  [],   # list[str]  – raw chunk text
    "metadatas":  [],   # list[dict] – {"book_id": "...", "title": "...", "chunk_index": N}
    "embeddings": [],   # list[list[float]]
}
_loaded = False


# ── Persistence ────────────────────────────────────────────────────────────

def _load_store() -> None:
    """Load the vector store from disk into memory (once per process)."""
    global _store, _loaded
    if _loaded:
        return
    if STORE_PATH.exists():
        try:
            with open(STORE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Basic validation
            if all(k in data for k in ("ids", "documents", "metadatas", "embeddings")):
                _store = data
                logger.info(
                    "Vector store loaded: %d chunks from %s", len(_store["ids"]), STORE_PATH
                )
            else:
                logger.warning("Vector store file is corrupt — starting fresh.")
        except Exception as exc:
            logger.error("Failed to load vector store: %s — starting fresh.", exc)
    _loaded = True


def _save_store() -> None:
    """Persist the in-memory store to disk."""
    try:
        with open(STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(_store, f)
    except Exception as exc:
        logger.error("Failed to save vector store: %s", exc)


# ── Public API ─────────────────────────────────────────────────────────────

def count() -> int:
    """Return number of stored vectors."""
    with _lock:
        _load_store()
        return len(_store["ids"])


def add(
    ids:        list[str],
    embeddings: list[list[float]],
    documents:  list[str],
    metadatas:  list[dict],
) -> None:
    """
    Insert new vectors (and delete any existing ones with the same ids first).
    Thread-safe.
    """
    with _lock:
        _load_store()

        # Remove existing entries with overlapping ids
        id_set = set(ids)
        keep = [i for i, eid in enumerate(_store["ids"]) if eid not in id_set]
        _store["ids"]        = [_store["ids"][i]        for i in keep]
        _store["documents"]  = [_store["documents"][i]  for i in keep]
        _store["metadatas"]  = [_store["metadatas"][i]  for i in keep]
        _store["embeddings"] = [_store["embeddings"][i] for i in keep]

        # Append new entries
        _store["ids"]        .extend(ids)
        _store["documents"]  .extend(documents)
        _store["metadatas"]  .extend(metadatas)
        _store["embeddings"] .extend(embeddings)

        _save_store()
        logger.debug("Added %d vectors. Total: %d", len(ids), len(_store["ids"]))


def delete_by_metadata(key: str, value: str) -> int:
    """Delete all vectors where metadata[key] == value. Returns deleted count."""
    with _lock:
        _load_store()
        keep = [
            i for i, m in enumerate(_store["metadatas"])
            if m.get(key) != value
        ]
        deleted = len(_store["ids"]) - len(keep)
        _store["ids"]        = [_store["ids"][i]        for i in keep]
        _store["documents"]  = [_store["documents"][i]  for i in keep]
        _store["metadatas"]  = [_store["metadatas"][i]  for i in keep]
        _store["embeddings"] = [_store["embeddings"][i] for i in keep]
        if deleted:
            _save_store()
        return deleted


def query(
    query_embedding: list[float],
    n_results:       int = 5,
    where:           Optional[dict] = None,
) -> dict:
    """
    Cosine similarity search.

    Args:
        query_embedding: The embedding vector to search against.
        n_results:       Max number of results to return.
        where:           Optional metadata filter, e.g. {"book_id": "42"}.

    Returns:
        Dict with keys: ids, documents, metadatas, distances
        where distances are in [0, 2] (0 = identical, 2 = opposite).
    """
    with _lock:
        _load_store()

        if not _store["ids"]:
            return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

        # Apply metadata filter
        if where:
            indices = [
                i for i, m in enumerate(_store["metadatas"])
                if all(m.get(k) == v for k, v in where.items())
            ]
        else:
            indices = list(range(len(_store["ids"])))

        if not indices:
            return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

        # Build matrix of candidate embeddings
        emb_matrix = np.array([_store["embeddings"][i] for i in indices], dtype=np.float32)
        q_vec = np.array(query_embedding, dtype=np.float32)

        # Cosine similarity: sim = (A · B) / (‖A‖ · ‖B‖)
        norms = np.linalg.norm(emb_matrix, axis=1)
        q_norm = np.linalg.norm(q_vec)

        # Prevent division by zero
        safe_norms = np.where(norms == 0, 1e-10, norms)
        q_norm = q_norm if q_norm != 0 else 1e-10

        similarities = (emb_matrix @ q_vec) / (safe_norms * q_norm)

        # Convert to distance (0 = identical)
        distances = 1 - similarities

        # Top-k
        k = min(n_results, len(indices))
        top_k_pos = np.argpartition(distances, k - 1)[:k]
        top_k_pos = top_k_pos[np.argsort(distances[top_k_pos])]  # Sort ascending

        result_ids   = [_store["ids"][indices[p]]       for p in top_k_pos]
        result_docs  = [_store["documents"][indices[p]] for p in top_k_pos]
        result_metas = [_store["metadatas"][indices[p]] for p in top_k_pos]
        result_dists = [float(distances[p])             for p in top_k_pos]

        return {
            "ids":       [result_ids],
            "documents": [result_docs],
            "metadatas": [result_metas],
            "distances": [result_dists],
        }


def get_by_metadata(key: str, value: str) -> dict:
    """Return all entries matching a metadata filter."""
    with _lock:
        _load_store()
        indices = [
            i for i, m in enumerate(_store["metadatas"])
            if m.get(key) == value
        ]
        return {
            "ids":        [_store["ids"][i]        for i in indices],
            "embeddings": [_store["embeddings"][i] for i in indices],
            "documents":  [_store["documents"][i]  for i in indices],
            "metadatas":  [_store["metadatas"][i]  for i in indices],
        }
