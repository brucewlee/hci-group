export function PaperCard({ paper, onOpen, onDelete }) {
  const handleCardKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      className="card paper-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleCardKeyDown}
    >
      <div className="paper-card-title">{paper.title || 'Untitled Paper'}</div>
      <div className="paper-card-meta">
        {paper.authors && <span>{paper.authors}</span>}
        {paper.year && <span> • {paper.year}</span>}
      </div>
      {paper.abstract && (
        <div className="paper-card-abstract">{paper.abstract}</div>
      )}
      {paper.tags && paper.tags.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {paper.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {paper.tags.length > 3 && (
            <span className="tag">+{paper.tags.length - 3}</span>
          )}
        </div>
      )}
      <div className="paper-card-actions">
        <button
          className="btn btn-primary btn-small"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          Open
        </button>
        <button
          className="btn btn-danger btn-small"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
