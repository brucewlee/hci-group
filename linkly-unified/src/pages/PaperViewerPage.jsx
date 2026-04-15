import { useParams } from 'react-router-dom';
import { PaperViewer } from './PaperViewer.jsx';

export function PaperViewerPage({ papers, updatePaper }) {
  const { paperId } = useParams();
  const paper = papers.find((p) => p.id === paperId);

  return <PaperViewer paper={paper} updatePaper={updatePaper} />;
}
