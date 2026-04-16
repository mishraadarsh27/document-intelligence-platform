import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import BookDetailPage from './pages/BookDetailPage';
import QnASidebar from './components/QnASidebar';

// Placeholder for missing pages to avoid white screens
const InsightsPage = () => (
  <div className="content-wrap py-20 text-center">
    <h2 className="heading-serif text-4xl mb-4 text-slate-800">Library Insights</h2>
    <p className="text-slate-500 max-w-md mx-auto">This section is being synchronized with the neural vector store. Advanced statistics on genre distribution and reader engagement will appear here.</p>
  </div>
);

const AIWorkspacePage = () => (
  <div className="content-wrap py-20 text-center">
    <h2 className="heading-serif text-4xl mb-4 text-slate-800">AI Global Lab</h2>
    <p className="text-slate-500 max-w-md mx-auto">Access global model parameters and specialized RAG tuning here. Currently, operations are focused in the sidebar workspace.</p>
  </div>
);

function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(true);

  return (
    <Router>
      <div className="main-grid bg-white">
        
        {/* Pane 1: Mini-Nav */}
        <Sidebar />

        {/* Pane 2: Primary Content Engine */}
        <div className="flex flex-col h-full bg-canvas/30 overflow-hidden relative border-r border-slate-100">
          <Navbar 
            onToggleDrawer={() => setDrawerOpen(!drawerOpen)} 
            drawerOpen={drawerOpen} 
          />
          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/"            element={<DashboardPage />} />
              <Route path="/books/:id"   element={<BookDetailPage />} />
              <Route path="/insights"    element={<InsightsPage />} />
              <Route path="/ai"          element={<AIWorkspacePage />} />
            </Routes>
          </div>
        </div>

        {/* Pane 3: AI Workspace - Collapsible */}
        <div 
          className={`h-full bg-white transition-all duration-300 overflow-hidden ${
            drawerOpen ? 'w-[400px] visible' : 'w-0 invisible'
          }`}
        >
          <div className="w-[400px] h-full flex flex-col"> {/* Fixed width and height inner container */}
            <QnASidebar />
          </div>

        </div>

      </div>
    </Router>
  );
}

export default App;
