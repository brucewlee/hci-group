# Linkly Unified - Research Paper Organization Platform

A unified research paper reading, annotation, and knowledge graph management application. This app integrates the best implementations from the three existing Linkly applications into a single, cohesive interface.

## Features

- **PDF Viewer**: Read and annotate papers with highlighted text selection, glossary term creation, and margin notes
- **Knowledge Graph**: Visualize citation relationships and paper connections with an interactive force-directed graph
- **Paper Library**: Browse and manage your uploaded research papers
- **Global Search**: Search across paper metadata, notes, and glossary terms
- **Persistent Storage**: All data is automatically saved to your browser's localStorage

## Getting Started

### Installation

```bash
cd linkly-unified
npm install
```

### Add your API key
Create a .env file in the root directory of the repo.

Then edit `.env` and paste your OpenRouter key:
```
VITE_OPENROUTER_KEY=sk-or-v1-your-actual-key
```
Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). The app uses `anthropic/claude-sonnet-4.6` through OpenRouter.

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## Architecture

### Pages

- **Landing** (`/`) - Dashboard with quick access to library, graph, and upload
- **Library** (`/library`) - Browse all uploaded papers
- **Upload** (`/upload`) - Upload and add metadata for new papers
- **Paper Viewer** (`/paper/:paperId`) - Read, highlight, and annotate papers
- **Knowledge Graph** (`/graph`) - Visualize paper relationships
- **Search** (`/search?q=...`) - Global search results

### Components

- **GlobalNav** - Top navigation bar with search and page links
- **PaperCard** - Reusable paper preview card
- **Modal** - Generic modal wrapper

### Hooks

- **usePaperStore** - Unified paper state management and localStorage persistence
- **useSearch** - Full-text search indexing and ranking

## Data Model

```javascript
Paper {
  id: string,
  title: string,
  authors: string,
  year: number,
  abstract: string,
  arxiv: string,
  note: string,
  tags: string[],
  glossary: Array<{id, term, definition, pageNumber}>,
  annotations: Array<{id, pageNumber, bounds: {x,y,width,height}, comment}>,
  buildsOn: string[], // citation references to other paper IDs
  uploadedAt: timestamp
}
```

## Reused Components from Source Apps

### From linkly-helloworld-pdf
- PDF viewing with react-pdf
- Glossary term creation and management
- Text selection capture
- Annotation/highlighting system
- Margin callout rendering
- Sidebar management with tabs
- All PDF viewer styling and layout

### From linkly-graph-ai
- Force-directed graph layout algorithm
- Node and edge rendering in SVG
- Paper node positioning and interaction
- Citation edge creation (drag to connect)
- Tag-based clustering with visual bubbles
- Paper detail panel
- Graph interaction patterns

### From linkly-data-search
- Full-text search with prefix matching
- Paper library listing
- Modal components
- Paper card UI
- Search result ranking

## Persistence

All data is stored in a single localStorage key (`linkly:papers`) containing the complete papers array. The app automatically saves on every change and restores on load.

## Styling

The app uses a unified CSS system with:
- CSS variables for colors and spacing
- Component-based class naming
- Responsive design patterns
- PDF viewer specific styles for the reader interface

## Future Enhancements

- PDF file upload and local storage (currently uses remote URLs)
- Export data to JSON
- Paper import from Bibtex
- Collaborative features
- Backend sync

## AI Attribution

All code in this repository was generated with assistance from AI.

Produced through iterative conversation with Claude Opus:
- Force-directed graph layout algorithm
- SVG rendering with hover/drag interactions
- Edge creation via connector handles
- Claude API integration for tag suggestion
- ArXiv metadata auto-fetch via Semantic Scholar API

Produced through iterative conversation with Claude Sonnet:
- localStorage read/write with seed-on-first-load pattern
- Tokenized inverted index search engine
- Prefix matching and multi-token AND queries
- Result highlighting and score-ranked output

Produced through iterative conversation with Codex:

- React multi-screen prototype with Hello World opening screen
- Style-guide screen with required colors, Lato font weights, and FontAwesome icons
- Native multi-page PDF rendering with react-pdf
- Text selection capture from rendered PDF into glossary entries
- Session-based glossary persistence with sessionStorage
- Drag-to-annotate PDF interactions with saved comments
- Persistent annotation storage with localStorage
- Margin annotation callouts connected to annotated PDF regions

After the implementation prototype stage, we integrated the standalone apps through iterative conversation with Claude Sonnet.
