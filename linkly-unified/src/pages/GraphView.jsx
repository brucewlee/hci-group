import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

const BG = '#ffffff';
const SURFACE = '#f8f9fa';
const BORDER = '#dadce0';
const T1 = '#202124';
const T2 = '#5f6368';
const T3 = '#9aa0a6';
const LINK = '#1a73e8';
const GREEN = '#1e8e3e';
const TAG_COLORS = [
  '#1a73e8', '#9334e6', '#e8710a', '#0d652d', '#c5221f', '#185abc', '#7627bb', '#b06000', '#0b8043', '#a50e0e',
];

const W = 800;
const H = 500;

function runLayout(papers, iterations = 180) {
  const ns = papers.map((p) => ({
    ...p,
    x: W * 0.15 + Math.random() * W * 0.7,
    y: H * 0.15 + Math.random() * H * 0.7,
    vx: 0,
    vy: 0,
  }));
  const map = Object.fromEntries(ns.map((n) => [n.id, n]));
  
  for (let s = 0; s < iterations; s++) {
    const decay = 1 - s / iterations;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        let dx = ns[j].x - ns[i].x,
          dy = ns[j].y - ns[i].y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        let f = (3200 * decay) / (d * d);
        ns[i].vx -= (f * dx) / d;
        ns[i].vy -= (f * dy) / d;
        ns[j].vx += (f * dx) / d;
        ns[j].vy += (f * dy) / d;
      }
      for (const pid of ns[i].buildsOn) {
        const other = map[pid];
        if (!other) continue;
        let dx = other.x - ns[i].x,
          dy = other.y - ns[i].y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        let f = (0.6 * decay * d) / 80;
        ns[i].vx += (f * dx) / d;
        ns[i].vy += (f * dy) / d;
        other.vx -= (f * dx) / d;
        other.vy -= (f * dy) / d;
      }
    }
    for (let i = 0; i < ns.length; i++) {
      ns[i].vx *= 1 - 0.06 * decay;
      ns[i].vy *= 1 - 0.06 * decay;
      ns[i].x += ns[i].vx;
      ns[i].y += ns[i].vy;
      ns[i].x = Math.max(40, Math.min(W - 40, ns[i].x));
      ns[i].y = Math.max(40, Math.min(H - 40, ns[i].y));
    }
  }
  return ns;
}

function EdgeGroup({ x1, y1, x2, y2, hl, dim, onDelete }) {
  return (
    <g style={{ opacity: dim ? 0.1 : 1, transition: 'opacity 0.15s' }}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={hl ? LINK : T3}
        strokeWidth={hl ? 2.5 : 1.5}
        markerEnd={hl ? 'url(#arr-hl)' : 'url(#arr)'}
        style={{ pointerEvents: 'none' }}
      />
      <g
        style={{ cursor: 'pointer' }}
        onMouseUp={onDelete}
      >
        <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={6} fill="none" stroke={hl ? LINK : '#ccc'} strokeWidth={1.5} />
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fill={hl ? LINK : '#999'}
          style={{ pointerEvents: 'none' }}
        >
          ×
        </text>
      </g>
    </g>
  );
}

export function GraphView({ papers, setPapers, tags = [] }) {
  const [filterTag, setFilterTag] = useState(null);
  const [laidOut, setLaidOut] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [edgeDragFrom, setEdgeDragFrom] = useState(null);
  const [edgeDragMouse, setEdgeDragMouse] = useState(null);
  const svgRef = useRef(null);
  const dragOff = useRef({ x: 0, y: 0 });
  const prevPaperIds = useRef('');

  const filteredPapers = filterTag ? papers.filter((p) => p.tags && p.tags.includes(filterTag)) : papers;
  const filteredIds = filteredPapers.map((p) => p.id).sort().join(',');

  useEffect(() => {
    if (filteredIds === prevPaperIds.current) return;
    prevPaperIds.current = filteredIds;
    if (filteredPapers.length === 0) {
      setLaidOut([]);
      return;
    }
    setLaidOut(runLayout(filteredPapers));
    setSelected(null);
  }, [filteredIds, filteredPapers]);

  const tagColor = useMemo(() => {
    const m = {};
    tags.forEach((t, i) => {
      m[t] = TAG_COLORS[i % TAG_COLORS.length];
    });
    return m;
  }, [tags]);

  const clusterCentroids = useMemo(() => {
    const m = {};
    tags.forEach((tag) => {
      const ps = laidOut.filter((p) => p.tags && p.tags.includes(tag));
      if (ps.length < 1) return;
      const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length;
      const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length;
      const maxD = Math.max(55, ...ps.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))) + 45;
      m[tag] = { cx, cy, r: maxD, count: ps.length };
    });
    return m;
  }, [laidOut, tags]);

  const handleNodeDown = (e, id) => {
    e.stopPropagation();
    const rect = svgRef.current.getBoundingClientRect();
    const n = laidOut.find((x) => x.id === id);
    dragOff.current = { x: e.clientX - rect.left - n.x, y: e.clientY - rect.top - n.y };
    setDragId(id);
  };

  const handleConnectorDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    setEdgeDragFrom(id);
    const rect = svgRef.current.getBoundingClientRect();
    setEdgeDragMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMove = useCallback(
    (e) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (dragId) {
        setLaidOut((prev) =>
          prev.map((n) =>
            n.id === dragId
              ? {
                  ...n,
                  x: Math.max(40, Math.min(W - 40, e.clientX - rect.left - dragOff.current.x)),
                  y: Math.max(40, Math.min(H - 40, e.clientY - rect.top - dragOff.current.y)),
                }
              : n,
          ),
        );
      }
      if (edgeDragFrom) {
        setEdgeDragMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [dragId, edgeDragFrom],
  );

  const handleUp = useCallback(
    (e) => {
      if (edgeDragFrom && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left,
          my = e.clientY - rect.top;
        const target = laidOut.find(
          (n) => n.id !== edgeDragFrom && Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < 28,
        );
        if (target) {
          const from = edgeDragFrom,
            to = target.id;
          setPapers((prev) =>
            prev.map((p) => {
              if (p.id === from && !p.buildsOn.includes(to)) {
                return { ...p, buildsOn: [...p.buildsOn, to] };
              }
              return p;
            }),
          );
        }
      }
      setDragId(null);
      setEdgeDragFrom(null);
      setEdgeDragMouse(null);
    },
    [edgeDragFrom, laidOut, setPapers],
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [handleMove, handleUp]);

  const connSet = useMemo(() => {
    if (!hovered) return new Set();
    const s = new Set([hovered]);
    filteredPapers.forEach((p) => {
      if (p.id === hovered) p.buildsOn.forEach((id) => s.add(id));
      if (p.buildsOn.includes(hovered)) s.add(p.id);
    });
    const hp = filteredPapers.find((p) => p.id === hovered);
    if (hp) {
      filteredPapers.forEach((p) => {
        if (p.id !== hovered && p.tags && hp.tags && p.tags.some((t) => hp.tags.includes(t))) {
          s.add(p.id);
        }
      });
    }
    return s;
  }, [hovered, filteredPapers]);

  const selPaper = selected ? papers.find((p) => p.id === selected) : null;
  const hovPaper = hovered ? papers.find((p) => p.id === hovered) : null;
  const hovNode = hovered ? laidOut.find((n) => n.id === hovered) : null;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Knowledge Graph</h1>
        <p className="page-subtitle">
          {papers.length} paper{papers.length !== 1 ? 's' : ''} · drag nodes to explore relationships
        </p>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        <button
          onClick={() => setFilterTag(null)}
          className={filterTag === null ? 'btn btn-primary btn-small' : 'btn btn-ghost btn-small'}
        >
          All ({papers.length})
        </button>
        {tags.map((t) => {
          const count = papers.filter((p) => p.tags && p.tags.includes(t)).length;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilterTag(filterTag === t ? null : t)}
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                border: `1px solid ${filterTag === t ? (tagColor[t] || LINK) : BORDER}`,
                background: filterTag === t ? (tagColor[t] || LINK) + '12' : 'transparent',
                color: filterTag === t ? (tagColor[t] || LINK) : T2,
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: filterTag === t ? '700' : '400',
              }}
            >
              {t} ({count})
            </button>
          );
        })}
      </div>

      {laidOut.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 24px',
            color: T3,
          }}
        >
          No papers match this filter. <Link to="/upload">Upload a paper</Link> to begin.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Graph SVG */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <svg
              ref={svgRef}
              width="100%"
              height="600"
              viewBox={`0 0 ${W} ${H}`}
              style={{
                background: SURFACE,
                borderRadius: '8px',
                border: `1px solid ${BORDER}`,
                userSelect: 'none',
                display: 'block',
              }}
              onMouseLeave={() => setHovered(null)}
            >
              <defs>
                <marker
                  id="arr"
                  viewBox="0 0 10 8"
                  refX="9"
                  refY="4"
                  markerWidth="7"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 4 L 0 8 z" fill={T3} />
                </marker>
                <marker
                  id="arr-hl"
                  viewBox="0 0 10 8"
                  refX="9"
                  refY="4"
                  markerWidth="7"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 4 L 0 8 z" fill={LINK} />
                </marker>
              </defs>

              {/* Cluster bubbles */}
              {Object.entries(clusterCentroids).map(([tag, c]) => (
                <g key={tag}>
                  <circle
                    cx={c.cx}
                    cy={c.cy}
                    r={c.r}
                    fill={tagColor[tag] || T3}
                    opacity={0.045}
                    stroke={tagColor[tag] || T3}
                    strokeWidth={1}
                    strokeOpacity={0.15}
                    strokeDasharray="5 3"
                  />
                  <text
                    x={c.cx}
                    y={c.cy - c.r + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill={tagColor[tag] || T3}
                    opacity={0.55}
                    fontFamily="Lato,sans-serif"
                  >
                    {tag}
                  </text>
                </g>
              ))}

              {/* Citation edges */}
              {filteredPapers.flatMap((p) =>
                p.buildsOn.map((pid) => {
                  const child = laidOut.find((n) => n.id === p.id);
                  const parent = laidOut.find((n) => n.id === pid);
                  if (!child || !parent) return null;
                  const hl = hovered && connSet.has(p.id) && connSet.has(pid);
                  const dim = hovered && !hl;
                  const dx = parent.x - child.x,
                    dy = parent.y - child.y;
                  const d = Math.sqrt(dx * dx + dy * dy) || 1;
                  const ux = dx / d,
                    uy = dy / d;
                  const x1 = child.x + ux * 20,
                    y1 = child.y + uy * 20,
                    x2 = parent.x - ux * 20,
                    y2 = parent.y - uy * 20;
                  return (
                    <EdgeGroup
                      key={`${p.id}-${pid}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      hl={hl}
                      dim={dim}
                      onDelete={() =>
                        setPapers((prev) =>
                          prev.map((pp) =>
                            pp.id === p.id
                              ? { ...pp, buildsOn: pp.buildsOn.filter((b) => b !== pid) }
                              : pp,
                          ),
                        )
                      }
                    />
                  );
                }),
              )}

              {/* Edge drag preview */}
              {edgeDragFrom && edgeDragMouse && (() => {
                const fromNode = laidOut.find((n) => n.id === edgeDragFrom);
                if (!fromNode) return null;
                return (
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={edgeDragMouse.x}
                    y2={edgeDragMouse.y}
                    stroke={LINK}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    opacity={0.6}
                  />
                );
              })()}

              {/* Paper nodes */}
              {laidOut.map((n) => {
                const isHov = hovered === n.id;
                const isSel = selected === n.id;
                const conn = connSet.has(n.id);
                const dim = hovered && !isHov && !conn;
                const pc = (n.tags && n.tags[0] && tagColor[n.tags[0]]) || LINK;
                const isDropTarget =
                  edgeDragFrom &&
                  edgeDragFrom !== n.id &&
                  edgeDragMouse &&
                  Math.sqrt((n.x - edgeDragMouse.x) ** 2 + (n.y - edgeDragMouse.y) ** 2) < 30;
                return (
                  <g
                    key={n.id}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ opacity: dim ? 0.1 : 1, transition: 'opacity 0.15s' }}
                  >
                    {(isHov || isDropTarget) && (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={24}
                        fill={isDropTarget ? LINK : pc}
                        opacity={isDropTarget ? 0.2 : 0.08}
                      />
                    )}
                    {isSel && (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={22}
                        fill="none"
                        stroke={pc}
                        strokeWidth={2}
                        strokeDasharray="3 2"
                      />
                    )}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={isHov || isDropTarget ? 18 : 16}
                      fill={BG}
                      stroke={isDropTarget ? LINK : pc}
                      strokeWidth={isSel ? 2.5 : isDropTarget ? 2.5 : 1.5}
                      onMouseDown={(e) => handleNodeDown(e, n.id)}
                      onClick={() => setSelected(n.id === selected ? null : n.id)}
                      style={{ cursor: 'grab' }}
                    />
                    <text
                      x={n.x}
                      y={n.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight={700}
                      fill={pc}
                      fontFamily="Lato,sans-serif"
                      style={{ pointerEvents: 'none' }}
                    >
                      '{String(n.year || 2024).slice(-2)}
                    </text>
                    <text
                      x={n.x}
                      y={n.y + 30}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={isHov ? 700 : 400}
                      fill={T1}
                      fontFamily="Lato,sans-serif"
                      style={{ pointerEvents: 'none', maxWidth: '40px' }}
                    >
                      {(n.title || 'Untitled').length > 28
                        ? (n.title || 'Untitled').slice(0, 26) + '…'
                        : n.title || 'Untitled'}
                    </text>
                    {n.tags &&
                      n.tags.slice(0, 4).map((t, i) => (
                        <circle
                          key={t}
                          cx={n.x - (n.tags.slice(0, 4).length - 1) * 4 + i * 8}
                          cy={n.y + 40}
                          r={2.5}
                          fill={tagColor[t] || T3}
                          style={{ pointerEvents: 'none' }}
                        />
                      ))}
                    {isHov && !edgeDragFrom && (
                      <circle
                        cx={n.x}
                        cy={n.y - 20}
                        r={5}
                        fill={LINK}
                        stroke={BG}
                        strokeWidth={1.5}
                        onMouseDown={(e) => handleConnectorDown(e, n.id)}
                        style={{ cursor: 'crosshair' }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right side detail panel */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            {hovPaper && hovNode && !selected && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="paper-card-title">{hovPaper.title || 'Untitled'}</div>
                <div className="paper-card-meta">{hovPaper.year}</div>
                {hovPaper.authors && (
                  <p style={{ fontSize: '12px', color: T2, marginBottom: 0 }}>{hovPaper.authors}</p>
                )}
              </div>
            )}

            {selPaper && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="paper-card-title">{selPaper.title || 'Untitled'}</div>
                    <div className="paper-card-meta">{selPaper.year}</div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer',
                      color: T3,
                      marginLeft: '8px',
                    }}
                  >
                    ×
                  </button>
                </div>
                {selPaper.authors && (
                  <p style={{ fontSize: '12px', color: T2, marginBottom: '8px' }}>{selPaper.authors}</p>
                )}
                {selPaper.abstract && (
                  <p style={{ fontSize: '13px', color: T1, marginBottom: '8px', lineHeight: 1.5 }}>
                    {selPaper.abstract.slice(0, 200)}...
                  </p>
                )}
                {selPaper.tags && selPaper.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {selPaper.tags.map((t) => (
                      <span key={t} className="tag" style={{ background: tagColor[t] || LINK }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {selPaper.note && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: T2, marginBottom: '4px', textTransform: 'uppercase' }}>
                      Notes
                    </p>
                    <p style={{ fontSize: '12px', color: T1, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {selPaper.note}
                    </p>
                  </div>
                )}
                {selPaper.buildsOn && selPaper.buildsOn.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: T2, marginBottom: '4px', textTransform: 'uppercase' }}>
                      Builds on
                    </p>
                    {selPaper.buildsOn.map((pid) => {
                      const pp = papers.find((p) => p.id === pid);
                      return pp ? (
                        <p
                          key={pid}
                          onClick={() => setSelected(pid)}
                          style={{
                            fontSize: '12px',
                            color: LINK,
                            cursor: 'pointer',
                            margin: '2px 0',
                          }}
                        >
                          → {pp.title} ({pp.year})
                        </p>
                      ) : null;
                    })}
                  </div>
                )}
                <Link to={`/paper/${selPaper.id}`} className="btn btn-primary" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}>
                  Open in Viewer
                </Link>
              </div>
            )}

            {!hovPaper && !selPaper && (
              <div style={{ padding: '16px', color: T3, fontSize: '13px', lineHeight: 1.5 }}>
                <p style={{ margin: 0 }}>Hover over nodes to preview.</p>
                <p style={{ marginTop: '8px' }}>Click to see full details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
