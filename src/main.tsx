import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The design system's single entry point (Art Director's). Imported here, not
// in App, so every surface — including a future second shell or an error page —
// pays for exactly one stylesheet graph and there is no unstyled code path.
import './styles/index.css';
import { App } from './app/App';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Mount failed: #root is missing from the document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
