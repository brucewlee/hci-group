import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

export function GlobalNav({ onResetLibrary, paperCount = 0 }) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleReset = () => {
    if (!onResetLibrary) return;
    const ok = window.confirm(
      `Reset library? This will permanently delete all ${paperCount} paper${paperCount === 1 ? '' : 's'}, their PDFs, annotations, tags, and graph edges. This cannot be undone.`
    );
    if (!ok) return;
    onResetLibrary();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  /* clicking a nav tab always routes to that section's home, even if already there */
  const navigateTo = (path) => (event) => {
    event.preventDefault();
    navigate(path);
  };

  return (
    <nav className="global-nav">
      <Link to="/" className="nav-logo" onClick={navigateTo('/')}>Linkly</Link>

      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`} onClick={navigateTo('/')}>Dashboard</Link>
        <Link
          to="/library"
          className={`nav-link ${isActive('/library')}`}
          onClick={navigateTo('/library')}
        >
          Library
        </Link>
        <Link to="/graph" className={`nav-link ${isActive('/graph')}`} onClick={navigateTo('/graph')}>Graph</Link>
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
      {onResetLibrary && paperCount > 0 && (
        <button
          type="button"
          className="btn btn-danger btn-small"
          onClick={handleReset}
          style={{ marginLeft: 8 }}
          title="Delete all papers and start fresh"
        >
          Reset
        </button>
      )}
    </nav>
  );
}
