import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

export function PaperViewer({ paper, updatePaper }) {
  const navigate = useNavigate();
  const { paperId } = useParams();
  const [activeTab, setActiveTab] = useState('glossary');
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState('');
  const [zoom, setZoom] = useState(1.15);
  const [selectionDraft, setSelectionDraft] = useState(null);
  const [termDraft, setTermDraft] = useState('');
  const [definitionDraft, setDefinitionDraft] = useState('');
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
    setActiveTab('glossary');
  }, [paper?.id]);

  useEffect(() => {
    if (paper && updatePaper) {
      updatePaper(paperId, { glossary: glossaryEntries, annotations });
    }
  }, [annotations, glossaryEntries, paper, paperId, updatePaper]);

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
  const pdfUrl = paper.file || samplePaperUrl;

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
