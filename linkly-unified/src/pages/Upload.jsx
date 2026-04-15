import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal.jsx';

export function Upload({ addPaper }) {
  const [showModal, setShowModal] = useState(true);
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [abstract, setAbstract] = useState('');
  const [arxiv, setArxiv] = useState('');
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [arxivLoading, setArxivLoading] = useState(false);
  const [fileData, setFileData] = useState(null);

  const navigate = useNavigate();

  const fetchArxivMeta = async () => {
    if (!arxiv.trim()) return;
    const match = arxiv.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
    if (!match) return;

    setArxivLoading(true);
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/ARXIV:${match[1]}?fields=title,authors,abstract,year`
      );
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (data.title) setTitle(data.title);
      if (data.authors?.length) setAuthors(data.authors.map((a) => a.name).join(', '));
      if (data.abstract) setAbstract(data.abstract);
      if (data.year) setYear(String(data.year));
    } catch (err) {
      console.error('Metadata fetch failed:', err);
    } finally {
      setArxivLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => setFileData(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFileData(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !fileData) return;

    const paper = addPaper({
      title: title.trim(),
      authors: authors.trim(),
      year: parseInt(year) || new Date().getFullYear(),
      abstract: abstract.trim(),
      arxiv: arxiv.trim(),
      note: note.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      glossary: [],
      annotations: [],
      file: fileData,
    });

    navigate(`/paper/${paper.id}`);
  };

  if (!showModal) return null;

  return (
    <Modal
      title="Upload Paper"
      onClose={() => {
        setShowModal(false);
        navigate('/library');
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Paper title"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">PDF File *</label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">arXiv Link (optional)</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input
              type="text"
              className="form-input"
              value={arxiv}
              onChange={(e) => setArxiv(e.target.value)}
              placeholder="https://arxiv.org/abs/..."
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={fetchArxivMeta}
              disabled={arxivLoading || !arxiv.trim()}
            >
              {arxivLoading ? 'Loading...' : 'Fetch'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Authors</label>
          <input
            type="text"
            className="form-input"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Author One, Author Two"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Year</label>
          <input
            type="number"
            className="form-input"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2024"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Abstract</label>
          <textarea
            className="form-textarea"
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            placeholder="Paper abstract"
            rows="4"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tags (comma-separated)</label>
          <input
            type="text"
            className="form-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="AI, Control, Safety"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Your notes about this paper..."
            rows="4"
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setShowModal(false);
              navigate('/library');
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || !fileData}>
            Upload Paper
          </button>
        </div>
      </form>
    </Modal>
  );
}
