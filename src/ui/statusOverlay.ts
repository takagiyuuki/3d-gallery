/**
 * Loading / error / unsupported-WebGL states (not in Figma; built from daisyUI defaults).
 */
export type StatusView =
  | { kind: 'hidden' }
  | { kind: 'loading'; progress: number | null; label: string }
  | { kind: 'error'; title: string; message: string; onRetry?: () => void }
  | { kind: 'unsupported' };

function panel(...children: Node[]): HTMLDivElement {
  const box = document.createElement('div');
  box.className =
    // max-w-[24rem], not max-w-sm: the Figma --spacing-sm token (8px) shadows container sizes.
    'glass-panel pointer-events-auto flex w-full max-w-[24rem] flex-col items-center gap-md rounded-md p-lg text-center';
  box.append(...children);
  return box;
}

function text(tag: 'p' | 'strong', className: string, value: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = value;
  return el;
}

function loadingView(progress: number | null, label: string): HTMLElement {
  let indicator: HTMLElement;
  if (progress === null) {
    indicator = document.createElement('span');
    indicator.className = 'loading loading-spinner loading-lg text-accent';
  } else {
    const percent = Math.round(progress * 100);
    indicator = document.createElement('div');
    indicator.className = 'radial-progress text-accent text-caption font-medium';
    indicator.style.setProperty('--value', String(percent));
    indicator.style.setProperty('--size', '4rem');
    indicator.setAttribute('role', 'progressbar');
    indicator.setAttribute('aria-valuenow', String(percent));
    indicator.textContent = `${percent}%`;
  }
  return panel(indicator, text('p', 'text-label', label));
}

function errorView(title: string, message: string, onRetry?: () => void): HTMLElement {
  const alert = document.createElement('div');
  alert.setAttribute('role', 'alert');
  alert.className =
    'alert alert-error alert-soft flex w-full flex-col items-start gap-xs text-left';
  alert.append(text('strong', 'text-label', title), text('p', 'text-caption break-all', message));
  const children: Node[] = [alert];
  if (onRetry) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-sm btn-accent';
    retry.textContent = '再試行';
    retry.addEventListener('click', onRetry);
    children.push(retry);
  }
  return panel(...children);
}

function unsupportedView(): HTMLElement {
  const alert = document.createElement('div');
  alert.setAttribute('role', 'alert');
  alert.className =
    'alert alert-warning alert-soft flex w-full flex-col items-start gap-xs text-left';
  alert.append(
    text('strong', 'text-label', 'WebGL 2 を利用できません'),
    text(
      'p',
      'text-caption',
      'このブラウザまたは端末では 3D 表示ができません。ハードウェアアクセラレーションを有効にするか、別のブラウザでお試しください。',
    ),
  );
  return panel(alert);
}

export function createStatusOverlay(root: HTMLElement): (view: StatusView) => void {
  let current = '';
  return (view) => {
    // Avoid rebuilding (and losing focus on) identical error views.
    const key = JSON.stringify({ ...view, onRetry: undefined });
    if (key === current && view.kind !== 'loading') return;
    current = key;

    root.classList.toggle('hidden', view.kind === 'hidden');
    root.classList.toggle('flex', view.kind !== 'hidden');
    switch (view.kind) {
      case 'hidden':
        root.replaceChildren();
        break;
      case 'loading':
        root.replaceChildren(loadingView(view.progress, view.label));
        break;
      case 'error':
        root.replaceChildren(errorView(view.title, view.message, view.onRetry));
        break;
      case 'unsupported':
        root.replaceChildren(unsupportedView());
        break;
    }
  };
}
