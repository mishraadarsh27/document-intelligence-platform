"""
AI Insight Generation Module
Generates: Summary, Genre Classification, Sentiment Analysis for books.
Supports both LM Studio (local) and OpenAI API backends.
Caches results to avoid repeated LLM calls.
"""

import json
import logging
import hashlib
from django.core.cache import cache
from django.conf import settings
import requests as http_requests

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# LLM Client helpers
# ─────────────────────────────────────────────

def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 500) -> str:
    """
    Call LLM – tries LM Studio first (local), falls back to OpenAI.
    Returns the assistant message text.
    """
    # Cache key based on prompts
    cache_key = "llm_" + hashlib.md5(
        (system_prompt + user_prompt).encode()
    ).hexdigest()
    cached = cache.get(cache_key)
    if cached:
        logger.debug("LLM cache hit.")
        return cached

    result = None

    if getattr(settings, "USE_LOCAL_LLM", True):
        result = _call_lmstudio(system_prompt, user_prompt, max_tokens)

    if not result and getattr(settings, "LLM_API_KEY", ""):
        result = _call_openai(system_prompt, user_prompt, max_tokens)

    if not result:
        result = _fallback_response(user_prompt)

    # Cache LLM responses for 24 hours to avoid repeated calls
    cache.set(cache_key, result, 86400)
    return result


def _call_lmstudio(system_prompt: str, user_prompt: str, max_tokens: int) -> str | None:
    """Call LM Studio local server (OpenAI-compatible API)."""
    base_url = getattr(settings, "LOCAL_LLM_URL", "http://localhost:1234/v1")
    try:
        resp = http_requests.post(
            f"{base_url}/chat/completions",
            json={
                "model": getattr(settings, "LOCAL_LLM_MODEL", "llama-3.2-3b-instruct"),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],

                "max_tokens": max_tokens,
                "temperature": 0.7,
            },
            timeout=120,
        )

        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("LM Studio call failed: %s", exc)
        return None


def _call_openai(system_prompt: str, user_prompt: str, max_tokens: int) -> str | None:
    """Call OpenAI API."""
    try:
        import openai
        client = openai.OpenAI(api_key=settings.LLM_API_KEY)
        resp = client.chat.completions.create(
            model=getattr(settings, "LLM_MODEL", "gpt-3.5-turbo"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        logger.warning("OpenAI call failed: %s", exc)
        return None


def _fallback_response(prompt: str) -> str:
    """Rule-based fallback when no LLM is available."""
    return (
        "AI service is currently unavailable. "
        "Please configure LM Studio (http://localhost:1234) or set OPENAI_API_KEY."
    )


# ─────────────────────────────────────────────
# Public AI Insight Functions
# ─────────────────────────────────────────────

def generate_summary(title: str, description: str, author: str = "") -> str:
    """
    Generate a 2-3 sentence summary of the book using an LLM.
    """
    if not description or len(description) < 20:
        return "No description available to generate a summary."

    system = (
        "You are a literary assistant. Given a book title, author, and description, "
        "generate a concise, engaging 2-3 sentence summary suitable for a book catalogue."
    )
    user = (
        f"Book: '{title}' by {author or 'Unknown Author'}\n\n"
        f"Description:\n{description[:1500]}\n\n"
        "Write a 2-3 sentence summary:"
    )
    return _call_llm(system, user, max_tokens=200)


def classify_genre(title: str, description: str) -> str:
    """
    Predict the book's genre based on its title and description.
    Returns a single genre string, e.g. 'Mystery', 'Science Fiction', etc.
    """
    if not description:
        description = title

    system = (
        "You are a genre classification expert. Given a book title and description, "
        "classify it into EXACTLY ONE genre from this list: "
        "Fiction, Mystery, Thriller, Romance, Science Fiction, Fantasy, Horror, "
        "Historical Fiction, Biography, Self-Help, Business, Children's, Young Adult, "
        "Poetry, Travel, Humor, Philosophy, Science, Technology, Cooking, Art. "
        "Respond with ONLY the genre name, nothing else."
    )
    user = (
        f"Title: {title}\n"
        f"Description: {description[:800]}\n\n"
        "Genre:"
    )
    genre = _call_llm(system, user, max_tokens=10)
    # Sanitize – take first word/phrase if LLM returns more
    genre = genre.strip().split("\n")[0].strip()
    return genre[:100]


def analyze_sentiment(description: str, title: str = "") -> tuple[str, float]:
    """
    Analyze the sentiment/tone of the book description.

    Returns:
        (label, score) where label is 'Positive' / 'Negative' / 'Neutral'
        and score is a float in [-1.0, 1.0].
    """
    if not description or len(description) < 10:
        return ("Neutral", 0.0)

    system = (
        "You are a sentiment analysis expert. Analyze the tone of the given book description. "
        "Respond with a JSON object like: "
        '{"label": "Positive", "score": 0.75} '
        "where label is one of Positive, Negative, Neutral, "
        "and score is between -1.0 (very negative) and 1.0 (very positive)."
    )
    user = (
        f"Book: {title}\n"
        f"Description: {description[:800]}\n\n"
        "Analyze sentiment:"
    )
    raw = _call_llm(system, user, max_tokens=60)

    # Parse JSON response
    try:
        # Extract JSON from response (LLM may add extra text)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(raw[start:end])
            label = data.get("label", "Neutral")
            score = float(data.get("score", 0.0))
            score = max(-1.0, min(1.0, score))
            return (label, score)
    except (json.JSONDecodeError, ValueError, KeyError) as exc:
        logger.warning("Failed to parse sentiment JSON: %s — raw: %s", exc, raw)

    # Simple fallback: look for keywords in raw response
    raw_lower = raw.lower()
    if "positive" in raw_lower:
        return ("Positive", 0.6)
    elif "negative" in raw_lower:
        return ("Negative", -0.6)
    return ("Neutral", 0.0)


def generate_all_insights(
    title: str,
    description: str,
    author: str = "",
) -> dict:
    """
    Convenience function: generate summary, genre, and sentiment for a book.

    Returns dict with keys: summary, genre, sentiment_label, sentiment_score.
    """
    summary = generate_summary(title, description, author)
    genre = classify_genre(title, description)
    sentiment_label, sentiment_score = analyze_sentiment(description, title)

    return {
        "summary": summary,
        "genre": genre,
        "sentiment_label": sentiment_label,
        "sentiment_score": sentiment_score,
    }
