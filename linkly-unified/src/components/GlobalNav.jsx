import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

const LAST_VIEWED_PAPER_CONTEXT_KEY = 'linkly:last-viewed-paper-context';

export function GlobalNav() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  const handleLibraryClick = (event) => {
    if (location.pathname === '/library') {
      return;
    }

    let lastViewedPaperContext = null;

    try {
      lastViewedPaperContext = JSON.parse(
        window.localStorage.getItem(LAST_VIEWED_PAPER_CONTEXT_KEY) || 'null',
      );
    } catch {
      lastViewedPaperContext = null;
    }

    if (!lastViewedPaperContext?.paperId) {
      return;
    }

    event.preventDefault();
    navigate(`/paper/${lastViewedPaperContext.paperId}`, {
      state: {
        activeTab: lastViewedPaperContext.activeTab || 'graph',
      },
    });
  };

  return (
    <nav className="global-nav">
      <Link to="/" className="nav-logo">Linkly</Link>
      
      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`}>Dashboard</Link>
        <Link
          to="/library"
          className={`nav-link ${isActive('/library')}`}
          onClick={handleLibraryClick}
        >
          Library
        </Link>
        <Link to="/graph" className={`nav-link ${isActive('/graph')}`}>Graph</Link>
      </div>

      <form className="nav-search" onSubmit={handleSearch}>
        <input
          type="text"
          className="search-input"
          placeholder="Search papers, terms, notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      <Link to="/upload" className="btn btn-primary btn-small">
        + Upload Paper
      </Link>
    </nav>
  );
}
