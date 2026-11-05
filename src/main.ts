import './style.css';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { resolveManifestUrl } from './env.ts';
import { type GalleryModel, loadManifest, ManifestError } from './manifest/loadManifest.ts';
import { onModelIdChange, pushModelId, readModelId, replaceModelId } from './router.ts';
import { type ModelNav, renderModelNav } from './ui/modelNav.ts';
import { renderReviewPanel } from './ui/reviewPanel.ts';
import { createStatusOverlay } from './ui/statusOverlay.ts';
import { bindViewerControls } from './ui/viewerControls.ts';
import { createViewer } from './viewer/createViewer.ts';
import type { Viewer } from './viewer/types.ts';

const SITE_TITLE = '3DCG Gallery';

function $<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const dom = {
  canvas: $<HTMLCanvasElement>('#viewer'),
  topBar: $<HTMLElement>('#top-bar'),
  title: $<HTMLElement>('#top-bar h1'),
  controls: $<HTMLElement>('#viewer-controls'),
  autoRotate: $<HTMLInputElement>('#toggle-auto-rotate'),
  play: $<HTMLInputElement>('#toggle-play'),
  sidebar: $<HTMLElement>('#model-nav'),
  sidebarList: $<HTMLUListElement>('#model-nav ul'),
  barList: $<HTMLUListElement>('#model-nav-bar ul'),
  bottomBar: $<HTMLElement>('#bottom-bar'),
  review: $<HTMLDetailsElement>('#review-panel'),
  review_summary: $<HTMLElement>('#review-summary'),
  review_stats: $<HTMLDListElement>('#review-stats'),
  review_notes: $<HTMLElement>('#review-notes'),
  review_credit: $<HTMLElement>('#review-credit'),
  status: $<HTMLElement>('#status'),
};

const showStatus = createStatusOverlay(dom.status);
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Viewer -------------------------------------------------------------------------------------

function initViewer(): Viewer | null {
  if (!WebGL.isWebGL2Available()) return null;
  try {
    return createViewer(dom.canvas, {
      // Motion is opt-in for users who asked the OS to reduce it.
      autoRotate: !prefersReducedMotion,
      playing: !prefersReducedMotion,
    });
  } catch (error) {
    console.error(error);
    return null;
  }
}

const viewer = initViewer();
if (viewer) {
  bindViewerControls(viewer, dom.autoRotate, dom.play);
} else {
  dom.autoRotate.disabled = true;
  dom.play.disabled = true;
}

/** Tells the viewer which parts of the canvas are covered so the model centers in the rest. */
function updateInsets(): void {
  if (!viewer) return;
  const canvas = dom.canvas.getBoundingClientRect();
  const desktop = window.matchMedia('(min-width: 48rem)').matches;
  const top = Math.max(
    dom.title.getBoundingClientRect().bottom,
    dom.controls.getBoundingClientRect().bottom,
  );
  // Measure the collapsed review panel so expanding it does not move the model.
  const bottom = dom.review.open ? null : canvas.bottom - dom.bottomBar.getBoundingClientRect().top;
  viewer.setInsets({
    top: top - canvas.top,
    right: 0,
    bottom: bottom ?? lastBottomInset,
    left: desktop ? dom.sidebar.getBoundingClientRect().right - canvas.left : 0,
  });
  if (bottom !== null) lastBottomInset = bottom;
}
let lastBottomInset = 0;
new ResizeObserver(updateInsets).observe(document.documentElement);

// --- Models & selection -------------------------------------------------------------------------

let models: GalleryModel[] = [];
let currentId: string | null = null;
const navs: ModelNav[] = [];

function syncStatus(): void {
  if (!viewer) {
    showStatus({ kind: 'unsupported' });
    return;
  }
  const state = viewer.getState();
  const model = models.find((m) => m.id === currentId);
  if (state.status === 'loading') {
    showStatus({
      kind: 'loading',
      progress: state.progress,
      label: `${model?.name ?? ''} を読み込み中…`,
    });
  } else if (state.status === 'error') {
    showStatus({
      kind: 'error',
      title: 'モデルを読み込めませんでした',
      message: state.error?.message ?? '',
      onRetry: () => currentId && select(currentId, { history: 'none', force: true }),
    });
  } else {
    showStatus({ kind: 'hidden' });
  }
}
viewer?.subscribe(syncStatus);

function select(
  requestedId: string | null,
  { history, force = false }: { history: 'push' | 'replace' | 'none'; force?: boolean },
): void {
  // Unknown or missing ids fall back to the first model.
  const model = models.find((m) => m.id === requestedId) ?? models[0];
  if (!model) return;
  if (history === 'push') pushModelId(model.id);
  if (history === 'replace' || model.id !== requestedId) replaceModelId(model.id);
  if (model.id === currentId && !force) return;

  currentId = model.id;
  for (const nav of navs) nav.setSelected(model.id);
  renderReviewPanel(
    {
      summary: dom.review_summary,
      stats: dom.review_stats,
      notes: dom.review_notes,
      credit: dom.review_credit,
    },
    model,
  );
  document.title = `${model.name} | ${SITE_TITLE}`;

  if (!viewer) return;
  viewer.load(model.glbUrl).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return; // superseded
    console.error(error);
  });
}

function manifestErrorMessage(error: unknown): string {
  if (!(error instanceof ManifestError)) return String(error);
  switch (error.kind) {
    case 'network':
      return `${error.message}(ネットワークまたは CORS の問題の可能性があります)`;
    default:
      return error.message;
  }
}

async function start(): Promise<void> {
  const manifestUrl = resolveManifestUrl();
  if (!manifestUrl) {
    showStatus({
      kind: 'error',
      title: 'モデル一覧の取得先が設定されていません',
      message: 'VITE_MANIFEST_URL を設定してビルドしてください。',
    });
    return;
  }

  showStatus({ kind: 'loading', progress: null, label: 'モデル一覧を読み込み中…' });
  try {
    const manifest = await loadManifest(manifestUrl);
    for (const warning of manifest.warnings) console.warn(`[manifest] ${warning}`);
    models = manifest.models;
  } catch (error) {
    console.error(error);
    showStatus({
      kind: 'error',
      title: 'モデル一覧を読み込めませんでした',
      message: manifestErrorMessage(error),
      onRetry: () => void start(),
    });
    return;
  }

  if (models.length === 0) {
    showStatus({
      kind: 'error',
      title: 'モデルがありません',
      message: '公開中のモデルはまだありません。',
    });
    return;
  }

  const onSelect = (id: string) => select(id, { history: 'push' });
  navs.splice(
    0,
    navs.length,
    renderModelNav(dom.sidebarList, models, 'sidebar', onSelect),
    renderModelNav(dom.barList, models, 'bar', onSelect),
  );
  updateInsets();
  syncStatus();
  currentId = null;
  select(readModelId(), { history: 'none' });
}

onModelIdChange((id) => select(id, { history: 'none' }));
dom.review.addEventListener('toggle', updateInsets);

if (!viewer) showStatus({ kind: 'unsupported' });
void start();

if (import.meta.env.DEV && viewer) {
  // Leak check from the console: __viewer.getMemoryInfo()
  Object.assign(window, { __viewer: viewer });
}
