import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal.jsx';
import { suggestTagsForPaper, buildGraphEdges } from '../utils/ai.js';

/* Cache arXiv metadata lookups in localStorage, keyed by arXiv ID.
   Avoids re-hitting rate-limited APIs when re-testing the same paper. */
const ARXIV_META_CACHE_KEY = 'linkly:arxiv-meta-cache';
const ARXIV_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readArxivMetaCache(id) {
  try {
    const raw = window.localStorage.getItem(ARXIV_META_CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[id];
    if (!entry) return null;
    if (Date.now() - entry.t > ARXIV_CACHE_TTL_MS) return null;
    return entry.meta || null;
  } catch {
    return null;
  }
}

function writeArxivMetaCache(id, meta) {
  try {
    const raw = window.localStorage.getItem(ARXIV_META_CACHE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[id] = { t: Date.now(), meta };
    window.localStorage.setItem(ARXIV_META_CACHE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / serialization errors */
  }
}

function parseArxivIdentifier(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  const stripVersion = (id) => id.replace(/v\d+$/i, '');

  try {
    const url = new URL(trimmed);
    if (!/arxiv\.org$/i.test(url.hostname)) {
      return null;
    }

    const match = url.pathname.match(/^\/(?:abs|pdf)\/([^?#]+?)(?:\.pdf)?$/i);
    return match ? stripVersion(match[1]) : null;
  } catch {
    /* fall through to bare-ID heuristic */
  }

  const bare = trimmed.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/);
  if (bare) return bare[1];
  return null;
}

export function Upload({ addPaper, updatePaper, papers = [] }) {
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
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiMatched, setAiMatched] = useState([]);
  const [aiSuggested, setAiSuggested] = useState([]);
  const [aiError, setAiError] = useState('');
  const [graphInferring, setGraphInferring] = useState(false);
  const [arxivWarning, setArxivWarning] = useState('');
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);

  const navigate = useNavigate();
  const arxivId = parseArxivIdentifier(arxiv);
  const hasPaperSource = Boolean(fileData);

  const existingTags = useMemo(
    () => Array.from(new Set(papers.flatMap((p) => p.tags || []))),
    [papers]
  );

  /* Duplicate detection.
       - If the library is empty, nothing can possibly match.
       - If an arXiv ID is present on the form, match strictly by normalized arXiv ID only.
       - Otherwise, fall back to an exact (normalized) title match, but only when the title
         is long enough to be reasonably specific. Papers with arXiv IDs already in the
         library are skipped here because arXiv is the authoritative identifier. */
  const duplicatePaper = useMemo(() => {
    if (!papers || papers.length === 0) return null;
    if (arxivId) {
      return papers.find((p) => {
        const existingId = parseArxivIdentifier(p.arxiv || '');
        return existingId && existingId === arxivId;
      }) || null;
    }
    const t = title.trim().toLowerCase();
    if (t.length < 15) return null;
    return papers.find((p) => {
      if (parseArxivIdentifier(p.arxiv || '')) return false;
      return (p.title || '').trim().toLowerCase() === t;
    }) || null;
  }, [papers, arxivId, title]);

  const canSubmit =
    Boolean(title.trim() && abstract.trim() && year.trim() && fileData) &&
    (!duplicatePaper || overrideDuplicate);

  const selectedTagList = useMemo(
    () => tags.split(',').map((t) => t.trim()).filter(Boolean),
    [tags]
  );
  const canSuggestTags = Boolean(title.trim() || abstract.trim() || note.trim());

  const toggleSuggestedTag = (tag) => {
    const lower = tag.toLowerCase();
    const parts = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const exists = parts.some((t) => t.toLowerCase() === lower);
    const next = exists
      ? parts.filter((t) => t.toLowerCase() !== lower)
      : [...parts, tag];
    setTags(next.join(', '));
  };

  const handleSuggestTags = async () => {
    setAiError('');
    setAiMatched([]);
    setAiSuggested([]);
    setAiSuggesting(true);
    try {
      const { matched, suggested } = await suggestTagsForPaper(
        { title, abstract, note },
        existingTags
      );
      setAiMatched(matched);
      setAiSuggested(suggested);
      if (!matched.length && !suggested.length) {
        setAiError('AI returned no tag suggestions. Try adding more context.');
      }
    } catch (err) {
      console.error('AI tag suggestion failed:', err);
      setAiError(err.message || 'Failed to get suggestions.');
    } finally {
      setAiSuggesting(false);
    }
  };

  /* auto-run AI tag suggestion exactly once, after the user has filled in
     enough content. After that, the user re-triggers manually via the button. */
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current) return;
    if (!title.trim() || !abstract.trim()) return;
    const timer = setTimeout(() => {
      if (aiSuggesting || hasAutoRun.current) return;
      hasAutoRun.current = true;
      handleSuggestTags();
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, abstract]);

  const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const fetchArxivPdf = async (id) => {
    const response = await fetch(`/api/arxiv-pdf/${id}.pdf`);
    if (!response.ok) {
      throw new Error(`Could not download the arXiv PDF (${response.status}).`);
    }

    const blob = await response.blob();
    const headerBuffer = await blob.slice(0, 5).arrayBuffer();
    const header = new TextDecoder('ascii').decode(headerBuffer);

    if (header !== '%PDF-') {
      throw new Error('The arXiv response was not a PDF.');
    }

    return blobToDataURL(blob);
  };

  const fetchWithRetry = async (url, { retries = 1, backoffMs = 1500, headers } = {}) => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const res = await fetch(url, headers ? { headers } : undefined);
      if (res.ok) return res;
      if (res.status !== 429 || attempt === retries) return res;
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
    return null;
  };

  const fetchSemanticScholar = async (id) => {
    try {
      const key = import.meta.env.VITE_SEMANTIC_SCHOLAR_KEY;
      const res = await fetchWithRetry(
        `https://api.semanticscholar.org/graph/v1/paper/ARXIV:${id}?fields=title,authors,abstract,year`,
        { retries: 1, backoffMs: 2000, headers: key ? { 'x-api-key': key } : undefined }
      );
      if (!res || !res.ok) return null;
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
        const res = await fetchWithRetry(url, { retries: 1, backoffMs: 2000 });
        if (!res || !res.ok) continue;
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
    if (!arxivId) return;
    const id = arxivId;

    setArxivLoading(true);
    setArxivWarning('');
    try {
      /* Try the local cache for metadata first; if we've fetched this paper
         in the last week, skip the external APIs entirely. PDF is always
         re-fetched fresh since it's too large to cache in localStorage. */
      const cachedMeta = readArxivMetaCache(id);

      /* Run lookups independently so a rate-limited metadata API
         doesn't block the PDF download (or vice versa). */
      const [ssResult, axResult, pdfResult] = await Promise.allSettled([
        cachedMeta ? Promise.resolve(null) : fetchSemanticScholar(id),
        cachedMeta ? Promise.resolve(null) : fetchArxivApi(id),
        fetchArxivPdf(id),
      ]);

      const ss = ssResult.status === 'fulfilled' ? ssResult.value : null;
      const ax = axResult.status === 'fulfilled' ? axResult.value : null;
      const pdfData = pdfResult.status === 'fulfilled' ? pdfResult.value : null;

      const meta = cachedMeta
        ? cachedMeta
        : {
            title: ss?.title || ax?.title || '',
            authors: ss?.authors || ax?.authors || '',
            abstract: ss?.abstract || ax?.abstract || '',
            year: ss?.year || ax?.year || '',
          };

      if (!cachedMeta && (meta.title || meta.abstract)) {
        writeArxivMetaCache(id, meta);
      }

      if (meta.title) setTitle(meta.title);
      if (meta.authors) setAuthors(meta.authors);
      if (meta.abstract) setAbstract(meta.abstract);
      if (meta.year) setYear(meta.year);
      if (pdfData) setFileData(pdfData);

      const metaFailed = !cachedMeta && !ss && !ax;
      const pdfFailed = !pdfData;
      if (metaFailed && pdfFailed) {
        setArxivWarning('arXiv lookup failed (rate-limited or offline). Try again in a minute or fill in the fields manually.');
      } else if (metaFailed) {
        setArxivWarning('Got the PDF, but metadata APIs are rate-limited. Fill in the title, authors, and abstract manually.');
      } else if (pdfFailed) {
        setArxivWarning('Got metadata, but the PDF download failed. Upload the PDF manually below.');
      }
    } catch (err) {
      console.error('arXiv fetch failed:', err);
      setArxivWarning('arXiv fetch failed. See console for details.');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

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
      source: arxivId ? 'arxiv' : 'upload',
    });

    /* Graph auto-construction: real citations (Semantic Scholar) + AI thematic links.
       Both sources are filtered to respect temporal ordering (earlier → later). */
    if (papers.length > 0 && updatePaper) {
      setGraphInferring(true);
      try {
        const { edges } = await buildGraphEdges(
          {
            title: paper.title,
            abstract: paper.abstract,
            year: paper.year,
          },
          papers,
          arxivId
        );
        if (edges.length > 0) {
          updatePaper(paper.id, { buildsOn: edges });
        }
      } catch (err) {
        console.error('Graph inference failed:', err);
      } finally {
        setGraphInferring(false);
      }
    }

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
        <div className="upload-quick">
          <div className="upload-quick-header">
            <span className="upload-quick-icon">⚡</span>
            <div>
              <div className="upload-quick-title">Quick start from arXiv</div>
              <div className="upload-quick-subtitle">
                Paste a link — we auto-fill the PDF, title, authors, abstract, and year.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <input
              type="text"
              className="form-input"
              value={arxiv}
              onChange={(e) => setArxiv(e.target.value)}
              placeholder="https://arxiv.org/abs/2312.06942"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className={`btn btn-primary${arxivLoading ? ' is-thinking' : ''}`}
              onClick={fetchArxivMeta}
              disabled={arxivLoading || !arxiv.trim() || !arxivId}
            >
              {arxivLoading ? 'Fetching…' : 'Fetch paper'}
            </button>
          </div>
          {arxiv.trim() && !arxivId && (
            <div className="upload-quick-hint is-warning">
              Doesn't look like an arXiv URL. Expected format: https://arxiv.org/abs/…
            </div>
          )}
          {hasPaperSource && arxivId && !duplicatePaper && !arxivWarning && (
            <div className="upload-quick-hint is-success">
              ✓ PDF and metadata loaded. Edit below if needed, then click Upload.
            </div>
          )}
          {arxivWarning && (
            <div className="upload-quick-hint is-warning">
              {arxivWarning}
            </div>
          )}
          {duplicatePaper && arxivId && (
            <div className="upload-duplicate">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  {overrideDuplicate ? 'Override — will add as a new paper' : 'Already in your library'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                  Matched: "{duplicatePaper.title}" ({duplicatePaper.year || 'no year'})
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  Library has {papers.length} paper{papers.length === 1 ? '' : 's'}.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  onClick={() => {
                    setShowModal(false);
                    navigate(`/paper/${duplicatePaper.id}`);
                  }}
                >
                  Open existing
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => setOverrideDuplicate((v) => !v)}
                >
                  {overrideDuplicate ? 'Cancel override' : 'Add anyway'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="upload-divider">
          <span>or enter manually</span>
        </div>

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
            PDF file {hasPaperSource ? <span style={{ color: 'var(--color-success)' }}>✓ loaded</span> : '*'}
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Required if you aren't using the arXiv quick-start above.
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
          <label className="form-label">Year *</label>
          <input
            type="number"
            className="form-input"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2024"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Abstract *</label>
          <textarea
            className="form-textarea"
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            placeholder="Paper abstract"
            rows="4"
            required
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Tags (comma-separated)</label>
            <button
              type="button"
              className={`btn btn-small btn-ai${aiSuggesting ? ' is-thinking' : ''}`}
              onClick={handleSuggestTags}
              disabled={aiSuggesting || !canSuggestTags}
              title={
                !canSuggestTags
                  ? 'Enter a title and abstract first'
                  : aiSuggesting
                    ? 'AI is analyzing this paper…'
                    : 'Re-run AI tag suggestions'
              }
            >
              <span className={`ai-sparkle${aiSuggesting ? ' is-spinning' : ''}`}>✦</span>
              {aiSuggesting
                ? 'AI thinking…'
                : (aiMatched.length || aiSuggested.length)
                  ? 'Refresh AI tags'
                  : existingTags.length
                    ? 'Suggest tags with AI'
                    : 'Generate starter tags'}
            </button>
          </div>
          <input
            type="text"
            className="form-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="AI, Control, Safety"
          />
          {(aiMatched.length > 0 || aiSuggested.length > 0) && (
            <div className="ai-suggestions">
              {aiMatched.length > 0 && (
                <>
                  <div className="ai-suggestions-label">
                    <span>✦</span> Matched from your tags — click to add
                  </div>
                  <div style={{ marginBottom: aiSuggested.length ? 10 : 0 }}>
                    {aiMatched.map((tag) => {
                      const selected = selectedTagList.some(
                        (t) => t.toLowerCase() === tag.toLowerCase()
                      );
                      return (
                        <span
                          key={tag}
                          className={`ai-chip${selected ? ' is-selected' : ''}`}
                          onClick={() => toggleSuggestedTag(tag)}
                        >
                          {selected ? '✓ ' : '+ '}
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
              {aiSuggested.length > 0 && (
                <>
                  <div className="ai-suggestions-label is-new">
                    <span>✨</span> New tag ideas — click to create
                  </div>
                  <div>
                    {aiSuggested.map((tag) => {
                      const selected = selectedTagList.some(
                        (t) => t.toLowerCase() === tag.toLowerCase()
                      );
                      return (
                        <span
                          key={tag}
                          className={`ai-chip is-new${selected ? ' is-selected' : ''}`}
                          onClick={() => toggleSuggestedTag(tag)}
                        >
                          {selected ? '✓ ' : '+ '}
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {aiError && <div className="ai-error">{aiError}</div>}
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

        {duplicatePaper && !arxivId && (
          <div className="upload-duplicate">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {overrideDuplicate ? 'Override — will add as a new paper' : 'A paper with this title already exists'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                Matched: "{duplicatePaper.title}" ({duplicatePaper.year || 'no year'})
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                Library has {papers.length} paper{papers.length === 1 ? '' : 's'}.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => {
                  setShowModal(false);
                  navigate(`/paper/${duplicatePaper.id}`);
                }}
              >
                Open existing
              </button>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => setOverrideDuplicate((v) => !v)}
              >
                {overrideDuplicate ? 'Cancel override' : 'Add anyway'}
              </button>
            </div>
          </div>
        )}
        {graphInferring && (
          <div className="ai-graph-banner">
            <span className="ai-sparkle is-spinning">✦</span>
            AI is linking this paper into your knowledge graph…
          </div>
        )}
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
          <button
            type="submit"
            className={`btn btn-primary${graphInferring ? ' is-thinking' : ''}`}
            disabled={!canSubmit || graphInferring}
          >
            {graphInferring ? 'Linking graph…' : 'Upload Paper'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
