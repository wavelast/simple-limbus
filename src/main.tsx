import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import { loadGuide, loadIndex, loadStatuses, setHydrating } from './data';
import './styles.css';

const el = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (el.hasChildNodes()) {
  const guide = el.dataset.guide;
  Promise.all([loadIndex(), loadStatuses(), guide ? loadGuide(guide) : null]).then(
    () => {
      setHydrating(true);
      hydrateRoot(el, app);
    },
    () => {
      el.textContent = '';
      createRoot(el).render(app);
    },
  );
} else {
  createRoot(el).render(app);
}
