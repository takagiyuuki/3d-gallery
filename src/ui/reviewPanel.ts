import type { GalleryModel } from '../manifest/loadManifest.ts';
import { formatBytes, formatCount, formatTextures } from './format.ts';

export interface ReviewPanelElements {
  summary: HTMLElement;
  stats: HTMLDListElement;
  notes: HTMLElement;
  credit: HTMLElement;
}

function stat(label: string, value: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-[2px]';
  const dt = document.createElement('dt');
  dt.className = 'text-caption text-text-secondary';
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.className = 'text-label font-medium';
  dd.textContent = value;
  wrapper.append(dt, dd);
  return wrapper;
}

/** Collapsed: one-line summary. Expanded: stats, notes and credit. */
export function renderReviewPanel(elements: ReviewPanelElements, model: GalleryModel | null): void {
  const stats = model?.stats ?? {};
  const summaryParts = model ? [model.name] : [];
  if (stats.triangles !== undefined) summaryParts.push(`${formatCount(stats.triangles)} tris`);
  if (stats.textureCount !== undefined) {
    summaryParts.push(`${stats.textureCount} ${stats.textureCount === 1 ? 'texture' : 'textures'}`);
  }
  elements.summary.textContent = summaryParts.join(' · ');

  const dash = '—';
  elements.stats.replaceChildren(
    stat('Triangles', stats.triangles !== undefined ? formatCount(stats.triangles) : dash),
    stat(
      'Textures',
      stats.textureCount !== undefined
        ? formatTextures(stats.textureCount, stats.maxTextureSize)
        : dash,
    ),
    stat('Draw calls', stats.drawCalls !== undefined ? String(stats.drawCalls) : dash),
    stat('File size', stats.fileSizeBytes !== undefined ? formatBytes(stats.fileSizeBytes) : dash),
  );

  elements.notes.textContent = model?.notes ? `制作メモ: ${model.notes}` : '';
  elements.notes.hidden = !model?.notes;

  const credit = model?.credit;
  elements.credit.replaceChildren();
  elements.credit.hidden = !credit;
  if (credit) {
    const text = [credit.author, credit.license].filter(Boolean).join(' / ');
    if (credit.url) {
      const link = document.createElement('a');
      link.href = credit.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'link';
      link.textContent = text;
      elements.credit.append('Credit: ', link);
    } else {
      elements.credit.textContent = `Credit: ${text}`;
    }
  }
}
