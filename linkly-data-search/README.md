## Requirement 8 — Local Data Persistence · 

All paper records (title, authors, year, tags), notes, and glossary entries are stored in `localStorage` under the key `linkly_papers` and survive closing and reopening the browser. On first load the app seeds sample data; subsequent loads restore the saved state. A "Saved to localStorage" indicator flashes on every write.

**Key code:** `linkly-data-search/src/App.jsx`
- Storage key and initial load from `localStorage`: ~line 15, ~line 433
- `useEffect` that writes to `localStorage` on every state change: ~line 449
- Paper/glossary/note mutation helpers (`addPaper`, `updateNotes`, `addGlossaryEntry`, `deleteGlossaryEntry`): ~line 467

## Requirement 9 — Full-Text Search ·

A tokenized inverted index is built over all glossary definitions and paper notes. Multi-word queries require all tokens to match; prefix matching is supported. Results are ranked by token frequency, labeled by source type (Glossary / Note), and display highlighted snippets. Clicking a result navigates to the paper in the Library tab.

**Key code:** `linkly-data-search/src/App.jsx`
- `tokenize()` helper and `buildIndex()` (builds `Map<token, Set<docId>>`): ~line 93, ~line 99
- `search()` (intersection across tokens, prefix match, scoring): ~line 140
- Index rebuilt via `useMemo` on every papers change: ~line 460

---

## Running the prototype

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