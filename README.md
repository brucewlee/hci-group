# Linkly — Implementation Prototypes

Technical requirement demos for the Linkly HCI project. Each subfolder is a standalone React + Vite app with separate READMEs.

```
linkly-graph-ai/       — Requirements 6 & 7  (AI tagging, interactive graph)
linkly-data-search/    — Requirements 8 & 9  (local persistence, full-text search)
```

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

**`linkly-graph-ai/`** — produced through iterative conversation with Claude Opus:
- Force-directed graph layout algorithm
- SVG rendering with hover/drag interactions
- Edge creation via connector handles
- Claude API integration for tag suggestion
- ArXiv metadata auto-fetch via Semantic Scholar API

**`linkly-data-search/`** — produced through iterative conversation with Claude Sonnet:
- localStorage read/write with seed-on-first-load pattern
- Tokenized inverted index search engine
- Prefix matching and multi-token AND queries
- Result highlighting and score-ranked output
