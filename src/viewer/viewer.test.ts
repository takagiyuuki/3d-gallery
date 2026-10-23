import {
  Bone,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObject3D } from './dispose.ts';
import { computeFraming, fitDistance } from './framing.ts';
import { computeViewOffset } from './viewOffset.ts';

describe('computeViewOffset', () => {
  it('is zero without insets', () => {
    expect(computeViewOffset(1000, 800, { top: 0, right: 0, bottom: 0, left: 0 })).toEqual({
      x: -0,
      y: -0,
      visibleWidth: 1000,
      visibleHeight: 800,
    });
  });

  it('shifts the center right by half of a left sidebar', () => {
    const offset = computeViewOffset(1000, 800, { top: 0, right: 0, bottom: 0, left: 240 });
    expect(offset.x).toBe(-120);
    expect(offset.visibleWidth).toBe(760);
  });

  it('shifts the center up when the bottom is covered more than the top', () => {
    const offset = computeViewOffset(380, 622, { top: 110, right: 0, bottom: 150, left: 0 });
    expect(offset.y).toBe(20);
    expect(offset.visibleHeight).toBe(362);
  });

  it('clamps insets larger than the canvas', () => {
    const offset = computeViewOffset(100, 100, { top: 0, right: 0, bottom: 0, left: 500 });
    expect(offset.visibleWidth).toBe(1);
  });
});

describe('framing', () => {
  const full = { height: 800, visibleWidth: 800, visibleHeight: 800 };

  it('backs off when the visible area is narrower than it is tall', () => {
    const narrow = { ...full, visibleWidth: 400 };
    expect(fitDistance(1, 45, narrow)).toBeGreaterThan(fitDistance(1, 45, full));
  });

  it('backs off when overlay UI covers part of the canvas height', () => {
    const covered = { ...full, visibleHeight: 500 };
    expect(fitDistance(1, 45, covered)).toBeGreaterThan(fitDistance(1, 45, full));
  });

  it('centers on the bounding sphere', () => {
    const mesh = new Mesh(new BoxGeometry(2, 2, 2));
    mesh.position.set(10, 0, 0);
    mesh.updateMatrixWorld();
    const framing = computeFraming(mesh, 45, full);
    expect(framing.target.x).toBeCloseTo(10);
    expect(framing.radius).toBeCloseTo(Math.sqrt(3));
  });
});

describe('disposeObject3D', () => {
  it('disposes geometries, shared materials once and their textures', () => {
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture });
    const group = new Group();
    const a = new Mesh(new BoxGeometry(), material);
    const b = new Mesh(new BoxGeometry(), material);
    group.add(a, b);

    const spies = {
      geometryA: vi.spyOn(a.geometry, 'dispose'),
      geometryB: vi.spyOn(b.geometry, 'dispose'),
      material: vi.spyOn(material, 'dispose'),
      texture: vi.spyOn(texture, 'dispose'),
    };
    disposeObject3D(group);

    expect(spies.geometryA).toHaveBeenCalledOnce();
    expect(spies.geometryB).toHaveBeenCalledOnce();
    expect(spies.material).toHaveBeenCalledOnce();
    expect(spies.texture).toHaveBeenCalled();
  });

  it('disposes skeletons of skinned meshes (bone textures)', () => {
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
    const skeleton = new Skeleton([new Bone()]);
    mesh.bind(skeleton);
    const spy = vi.spyOn(skeleton, 'dispose');
    disposeObject3D(mesh);
    expect(spy).toHaveBeenCalledOnce();
  });
});
