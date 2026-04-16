import React from 'react';
import axios from 'axios';
import {
  MessageSquare, Send, Sparkles, BookOpen, LinkIcon,
  Loader, AlertCircle, Lightbulb, ChevronDown,
} from 'lucide-react';

const API = 'http://localhost:8000/api';

// ── Confidence badge ───────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  const map = {
    High:   { cls: 'badge-high',   label: '🟢 High Confidence' },
    Medium: { cls: 'badge-medium', label: '🟡 Medium Confidence' },
    Low:    { cls: 'badge-low',    label: '🔴 Low Confidence' },
    None:   { cls: 'badge-none',   label: '⚪ No Result' },
  };
  const { cls, label } = map[confidence] || map.None;
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

// ── Source Citation Card ───────────────────────────────────────────────────
function SourceCard({ source, index }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div
      className="rounded-xl p-3 cursor-pointer transition-all duration-200"
      style={{
        background: 'rgba(17,24,39,0.7)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--gradient-accent)' }}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{source.title}</p>
            {source.similarity !== undefined && (
              <p className="text-xs text-teal-400">
                {Math.round(source.similarity * 100)}% relevant
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          size={14}
          className="text-gray-400 shrink-0 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>
      {expanded && source.chunk && (
        <p className="text-xs text-gray-400 mt-3 leading-relaxed border-t border-gray-700 pt-3">
          {source.chunk}
        </p>
      )}
    </div>
  );
}

// ── Chat Message ───────────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-4 fade-in-up">
        <div className="chat-bubble-user text-sm">{msg.content}</div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex justify-start mb-6 fade-in-up">
      <div className="max-w-full w-full">
        <div className="chat-bubble-ai mb-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="p-1.5 rounded-lg"
              style={{ background: 'var(--gradient-accent)' }}
            >
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-indigo-300">BookIntel AI</span>
            {msg.confidence && (
              <ConfidenceBadge confidence={msg.confidence} />
            )}
          </div>

          {/* Answer text */}
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </p>
        </div>

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="ml-0">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1 uppercase tracking-wide font-semibold">
              <LinkIcon size={10} />
              Sources ({msg.sources.length})
            </p>
            <div className="flex flex-col gap-2">
              {msg.sources.map((src, i) => (
                <SourceCard key={i} source={src} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sample Questions ───────────────────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  "What mystery books do you have in the collection?",
  "Which book has the highest rating?",
  "Tell me about science fiction books available.",
  "What are the best romance novels in the library?",
  "Which books are good for young adults?",
];

// ── Main Component ─────────────────────────────────────────────────────────
export default function QnAPage() {
  const [messages, setMessages] = React.useState([
    {
      role: 'ai',
      content:
        "Hello! I'm BookIntel AI, your intelligent book assistant. I can answer questions about any books in the library using our RAG pipeline. Try asking about genres, authors, recommendations, or specific book details!",
      confidence: null,
      sources: [],
    },
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const chatEndRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/books/ask_question/`, { question: q });
      const data = res.data;
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: data.answer,
          confidence: data.confidence,
          sources: data.sources || [],
          citations: data.citations || [],
          contextUsed: data.context_used,
        },
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to get answer. Is the backend running?';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `Error: ${msg}`,
          confidence: 'None',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  return (
    <div className="pt-20 pb-6 px-4 max-w-4xl mx-auto flex flex-col" style={{ minHeight: '100vh' }}>
      {/* ── Header ───────────────────────────────── */}
      <div className="text-center mb-8 fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div
            className="p-3 rounded-2xl"
            style={{ background: 'var(--gradient-accent)' }}
          >
            <MessageSquare size={24} className="text-white" />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-extrabold"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            <span className="gradient-text">Ask</span>
            <span className="text-white"> BookIntel AI</span>
          </h1>
        </div>
        <p className="text-gray-400 text-sm max-w-lg mx-auto">
          Powered by RAG — questions are answered using semantic search across your book library and an LLM.
        </p>
      </div>

      {/* ── Sample questions ─────────────────────── */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
          <Lightbulb size={11} />
          Sample Questions
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendQuestion(q)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-xl transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'rgba(99,102,241,0.12)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat Area ────────────────────────────── */}
      <div
        className="flex-1 glass-card p-5 mb-4 scrollable"
        style={{ minHeight: '400px', maxHeight: '60vh', overflowY: 'auto' }}
      >
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} />
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start mb-4 fade-in-up">
            <div className="chat-bubble-ai flex items-center gap-2">
              <Loader size={14} className="text-indigo-400 animate-spin" />
              <span className="text-sm text-gray-400">Thinking…</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Error banner ─────────────────────────── */}
      {error && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl mb-3 text-sm fade-in-up"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span className="text-red-300">{error}</span>
        </div>
      )}

      {/* ── Input Row ────────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <BookOpen
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the books… (Enter to send)"
            rows={1}
            className="input-field pl-9 pr-4 resize-none"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={() => sendQuestion()}
          disabled={loading || !input.trim()}
          className="btn-glow px-5 py-3 flex items-center gap-2 text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? 'Sending' : 'Send'}
        </button>
      </div>

      <p className="text-center text-xs text-gray-600 mt-3">
        Answers are generated from your book library using RAG · Sources shown below each answer
      </p>
    </div>
  );
}
