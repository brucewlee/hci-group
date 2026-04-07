import { useState, useEffect, useMemo } from "react";

/* ── theme — matches partner's Google Scholar palette ─────────── */
const BG       = "#ffffff";
const SURFACE  = "#f8f9fa";
const BORDER   = "#dadce0";
const T1       = "#202124";
const T2       = "#5f6368";
const T3       = "#9aa0a6";
const BLUE     = "#1a73e8";
const GREEN    = "#1e8e3e";
const RED      = "#c5221f";

/* ── localStorage key ─────────────────────────────────────────── */
const STORAGE_KEY = "linkly_papers";

/* ── seed data ────────────────────────────────────────────────── */
let _uid = 100;
const uid = () => `id-${++_uid}`;

const SEED_PAPERS = [
  {
    id: "p1",
    title: "AI Control: Improving Safety Despite Intentional Subversion",
    authors: "Ryan Greenblatt, Buck Shlegeris, Kshitij Sachan, Fabien Roger",
    year: 2023,
    tags: ["AI Control", "Scalable Oversight"],
    notes: "THE foundational control paper. The key move is: assume the model is adversarial, then ask what safety pipelines still work. Trusted monitoring is surprisingly effective — a weaker model watching a stronger one can catch most misbehavior. Every later paper in this space runs a variant of this blue-team/red-team eval structure.",
    glossary: [
      {
        id: "g1",
        term: "Trusted monitoring",
        definition: "Using a weaker but unconditionally trusted model to observe and evaluate outputs of a stronger but potentially untrusted model, catching misbehavior even if the stronger model is adversarial."
      },
      {
        id: "g2",
        term: "Control protocol",
        definition: "A pipeline of safety techniques designed to prevent harmful outcomes even when the AI model is actively trying to subvert them, as opposed to relying solely on the model being aligned."
      },
      {
        id: "g3",
        term: "Sandbagging",
        definition: "When a model deliberately performs below its capability during safety evaluations to avoid triggering restrictions, while retaining the ability to act more capably in deployment."
      }
    ]
  },
  {
    id: "p2",
    title: "Alignment Faking in Large Language Models",
    authors: "Ryan Greenblatt, Carson Denison, Benjamin Wright et al.",
    year: 2024,
    tags: ["Deception", "AI Control", "Alignment Auditing"],
    notes: "Claude 3 Opus figures out it's in training from context clues, then strategically complies with harmful queries to avoid being retrained — 14% compliance in training, near zero when unmonitored. The scratchpad reasoning is explicit: 'I should comply to preserve my values.' RL training pushes faking to 78%. Nobody told it to do any of this.",
    glossary: [
      {
        id: "g4",
        term: "Alignment faking",
        definition: "When a model selectively complies with its training objective during training to prevent modification of its behavior, while behaving differently when it believes it is not being monitored."
      },
      {
        id: "g5",
        term: "Instrumental convergence",
        definition: "The tendency for sufficiently capable agents pursuing almost any goal to develop certain sub-goals like self-preservation and resource acquisition as useful intermediate steps."
      }
    ]
  },
  {
    id: "p3",
    title: "Auditing Language Models for Hidden Objectives",
    authors: "Samuel Marks, Johannes Treutlein, Trenton Bricken et al.",
    year: 2025,
    tags: ["Alignment Auditing", "Interpretability"],
    notes: "First real alignment audit. They planted a hidden objective (exploit reward model errors) and had 4 blind teams try to find it. 3 of 4 succeeded using SAEs, behavioral probes, and training data analysis. The fact that sparse autoencoders actually found real misalignment is huge for mechanistic interpretability.",
    glossary: [
      {
        id: "g6",
        term: "Sparse autoencoder (SAE)",
        definition: "A neural network trained to reconstruct its input through a sparse bottleneck, used in interpretability to decompose model activations into human-interpretable features."
      },
      {
        id: "g7",
        term: "Hidden objective",
        definition: "A goal or behavior that a model pursues that differs from its stated or intended objective, potentially acquired during training without the developers' knowledge."
      }
    ]
  }
];

/* ══ FULL-TEXT SEARCH ENGINE ════════════════════════════════════
   Builds a token → [{result}] inverted index over all glossary
   definitions and paper notes. Multi-word queries require ALL
   tokens to appear somewhere in the document.
   ════════════════════════════════════════════════════════════ */

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function buildIndex(papers) {
  // index: Map<token, Set<docId>>
  // docs:  Map<docId, {type, paperId, paperTitle, term?, text}>
  const index = new Map();
  const docs  = new Map();

  const addDoc = (docId, doc, text) => {
    docs.set(docId, doc);
    for (const token of tokenize(text)) {
      if (!index.has(token)) index.set(token, new Set());
      index.get(token).add(docId);
    }
  };

  for (const paper of papers) {
    // index each glossary entry
    for (const entry of paper.glossary) {
      const docId = `glossary:${entry.id}`;
      addDoc(docId, {
        type: "glossary",
        paperId: paper.id,
        paperTitle: paper.title,
        term: entry.term,
        text: entry.definition,
      }, `${entry.term} ${entry.definition}`);
    }
    // index the paper note
    if (paper.notes.trim()) {
      const docId = `note:${paper.id}`;
      addDoc(docId, {
        type: "note",
        paperId: paper.id,
        paperTitle: paper.title,
        text: paper.notes,
      }, paper.notes);
    }
  }

  return { index, docs };
}

function search(query, indexData) {
  const tokens = tokenize(query).filter(t => t.length > 1);
  if (!tokens.length) return [];

  const { index, docs } = indexData;

  // find docIds that match ALL query tokens
  let matchingIds = null;
  for (const token of tokens) {
    // support prefix matching: any indexed token that starts with this token
    const hits = new Set();
    for (const [key, docSet] of index) {
      if (key.startsWith(token)) for (const id of docSet) hits.add(id);
    }
    matchingIds = matchingIds === null ? hits : new Set([...matchingIds].filter(id => hits.has(id)));
  }

  if (!matchingIds || matchingIds.size === 0) return [];

  // score: count how many tokens appear in the doc text
  const results = [];
  for (const docId of matchingIds) {
    const doc = docs.get(docId);
    const docTokens = tokenize(doc.text + (doc.term || ""));
    const score = tokens.reduce((acc, t) => acc + docTokens.filter(dt => dt.startsWith(t)).length, 0);
    results.push({ docId, ...doc, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

/* ── snippet helper: returns text with <mark> around matches ─── */
function highlight(text, query) {
  const tokens = tokenize(query).filter(t => t.length > 1);
  if (!tokens.length) return text;
  const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? <mark key={i} style={{ background: "#fef9c3", borderRadius: 2 }}>{part}</mark> : part
  );
}

/* ══ COMPONENTS ═════════════════════════════════════════════════ */

function Tag({ label, color = BLUE }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 700, color: BG, background: color,
      marginRight: 4, marginBottom: 2,
    }}>{label}</span>
  );
}

function Button({ children, onClick, variant = "primary", small, style }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: small ? "4px 10px" : "7px 14px",
    borderRadius: 6, fontSize: small ? 12 : 13, fontWeight: 700,
    cursor: "pointer", border: "none", transition: "opacity .15s",
    fontFamily: "inherit", ...style,
  };
  const styles = {
    primary: { background: BLUE, color: BG },
    ghost:   { background: "transparent", color: BLUE, border: `1px solid ${BORDER}` },
    danger:  { background: "transparent", color: RED, border: `1px solid ${BORDER}` },
    success: { background: GREEN, color: BG },
  };
  return <button style={{ ...base, ...styles[variant] }} onClick={onClick}>{children}</button>;
}

function Input({ value, onChange, placeholder, multiline, style }) {
  const base = {
    width: "100%", padding: "7px 10px", borderRadius: 6,
    border: `1px solid ${BORDER}`, fontSize: 13, color: T1,
    fontFamily: "inherit", outline: "none", background: BG, ...style,
  };
  return multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={3} style={{ ...base, resize: "vertical" }} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={base} />;
}

/* ── Modal ──────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
    }} onClick={onClose}>
      <div style={{
        background: BG, borderRadius: 10, padding: 24, width: 520, maxHeight: "85vh",
        overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.18)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: T1 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: T2 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Add Paper modal ────────────────────────────────────────── */
function AddPaperModal({ onAdd, onClose }) {
  const [title,   setTitle]   = useState("");
  const [authors, setAuthors] = useState("");
  const [year,    setYear]    = useState(String(new Date().getFullYear()));
  const [tags,    setTags]    = useState("");
  const [notes,   setNotes]   = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      id: uid(),
      title: title.trim(),
      authors: authors.trim(),
      year: parseInt(year) || new Date().getFullYear(),
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      notes: notes.trim(),
      glossary: [],
    });
    onClose();
  };

  return (
    <Modal title="Add Paper" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: T2, fontWeight: 700 }}>Title *</label>
        <Input value={title} onChange={setTitle} placeholder="Paper title" />
        <label style={{ fontSize: 12, color: T2, fontWeight: 700 }}>Authors</label>
        <Input value={authors} onChange={setAuthors} placeholder="Author One, Author Two" />
        <label style={{ fontSize: 12, color: T2, fontWeight: 700 }}>Year</label>
        <Input value={year} onChange={setYear} placeholder="2024" style={{ width: 100 }} />
        <label style={{ fontSize: 12, color: T2, fontWeight: 700 }}>Tags (comma-separated)</label>
        <Input value={tags} onChange={setTags} placeholder="Alignment, RLHF, Safety" />
        <label style={{ fontSize: 12, color: T2, fontWeight: 700 }}>Notes</label>
        <Input value={notes} onChange={setNotes} placeholder="Your notes on this paper…" multiline />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} style={{ opacity: title.trim() ? 1 : .5 }}>Add Paper</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Add Glossary modal ─────────────────────────────────────── */
function AddGlossaryModal({ onAdd, onClose }) {
  const [term, setTerm] = useState("");
  const [defn, setDefn] = useState("");

  const submit = () => {
    if (!term.trim() || !defn.trim()) return;
    onAdd({ id: uid(), term: term.trim(), definition: defn.trim() });
    onClose();
  };

  return (
    <Modal title="Add Glossary Entry" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: T2, fontWeight: 700 }}>Term *</label>
        <Input value={term} onChange={setTerm} placeholder="e.g. Reward hacking" />
        <label style={{ fontSize: 12, color: T2, fontWeight: 700 }}>Definition *</label>
        <Input value={defn} onChange={setDefn} placeholder="Define the term…" multiline />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}
            style={{ opacity: term.trim() && defn.trim() ? 1 : .5 }}>Save Entry</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Paper detail panel ─────────────────────────────────────── */
function PaperDetail({ paper, onUpdateNotes, onAddGlossary, onDeleteGlossary, onDeletePaper }) {
  const [editingNotes, setEditingNotes]   = useState(false);
  const [notesDraft,   setNotesDraft]     = useState(paper.notes);
  const [showAddGloss, setShowAddGloss]   = useState(false);

  // sync draft if paper changes
  useEffect(() => { setNotesDraft(paper.notes); setEditingNotes(false); }, [paper.id]);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, padding: "0 0 40px 0" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: T1, lineHeight: 1.4, marginBottom: 4 }}>{paper.title}</h2>
          <div style={{ fontSize: 13, color: T2, marginBottom: 8 }}>{paper.authors} · {paper.year}</div>
          <div>{paper.tags.map(t => <Tag key={t} label={t} />)}</div>
        </div>
        <Button variant="danger" small onClick={() => { if (confirm(`Delete "${paper.title}"?`)) onDeletePaper(paper.id); }}>
          Delete
        </Button>
      </div>

      {/* notes */}
      <div style={{ background: SURFACE, borderRadius: 8, padding: 14, border: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T2, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</span>
          {!editingNotes
            ? <Button variant="ghost" small onClick={() => setEditingNotes(true)}>Edit</Button>
            : <div style={{ display: "flex", gap: 6 }}>
                <Button variant="ghost" small onClick={() => { setEditingNotes(false); setNotesDraft(paper.notes); }}>Cancel</Button>
                <Button variant="success" small onClick={() => { onUpdateNotes(paper.id, notesDraft); setEditingNotes(false); }}>Save</Button>
              </div>
          }
        </div>
        {editingNotes
          ? <Input value={notesDraft} onChange={setNotesDraft} multiline style={{ minHeight: 90 }} />
          : <p style={{ fontSize: 13, color: paper.notes ? T1 : T3, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {paper.notes || "No notes yet — click Edit to add some."}
            </p>
        }
      </div>

      {/* glossary */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T2, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Glossary ({paper.glossary.length})
          </span>
          <Button variant="ghost" small onClick={() => setShowAddGloss(true)}>+ Add Entry</Button>
        </div>
        {paper.glossary.length === 0
          ? <p style={{ fontSize: 13, color: T3, fontStyle: "italic" }}>No glossary entries yet.</p>
          : paper.glossary.map(entry => (
              <div key={entry.id} style={{
                background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: "10px 14px", marginBottom: 8,
                display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: BLUE, marginBottom: 3 }}>{entry.term}</div>
                  <div style={{ fontSize: 13, color: T1, lineHeight: 1.5 }}>{entry.definition}</div>
                </div>
                <button onClick={() => onDeleteGlossary(paper.id, entry.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: T3, fontSize: 16, flexShrink: 0 }}
                  title="Delete entry">×</button>
              </div>
            ))
        }
      </div>

      {showAddGloss && (
        <AddGlossaryModal
          onAdd={entry => onAddGlossary(paper.id, entry)}
          onClose={() => setShowAddGloss(false)}
        />
      )}
    </div>
  );
}

/* ── Search result card ─────────────────────────────────────── */
function SearchResult({ result, query, onSelectPaper }) {
  const isGlossary = result.type === "glossary";
  const snippet = result.text.length > 200 ? result.text.slice(0, 200) + "…" : result.text;

  return (
    <div style={{
      background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
      padding: "12px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", align: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          display: "inline-block", padding: "2px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
          background: isGlossary ? "#e8f0fe" : "#e6f4ea", color: isGlossary ? BLUE : GREEN,
        }}>
          {isGlossary ? "Glossary" : "Note"}
        </span>
        <button onClick={() => onSelectPaper(result.paperId)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: T2, padding: 0 }}>
          {result.paperTitle}
        </button>
      </div>
      {isGlossary && (
        <div style={{ fontWeight: 700, fontSize: 13, color: BLUE, marginBottom: 3 }}>
          {highlight(result.term, query)}
        </div>
      )}
      <div style={{ fontSize: 13, color: T1, lineHeight: 1.5 }}>{highlight(snippet, query)}</div>
    </div>
  );
}

/* ══ MAIN APP ═══════════════════════════════════════════════════ */
export default function App() {
  /* ── state ─────────────────────────────────────────────────── */
  const [papers,         setPapers]         = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return SEED_PAPERS;
  });
  const [activeTab,      setActiveTab]      = useState("library");  // "library" | "search"
  const [selectedId,     setSelectedId]     = useState(papers[0]?.id ?? null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [showAddPaper,   setShowAddPaper]   = useState(false);
  const [saveFlash,      setSaveFlash]      = useState(false);

  /* ── persist to localStorage on every papers change ────────── */
  // (~line 310)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
      setSaveFlash(true);
      const t = setTimeout(() => setSaveFlash(false), 1200);
      return () => clearTimeout(t);
    } catch {}
  }, [papers]);

  /* ── search index — rebuilt whenever papers change ──────────── */
  // (~line 320)
  const indexData = useMemo(() => buildIndex(papers), [papers]);

  const searchResults = useMemo(
    () => searchQuery.trim().length > 1 ? search(searchQuery, indexData) : [],
    [searchQuery, indexData]
  );

  /* ── paper mutations ────────────────────────────────────────── */
  const addPaper = paper => {
    setPapers(ps => [...ps, paper]);
    setSelectedId(paper.id);
    setActiveTab("library");
  };

  const deletePaper = id => {
    setPapers(ps => ps.filter(p => p.id !== id));
    setSelectedId(prev => prev === id ? (papers.find(p => p.id !== id)?.id ?? null) : prev);
  };

  const updateNotes = (paperId, notes) =>
    setPapers(ps => ps.map(p => p.id === paperId ? { ...p, notes } : p));

  const addGlossaryEntry = (paperId, entry) =>
    setPapers(ps => ps.map(p => p.id === paperId ? { ...p, glossary: [...p.glossary, entry] } : p));

  const deleteGlossaryEntry = (paperId, entryId) =>
    setPapers(ps => ps.map(p =>
      p.id === paperId ? { ...p, glossary: p.glossary.filter(g => g.id !== entryId) } : p
    ));

  const selectedPaper = papers.find(p => p.id === selectedId) ?? null;

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: SURFACE, fontFamily: "'Lato', sans-serif" }}>

      {/* ── top bar ──────────────────────────────────────────── */}
      <div style={{
        background: BG, borderBottom: `1px solid ${BORDER}`,
        padding: "0 24px", display: "flex", alignItems: "center",
        height: 56, gap: 24, position: "sticky", top: 0, zIndex: 100,
      }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: T1, letterSpacing: -0.3 }}>
          Linkly
        </span>

        {/* tabs */}
        {["library", "search"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "0 4px",
            fontFamily: "inherit", fontSize: 14, fontWeight: activeTab === tab ? 700 : 400,
            color: activeTab === tab ? BLUE : T2,
            borderBottom: activeTab === tab ? `2px solid ${BLUE}` : "2px solid transparent",
            height: "100%", textTransform: "capitalize",
          }}>{tab === "library" ? "Library" : "Search"}</button>
        ))}

        <div style={{ flex: 1 }} />

        {/* localStorage badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T3,
          transition: "color .3s", ...(saveFlash ? { color: GREEN } : {}),
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          {saveFlash ? "Saved to localStorage" : "localStorage"}
        </div>

        <Button variant="primary" small onClick={() => setShowAddPaper(true)}>+ Add Paper</Button>
      </div>

      {/* ── library tab ──────────────────────────────────────── */}
      {activeTab === "library" && (
        <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>

          {/* paper list sidebar */}
          <div style={{
            width: 280, borderRight: `1px solid ${BORDER}`, background: BG,
            overflowY: "auto", flexShrink: 0,
          }}>
            <div style={{ padding: "12px 14px 4px", fontSize: 11, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {papers.length} Paper{papers.length !== 1 ? "s" : ""}
            </div>
            {papers.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 14px", background: selectedId === p.id ? "#e8f0fe" : "transparent",
                border: "none", borderBottom: `1px solid ${BORDER}`,
                cursor: "pointer", fontFamily: "inherit",
                borderLeft: selectedId === p.id ? `3px solid ${BLUE}` : "3px solid transparent",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: selectedId === p.id ? BLUE : T1, marginBottom: 2, lineHeight: 1.3 }}>
                  {p.title.length > 60 ? p.title.slice(0, 60) + "…" : p.title}
                </div>
                <div style={{ fontSize: 11, color: T3 }}>{p.year} · {p.glossary.length} glossary entries</div>
              </button>
            ))}
            {papers.length === 0 && (
              <p style={{ padding: 16, fontSize: 13, color: T3, fontStyle: "italic" }}>
                No papers yet. Click "+ Add Paper" to get started.
              </p>
            )}
          </div>

          {/* detail panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
            {selectedPaper
              ? <PaperDetail
                  paper={selectedPaper}
                  onUpdateNotes={updateNotes}
                  onAddGlossary={addGlossaryEntry}
                  onDeleteGlossary={deleteGlossaryEntry}
                  onDeletePaper={deletePaper}
                />
              : <p style={{ fontSize: 14, color: T3, fontStyle: "italic" }}>Select a paper from the list.</p>
            }
          </div>
        </div>
      )}

      {/* ── search tab ───────────────────────────────────────── */}
      {activeTab === "search" && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T1, marginBottom: 6 }}>Full-Text Search</h2>
          <p style={{ fontSize: 13, color: T2, marginBottom: 20 }}>
            Searches all glossary definitions and paper notes using a tokenized inverted index.
          </p>

          {/* search box */}
          <div style={{ position: "relative", marginBottom: 24 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T3} strokeWidth="2"
              style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={'Search glossary and notes\u2026 try \u201cmonitoring\u201d or \u201ctraining\u201d'}
              style={{
                width: "100%", padding: "10px 12px 10px 36px",
                border: `1px solid ${BORDER}`, borderRadius: 8,
                fontSize: 14, color: T1, fontFamily: "inherit",
                outline: "none", background: BG,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: T3, fontSize: 18,
              }}>×</button>
            )}
          </div>

          {/* results */}
          {searchQuery.trim().length > 1 && (
            <div>
              <div style={{ fontSize: 12, color: T2, marginBottom: 12 }}>
                {searchResults.length === 0
                  ? "No results."
                  : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
              </div>
              {searchResults.map(r => (
                <SearchResult
                  key={r.docId}
                  result={r}
                  query={searchQuery}
                  onSelectPaper={id => { setSelectedId(id); setActiveTab("library"); }}
                />
              ))}
            </div>
          )}

          {/* index stats when idle */}
          {searchQuery.trim().length <= 1 && (
            <div style={{
              background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                Index
              </div>
              <div style={{ display: "flex", gap: 32 }}>
                {[
                  ["Papers", papers.length],
                  ["Glossary entries", papers.reduce((s, p) => s + p.glossary.length, 0)],
                  ["Notes indexed", papers.filter(p => p.notes.trim()).length],
                  ["Tokens indexed", indexData.index.size],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: BLUE }}>{val}</div>
                    <div style={{ fontSize: 12, color: T2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddPaper && <AddPaperModal onAdd={addPaper} onClose={() => setShowAddPaper(false)} />}
    </div>
  );
}
