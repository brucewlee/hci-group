const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.6';

async function callClaude(prompt, { maxTokens = 1000 } = {}) {
  const key = import.meta.env.VITE_OPENROUTER_KEY;
  if (!key) {
    const err = new Error('Missing VITE_OPENROUTER_KEY. Add it to .env and restart the dev server.');
    err.code = 'NO_KEY';
    throw err;
  }
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter error');
  return data.choices?.[0]?.message?.content || '';
}

function extractJson(text) {
  if (!text) return null;
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch { /* fall through */ }
  }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]); } catch { /* fall through */ }
  }
  return null;
}

export async function suggestTagsFromTaxonomy({ title, abstract, note }, existingTags) {
  if (!existingTags.length) return [];
  if (!title?.trim() && !abstract?.trim() && !note?.trim()) return [];

  const prompt = `You help a researcher organize their paper reading list. Their personal tag taxonomy is:
${existingTags.map((t) => `- ${t}`).join('\n')}

New paper:
Title: ${title || ''}
Abstract: ${abstract || ''}
${note ? `Note: ${note}` : ''}

Which EXISTING tags from the list above fit this paper? Return ONLY a JSON array of matching tag strings. Use only tags from the list above — do not invent new tags.`;

  const content = await callClaude(prompt, { maxTokens: 500 });
  const parsed = extractJson(content);
  if (!Array.isArray(parsed)) return [];
  const lowered = Object.fromEntries(existingTags.map((t) => [t.toLowerCase(), t]));
  return parsed
    .filter((t) => typeof t === 'string')
    .map((t) => lowered[t.toLowerCase()])
    .filter(Boolean);
}

/* Returns { matched: [existing tags that fit], suggested: [new tags to create] } */
export async function suggestTagsForPaper({ title, abstract, note }, existingTags) {
  if (!title?.trim() && !abstract?.trim() && !note?.trim()) {
    return { matched: [], suggested: [] };
  }

  const taxonomyBlock = existingTags.length
    ? `The researcher's existing tag taxonomy:\n${existingTags.map((t) => `- ${t}`).join('\n')}`
    : `The researcher has no existing tags yet.`;

  const prompt = `You help a researcher organize their paper reading list.

${taxonomyBlock}

New paper:
Title: ${title || ''}
Abstract: ${abstract || ''}
${note ? `Note: ${note}` : ''}

Return ONLY a JSON object with two keys:
{
  "matched":   [tags from the existing taxonomy above that fit this paper, verbatim],
  "suggested": [1-3 NEW tag names that capture important concepts NOT already covered by the existing taxonomy]
}

Rules for "matched": use only tags from the existing taxonomy, copied exactly. Return [] if none apply.
Rules for "suggested": 1-3 concise noun-phrases (2-4 words each), Title Case, covering concepts absent from the taxonomy. Avoid duplicates of existing tags. If there are no existing tags, propose a useful starter set of 2-4 tags for this paper.`;

  const content = await callClaude(prompt, { maxTokens: 500 });
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== 'object') {
    return { matched: [], suggested: [] };
  }

  const lowered = Object.fromEntries(existingTags.map((t) => [t.toLowerCase(), t]));
  const matched = Array.isArray(parsed.matched)
    ? parsed.matched
        .filter((t) => typeof t === 'string')
        .map((t) => lowered[t.toLowerCase()])
        .filter(Boolean)
    : [];
  const suggested = Array.isArray(parsed.suggested)
    ? parsed.suggested
        .filter((t) => typeof t === 'string' && t.trim())
        .map((t) => t.trim())
        .filter((t) => !lowered[t.toLowerCase()])
    : [];
  return { matched, suggested };
}

/* Filter existing papers to only those that could plausibly be cited by the new paper
   (i.e. published in the same year or earlier). */
function filterCitableCandidates(newPaper, existingPapers) {
  const newYear = Number(newPaper.year);
  if (!Number.isFinite(newYear)) return existingPapers;
  return existingPapers.filter((p) => {
    const y = Number(p.year);
    return Number.isFinite(y) && y <= newYear;
  });
}

/* Parse an arXiv identifier from a URL or bare ID. */
function parseArxivId(value) {
  if (!value) return null;
  const str = String(value).trim();
  const urlMatch = str.match(/arxiv\.org\/(?:abs|pdf)\/([^?#\s]+?)(?:\.pdf)?(?:[?#]|$)/i);
  if (urlMatch) return urlMatch[1].replace(/v\d+$/, '');
  const bareMatch = str.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/);
  if (bareMatch) return bareMatch[1];
  return null;
}

/* Fetch the cited references of a paper from Semantic Scholar.
   Returns an array of { arxivId, title, year } objects. */
export async function fetchCitedReferences(arxivId) {
  if (!arxivId) return [];
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/ARXIV:${arxivId}/references?fields=externalIds,title,year&limit=100`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];
    return items
      .map((item) => item.citedPaper)
      .filter(Boolean)
      .map((ref) => ({
        arxivId: ref.externalIds?.ArXiv || null,
        title: ref.title || '',
        year: ref.year || null,
      }));
  } catch (err) {
    console.error('Semantic Scholar references fetch failed:', err);
    return [];
  }
}

/* Match cited references against papers already in the library.
   Primary match: arXiv ID. Fallback: normalized title equality. */
export function matchReferencesToLibrary(references, existingPapers) {
  if (!references.length || !existingPapers.length) return [];

  const byArxiv = new Map();
  const byTitle = new Map();
  for (const p of existingPapers) {
    const ax = parseArxivId(p.arxiv);
    if (ax) byArxiv.set(ax, p.id);
    const t = (p.title || '').trim().toLowerCase();
    if (t) byTitle.set(t, p.id);
  }

  const matched = new Set();
  for (const ref of references) {
    if (ref.arxivId && byArxiv.has(ref.arxivId)) {
      matched.add(byArxiv.get(ref.arxivId));
      continue;
    }
    const refTitle = (ref.title || '').trim().toLowerCase();
    if (refTitle && byTitle.has(refTitle)) {
      matched.add(byTitle.get(refTitle));
    }
  }
  return Array.from(matched);
}

export async function inferBuildsOnEdges(newPaper, existingPapers) {
  if (!existingPapers.length) return [];
  if (!newPaper.title?.trim() && !newPaper.abstract?.trim()) return [];

  const candidates = filterCitableCandidates(newPaper, existingPapers);
  if (!candidates.length) return [];

  const summarized = candidates.map((p) => ({
    id: p.id,
    title: p.title,
    year: p.year,
    abstract: (p.abstract || '').slice(0, 400),
  }));

  const prompt = `You are analyzing an academic paper to identify which existing papers in a researcher's library it most plausibly builds upon (cites, extends, or directly responds to).

IMPORTANT TEMPORAL CONSTRAINT: A paper can only build on papers published in the same year or earlier. The candidate list below has already been filtered to only temporally valid predecessors.

Candidate predecessor papers (JSON):
${JSON.stringify(summarized, null, 2)}

New paper being added:
Title: ${newPaper.title}
Year: ${newPaper.year || 'unknown'}
Abstract: ${newPaper.abstract || ''}

Consider topical overlap, methodological extension, and whether the new paper could plausibly cite or extend them. Only include strong connections (usually 0-3 papers). Return ONLY a JSON array of paper IDs (strings) from the list above. If there are no strong connections, return [].`;

  const content = await callClaude(prompt, { maxTokens: 400 });
  const parsed = extractJson(content);
  if (!Array.isArray(parsed)) return [];
  const validIds = new Set(candidates.map((p) => p.id));
  return parsed.filter((id) => typeof id === 'string' && validIds.has(id));
}

/* Combined edge inference: citation data (high confidence) + AI thematic links (supplementary).
   Both sources are filtered to respect temporal ordering. */
export async function buildGraphEdges(newPaper, existingPapers, newPaperArxivId) {
  const citable = filterCitableCandidates(newPaper, existingPapers);
  if (!citable.length) return { edges: [], citationMatches: [], aiMatches: [] };

  const [refs, aiEdges] = await Promise.all([
    newPaperArxivId ? fetchCitedReferences(newPaperArxivId) : Promise.resolve([]),
    inferBuildsOnEdges(newPaper, citable).catch(() => []),
  ]);

  const citationMatches = matchReferencesToLibrary(refs, citable);
  const combined = new Set([...citationMatches, ...aiEdges]);
  return {
    edges: Array.from(combined),
    citationMatches,
    aiMatches: aiEdges.filter((id) => !citationMatches.includes(id)),
  };
}
