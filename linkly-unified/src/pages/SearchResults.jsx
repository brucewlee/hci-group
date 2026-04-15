import { useSearch } from '../hooks/useSearch.js';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

export function SearchResults({ papers }) {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const results = useSearch(papers, query);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Search Results</h1>
        <p className="page-subtitle">
          {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
        </p>
      </div>

      {results.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {results.map((result, idx) => (
            <div key={idx} className="card">
              {result.type === 'paper' && (
                <Link to={`/paper/${result.paperId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ cursor: 'pointer' }}>
                    <div className="paper-card-title">{result.title}</div>
                    <div className="paper-card-meta">{result.authors}</div>
                    {result.preview && (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '8px 0' }}>
                        {result.preview}...
                      </p>
                    )}
                  </div>
                </Link>
              )}

              {result.type === 'glossary' && (
                <Link to={`/paper/${result.paperId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ cursor: 'pointer' }}>
                    <div className="paper-card-title">Glossary: {result.term}</div>
                    <div className="paper-card-meta">{result.paperTitle}</div>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '8px 0' }}>
                      {result.definition}
                    </p>
                  </div>
                </Link>
              )}

              {result.type === 'note' && (
                <Link to={`/paper/${result.paperId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ cursor: 'pointer' }}>
                    <div className="paper-card-title">Note: {result.paperTitle}</div>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '8px 0' }}>
                      {result.preview}...
                    </p>
                  </div>
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            No results found for "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
