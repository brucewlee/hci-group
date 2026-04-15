import { useState, useCallback, useEffect } from 'react';

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
      window.localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
    } catch (err) {
      console.error('Failed to save papers:', err);
    }
  }, [papers]);

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
    return newPaper;
  }, []);

  const updatePaper = useCallback((paperId, updates) => {
    setPapers((prev) =>
      prev.map((p) => (p.id === paperId ? { ...p, ...updates } : p))
    );
  }, []);

  const deletePaper = useCallback((paperId) => {
    setPapers((prev) => prev.filter((p) => p.id !== paperId));
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
