import React from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Sparkles, Clock, Settings2, ArrowRight, BrainCircuit, Library, Briefcase, RefreshCw, AlertCircle
} from 'lucide-react';

const API = 'http://localhost:8000/api';

function BookCard({ book, sizeClass = "bento-1x1" }) {
  const aiRank = (book.rating * 20).toFixed(0);
  const readingTime = Math.floor(Math.random() * 8) + 4;

  return (
    <Link 
      to={`/books/${book.id}`} 
      className={`surface-card group flex flex-col ${sizeClass}`}
    >
      <div className="relative flex-1 overflow-hidden">
        {book.cover_image_url ? (
          <img 
            src={book.cover_image_url} 
            alt={book.title} 
            className="w-full h-full object-cover grayscale-[0.2] transition-all duration-700 group-hover:grayscale-0 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-slate-50 flex items-center justify-center">
            <Library size={48} className="text-slate-200" />
          </div>
        )}
        
        <div className="absolute top-4 left-4 flex gap-2">
           <div className="px-3 py-1 bg-white/95 rounded-xl shadow-sm border border-slate-100 flex items-center gap-1.5">
              <BrainCircuit size={10} className="text-indigo-500" />
              <span className="mono text-[9px] font-bold text-slate-800 uppercase tracking-widest">AI Rank #{aiRank}</span>
           </div>
        </div>
        
        <div className="absolute top-4 right-4">
           <div className="px-3 py-1 bg-slate-900/90 rounded-xl text-white border border-white/10 flex items-center gap-1.5">
              <Clock size={10} className="text-indigo-300" />
              <span className="mono text-[9px] font-bold uppercase">{readingTime}hr Index</span>
           </div>
        </div>
      </div>

      <div className="p-6">
        <h3 className="heading-serif text-lg font-bold text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
          {book.title}
        </h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-4 truncate text-mono"> 
          {book.author || 'Author Unknown'}
        </p>
        
        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
           <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Neural Synced</span>
           </div>
           <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300 uppercase italic transition-all group-hover:text-indigo-500">
              Insight <ArrowRight size={10} />
           </div>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [books, setBooks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [scraping, setScraping] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchBooks = React.useCallback(async () => {
    try {
      const res = await axios.get(`${API}/books/`);
      setBooks(res.data.results || res.data || []);
    } catch (err) {
      setError("Archive connectivity issue. Check backend status.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const startScrape = async () => {
    if (scraping) return;
    setScraping(true);
    setError(null);
    try {
      await axios.post(`${API}/books/scrape_books/`);
      fetchBooks();
    } catch (err) {
      setError("Scrape pipeline failed. Check engine logs.");
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="content-wrap py-12">
      
      {/* Strategic Welcome - Wire up the Data Pipeline button */}
      <section className="flex items-end justify-between mb-16 px-1">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-6">
             <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><Sparkles size={16} /></div>
             <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em]">Platform Intelligence v4.0</span>
          </div>
          <h2 className="text-5xl font-extrabold text-slate-800 leading-tight mb-4 tracking-tighter">
            Architect your <br /> <span className="text-indigo-500">Document Strategy.</span>
          </h2>
          <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-md">
            Advanced neural workspace for enterprise-level document intelligence and semantic extraction.
          </p>
        </div>

        <div className="flex flex-col gap-4 items-end">
           <div className="flex items-center gap-3">
              <button 
                onClick={startScrape}
                disabled={scraping}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                 {scraping ? <RefreshCw className="animate-spin" size={14} /> : <Briefcase size={14} />}
                 {scraping ? 'Syncing...' : 'Data Pipeline'}
              </button>
              <button 
                onClick={() => fetchBooks()}
                className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-500 transition-all shadow-sm"
              >
                 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
           </div>
           
           {error && (
             <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
               <AlertCircle size={12} /> {error}
             </div>
           )}

           <div className="flex items-center gap-2 group cursor-pointer">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-indigo-500 transition-colors">Neural Hub Connectivity</span>
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></div>
           </div>
        </div>
      </section>

      {/* Analytics Bar */}
      <section className="grid grid-cols-4 gap-6 mb-16">
        {[
          { label: 'Books Index', val: books.length, sub: 'Total Archive' },
          { label: 'Cloud Sync', val: books.length > 0 ? 'UP' : 'INIT', sub: 'Neural Engine' },
          { label: 'Latency', val: '12ms', sub: 'RAG Pipeline' },
          { label: 'Processing', val: '2k+', sub: 'Words/Min' }
        ].map((s, i) => (
          <div key={i} className="surface-card p-6 flex flex-col justify-between border-slate-50">
            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4">{s.label}</div>
            <div>
               <div className="text-2xl font-black text-slate-800">{s.val}</div>
               <div className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tight">{s.sub}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Archive Bento Grid */}
      <section>
        <div className="flex items-center gap-4 mb-8">
           <h3 className="heading-serif text-2xl font-bold text-slate-800">Knowledge Archive</h3>
           <div className="h-px flex-1 bg-slate-100"></div>
           <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Global Persistence</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {loading ? (
             [1,2,3,4,5,6,7,8].map(i => <div key={i} className="surface-card h-80 animate-pulse bg-slate-50 rounded-2xl"></div>)
          ) : books.length === 0 ? (
            <div className="col-span-full surface-card flex items-center justify-center border-dashed bg-slate-50 border-slate-200 p-12">
               <div className="text-center">
                  <Library size={56} className="text-slate-200 mx-auto mb-6" />
                  <div className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Memory Archive Empty</div>
                  <button 
                    onClick={startScrape}
                    className="mt-6 px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mx-auto hover:bg-slate-50 transition-all shadow-sm"
                  >
                     Run Scraping Engine <ArrowRight size={10} />
                  </button>
               </div>
            </div>
          ) : (
            books.map((book) => (
              <BookCard key={book.id} book={book} sizeClass="h-[420px]" />
            ))
          )}
        </div>

      </section>

    </div>
  );
}
