import { useParams } from 'react-router-dom';
import { PaperViewer } from './PaperViewer.jsx';

export function PaperViewerPage({ papers, updatePaper }) {
  const { paperId } = useParams();
  const paper = papers.find((p) => p.id === paperId);
  const availableTags = Array.from(new Set(papers.flatMap((p) => p.tags || [])));

  return <PaperViewer paper={paper} updatePaper={updatePaper} availableTags={availableTags} />;
}
