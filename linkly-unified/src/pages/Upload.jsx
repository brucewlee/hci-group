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

  const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const fetchArxivPdf = async (id) => {
    const pdfUrls = [
      `https://arxiv.org/pdf/${id}.pdf`,
      `https://arxiv.org/pdf/${id}`,
      `https://export.arxiv.org/pdf/${id}.pdf`,
      `https://corsproxy.io/?${encodeURIComponent(`https://arxiv.org/pdf/${id}.pdf`)}`,
    ];
    for (const url of pdfUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        if (blob.type && !blob.type.includes('pdf') && blob.size < 1000) continue;
        return await blobToDataURL(blob);
      } catch {
        // try next
      }
    }
    return null;
  };

  const fetchSemanticScholar = async (id) => {
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/ARXIV:${id}?fields=title,authors,abstract,year`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title || '',
        authors: (data.authors || []).map((a) => a.name).join(', '),
        abstract: data.abstract || '',
        year: data.year ? String(data.year) : '',
      };
    } catch {
      return null;
    }
  };

  const fetchArxivApi = async (id) => {
    const endpoints = [
      `https://export.arxiv.org/api/query?id_list=${id}`,
      `https://corsproxy.io/?${encodeURIComponent(`https://export.arxiv.org/api/query?id_list=${id}`)}`,
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const xml = await res.text();
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const entry = doc.querySelector('entry');
        if (!entry) continue;
        const title = entry.querySelector('title')?.textContent?.trim() || '';
        const summary = entry.querySelector('summary')?.textContent?.trim() || '';
        const published = entry.querySelector('published')?.textContent || '';
        const authors = Array.from(entry.querySelectorAll('author > name'))
          .map((n) => n.textContent.trim())
          .join(', ');
        return {
          title: title.replace(/\s+/g, ' '),
          authors,
          abstract: summary.replace(/\s+/g, ' '),
          year: published.slice(0, 4),
        };
      } catch {
        // try next
      }
    }
    return null;
  };

  const fetchArxivMeta = async () => {
    if (!arxiv.trim()) return;
    const match = arxiv.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
    if (!match) return;
    const id = match[1];

    setArxivLoading(true);
    try {
      const [ss, ax, pdfData] = await Promise.all([
        fetchSemanticScholar(id),
        fetchArxivApi(id),
        fetchArxivPdf(id),
      ]);

      const meta = {
        title: ss?.title || ax?.title || '',
        authors: ss?.authors || ax?.authors || '',
        abstract: ss?.abstract || ax?.abstract || '',
        year: ss?.year || ax?.year || '',
      };

      if (meta.title) setTitle(meta.title);
      if (meta.authors) setAuthors(meta.authors);
      if (meta.abstract) setAbstract(meta.abstract);
      if (meta.year) setYear(meta.year);

      if (pdfData) {
        setFileData(pdfData);
      } else {
        console.warn('Could not fetch PDF from arXiv — please upload manually.');
      }
    } catch (err) {
      console.error('arXiv fetch failed:', err);
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
          <label className="form-label">
            PDF File {fileData ? '✓' : '*'}
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Upload a PDF, or paste an arXiv link below and click Fetch to auto-load it.
          </div>
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
