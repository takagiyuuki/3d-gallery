import type { GalleryModel } from '../manifest/loadManifest.ts';

export type ModelNavVariant = 'sidebar' | 'bar';

export interface ModelNav {
  setSelected(id: string | null): void;
}

const ITEM_BASE =
  'flex w-full cursor-pointer items-center gap-sm rounded-sm py-xs pr-md pl-xs text-left ' +
  'text-label font-medium transition-colors';
const ITEM_DEFAULT = 'text-text-primary hover:bg-black/5 active:bg-black/10';
const ITEM_SELECTED = 'bg-accent-default text-text-on-accent hover:bg-accent-default';

function createItem(model: GalleryModel, onSelect: (id: string) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.modelId = model.id;
  button.className = `${ITEM_BASE} ${ITEM_DEFAULT}`;
  button.addEventListener('click', () => onSelect(model.id));

  const thumb = document.createElement('span');
  thumb.className = 'size-[32px] shrink-0 overflow-hidden rounded-sm bg-surface-thumbnail';
  if (model.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = model.thumbnailUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.className = 'size-full object-cover';
    // Keep the placeholder background when the thumbnail is missing.
    img.addEventListener('error', () => img.remove(), { once: true });
    thumb.append(img);
  }

  const label = document.createElement('span');
  label.className = 'min-w-0 truncate';
  label.textContent = model.name; // untrusted manifest data: never innerHTML
  button.title = model.name;

  button.append(thumb, label);
  return button;
}

/**
 * Renders the model list into `list` (<ul>). The sidebar scrolls vertically; the mobile bar
 * scrolls horizontally with natural item widths, so overflowing items are cut at the right edge
 * (faded via `.scroll-fade-end`) to hint that it scrolls.
 */
export function renderModelNav(
  list: HTMLUListElement,
  models: readonly GalleryModel[],
  variant: ModelNavVariant,
  onSelect: (id: string) => void,
): ModelNav {
  const buttons = new Map<string, HTMLButtonElement>();
  list.replaceChildren(
    ...models.map((model) => {
      const li = document.createElement('li');
      li.className = variant === 'bar' ? 'max-w-[11rem] shrink-0 snap-start' : 'shrink-0';
      const button = createItem(model, onSelect);
      buttons.set(model.id, button);
      li.append(button);
      return li;
    }),
  );

  return {
    setSelected(id) {
      for (const [modelId, button] of buttons) {
        const selected = modelId === id;
        button.className = `${ITEM_BASE} ${selected ? ITEM_SELECTED : ITEM_DEFAULT}`;
        if (selected) {
          button.setAttribute('aria-current', 'true');
          button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else {
          button.removeAttribute('aria-current');
        }
      }
    },
  };
}
