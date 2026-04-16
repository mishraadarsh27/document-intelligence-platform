import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Library, Cpu, BarChart3, Settings, 
  Sparkles, Plus, Moon, Sun, Monitor
} from 'lucide-react';

const icons = [
  { icon: Library, label: 'Collection', path: '/' },
  { icon: BarChart3, label: 'Insights', path: '/insights' },
  { icon: Cpu, label: 'AI Workspace', path: '/ai' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = React.useState('light');

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    // Real theme switching logic can be injected here
    document.documentElement.classList.toggle('dark-mode');
  };

  return (
    <div className="w-[72px] h-full flex flex-col items-center py-6 border-r border-slate-100 bg-white transition-all duration-300">
      
      {/* Top Section: Logo & Action */}
      <div className="flex flex-col items-center gap-6 mb-10">
        <button 
          onClick={() => navigate('/')}
          className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
        >
          <Sparkles size={22} className="text-white" />
        </button>
        
        {/* Quick Action: Import Trigger */}
        <button 
          title="Manual Import"
          className="w-10 h-10 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all shadow-sm"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Mid Section: Primary Navigation */}
      <div className="flex-1 space-y-4">
        {icons.map(({ icon: Icon, label, path }) => (
          <button
            key={label}
            onClick={() => navigate(path)}
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${
              location.pathname === path
                ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={20} strokeWidth={location.pathname === path ? 2.5 : 2} />
            
            {/* Context Tooltip */}
            <div className="absolute left-16 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all pointer-events-none uppercase tracking-[0.1em] whitespace-nowrap z-50 shadow-xl">
              {label}
            </div>

            {/* Active Anchor */}
            {location.pathname === path && (
              <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-600 rounded-r-full"></div>
            )}
          </button>
        ))}
      </div>

      {/* Bottom Section: System Controls */}
      <div className="flex flex-col items-center gap-5 mt-auto">
        
        {/* Theme Toggle Button - Functional */}
        <button 
          onClick={toggleTheme}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-800 transition-all"
          title="Toggle Theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className="w-8 h-px bg-slate-100"></div>

        {/* Profile / System status */}
        <button className="w-11 h-11 rounded-2xl border-2 border-white bg-slate-50 p-0.5 overflow-hidden hover:border-indigo-500 transition-all shadow-sm ring-1 ring-slate-100">
           <img 
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky" 
            alt="avatar" 
            className="w-full h-full rounded-xl grayscale hover:grayscale-0 transition-all"
          />
        </button>

        <button className="flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors">
           <Settings size={18} />
        </button>
      </div>

    </div>
  );
}
