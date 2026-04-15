import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

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

  return (
    <nav className="global-nav">
      <Link to="/" className="nav-logo">Linkly</Link>
      
      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`}>Dashboard</Link>
        <Link to="/library" className={`nav-link ${isActive('/library')}`}>Library</Link>
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
