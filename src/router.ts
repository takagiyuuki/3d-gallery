/** Keeps the selected model in sync with `?model=<id>`. */

const PARAM = 'model';

export function readModelId(): string | null {
  return new URLSearchParams(location.search).get(PARAM);
}

function urlFor(id: string): string {
  const url = new URL(location.href);
  url.searchParams.set(PARAM, id);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** New history entry for a user selection (no-op if already current). */
export function pushModelId(id: string): void {
  if (readModelId() === id) return;
  history.pushState({ model: id }, '', urlFor(id));
}

/** Rewrites the current entry, e.g. to normalize an unknown id. */
export function replaceModelId(id: string): void {
  if (readModelId() === id) return;
  history.replaceState({ model: id }, '', urlFor(id));
}

/** Back / forward navigation. Returns an unsubscribe function. */
export function onModelIdChange(listener: (id: string | null) => void): () => void {
  const handler = () => listener(readModelId());
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
