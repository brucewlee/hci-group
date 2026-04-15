import { useMemo } from 'react';

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function useSearch(papers, query) {
  return useMemo(() => {
    if (!query.trim()) return [];

    const tokens = tokenize(query).filter((t) => t.length > 1);
    if (!tokens.length) return [];

    const results = [];

    // Search papers
    for (const paper of papers) {
      let score = 0;
      const searchText = `${paper.title} ${paper.authors} ${paper.abstract} ${paper.note}`;
      const paperTokens = tokenize(searchText);

      for (const token of tokens) {
        score += paperTokens.filter((t) => t.startsWith(token)).length;
      }

      if (score > 0) {
        results.push({
          type: 'paper',
          paperId: paper.id,
          title: paper.title,
          authors: paper.authors,
          preview: paper.abstract.slice(0, 150),
          score,
        });
      }

      // Search glossary entries
      for (const entry of paper.glossary) {
        let glossaryScore = 0;
        const glossaryText = `${entry.term} ${entry.definition}`;
        const glossaryTokens = tokenize(glossaryText);

        for (const token of tokens) {
          glossaryScore += glossaryTokens.filter((t) => t.startsWith(token)).length;
        }

        if (glossaryScore > 0) {
          results.push({
            type: 'glossary',
            paperId: paper.id,
            paperTitle: paper.title,
            term: entry.term,
            definition: entry.definition.slice(0, 100),
            score: glossaryScore,
          });
        }
      }

      // Search notes
      if (paper.note.trim()) {
        let noteScore = 0;
        const noteTokens = tokenize(paper.note);

        for (const token of tokens) {
          noteScore += noteTokens.filter((t) => t.startsWith(token)).length;
        }

        if (noteScore > 0) {
          results.push({
            type: 'note',
            paperId: paper.id,
            paperTitle: paper.title,
            preview: paper.note.slice(0, 150),
            score: noteScore,
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }, [papers, query]);
}
