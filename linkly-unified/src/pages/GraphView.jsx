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
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

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
        <circle cx={midX} cy={midY} r={11} fill="transparent" stroke="none" />
        <circle cx={midX} cy={midY} r={6} fill={BG} stroke={hl ? LINK : '#ccc'} strokeWidth={1.5} />
        <text
          x={midX}
          y={midY}
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

function clientToSvgPoint(svg, clientX, clientY) {
  if (!svg) return null;

  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  const point = new DOMPoint(clientX, clientY);
  return point.matrixTransform(ctm.inverse());
}

export function GraphView({ papers, setPapers, tags = [] }) {
  const [filterTag, setFilterTag] = useState(null);
  const [laidOut, setLaidOut] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [dragId, setDragId] = useState(null);
  const [edgeDragFrom, setEdgeDragFrom] = useState(null);
  const [edgeDragMouse, setEdgeDragMouse] = useState(null);
  const svgRef = useRef(null);
  const dragOff = useRef({ x: 0, y: 0 });
  const prevPaperIds = useRef('');

  const filteredPapers = filterTag ? papers.filter((p) => p.tags && p.tags.includes(filterTag)) : papers;
  const filteredIds = filteredPapers.map((p) => p.id).sort().join(',');
  const filteredMetadataKey = filteredPapers
    .map((p) => `${p.id}:${(p.tags || []).join('|')}:${(p.buildsOn || []).join('|')}:${p.title || ''}:${p.year || ''}`)
    .sort()
    .join('~');

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

  useEffect(() => {
    setLaidOut((prev) => {
      const previousById = new Map(prev.map((paper) => [paper.id, paper]));
      const hasMatchingNodeSet =
        prev.length === filteredPapers.length &&
        filteredPapers.every((paper) => previousById.has(paper.id));

      if (!hasMatchingNodeSet) {
        return prev;
      }

      return filteredPapers.map((paper) => {
        const currentNode = previousById.get(paper.id);
        return {
          ...paper,
          x: currentNode.x,
          y: currentNode.y,
          vx: currentNode.vx,
          vy: currentNode.vy,
        };
      });
    });
  }, [filteredMetadataKey]);

  const tagColor = useMemo(() => {
    const m = {};
    tags.forEach((t, i) => {
      m[t] = TAG_COLORS[i % TAG_COLORS.length];
    });
    return m;
  }, [tags]);

  const clusterCentroids = useMemo(() => {
    const centroids = {};

    tags.forEach((tag) => {
      const taggedNodes = laidOut.filter((paper) => paper.tags && paper.tags.includes(tag));
      if (taggedNodes.length < 2) return;

      const cx = taggedNodes.reduce((sum, paper) => sum + paper.x, 0) / taggedNodes.length;
      const cy = taggedNodes.reduce((sum, paper) => sum + paper.y, 0) / taggedNodes.length;
      const radius =
        Math.max(
          52,
          ...taggedNodes.map((paper) => Math.sqrt((paper.x - cx) ** 2 + (paper.y - cy) ** 2)),
        ) + 34;

      centroids[tag] = { cx, cy, r: radius, count: taggedNodes.length };
    });

    return centroids;
  }, [laidOut, tags]);

  const tagSummaries = useMemo(
    () =>
      tags
        .map((tag) => ({
          tag,
          count: papers.filter((paper) => paper.tags && paper.tags.includes(tag)).length,
        }))
        .filter((entry) => entry.count > 0),
    [papers, tags],
  );

  const handleNodeDown = (e, id) => {
    e.stopPropagation();
    const point = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    const n = laidOut.find((x) => x.id === id);
    if (!point || !n) return;
    dragOff.current = { x: point.x - n.x, y: point.y - n.y };
    setDragId(id);
  };

  const handleConnectorDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    setEdgeDragFrom(id);
    const point = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
    if (!point) return;
    setEdgeDragMouse({ x: point.x, y: point.y });
  };

  const handleMove = useCallback(
    (e) => {
      if (!svgRef.current) return;
      const point = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
      if (!point) return;
      if (dragId) {
        setLaidOut((prev) =>
          prev.map((n) =>
            n.id === dragId
              ? {
                  ...n,
                  x: Math.max(40, Math.min(W - 40, point.x - dragOff.current.x)),
                  y: Math.max(40, Math.min(H - 40, point.y - dragOff.current.y)),
                }
              : n,
          ),
        );
      }
      if (edgeDragFrom) {
        setEdgeDragMouse({ x: point.x, y: point.y });
      }
    },
    [dragId, edgeDragFrom],
  );

  const handleUp = useCallback(
    (e) => {
      if (edgeDragFrom && svgRef.current) {
        const point = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
        if (!point) {
          setDragId(null);
          setEdgeDragFrom(null);
          setEdgeDragMouse(null);
          return;
        }
        const mx = point.x;
        const my = point.y;
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
  const selectedTagSet = new Set((selPaper?.tags || []).map((tag) => tag.toLowerCase()));
  const availableTags = tags.filter((tag) => !selectedTagSet.has(tag.toLowerCase()));

  useEffect(() => {
    setTagDraft('');
  }, [selected]);

  const addTagToPaper = useCallback(
    (paperId, tagValue = tagDraft) => {
      const nextTag = tagValue.trim();
      if (!nextTag) return;

      setPapers((prev) =>
        prev.map((paper) => {
          if (paper.id !== paperId) return paper;

          const existingTags = paper.tags || [];
          const hasMatch = existingTags.some(
            (tag) => tag.toLowerCase() === nextTag.toLowerCase(),
          );

          if (hasMatch) {
            return paper;
          }

          return { ...paper, tags: [...existingTags, nextTag] };
        }),
      );
      setTagDraft('');
    },
    [setPapers, tagDraft],
  );

  const removeTagFromPaper = useCallback(
    (paperId, tagToRemove) => {
      setPapers((prev) =>
        prev.map((paper) =>
          paper.id === paperId
            ? { ...paper, tags: (paper.tags || []).filter((tag) => tag !== tagToRemove) }
            : paper,
        ),
      );
    },
    [setPapers],
  );

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
        <span style={{ fontSize: '12px', fontWeight: 700, color: T2, marginRight: '4px' }}>
          Filter by tag
        </span>
        <button
          onClick={() => setFilterTag(null)}
          className={filterTag === null ? 'btn btn-primary btn-small' : 'btn btn-ghost btn-small'}
        >
          All ({papers.length})
        </button>
        {tagSummaries.map(({ tag, count }) => {
          return (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                border: `1px solid ${filterTag === tag ? (tagColor[tag] || LINK) : BORDER}`,
                background: filterTag === tag ? (tagColor[tag] || LINK) + '12' : BG,
                color: filterTag === tag ? (tagColor[tag] || LINK) : T2,
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: filterTag === tag ? '700' : '400',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '999px',
                  background: tagColor[tag] || LINK,
                  flexShrink: 0,
                }}
              />
              {tag} ({count})
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
            {tagSummaries.length > 0 && (
              <div
                className="card"
                style={{
                  marginBottom: '12px',
                  padding: '12px 14px',
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '13px', color: T1 }}>Tag Key</strong>
                  <span style={{ fontSize: '11px', color: T3 }}>
                    Colors live in the key, not over the canvas
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {tagSummaries.map(({ tag, count }) => (
                    <button
                      key={`legend-${tag}`}
                      type="button"
                      onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '999px',
                        border: `1px solid ${filterTag === tag ? (tagColor[tag] || LINK) : BORDER}`,
                        background: filterTag === tag ? (tagColor[tag] || LINK) + '12' : BG,
                        color: filterTag === tag ? (tagColor[tag] || LINK) : T1,
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '999px',
                          background: tagColor[tag] || LINK,
                          boxShadow: `0 0 0 3px ${(tagColor[tag] || LINK)}1f`,
                          flexShrink: 0,
                        }}
                      />
                      <span>{tag}</span>
                      <span style={{ color: T3 }}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              {Object.entries(clusterCentroids).map(([tag, cluster]) => (
                <g key={`cluster-${tag}`} style={{ pointerEvents: 'none' }}>
                  <circle
                    cx={cluster.cx}
                    cy={cluster.cy}
                    r={cluster.r}
                    fill={tagColor[tag] || T3}
                    opacity={filterTag && filterTag !== tag ? 0.015 : 0.03}
                  />
                  <circle
                    cx={cluster.cx}
                    cy={cluster.cy}
                    r={cluster.r}
                    fill="none"
                    stroke={tagColor[tag] || T3}
                    strokeWidth={filterTag === tag ? 1.6 : 1}
                    strokeOpacity={filterTag === tag ? 0.22 : 0.12}
                    strokeDasharray={filterTag === tag ? '4 3' : '6 5'}
                  />
                </g>
              ))}

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
                      <button
                        key={t}
                        type="button"
                        className="tag"
                        onClick={() => removeTagFromPaper(selPaper.id, t)}
                        title={`Remove tag "${t}"`}
                        style={{
                          background: tagColor[t] || LINK,
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {t} ×
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: T2, marginBottom: '6px', textTransform: 'uppercase' }}>
                    Tags
                  </p>
                  {(!selPaper.tags || selPaper.tags.length === 0) && (
                    <p style={{ fontSize: '12px', color: T2, marginBottom: '8px' }}>
                      No tags yet. Add one below.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      list="graph-tag-options"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTagToPaper(selPaper.id);
                        }
                      }}
                      placeholder="Add a tag"
                    />
                    <datalist id="graph-tag-options">
                      {availableTags.map((tag) => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => addTagToPaper(selPaper.id)}
                      disabled={!tagDraft.trim()}
                    >
                      Add
                    </button>
                  </div>
                  {availableTags.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <p
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: T2,
                          marginBottom: '6px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Existing tags
                      </p>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {availableTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="tag"
                            onClick={() => addTagToPaper(selPaper.id, tag)}
                            style={{
                              background: tagColor[tag] || LINK,
                              border: 'none',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: '11px', color: T3, marginTop: '6px', marginBottom: 0 }}>
                    Click an existing tag to remove it.
                  </p>
                </div>
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
