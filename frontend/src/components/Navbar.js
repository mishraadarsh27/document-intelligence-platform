import React from 'react';
import { Search, Command, Zap, Bell, PanelRightClose, PanelRightOpen } from 'lucide-react';

export default function Navbar({ onToggleDrawer, drawerOpen }) {
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <nav className="h-20 bg-white border-b border-slate-100 flex items-center shrink-0">
      <div className="content-wrap w-full flex items-center justify-between">
        
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">
             Workspace
          </h1>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Neural Live</span>
          </div>
        </div>

        <div className="flex-1 max-w-xl px-12">
          <div className="search-pill flex items-center h-11 px-4 cursor-text" onClick={() => inputRef.current?.focus()}>
            <Search size={16} className="text-slate-400 mr-3" />
            <input 
              ref={inputRef}
              type="text" 
              placeholder="Search Intelligence..."
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
            />
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
              <Command size={10} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400">K</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleDrawer}
            className={`p-2 rounded-xl transition-all flex items-center gap-2 ${
              drawerOpen ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'
            }`}
            title={drawerOpen ? "Hide AI Workspace" : "Show AI Workspace"}
          >
            {drawerOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
            <span className="text-[10px] font-bold uppercase hidden sm:inline">{drawerOpen ? 'Hide AI' : 'Show AI'}</span>
          </button>
          
          <div className="h-6 w-px bg-slate-100 mx-1"></div>

          <button className="p-2 text-slate-400 hover:text-indigo-500 transition-colors">
            <Zap size={20} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
            <Bell size={20} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white"></div>
          </button>
        </div>

      </div>
    </nav>
  );
}
