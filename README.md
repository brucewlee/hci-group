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

linkly-helloworld-pdf/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles.css
    ├── assets/
    │   └── sample-paper.pdf
    └── components/
        └── PdfWorkbench.jsx   # PDF viewer, glossary, and annotation logic
```

---

## AI Attribution

All code in this repository was generated with assistance from AI.

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

**`linkly-hello-world/`** — produced through iterative conversation with Codex:

- React multi-screen prototype with Hello World opening screen
- Style-guide screen with required colors, Lato font weights, and FontAwesome icons
- Native multi-page PDF rendering with react-pdf
- Text selection capture from rendered PDF into glossary entries
- Session-based glossary persistence with sessionStorage
- Drag-to-annotate PDF interactions with saved comments
- Persistent annotation storage with localStorage
- Margin annotation callouts connected to annotated PDF regions