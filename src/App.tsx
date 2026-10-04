import { useEffect } from 'react';
import { loadIndex, loadStatuses, peekIndex, peekStatuses, setHydrating, useAsync } from './data';
import { HOME, guideHref, registerIdentities, resolveIdentity, useRoute } from './route';
import Browse from './pages/Browse';
import Guide from './pages/Guide';
import { RichProvider } from './components/Rich';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const route = useRoute();
  const index = useAsync(loadIndex, [], peekIndex);
  const statuses = useAsync(loadStatuses, [], peekStatuses);

  useEffect(() => setHydrating(false), []);

  if (index.data) registerIdentities(index.data.identities);
  const guideId = route.page === 'guide' ? resolveIdentity(route.id) : null;

  useEffect(() => {
    if (!guideId || !index.data) return;
    const href = guideHref(guideId);
    if (window.location.pathname !== href) history.replaceState(null, '', href);
  }, [guideId, index.data]);

  const error = index.error ?? statuses.error;
  const updated = index.data ? new Date(index.data.updated) : null;

  return (
    <>
      <header className="topbar">
        <a className="brand" href={HOME}>
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <g transform="rotate(-35 16 16)">
              <path d="M16 23.34L6.23 20.01L3.81 12.53L10.58 6.54L21.42 6.54L28.19 12.53L25.77 20.01Z" />
              <path d="M3.81 12.53L3.81 14.66L6.23 22.13L16 25.46L25.77 22.13L28.19 14.66L28.19 12.53" />
              <path d="M6.23 20.01L6.23 22.13M16 23.34L16 25.46M25.77 20.01L25.77 22.13" strokeWidth={1.4} />
            </g>
          </svg>
          <span>Simple Limbus</span>
        </a>
      </header>

      <main className="container">
        {error ? (
          <div className="state">
            <p>Couldn't load the identity data.</p>
            <button
              type="button"
              className="retry"
              onClick={() => {
                if (index.error) index.retry();
                if (statuses.error) statuses.retry();
              }}
            >
              Try again
            </button>
          </div>
        ) : !index.data || !statuses.data ? (
          <div className="state">Loading…</div>
        ) : guideId ? (
          <ErrorBoundary resetKey={guideId}>
            <Guide id={guideId} statuses={statuses.data} identities={index.data.identities} />
          </ErrorBoundary>
        ) : (
          <RichProvider statuses={statuses.data} skills={[]}>
            <Browse identities={index.data.identities} statuses={statuses.data} />
          </RichProvider>
        )}
      </main>

      <footer className="footer">
        <p>
          Data:{' '}
          <a href="https://limbuscompany.wiki.gg" target="_blank" rel="noreferrer">
            Limbus Company Wiki
          </a>{' '}
          (
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
            CC BY-SA 4.0
          </a>
          ){updated && <>, updated {updated.toISOString().slice(0, 10)}</>}. Limbus Company © Project Moon. Not affiliated with Project Moon.
        </p>
      </footer>
    </>
  );
}
