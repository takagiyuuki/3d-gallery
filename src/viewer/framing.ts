import { Box3, MathUtils, type Object3D, Sphere, Vector3 } from 'three';

export interface Framing {
  target: Vector3;
  distance: number;
  radius: number;
}

/** Extra space around the bounding sphere. */
const MARGIN = 1.15;

/** Canvas height and the part of the canvas not covered by overlay UI (CSS px). */
export interface FitViewport {
  height: number;
  visibleWidth: number;
  visibleHeight: number;
}

/**
 * Camera distance at which a sphere of `radius` fits in the visible area. `fovDeg` is the
 * camera's vertical FOV over the full canvas height; the visible area spans a narrower angle.
 */
export function fitDistance(radius: number, fovDeg: number, viewport: FitViewport): number {
  const tanHalf = Math.tan(MathUtils.degToRad(fovDeg) / 2);
  const tanHalfVisible =
    (tanHalf * Math.min(viewport.visibleWidth, viewport.visibleHeight)) / viewport.height;
  const halfAngle = Math.atan(tanHalfVisible);
  return (radius * MARGIN) / Math.sin(halfAngle);
}

/** Bounding-sphere framing for `object`. Falls back to a unit sphere for empty scenes. */
export function computeFraming(object: Object3D, fovDeg: number, viewport: FitViewport): Framing {
  const box = new Box3().setFromObject(object);
  const sphere = box.isEmpty() ? new Sphere(new Vector3(), 1) : box.getBoundingSphere(new Sphere());
  const radius = sphere.radius > 0 ? sphere.radius : 1;
  return { target: sphere.center, radius, distance: fitDistance(radius, fovDeg, viewport) };
}
