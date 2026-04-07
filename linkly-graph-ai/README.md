# Research Graph — Implementation Prototype

A personal research paper organizer for AI safety researchers. Cluster papers by topic, track "builds on" relationships, write free-form notes, and use AI to suggest tags from your personal taxonomy.

## Requirements Covered

### Requirement 6 — AI (paper tagging)
When adding a paper, clicking **"✦ Suggest from my tags"** calls the Claude API (Anthropic) to match the paper's title/abstract against your existing personal tag taxonomy. The AI only suggests tags you've already defined — no generic labels.

**Key code:** `src/App.jsx` → `suggestTags()` function (~line 338)

### Requirement 7 — Interactive Graph
The graph tab renders a force-directed cluster graph with:
- **Cluster bubbles** grouping papers by shared tags
- **Directed "builds on" arrows** between papers
- **Hover highlighting** — connected nodes and edges light up, others dim
- **Drag nodes** to reposition (grab the node body)
- **Create edges** by dragging the blue connector dot (appears on hover above each node) to another node
- **Delete edges** by clicking an arrow (turns red on hover, click to remove)

**Key code:** `src/App.jsx` → force layout `runLayout()` (~line 97), node/edge rendering (~line 460–515), drag handlers (~line 277–320)

---

## Setup

### Prerequisites
- Node.js 18+ and npm
- An OpenRouter API key (for AI tag suggestion feature)

### 1. Install dependencies
```bash
npm install
```

### 2. Add your API key
```bash
cp .env.example .env
```
Then edit `.env` and paste your OpenRouter key:
```
VITE_OPENROUTER_KEY=sk-or-v1-your-actual-key
```
Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). The app uses `anthropic/claude-sonnet-4.6` through OpenRouter.

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:5173 in your browser.

### 4. Test the features

**Graph (Requirement 7):**
1. Open the app — you'll see the graph tab with 7 pre-loaded AI safety papers
2. Hover any node to see title/year and highlight connections
3. Drag a node to reposition it
4. Hover a node and drag from the **blue dot** above it to another node — creates a "builds on" edge
5. Hover any arrow — it turns red. Click to delete it
6. Use filter chips at the top to filter by tag

**AI Tagging (Requirement 6):**
1. Click **"+ Add Paper"** in the header
2. Paste an arXiv link — title, authors, abstract, and year auto-fill
3. Click **"✦ Suggest from my tags"**
4. The AI returns matching tags from your existing taxonomy
5. Accept suggestions and add the paper to your graph

---

## AI Attribution

All code in this repository was generated with assistance from **Claude** (Anthropic). The entire `src/App.jsx` component, project scaffolding, and this README were produced through iterative conversation with Claude Opus.

Specifically:
- Force-directed graph layout algorithm
- SVG rendering with hover/drag interactions
- Edge creation via connector handles
- Claude API integration for tag suggestion
- ArXiv metadata auto-fetch via Semantic Scholar API
- React state management and component structure
- Bug fixes and iterative refinement

---

## Project Structure
```
research-graph/
├── index.html          # Entry point
├── package.json        # Dependencies (React 18, Vite 5)
├── vite.config.js      # Dev server with API proxy
├── .env.example        # API key template
├── .gitignore
├── README.md
└── src/
    ├── main.jsx        # React mount
    └── App.jsx         # All application code (~730 lines)
```

Make sure the repo is **public** for grading.
