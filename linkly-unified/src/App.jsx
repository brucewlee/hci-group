import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GlobalNav } from './components/GlobalNav.jsx';
import { Landing } from './pages/Landing.jsx';
import { Library } from './pages/Library.jsx';
import { Upload } from './pages/Upload.jsx';
import { PaperViewerPage } from './pages/PaperViewerPage.jsx';
import { GraphView } from './pages/GraphView.jsx';
import { SearchResults } from './pages/SearchResults.jsx';
import { usePaperStore } from './hooks/usePaperStore.js';

function App() {
  const { papers, setPapers, addPaper, updatePaper, deletePaper } = usePaperStore();

  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <GlobalNav />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Landing papers={papers} />} />
            <Route path="/library" element={<Library papers={papers} deletePaper={deletePaper} />} />
            <Route path="/upload" element={<Upload addPaper={addPaper} />} />
            <Route path="/paper/:paperId" element={<PaperViewerPage papers={papers} updatePaper={updatePaper} />} />
            <Route path="/graph" element={<GraphView papers={papers} setPapers={setPapers} tags={Array.from(new Set(papers.flatMap(p => p.tags || [])))} />} />
            <Route path="/search" element={<SearchResults papers={papers} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
