import { useNavigate } from 'react-router-dom';
import { PaperCard } from '../components/PaperCard.jsx';

export function Library({ papers, deletePaper }) {
  const navigate = useNavigate();

  const handleOpen = (paperId) => {
    navigate(`/paper/${paperId}`);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Paper Library</h1>
        <p className="page-subtitle">
          {papers.length} paper{papers.length !== 1 ? 's' : ''} in your collection
        </p>
      </div>

      {papers.length > 0 ? (
        <div className="paper-grid">
          {papers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              onOpen={() => handleOpen(paper.id)}
              onDelete={() => {
                if (confirm(`Delete "${paper.title}"?`)) {
                  deletePaper(paper.id);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            No papers yet. <a href="/upload" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Upload a paper</a> to begin.
          </p>
        </div>
      )}
    </div>
  );
}
