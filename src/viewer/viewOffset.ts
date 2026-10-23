/** Screen area (CSS px) covered by overlay UI on each edge of the canvas. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface ViewOffset {
  x: number;
  y: number;
  /** Size of the uncovered area; used to fit the model. */
  visibleWidth: number;
  visibleHeight: number;
}

/**
 * Offset for `camera.setViewOffset(width, height, x, y, width, height)` that moves the projection
 * center from the canvas center to the center of the area not covered by `insets`.
 *
 * Shifting the sub-view window by -d moves the image by +d, so the center moves by half of the
 * difference between opposite insets.
 */
export function computeViewOffset(width: number, height: number, insets: Insets): ViewOffset {
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  const left = clamp(insets.left, width);
  const right = clamp(insets.right, width - left);
  const top = clamp(insets.top, height);
  const bottom = clamp(insets.bottom, height - top);
  return {
    x: -(left - right) / 2,
    y: -(top - bottom) / 2,
    visibleWidth: Math.max(width - left - right, 1),
    visibleHeight: Math.max(height - top - bottom, 1),
  };
}
