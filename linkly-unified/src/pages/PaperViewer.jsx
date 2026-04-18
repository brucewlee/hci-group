import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faDrawPolygon,
  faEye,
  faEyeSlash,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
} from '@fortawesome/free-solid-svg-icons';
import samplePaperUrl from '../assets/sample-paper.pdf?url';

function parseArxivIdentifier(value) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!/arxiv\.org$/i.test(url.hostname)) {
      return null;
    }

    const match = url.pathname.match(/^\/(?:abs|pdf)\/([^?#]+?)(?:\.pdf)?$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

if (!Promise.withResolvers) {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MIN_RECT_SIZE = 18;
const DEFAULT_ANNOTATION_WIDTH = 140;
const DEFAULT_ANNOTATION_HEIGHT = 72;
const CALLOUT_HEIGHT = 0.13;
const CALLOUT_GAP = 0.018;

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeDraft(draft) {
  const left = Math.min(draft.startX, draft.endX);
  const top = Math.min(draft.startY, draft.endY);
  const width = Math.abs(draft.endX - draft.startX);
  const height = Math.abs(draft.endY - draft.startY);

  if (width < MIN_RECT_SIZE || height < MIN_RECT_SIZE) {
    return null;
  }

  return {
    x: left / draft.containerWidth,
    y: top / draft.containerHeight,
    width: width / draft.containerWidth,
    height: height / draft.containerHeight,
  };
}

function createDefaultBounds(draft) {
  const width = Math.min(DEFAULT_ANNOTATION_WIDTH, draft.containerWidth);
  const height = Math.min(DEFAULT_ANNOTATION_HEIGHT, draft.containerHeight);
  const left = clamp(draft.startX - width / 2, 0, draft.containerWidth - width);
  const top = clamp(draft.startY - height / 2, 0, draft.containerHeight - height);

  return {
    x: left / draft.containerWidth,
    y: top / draft.containerHeight,
    width: width / draft.containerWidth,
    height: height / draft.containerHeight,
  };
}

function rectStyle(bounds) {
  return {
    left: `${bounds.x * 100}%`,
    top: `${bounds.y * 100}%`,
    width: `${bounds.width * 100}%`,
    height: `${bounds.height * 100}%`,
  };
}

function layoutAnnotationCallouts(pageAnnotations) {
  const laidOut = [...pageAnnotations]
    .sort(
      (left, right) =>
        left.bounds.y + left.bounds.height / 2 - (right.bounds.y + right.bounds.height / 2),
    )
    .map((annotation) => ({
      annotation,
      anchor: annotation.bounds.y + annotation.bounds.height / 2,
      top: 0,
    }));

  let cursor = 0;
  laidOut.forEach((item) => {
    const desiredTop = clamp(item.anchor - CALLOUT_HEIGHT / 2, 0, 1 - CALLOUT_HEIGHT);
    item.top = Math.max(desiredTop, cursor);
    cursor = item.top + CALLOUT_HEIGHT + CALLOUT_GAP;
  });

  const overflow = cursor - CALLOUT_GAP - 1;
  if (overflow > 0) {
    laidOut.forEach((item) => {
      item.top -= overflow;
    });

    if (laidOut[0] && laidOut[0].top < 0) {
      laidOut[0].top = 0;
      for (let index = 1; index < laidOut.length; index += 1) {
        laidOut[index].top = laidOut[index - 1].top + CALLOUT_HEIGHT + CALLOUT_GAP;
      }
    }
  }

  return laidOut;
}

function calloutStyle(top) {
  return {
    top: `${top * 100}%`,
    height: `${CALLOUT_HEIGHT * 100}%`,
  };
}

function getTabButtonClass(isActive) {
  return isActive ? 'simple-tab is-active' : 'simple-tab';
}

const MINI_GRAPH_WIDTH = 228;
const MINI_GRAPH_HEIGHT = 196;
const MINI_LAYOUT_WIDTH = 720;
const MINI_LAYOUT_HEIGHT = 460;
const MINI_LAYOUT_MARGIN = 58;
const MINI_NODE_RADIUS = 10;

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function runMiniGraphLayout(papers, iterations = 150) {
  if (!papers.length) {
    return [];
  }

  const nodes = papers.map((entry, index) => {
    const hash = hashString(entry.id || `${entry.title || 'paper'}-${index}`);
    const angle = (hash % 360) * (Math.PI / 180);
    const radius = 120 + (hash % 120);

    return {
      ...entry,
      buildsOn: entry.buildsOn || [],
      x: MINI_LAYOUT_WIDTH / 2 + Math.cos(angle) * radius,
      y: MINI_LAYOUT_HEIGHT / 2 + Math.sin(angle) * (radius * 0.62),
      vx: 0,
      vy: 0,
    };
  });

  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));

  for (let step = 0; step < iterations; step += 1) {
    const decay = 1 - step / iterations;

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const leftNode = nodes[leftIndex];
        const rightNode = nodes[rightIndex];
        const dx = rightNode.x - leftNode.x;
        const dy = rightNode.y - leftNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (2800 * decay) / (distance * distance);

        leftNode.vx -= (force * dx) / distance;
        leftNode.vy -= (force * dy) / distance;
        rightNode.vx += (force * dx) / distance;
        rightNode.vy += (force * dy) / distance;
      }

      nodes[leftIndex].buildsOn.forEach((targetId) => {
        const targetNode = nodeMap[targetId];
        if (!targetNode) {
          return;
        }

        const dx = targetNode.x - nodes[leftIndex].x;
        const dy = targetNode.y - nodes[leftIndex].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (0.55 * decay * distance) / 92;

        nodes[leftIndex].vx += (force * dx) / distance;
        nodes[leftIndex].vy += (force * dy) / distance;
        targetNode.vx -= (force * dx) / distance;
        targetNode.vy -= (force * dy) / distance;
      });
    }

    nodes.forEach((node) => {
      node.vx *= 1 - 0.07 * decay;
      node.vy *= 1 - 0.07 * decay;
      node.x += node.vx;
      node.y += node.vy;
      node.x = clamp(node.x, MINI_LAYOUT_MARGIN, MINI_LAYOUT_WIDTH - MINI_LAYOUT_MARGIN);
      node.y = clamp(node.y, MINI_LAYOUT_MARGIN, MINI_LAYOUT_HEIGHT - MINI_LAYOUT_MARGIN);
    });
  }

  return nodes;
}

function fitMiniGraphNodes(nodes) {
  if (!nodes.length) {
    return [];
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const paddingX = 18;
  const paddingTop = 16;
  const paddingBottom = 36;
  const scale = Math.min(
    (MINI_GRAPH_WIDTH - paddingX * 2) / contentWidth,
    (MINI_GRAPH_HEIGHT - paddingTop - paddingBottom) / contentHeight,
  );

  return nodes.map((node) => ({
    ...node,
    x: paddingX + (node.x - minX) * scale,
    y: paddingTop + (node.y - minY) * scale,
  }));
}

function truncateMiniGraphTitle(title) {
  const normalizedTitle = title || 'Untitled';
  return normalizedTitle.length > 22 ? `${normalizedTitle.slice(0, 20)}…` : normalizedTitle;
}

function buildMiniGraphData(currentPaper, papers) {
  if (!currentPaper) {
    return null;
  }

  const laidOutNodes = fitMiniGraphNodes(runMiniGraphLayout(papers));
  const nodeMap = new Map(laidOutNodes.map((node) => [node.id, node]));
  const edges = [];

  papers.forEach((sourcePaper) => {
    (sourcePaper.buildsOn || []).forEach((targetId) => {
      const fromNode = nodeMap.get(sourcePaper.id);
      const toNode = nodeMap.get(targetId);

      if (!fromNode || !toNode) {
        return;
      }

      edges.push({
        id: `${sourcePaper.id}-${targetId}`,
        from: sourcePaper.id,
        to: targetId,
      });
    });
  });

  return {
    nodes: laidOutNodes.map((node) => ({
      id: node.id,
      title: node.title || 'Untitled',
      year: node.year,
      x: node.x,
      y: node.y,
      isCurrent: node.id === currentPaper.id,
      hasConnections:
        (node.buildsOn || []).length > 0 ||
        papers.some((paper) => (paper.buildsOn || []).includes(node.id)),
    })),
    edges,
    totalCount: laidOutNodes.length,
  };
}

function MiniGraphPreview({ paper, papers, onOpenPaper, onOpenGraph }) {
  const graphData = useMemo(() => buildMiniGraphData(paper, papers), [paper, papers]);
  const svgRef = useRef(null);
  const [nodePositions, setNodePositions] = useState({});
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);

  useEffect(() => {
    if (!graphData) return;
    setNodePositions((prev) => {
      const next = {};
      for (const node of graphData.nodes) {
        next[node.id] = prev[node.id] || { x: node.x, y: node.y };
      }
      return next;
    });
  }, [graphData]);

  if (!paper || !graphData) {
    return null;
  }

  const getPos = (node) => nodePositions[node.id] || { x: node.x, y: node.y };
  const nodeMap = new Map(graphData.nodes.map((node) => [node.id, node]));

  function svgPointFromEvent(event) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = MINI_GRAPH_WIDTH / rect.width;
    const scaleY = MINI_GRAPH_HEIGHT / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    const point = svgPointFromEvent(event);
    const current = nodePositions[nodeId] || nodeMap.get(nodeId);
    dragState.current = {
      type: 'node',
      nodeId,
      offsetX: point.x - current.x,
      offsetY: point.y - current.y,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleBackgroundPointerDown(event) {
    if (event.target.closest('[data-node-id]')) return;
    event.preventDefault();
    dragState.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      panStart: { ...pan },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const state = dragState.current;
    if (!state) return;
    if (state.type === 'node') {
      const point = svgPointFromEvent(event);
      const nx = point.x - state.offsetX;
      const ny = point.y - state.offsetY;
      if (Math.abs(event.clientX - state.startX) > 2 || Math.abs(event.clientY - state.startY) > 2) {
        state.moved = true;
      }
      setNodePositions((prev) => ({ ...prev, [state.nodeId]: { x: nx, y: ny } }));
    } else if (state.type === 'pan') {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = MINI_GRAPH_WIDTH / rect.width;
      const scaleY = MINI_GRAPH_HEIGHT / rect.height;
      setPan({
        x: state.panStart.x + (event.clientX - state.startX) * scaleX,
        y: state.panStart.y + (event.clientY - state.startY) * scaleY,
      });
    }
  }

  function handlePointerUp(event, nodeId) {
    const state = dragState.current;
    dragState.current = null;
    if (state?.type === 'node' && !state.moved && nodeId) {
      onOpenPaper(nodeId);
    }
  }

  function handleNodeKeyDown(event, nodeId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onOpenPaper(nodeId);
    }
  }

  function recenter() {
    setPan({ x: 0, y: 0 });
    const reset = {};
    for (const node of graphData.nodes) {
      reset[node.id] = { x: node.x, y: node.y };
    }
    setNodePositions(reset);
  }

  return (
    <article className="reader-card mini-graph-card">
      <div className="mini-graph-header">
        <div>
          <h3>Graph</h3>
          <p className="reader-subtitle">
            {graphData.totalCount
              ? `${graphData.totalCount} paper${graphData.totalCount === 1 ? '' : 's'} in your graph`
              : 'No papers in the graph yet'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="secondary-button mini-graph-open-button"
            type="button"
            onClick={recenter}
          >
            Recenter
          </button>
          <button
            className="secondary-button mini-graph-open-button"
            type="button"
            onClick={onOpenGraph}
          >
            Open graph
          </button>
        </div>
      </div>

      <div className="mini-graph-shell" aria-label="Miniature paper graph preview">
        <svg
          ref={svgRef}
          className="mini-graph-svg"
          viewBox={`0 0 ${MINI_GRAPH_WIDTH} ${MINI_GRAPH_HEIGHT}`}
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => handlePointerUp()}
          onPointerCancel={() => handlePointerUp()}
          style={{ cursor: dragState.current?.type === 'pan' ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <g transform={`translate(${pan.x}, ${pan.y})`}>
            {graphData.edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) return null;
              const fromPos = getPos(fromNode);
              const toPos = getPos(toNode);
              return (
                <line
                  key={edge.id}
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  className="mini-graph-edge"
                />
              );
            })}

            {graphData.nodes.map((node) => {
              const pos = getPos(node);
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className={node.isCurrent ? 'mini-graph-node is-current' : 'mini-graph-node'}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => handlePointerDown(event, node.id)}
                  onPointerUp={(event) => handlePointerUp(event, node.id)}
                  onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                  style={{ cursor: 'grab' }}
                >
                  <title>{node.isCurrent ? `${node.title} (current paper)` : node.title}</title>
                  <circle cx={pos.x} cy={pos.y + 11} r={24} className="mini-graph-hit-area" />
                  <circle cx={pos.x} cy={pos.y} r={MINI_NODE_RADIUS} className="mini-graph-node-dot" />
                  <text
                    x={pos.x}
                    y={pos.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="mini-graph-node-year"
                  >
                    '{String(node.year || 2024).slice(-2)}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 24}
                    textAnchor="middle"
                    className="mini-graph-node-label"
                  >
                    {truncateMiniGraphTitle(node.title)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <p className="mini-graph-summary">
        Drag the background to pan, drag nodes to reposition, click a node to open that paper.
      </p>
    </article>
  );
}

export function PaperViewer({ paper, papers = [], updatePaper, availableTags = [] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { paperId } = useParams();
  const [activeTab, setActiveTab] = useState('glossary');
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState('');
  const [zoom, setZoom] = useState(1.15);
  const [selectionDraft, setSelectionDraft] = useState(null);
  const [termDraft, setTermDraft] = useState('');
  const [definitionDraft, setDefinitionDraft] = useState('');
  const [paperTags, setPaperTags] = useState(paper?.tags || []);
  const [tagDraft, setTagDraft] = useState('');
  const [glossaryEntries, setGlossaryEntries] = useState(paper?.glossary || []);
  const [annotations, setAnnotations] = useState(paper?.annotations || []);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [dragDraft, setDragDraft] = useState(null);
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [activeAnnotationId, setActiveAnnotationId] = useState(null);
  const [editingGlossaryId, setEditingGlossaryId] = useState(null);
  const [expandedGlossaryId, setExpandedGlossaryId] = useState(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState(null);
  const [editingAnnotationComment, setEditingAnnotationComment] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const viewerRef = useRef(null);
  const pageRefs = useRef(new Map());
  const selectionTimeoutRef = useRef(null);

  useEffect(() => {
    setPaperTags(paper?.tags || []);
    setTagDraft('');
    setGlossaryEntries(paper?.glossary || []);
    setAnnotations(paper?.annotations || []);
    setSelectionDraft(null);
    setTermDraft('');
    setDefinitionDraft('');
    setDragDraft(null);
    setPendingAnnotation(null);
    setCommentDraft('');
    setActiveAnnotationId(null);
    setEditingGlossaryId(null);
    setExpandedGlossaryId(null);
    setEditingAnnotationId(null);
    setEditingAnnotationComment('');
    setSidebarCollapsed(false);
    setActiveTab(location.state?.activeTab || 'glossary');
  }, [location.state, paper?.id]);

  useEffect(() => {
    if (paper && updatePaper) {
      updatePaper(paperId, { tags: paperTags, glossary: glossaryEntries, annotations });
    }
  }, [annotations, glossaryEntries, paper, paperId, paperTags, updatePaper]);

  useEffect(() => {
    return () => {
      if (selectionTimeoutRef.current) {
        window.clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  if (!paper) {
    return (
      <div
        className="page-wrapper"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}
      >
        <div style={{ textAlign: 'center' }}>
          <p>Paper not found.</p>
          <Link to="/library" className="btn btn-primary" style={{ marginTop: '16px' }}>
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  function rememberPageNode(pageNumber, node) {
    if (node) {
      pageRefs.current.set(pageNumber, node);
      return;
    }

    pageRefs.current.delete(pageNumber);
  }

  function openSidebarTab(tab) {
    setSidebarCollapsed(false);
    setActiveTab(tab);
  }

  function handleDocumentLoadSuccess({ numPages: nextNumPages }) {
    setPdfError('');
    setNumPages(nextNumPages);
  }

  function handleDocumentLoadError(error) {
    setPdfError(error?.message || String(error));
  }

  function scheduleSelectionCapture() {
    if (annotationMode) return;

    if (selectionTimeoutRef.current) {
      window.clearTimeout(selectionTimeoutRef.current);
    }

    selectionTimeoutRef.current = window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const text = selection.toString().replace(/\s+/g, ' ').trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      const ancestor =
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentElement
          : range.commonAncestorContainer;

      if (!(ancestor instanceof Element) || !viewerRef.current?.contains(ancestor)) return;

      const pageElement = ancestor.closest('[data-page-number]');
      const pageNumber = Number(pageElement?.dataset.pageNumber || 1);

      setSelectionDraft({ text, pageNumber });
      setTermDraft(text);
      setDefinitionDraft('');
      openSidebarTab('glossary');
    }, 20);
  }

  function clearGlossaryDraft() {
    setSelectionDraft(null);
    setTermDraft('');
    setDefinitionDraft('');
    setEditingGlossaryId(null);
    window.getSelection()?.removeAllRanges();
  }

  function startGlossaryEdit(entry) {
    openSidebarTab('glossary');
    setEditingGlossaryId(entry.id);
    setExpandedGlossaryId(entry.id);
    setTermDraft(entry.term);
    setDefinitionDraft(entry.definition);
    setSelectionDraft(null);
  }

  function cancelGlossaryEdit() {
    setEditingGlossaryId(null);
    setTermDraft('');
    setDefinitionDraft('');
  }

  function addPaperTagValue(value) {
    const nextTag = value.trim();
    if (!nextTag) return;

    setPaperTags((current) => {
      const hasMatch = current.some((tag) => tag.toLowerCase() === nextTag.toLowerCase());
      return hasMatch ? current : [...current, nextTag];
    });
    setTagDraft('');
  }

  function addPaperTag(event) {
    event.preventDefault();
    addPaperTagValue(tagDraft);
  }

  function removePaperTag(tagToRemove) {
    setPaperTags((current) => current.filter((tag) => tag !== tagToRemove));
  }

  const selectableTags = availableTags.filter(
    (tag) => !paperTags.some((paperTag) => paperTag.toLowerCase() === tag.toLowerCase()),
  );

  function saveGlossaryEntry(event) {
    event.preventDefault();
    const term = termDraft.trim();
    const definition = definitionDraft.trim();
    if (!term || !definition) return;

    if (editingGlossaryId) {
      setGlossaryEntries((current) =>
        current.map((entry) =>
          entry.id === editingGlossaryId ? { ...entry, term, definition } : entry,
        ),
      );
      clearGlossaryDraft();
      return;
    }

    const nextEntry = {
      id: createId(),
      term,
      definition,
      pageNumber: selectionDraft?.pageNumber || 1,
    };

    setGlossaryEntries((current) => [nextEntry, ...current]);
    clearGlossaryDraft();
  }

  function deleteGlossaryEntry(entryId) {
    setGlossaryEntries((current) => current.filter((entry) => entry.id !== entryId));

    if (editingGlossaryId === entryId) {
      clearGlossaryDraft();
    }

    if (expandedGlossaryId === entryId) {
      setExpandedGlossaryId(null);
    }
  }

  function getRelativePoint(pageNumber, event) {
    const pageNode = pageRefs.current.get(pageNumber);
    if (!pageNode) return null;

    const bounds = pageNode.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
      containerWidth: bounds.width,
      containerHeight: bounds.height,
    };
  }

  function beginAnnotation(pageNumber, event) {
    if (!annotationMode || pendingAnnotation) return;
    const point = getRelativePoint(pageNumber, event);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragDraft({
      pageNumber,
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
      containerWidth: point.containerWidth,
      containerHeight: point.containerHeight,
    });
    setActiveAnnotationId(null);
  }

  function updateAnnotation(pageNumber, event) {
    const point = getRelativePoint(pageNumber, event);
    setDragDraft((current) => {
      if (!current || current.pageNumber !== pageNumber || !point) return current;

      return {
        ...current,
        endX: point.x,
        endY: point.y,
        containerWidth: point.containerWidth,
        containerHeight: point.containerHeight,
      };
    });
  }

  function finishAnnotation(pageNumber, event) {
    const point = getRelativePoint(pageNumber, event);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragDraft((current) => {
      if (!current || current.pageNumber !== pageNumber) return current;

      const completedDraft = point
        ? {
            ...current,
            endX: point.x,
            endY: point.y,
            containerWidth: point.containerWidth,
            containerHeight: point.containerHeight,
          }
        : current;

      const normalized = normalizeDraft(completedDraft);
      const finalBounds = normalized || createDefaultBounds(completedDraft);

      setPendingAnnotation({ pageNumber, bounds: finalBounds });
      setAnnotationMode(false);
      setCommentDraft('');
      openSidebarTab('annotations');
      return null;
    });
  }

  function cancelAnnotationDraft() {
    setPendingAnnotation(null);
    setCommentDraft('');
  }

  function startAnnotationEdit(annotation) {
    setActiveAnnotationId(annotation.id);
    openSidebarTab('annotations');
    setEditingAnnotationId(annotation.id);
    setEditingAnnotationComment(annotation.comment);
  }

  function cancelAnnotationEdit() {
    setEditingAnnotationId(null);
    setEditingAnnotationComment('');
  }

  function saveAnnotationEdit(event) {
    event.preventDefault();
    if (!editingAnnotationId || !editingAnnotationComment.trim()) {
      return;
    }

    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === editingAnnotationId
          ? { ...annotation, comment: editingAnnotationComment.trim() }
          : annotation,
      ),
    );
    cancelAnnotationEdit();
  }

  function deleteAnnotation(annotationId) {
    setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    if (activeAnnotationId === annotationId) {
      setActiveAnnotationId(null);
    }
    if (editingAnnotationId === annotationId) {
      cancelAnnotationEdit();
    }
  }

  function saveAnnotation(event) {
    event.preventDefault();
    if (!pendingAnnotation || !commentDraft.trim()) return;

    const nextAnnotation = {
      id: createId(),
      pageNumber: pendingAnnotation.pageNumber,
      bounds: pendingAnnotation.bounds,
      comment: commentDraft.trim(),
    };

    setAnnotations((current) => [nextAnnotation, ...current]);
    setPendingAnnotation(null);
    setCommentDraft('');
    setAnnotationMode(false);
    setActiveAnnotationId(nextAnnotation.id);
  }

  function focusAnnotation(annotation) {
    startAnnotationEdit(annotation);
    pageRefs.current.get(annotation.pageNumber)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function setAnnotationVisibility(nextVisible) {
    setAnnotationsVisible(nextVisible);
    if (!nextVisible) {
      setActiveAnnotationId(null);
    }
  }

  function toggleAnnotationMode() {
    const nextMode = !annotationMode;
    setAnnotationMode(nextMode);
    setAnnotationsVisible(true);
    setPendingAnnotation(null);
    setCommentDraft('');
    openSidebarTab('annotations');
  }

  const pdfErrorMessage = pdfError ? `PDF load error: ${pdfError}` : '';
  const workbenchClassName = sidebarCollapsed
    ? 'pdf-workbench sidebar-collapsed'
    : 'pdf-workbench';
  const sidebarClassName = sidebarCollapsed ? 'pdf-sidebar is-collapsed' : 'pdf-sidebar';
  const annotationToggleClassName = annotationMode ? 'primary-button' : 'secondary-button';
  const paperTitle = paper.title || 'Sample Academic Paper';
  const arxivId = parseArxivIdentifier(paper.arxiv || '');
  const pdfUrl = paper.file || (arxivId ? `/api/arxiv-pdf/${arxivId}.pdf` : samplePaperUrl);

  return (
    <div className="page-wrapper" style={{ padding: 0 }}>
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button onClick={() => navigate('/library')} className="btn btn-icon" type="button">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <h2 style={{ flex: 1, marginBottom: 0 }}>{paperTitle}</h2>
      </div>

      <section className={workbenchClassName} style={{ padding: '16px', margin: 0 }}>
        <div
          className="pdf-stage"
          ref={viewerRef}
          onMouseUp={scheduleSelectionCapture}
          onTouchEnd={scheduleSelectionCapture}
        >
          <div className="pdf-stage-header">
            <div className="pdf-stage-title">
              <h2>{paperTitle}</h2>
            </div>

            <div className="zoom-controls">
              <button
                className="icon-button"
                type="button"
                onClick={() => setZoom((current) => Math.max(0.8, current - 0.1))}
                aria-label="Zoom out"
              >
                <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                className="icon-button"
                type="button"
                onClick={() => setZoom((current) => Math.min(1.8, current + 0.1))}
                aria-label="Zoom in"
              >
                <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
              </button>
            </div>
          </div>

          <div className="pdf-scroll-shell">
            <Document
              file={pdfUrl}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading={<div className="loading-card">Rendering academic paper...</div>}
              error={
                <div className="loading-card">
                  The PDF could not be rendered. {pdfErrorMessage || 'Check the PDF setup.'}
                </div>
              }
            >
              {Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1;
                const pageAnnotations = annotations.filter(
                  (annotation) => annotation.pageNumber === pageNumber,
                );
                const laidOutAnnotations = layoutAnnotationCallouts(pageAnnotations);
                const draftBounds =
                  dragDraft && dragDraft.pageNumber === pageNumber ? normalizeDraft(dragDraft) : null;

                return (
                  <article key={pageNumber} className="pdf-page-card">
                    <div className="pdf-page-meta">Page {pageNumber}</div>
                    <div className="pdf-page-layout">
                      <div
                        className="pdf-page-shell"
                        data-page-number={pageNumber}
                        ref={(node) => rememberPageNode(pageNumber, node)}
                      >
                        <Page
                          pageNumber={pageNumber}
                          renderAnnotationLayer
                          renderTextLayer
                          scale={zoom}
                          loading=""
                        />
                        <div
                          className={annotationMode ? 'annotation-layer is-active' : 'annotation-layer'}
                          onPointerDown={(event) => beginAnnotation(pageNumber, event)}
                          onPointerMove={(event) => updateAnnotation(pageNumber, event)}
                          onPointerUp={(event) => finishAnnotation(pageNumber, event)}
                          onPointerCancel={() => setDragDraft(null)}
                        >
                          {annotationsVisible
                            ? pageAnnotations.map((annotation) => (
                                <button
                                  key={annotation.id}
                                  className={
                                    annotation.id === activeAnnotationId
                                      ? 'annotation-box is-active'
                                      : 'annotation-box'
                                  }
                                  style={rectStyle(annotation.bounds)}
                                  type="button"
                                  onClick={() => focusAnnotation(annotation)}
                                  title={annotation.comment}
                                />
                              ))
                            : null}
                          {draftBounds ? (
                            <div
                              className="annotation-box annotation-box-draft"
                              style={rectStyle(draftBounds)}
                            />
                          ) : null}
                          {pendingAnnotation && pendingAnnotation.pageNumber === pageNumber ? (
                            <div
                              className="annotation-box annotation-box-pending"
                              style={rectStyle(pendingAnnotation.bounds)}
                            />
                          ) : null}
                        </div>
                      </div>

                      {annotationsVisible && laidOutAnnotations.length ? (
                        <div className="annotation-margin">
                          <svg
                            className="annotation-connectors"
                            viewBox="0 0 56 100"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            {laidOutAnnotations.map(({ annotation, anchor, top }) => {
                              const calloutMidpoint = (top + CALLOUT_HEIGHT / 2) * 100;
                              const anchorPoint = anchor * 100;

                              return (
                                <g key={`${annotation.id}-connector`}>
                                  <polyline
                                    points={`8,${anchorPoint} 18,${anchorPoint} 18,${calloutMidpoint} 56,${calloutMidpoint}`}
                                    className="annotation-connector-path"
                                  />
                                </g>
                              );
                            })}
                          </svg>

                          {laidOutAnnotations.map(({ annotation, anchor }) => (
                            <span
                              key={`${annotation.id}-anchor`}
                              className="annotation-connector-anchor"
                              style={{ top: `${anchor * 100}%` }}
                              aria-hidden="true"
                            />
                          ))}

                          {laidOutAnnotations.map(({ annotation, top }) => (
                            <button
                              key={`${annotation.id}-callout`}
                              className={
                                annotation.id === activeAnnotationId
                                  ? 'annotation-callout is-active'
                                  : 'annotation-callout'
                              }
                              style={calloutStyle(top)}
                              type="button"
                              onClick={() => focusAnnotation(annotation)}
                            >
                              <p>{annotation.comment}</p>
                              <span className="annotation-callout-action">Click to view or edit</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </Document>
          </div>
        </div>

        <aside className={sidebarClassName}>
          {sidebarCollapsed ? (
            <div className="collapsed-sidebar-summary">
              <button
                className="icon-button"
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label="Expand sidebar"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <button
                className={
                  annotationsVisible
                    ? 'icon-button sidebar-mini-toggle is-active'
                    : 'icon-button sidebar-mini-toggle'
                }
                type="button"
                onClick={() => setAnnotationVisibility(!annotationsVisible)}
                aria-label={annotationsVisible ? 'Hide annotations' : 'Show annotations'}
                title={annotationsVisible ? 'Hide annotations' : 'Show annotations'}
              >
                <FontAwesomeIcon icon={annotationsVisible ? faEye : faEyeSlash} />
              </button>
            </div>
          ) : (
            <>
              <div className="sidebar-tabs" role="tablist" aria-label="Reader panels">
                <button
                  className="icon-button sidebar-collapse-button"
                  type="button"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  aria-label="Collapse sidebar"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
                <button
                  className={getTabButtonClass(activeTab === 'tags')}
                  type="button"
                  onClick={() => setActiveTab('tags')}
                >
                  Tags
                </button>
                <button
                  className={getTabButtonClass(activeTab === 'graph')}
                  type="button"
                  onClick={() => setActiveTab('graph')}
                >
                  Graph
                </button>
                <button
                  className={getTabButtonClass(activeTab === 'glossary')}
                  type="button"
                  onClick={() => setActiveTab('glossary')}
                >
                  Glossary
                </button>
                <button
                  className={getTabButtonClass(activeTab === 'annotations')}
                  type="button"
                  onClick={() => setActiveTab('annotations')}
                >
                  Annotations
                </button>
              </div>

              <div className="sidebar-panel">
                {activeTab === 'graph' ? (
                  <MiniGraphPreview
                    paper={paper}
                    papers={papers}
                    onOpenPaper={(nextPaperId) =>
                      navigate(`/paper/${nextPaperId}`, { state: { activeTab: 'graph' } })
                    }
                    onOpenGraph={() => navigate('/graph')}
                  />
                ) : null}

                {activeTab === 'tags' ? (
                  <div className="tags-tab-layout">
                    <article className="reader-card paper-tags-card">
                      <div className="paper-tags-header">
                        <h3>Tags</h3>
                        <span>{paperTags.length}</span>
                      </div>
                      {paperTags.length ? (
                        <div className="paper-tags-list">
                          {paperTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="paper-tag-chip"
                              onClick={() => removePaperTag(tag)}
                              title={`Remove tag "${tag}"`}
                            >
                              {tag} ×
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-state">No tags yet. Add one below.</p>
                      )}
                    </article>

                    <article className="reader-card paper-tags-card">
                      <h3>Add tag</h3>
                      <form className="stack-form" onSubmit={addPaperTag}>
                        <div className="paper-tag-form">
                          <input
                            className="text-input"
                            type="text"
                            list="paper-view-tag-options"
                            value={tagDraft}
                            onChange={(event) => setTagDraft(event.target.value)}
                            placeholder="Add a tag"
                          />
                          <datalist id="paper-view-tag-options">
                            {selectableTags.map((tag) => (
                              <option key={tag} value={tag} />
                            ))}
                          </datalist>
                          <button
                            className="secondary-button"
                            type="submit"
                            disabled={!tagDraft.trim()}
                          >
                            Add
                          </button>
                        </div>
                      </form>
                      {selectableTags.length ? (
                        <>
                          <p className="reader-subtitle">
                            Add from existing tags in your library.
                          </p>
                          <div className="paper-tags-list">
                            {selectableTags.map((tag) => (
                              <button
                                key={`available-${tag}`}
                                type="button"
                                className="paper-tag-chip paper-tag-chip-add"
                                onClick={() => addPaperTagValue(tag)}
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="empty-state">No other tags available yet.</p>
                      )}
                    </article>
                  </div>
                ) : null}

                {activeTab === 'glossary' ? (
                  <div className="glossary-tab-layout">
                    <article className="reader-card glossary-composer-card">
                      <h3>Define term</h3>
                      <div className="glossary-composer-header">
                        <div>
                          <p className="reader-subtitle">
                            {selectionDraft
                              ? `Selected from page ${selectionDraft.pageNumber}`
                              : 'Highlight text in the PDF or type a term here.'}
                          </p>
                        </div>
                        {selectionDraft ? (
                          <div className="glossary-source-chip">"{selectionDraft.text}"</div>
                        ) : null}
                      </div>

                      <form className="stack-form" onSubmit={saveGlossaryEntry}>
                        <input
                          className="text-input"
                          type="text"
                          value={termDraft}
                          onChange={(event) => setTermDraft(event.target.value)}
                          placeholder="Term"
                        />
                        <textarea
                          className="text-input glossary-textarea"
                          rows="3"
                          value={definitionDraft}
                          onChange={(event) => setDefinitionDraft(event.target.value)}
                          placeholder="Definition"
                        />
                        <div className="form-actions">
                          <button
                            className="primary-button"
                            type="submit"
                            disabled={!termDraft.trim() || !definitionDraft.trim()}
                          >
                            {editingGlossaryId ? 'Save changes' : 'Save glossary item'}
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={editingGlossaryId ? cancelGlossaryEdit : clearGlossaryDraft}
                          >
                            {editingGlossaryId ? 'Cancel edit' : 'Clear'}
                          </button>
                        </div>
                      </form>
                    </article>

                    <article className="reader-card glossary-definitions-card">
                      <div className="glossary-definitions-header">
                        <strong>Definitions</strong>
                        <span>{glossaryEntries.length}</span>
                      </div>
                      {glossaryEntries.length ? (
                        <div className="list-stack glossary-list">
                          {glossaryEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className={
                                editingGlossaryId === entry.id
                                  ? 'list-card glossary-entry is-editing'
                                  : 'list-card glossary-entry'
                              }
                            >
                              <div className="glossary-entry-header">
                                <button
                                  className="glossary-entry-toggle"
                                  type="button"
                                  onClick={() =>
                                    setExpandedGlossaryId((current) =>
                                      current === entry.id ? null : entry.id,
                                    )
                                  }
                                >
                                  <span className="glossary-entry-summary-term">{entry.term}</span>
                                  <span>Page {entry.pageNumber}</span>
                                </button>
                                <div className="glossary-entry-actions">
                                  <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={() => startGlossaryEdit(entry)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="secondary-button"
                                    type="button"
                                    onClick={() => deleteGlossaryEntry(entry.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {expandedGlossaryId === entry.id ? (
                                <div className="glossary-entry-expanded">
                                  <strong>{entry.term}</strong>
                                  <p>{entry.definition}</p>
                                </div>
                              ) : (
                                <p className="glossary-entry-preview">{entry.definition}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-state">No glossary items yet.</p>
                      )}
                    </article>
                  </div>
                ) : null}

                {activeTab === 'annotations' ? (
                  <div className="annotations-tab-layout">
                    <article className="reader-card annotations-controls-card">
                      <h3>Annotations</h3>
                      <div className="annotation-controls">
                        <label className="annotation-visibility-toggle">
                          <input
                            type="checkbox"
                            checked={annotationsVisible}
                            onChange={(event) => setAnnotationVisibility(event.target.checked)}
                          />
                          <span>Show annotations</span>
                        </label>

                        <button
                          className={annotationToggleClassName}
                          type="button"
                          onClick={toggleAnnotationMode}
                        >
                          <FontAwesomeIcon icon={faDrawPolygon} />
                          {annotationMode ? 'Cancel drawing' : 'Add annotation'}
                        </button>
                      </div>

                      {pendingAnnotation ? (
                        <form className="stack-form" onSubmit={saveAnnotation}>
                          <p className="empty-state">
                            Region selected. Add a comment to save the annotation.
                          </p>
                          <textarea
                            className="text-input"
                            rows="4"
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            placeholder="Comment on selected region"
                          />
                          <div className="form-actions">
                            <button
                              className="primary-button"
                              type="submit"
                              disabled={!commentDraft.trim()}
                            >
                              Save
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={cancelAnnotationDraft}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {editingAnnotationId ? (
                        <form className="stack-form" onSubmit={saveAnnotationEdit}>
                          <p className="empty-state">Editing selected annotation.</p>
                          <textarea
                            className="text-input"
                            rows="4"
                            value={editingAnnotationComment}
                            onChange={(event) => setEditingAnnotationComment(event.target.value)}
                            placeholder="Update comment"
                          />
                          <div className="form-actions">
                            <button
                              className="primary-button"
                              type="submit"
                              disabled={!editingAnnotationComment.trim()}
                            >
                              Save changes
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={cancelAnnotationEdit}
                            >
                              Cancel
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => deleteAnnotation(editingAnnotationId)}
                            >
                              Delete
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </article>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}
