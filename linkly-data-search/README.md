## Requirement 6 — AI (paper tagging) · `linkly-graph-ai/`

When adding a paper, clicking **"✦ Suggest from my tags"** calls the Claude API to match the paper's title/abstract against the user's existing personal tag taxonomy. The AI only suggests tags already defined — no generic labels.

**Key code:** `linkly-graph-ai/src/App.jsx` → `suggestTags()` (~line 338)

## Requirement 7 — Interactive Graph · `linkly-graph-ai/`

Force-directed cluster graph with:
- **Cluster bubbles** grouping papers by shared tags
- **Directed "builds on" arrows** between papers
- **Hover highlighting** — connected nodes and edges light up, others dim
- **Drag nodes** to reposition
- **Create edges** by dragging the blue connector dot (appears on hover) to another node
- **Delete edges** by clicking an arrow (turns red on hover, click to remove)

**Key code:** `linkly-graph-ai/src/App.jsx` → force layout `runLayout()` (~line 97), node/edge rendering (~line 460–515), drag handlers (~line 277–320)

## Requirement 8 — Local Data Persistence · `linkly-data-search/`

All paper records (title, authors, year, tags), notes, and glossary entries are stored in `localStorage` under the key `linkly_papers` and survive closing and reopening the browser. On first load the app seeds sample data; subsequent loads restore the saved state. A "Saved to localStorage" indicator flashes on every write.

**Key code:** `linkly-data-search/src/App.jsx`
- Storage key and initial load from `localStorage`: ~line 15, ~line 433
- `useEffect` that writes to `localStorage` on every state change: ~line 449
- Paper/glossary/note mutation helpers (`addPaper`, `updateNotes`, `addGlossaryEntry`, `deleteGlossaryEntry`): ~line 467

## Requirement 9 — Full-Text Search · `linkly-data-search/`

A tokenized inverted index is built over all glossary definitions and paper notes. Multi-word queries require all tokens to match; prefix matching is supported. Results are ranked by token frequency, labeled by source type (Glossary / Note), and display highlighted snippets. Clicking a result navigates to the paper in the Library tab.

**Key code:** `linkly-data-search/src/App.jsx`
- `tokenize()` helper and `buildIndex()` (builds `Map<token, Set<docId>>`): ~line 93, ~line 99
- `search()` (intersection across tokens, prefix match, scoring): ~line 140
- Index rebuilt via `useMemo` on every papers change: ~line 460

---

## Running the apps

### Requirements 6 & 7 — `linkly-graph-ai/`

Requires an OpenRouter API key for the AI tagging feature.

```bash
cd linkly-graph-ai
npm install
cp .env.example .env      # then paste your OpenRouter key into .env
npm run dev
```
Open http://localhost:5173

### Requirements 8 & 9 — `linkly-data-search/`

No API key needed.

```bash
cd linkly-data-search
npm install
npm run dev
```
Open http://localhost:5173

### Demo walkthrough

**Persistence (Req 8):**
1. Open the app — the Library tab shows 3 pre-loaded AI safety papers with glossary entries
2. Edit a note or add a glossary entry — watch the "Saved to localStorage" indicator flash
3. Close the tab, reopen http://localhost:5173 — all changes are still there

**Search (Req 9):**
1. Click the **Search** tab
2. The index stats panel shows papers, glossary entries, notes, and total token count
3. Type `monitoring` — surfaces glossary entries and notes containing the word
4. Type `strategic` — surfaces a note match
5. Click any result to jump to that paper in the Library tab

---

## Project Structure

```
linkly-graph-ai/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
└── src/
    ├── main.jsx
    └── App.jsx          # All application code (~730 lines)

linkly-data-search/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    └── App.jsx          # All application code (~665 lines)
```

---

## AI Attribution

All code in this repository was generated with assistance from **Claude** (Anthropic).

**`linkly-graph-ai/`** — produced by Grace's partner through iterative conversation with Claude Opus:
- Force-directed graph layout algorithm
- SVG rendering with hover/drag interactions
- Edge creation via connector handles
- Claude API integration for tag suggestion
- ArXiv metadata auto-fetch via Semantic Scholar API

**`linkly-data-search/`** — produced by Grace through iterative conversation with Claude Sonnet:
- localStorage read/write with seed-on-first-load pattern
- Tokenized inverted index search engine
- Prefix matching and multi-token AND queries
- Result highlighting and score-ranked output
