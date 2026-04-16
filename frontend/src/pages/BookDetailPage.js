import React from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Star, ExternalLink, Bookmark, Share2, 
  Lightbulb, FileText, BarChart, BookOpen, Clock,
  Sparkles, ChevronRight
} from 'lucide-react';

const API = 'http://localhost:8000/api';

export default function BookDetailPage() {
  const { id } = useParams();
  const [book, setBook] = React.useState(null);
  const [recommendations, setRecommendations] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookRes, recRes] = await Promise.all([
          axios.get(`${API}/books/${id}/`),
          axios.get(`${API}/books/${id}/recommend/`)
        ]);
        setBook(bookRes.data);
        setRecommendations(recRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return (
    <div className="pt-32 px-12 animate-pulse mb-20">
      <div className="max-w-6xl mx-auto">
        <div className="h-96 bg-slate-50 rounded-[40px] mb-8"></div>
        <div className="space-y-4">
          <div className="h-10 bg-slate-50 w-2/3 rounded-xl"></div>
          <div className="h-6 bg-slate-50 w-1/3 rounded-xl"></div>
        </div>
      </div>
    </div>
  );

  if (!book) return null;

  const sentimentLabel = (book.sentiment_score > 0.3) ? "Positive" : (book.sentiment_score < -0.3) ? "Negative" : "Neutral";
  const sentimentColor = (book.sentiment_score > 0.3) ? "text-emerald-500" : (book.sentiment_score < -0.3) ? "text-rose-500" : "text-amber-500";

  return (
    <div className="pt-28 pb-32 px-4 md:px-12 max-w-6xl mx-auto">
      <div className="mb-10 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors uppercase tracking-widest">
          <ArrowLeft size={16} /> Back to Library
        </Link>
        <div className="flex gap-3">
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-500 hover:border-indigo-100 transition-all shadow-sm">
            <Bookmark size={20} />
          </button>
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-500 hover:border-indigo-100 transition-all shadow-sm">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20">
        {/* Left: Book Profile */}
        <div className="lg:col-span-4 flex flex-col gap-8 sticky top-28">
           <div className="relative group">
              <div className="absolute -inset-4 bg-indigo-50 rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity blur-2xl"></div>
              <div className="relative rounded-[32px] overflow-hidden shadow-2xl border-4 border-white">
                {book.cover_image_url ? (
                  <img src={book.cover_image_url} alt={book.title} className="w-full object-cover" />
                ) : (
                  <div className="aspect-[3/4] bg-slate-50 flex items-center justify-center">
                    <BookOpen size={64} className="text-slate-100" />
                  </div>
                )}
              </div>
           </div>

           <div className="premium-card p-6 divide-y divide-slate-50">
              <div className="pb-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Status</div>
                  <div className="flex items-center gap-2">
                    <div className="status-dot active"></div>
                    <span className="text-xs font-bold text-slate-600">AI Indexed</span>
                  </div>
                </div>
                <div className="text-right">
                   <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Rating</div>
                   <div className="flex items-center gap-1">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-slate-700">{book.rating || 'N/A'}</span>
                   </div>
                </div>
              </div>
              <div className="py-4 space-y-3">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-tight">Author</span>
                    <span className="text-slate-800 font-bold truncate max-w-[150px]">{book.author || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-tight">Genre</span>
                    <span className="text-indigo-600 font-bold px-2 py-0.5 bg-indigo-50 rounded-lg">{book.genre || 'Unclassified'}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-tight">ISBN</span>
                    <span className="text-slate-800 font-mono text-[10px] font-bold">{book.isbn || 'N/A'}</span>
                 </div>
              </div>
              <div className="pt-4 text-center">
                 <a 
                   href={book.book_url} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                 >
                   Open Original <ExternalLink size={14} />
                 </a>
              </div>
           </div>
        </div>

        {/* Right: Insights */}
        <div className="lg:col-span-8 flex flex-col gap-10">
           <header>
              <div className="flex flex-wrap gap-2 mb-6">
                 {['Advanced Analysis', 'Vector Store Active', 'Full RAG Enabled'].map(t => (
                   <span key={t} className="pill-tag text-[9px] uppercase tracking-widest flex items-center gap-1.5 font-black">
                     <Clock size={10} className="text-indigo-400" /> {t}
                   </span>
                 ))}
              </div>
              <h1 className="text-5xl font-extrabold text-slate-800 mb-4 leading-tight">
                {book.title}
              </h1>
              <p className="text-xl text-slate-400 font-medium">Authorised edition by {book.author || 'Unknown Author'}</p>
           </header>

           {/* Tabs-like layout for Details */}
           <section className="space-y-8">
              <div className="flex items-center gap-2 text-slate-800 font-black uppercase tracking-widest text-[11px] border-b border-slate-100 pb-3">
                <Lightbulb size={14} className="text-indigo-500" /> Contextual AI Summary
              </div>
              <div className="premium-card p-8 bg-indigo-50/30 border-indigo-100 border-dashed">
                <p className="text-slate-600 text-lg leading-relaxed font-medium serif">
                  {book.summary || "Generating advanced summary... Please check back in a few moments as our AI workspace indexes this title across the neural vector store."}
                </p>
                {book.summary && (
                  <div className="mt-6 flex items-center gap-4 text-xs font-bold text-indigo-400 uppercase tracking-widest">
                    <div className="flex -space-x-1.5">
                      {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border border-white bg-indigo-100"></div>)}
                    </div>
                    Verified by AI Logic
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-800 font-black uppercase tracking-widest text-[11px] border-b border-slate-100 pb-3">
                <FileText size={14} className="text-indigo-500" /> Full Description
              </div>
              <p className="text-slate-500 text-base leading-relaxed font-medium px-2 italic">
                {book.description || "No full description available for this volume."}
              </p>

              <div className="flex items-center gap-2 text-slate-800 font-black uppercase tracking-widest text-[11px] border-b border-slate-100 pb-3">
                <BarChart size={14} className="text-indigo-500" /> Sentiment Analysis Metric
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="premium-card p-6 flex flex-col items-center justify-center gap-4 text-center">
                    <div className={`text-4xl font-black ${sentimentColor}`}>
                       {book.sentiment_score ? (book.sentiment_score * 100).toFixed(0) + '%' : 'N/A'}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emotional Resonance</div>
                      <div className={`text-[11px] font-bold uppercase tracking-tight ${sentimentColor}`}>{sentimentLabel}</div>
                    </div>
                 </div>
                 <div className="premium-card p-6 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="flex gap-1">
                       {[1,2,3,4,5].map(i => <Star key={i} size={24} className={i <= (book.rating || 0) ? 'text-indigo-500 fill-indigo-500' : 'text-slate-100'} />)}
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reader Consensus</div>
                 </div>
              </div>
           </section>
        </div>
      </div>

      {/* Recommendations Section */}
      {recommendations.length > 0 && (
        <section className="pt-20 border-t border-slate-100">
           <div className="flex items-center justify-between mb-10">
              <div>
                 <h2 className="text-3xl font-black text-slate-800 mb-2">You Might Also Like</h2>
                 <p className="text-sm font-medium text-slate-400">Similarity-based recommendations from the neural vector store</p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-xl">
                 <Sparkles size={20} className="text-indigo-500" />
              </div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recommendations.map(reco => (
                <Link key={reco.id} to={`/books/${reco.id}`} className="premium-card overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                  <div className="aspect-[3/4] overflow-hidden relative">
                    <img 
                      src={reco.cover_image_url} 
                      alt={reco.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                       <span className="text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                          Analyze Now <ChevronRight size={10} />
                       </span>
                    </div>
                  </div>
                  <div className="p-4">
                     <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{reco.genre || 'Book'}</div>
                     <h3 className="font-bold text-slate-800 text-sm truncate mb-1">{reco.title}</h3>
                     <p className="text-[11px] font-medium text-slate-400">{reco.author}</p>
                  </div>
                </Link>
              ))}
           </div>
        </section>
      )}
    </div>
  );
}
