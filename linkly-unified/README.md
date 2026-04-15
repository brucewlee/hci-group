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
