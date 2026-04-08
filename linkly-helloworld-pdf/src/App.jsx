import { Suspense, lazy, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookOpen,
  faCommentDots,
  faHighlighter,
  faPalette,
} from '@fortawesome/free-solid-svg-icons';

const PdfWorkbench = lazy(() => import('./components/PdfWorkbench'));

const views = [
  { id: 'home', label: 'Hello World' },
  { id: 'styles', label: 'Hello Styles' },
  { id: 'pdf', label: 'PDF Lab' },
];

const colorSamples = ['#32a852', '#1475fc'];

const typeSamples = [
  { className: 'type-sample-light', label: 'Light' },
  { className: 'type-sample-medium', label: 'Medium' },
  { className: 'type-sample-bold', label: 'Bold' },
];

const iconSamples = [
  { icon: faBookOpen, label: 'Reader' },
  { icon: faHighlighter, label: 'Glossary' },
  { icon: faCommentDots, label: 'Annotations' },
  { icon: faPalette, label: 'Styles' },
];

function App() {
  const [activeView, setActiveView] = useState('home');

  return (
    <div className="app-shell">
      <header className="simple-header">
        <nav className="simple-nav" aria-label="Primary views">
          {views.map((view) => (
            <button
              key={view.id}
              className={view.id === activeView ? 'simple-tab is-active' : 'simple-tab'}
              type="button"
              onClick={() => setActiveView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="simple-main">
        {activeView === 'home' ? (
          <section className="simple-section home-section">
            <div className="home-hero">
              <h2>Hello World</h2>
            </div>
          </section>
        ) : null}

        {activeView === 'styles' ? (
          <section className="simple-section">
            <div className="simple-card">
              <h2>Hello Styles</h2>
              <div className="simple-swatches">
                {colorSamples.map((color) => (
                  <div
                    key={color}
                    className={color === '#32a852' ? 'simple-swatch green-swatch' : 'simple-swatch blue-swatch'}
                  >
                    <span>{color}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="simple-card">
              <h3>Typography</h3>
              {typeSamples.map((sample) => (
                <div key={sample.label} className={`type-sample ${sample.className}`}>
                  <p>The quick brown fox demonstrates the {sample.label} style.</p>
                </div>
              ))}
            </div>
            <div className="simple-card">
              <h3>Icons</h3>
              <div className="simple-icons">
                {iconSamples.map((sample) => (
                  <div key={sample.label} className="simple-icon">
                    <FontAwesomeIcon icon={sample.icon} />
                    <span>{sample.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === 'pdf' ? (
          <Suspense
            fallback={<section className="simple-card">Loading PDF reader...</section>}
          >
            <PdfWorkbench />
          </Suspense>
        ) : null}
      </main>
    </div>
  );
}

export default App;
