type GoatCounter = { count: (vars: { path: string; title: string }) => void };

let lastPath = typeof window === 'undefined' ? '' : window.location.pathname;

export function countView() {
  const path = window.location.pathname;
  if (path === lastPath) return;
  lastPath = path;
  (window as Window & { goatcounter?: GoatCounter }).goatcounter?.count?.({ path, title: document.title });
}
