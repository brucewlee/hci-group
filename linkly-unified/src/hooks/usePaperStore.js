import { useState, useCallback, useEffect } from 'react';
import { deletePaperFile, loadPaperFiles, savePaperFile } from '../utils/paperFiles.js';

const PAPERS_KEY = 'linkly:papers';

export function usePaperStore() {
  const [papers, setPapers] = useState(() => {
    try {
      const stored = window.localStorage.getItem(PAPERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage whenever papers change
  useEffect(() => {
    try {
      const serializedPapers = papers.map(({ file, ...paper }) => ({
        ...paper,
        hasStoredFile: Boolean(file),
      }));
      window.localStorage.setItem(PAPERS_KEY, JSON.stringify(serializedPapers));
    } catch (err) {
      console.error('Failed to save papers:', err);
    }
  }, [papers]);

  useEffect(() => {
    let cancelled = false;

    loadPaperFiles()
      .then((filesById) => {
        if (cancelled) return;

        setPapers((current) =>
          current.map((paper) => ({
            ...paper,
            file: filesById[paper.id] || paper.file || null,
          })),
        );
      })
      .catch((error) => {
        console.error('Failed to load stored paper files:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addPaper = useCallback((paper) => {
    const newPaper = {
      id: `paper-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: '',
      authors: '',
      year: new Date().getFullYear(),
      abstract: '',
      arxiv: '',
      note: '',
      tags: [],
      buildsOn: [],
      glossary: [],
      annotations: [],
      uploadedAt: Date.now(),
      ...paper,
    };
    setPapers((prev) => [newPaper, ...prev]);

    if (newPaper.file) {
      savePaperFile(newPaper.id, newPaper.file).catch((error) => {
        console.error('Failed to persist paper file:', error);
      });
    }

    return newPaper;
  }, []);

  const updatePaper = useCallback((paperId, updates) => {
    setPapers((prev) =>
      prev.map((p) => (p.id === paperId ? { ...p, ...updates } : p))
    );

    if (Object.prototype.hasOwnProperty.call(updates, 'file')) {
      if (updates.file) {
        savePaperFile(paperId, updates.file).catch((error) => {
          console.error('Failed to persist updated paper file:', error);
        });
      } else {
        deletePaperFile(paperId).catch((error) => {
          console.error('Failed to remove stored paper file:', error);
        });
      }
    }
  }, []);

  const deletePaper = useCallback((paperId) => {
    setPapers((prev) => prev.filter((p) => p.id !== paperId));
    deletePaperFile(paperId).catch((error) => {
      console.error('Failed to delete stored paper file:', error);
    });
  }, []);

  const getPaper = useCallback(
    (paperId) => papers.find((p) => p.id === paperId),
    [papers]
  );

  return {
    papers,
    setPapers,
    addPaper,
    updatePaper,
    deletePaper,
    getPaper,
  };
}
