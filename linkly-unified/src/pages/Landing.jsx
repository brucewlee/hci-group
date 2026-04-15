import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faShareNodes, faCloudArrowUp } from '@fortawesome/free-solid-svg-icons';

export function Landing({ papers }) {
  const recentPapers = papers.slice(0, 3);

  return (
    <div className="page-wrapper">
      <section className="page-header" style={{ marginTop: '48px', marginBottom: '48px', textAlign: 'center' }}>
        <h1 className="page-title">Welcome to Linkly</h1>
        <p className="page-subtitle">
          Organize your research papers with AI-powered knowledge graphs, annotations, and intelligent search.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <Link to="/upload" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ height: '100%', textAlign: 'center', cursor: 'pointer', paddingTop: '32px', paddingBottom: '32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                <FontAwesomeIcon icon={faCloudArrowUp} color="var(--color-primary)" />
              </div>
              <h3 style={{ marginBottom: '8px' }}>Upload Paper</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Add a new research paper and provide metadata
              </p>
            </div>
          </Link>

          <Link to="/library" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ height: '100%', textAlign: 'center', cursor: 'pointer', paddingTop: '32px', paddingBottom: '32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                <FontAwesomeIcon icon={faBookOpen} color="var(--color-primary)" />
              </div>
              <h3 style={{ marginBottom: '8px' }}>Paper Library</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Browse and organize all your papers
              </p>
            </div>
          </Link>

          <Link to="/graph" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ height: '100%', textAlign: 'center', cursor: 'pointer', paddingTop: '32px', paddingBottom: '32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                <FontAwesomeIcon icon={faShareNodes} color="var(--color-primary)" />
              </div>
              <h3 style={{ marginBottom: '8px' }}>Knowledge Graph</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Visualize citation relationships
              </p>
            </div>
          </Link>
        </div>
      </section>

      {recentPapers.length > 0 && (
        <section>
          <h2 style={{ marginBottom: '16px' }}>Recent Papers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {recentPapers.map((paper) => (
              <Link key={paper.id} to={`/paper/${paper.id}`} style={{ textDecoration: 'none' }}>
                <div className="card paper-card">
                  <div className="paper-card-title">{paper.title || 'Untitled'}</div>
                  <div className="paper-card-meta">{paper.year}</div>
                  {paper.abstract && (
                    <div className="paper-card-abstract">{paper.abstract.slice(0, 80)}...</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {papers.length === 0 && (
        <section style={{ textAlign: 'center', marginTop: '48px' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            No papers yet. <Link to="/upload" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Upload your first paper</Link> to get started.
          </p>
        </section>
      )}
    </div>
  );
}
