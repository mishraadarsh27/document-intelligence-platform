import React from 'react';
import axios from 'axios';
import { 
  Send, Sparkles, Loader, ChevronRight, 
  CornerDownRight, ExternalLink, Code2, Database
} from 'lucide-react';

const API = 'http://localhost:8000/api';

export default function QnASidebar() {
  const [messages, setMessages] = React.useState([
    { 
      role: 'ai', 
      content: 'Neural engine initialized. Ready for semantic queries across your library.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const chatEndRef = React.useRef(null);

  React.useEffect(() => {
    const scrollToBottom = () => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    // Small timeout to ensure the DOM has updated with the wrapped text height
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, loading]);


  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/books/ask_question/`, { question: q });
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: res.data.answer, 
        sources: res.data.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: 'Engine offline. Please verify the backend connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Workspace Header */}
      <div className="p-8 pb-4">
        <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 rounded-lg">
                 <Sparkles size={16} className="text-indigo-500" />
              </div>
              <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">Neural Workspace</h3>
           </div>
           <div className="status-pill online">Active</div>
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1.5 ml-1">
           <Database size={10} /> Vector Store: Persisted
        </div>
      </div>

      {/* Threaded Chat */}
      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-8">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-2 px-1">
               <span className="mono text-[8px] font-bold text-slate-300 uppercase tracking-widest">{msg.role}</span>
               <span className="mono text-[8px] font-bold text-slate-300 uppercase tracking-widest opacity-50">{msg.timestamp}</span>
            </div>
            
            <div className={`p-5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-100' 
                : 'bg-white border border-slate-100 text-slate-600 shadow-sm'
            }`}>
              {/* Parse content for code blocks simple mock */}
              {msg.content.includes('```') ? (
                <div className="space-y-3">
                   <p>{msg.content.split('```')[0]}</p>
                   <pre className="rounded-xl overflow-hidden">
                      <code className="text-[11px] block">{msg.content.split('```')[1]}</code>
                   </pre>
                </div>
              ) : (
                msg.content
              )}

              {/* Citations */}
              {msg.sources?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                   <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <CornerDownRight size={10} /> Data Points
                   </div>
                   {msg.sources.map((s, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => window.location.href = `/books/${s.book_id}`}
                        className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg group cursor-pointer hover:bg-indigo-50 transition-colors"
                      >
                         <span className="text-[10px] font-bold text-slate-500 truncate group-hover:text-indigo-600 transition-colors">{s.title}</span>
                         <ExternalLink size={10} className="text-slate-300 shrink-0" />
                      </div>
                   ))}

                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="mono text-[8px] font-bold text-slate-300 uppercase px-1 mb-2">Neural Link...</div>
            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-3">
               <Loader size={14} className="animate-spin text-indigo-400" />
               <span className="text-xs text-slate-400 font-medium">Synthesizing Answer...</span>
            </div>
          </div>
        )}
        {/* Invisible anchor for scrolling */}
        <div ref={chatEndRef} className="pb-4" />
      </div>


      {/* Workspace Controls */}
      <div className="p-8 pt-4">
        <div className="relative neural-search p-1.5 rounded-2xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Search engine knowledge..."
            rows={1}
            className="w-full bg-transparent p-3 pr-12 text-sm font-medium text-slate-700 outline-none resize-none"
          />
          <button 
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-slate-800 text-white rounded-xl flex items-center justify-center hover:bg-slate-700 transition-all disabled:opacity-50 disabled:grayscale"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between text-[8px] font-black text-slate-300 uppercase tracking-widest px-1">
           <div className="flex items-center gap-1.5">
              <Code2 size={10} /> Code Integration: ON
           </div>
           <div>Semantic Retrieval v1.2</div>
        </div>
      </div>
    </div>
  );
}
