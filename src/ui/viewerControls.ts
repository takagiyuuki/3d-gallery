import type { Viewer } from '../viewer/types.ts';

/** Wires the Auto rotate / Play toggles to the viewer, both ways. */
export function bindViewerControls(
  viewer: Viewer,
  autoRotate: HTMLInputElement,
  play: HTMLInputElement,
): void {
  autoRotate.addEventListener('change', () => viewer.setAutoRotate(autoRotate.checked));
  play.addEventListener('change', () => viewer.setPlaying(play.checked));

  const sync = () => {
    const state = viewer.getState();
    autoRotate.checked = state.autoRotate;
    // Play only applies to models with animation clips (Figma Toggle State=Disabled).
    play.disabled = !state.hasAnimation;
    play.checked = state.hasAnimation && state.playing;
    play.title = state.hasAnimation ? '' : 'This model has no animation';
  };
  viewer.subscribe(sync);
  sync();
}
