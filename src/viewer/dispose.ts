import { type Material, Mesh, type Object3D, SkinnedMesh, Texture } from 'three';

function disposeTexture(texture: Texture): void {
  texture.dispose();
  // GLTFLoader decodes images to ImageBitmap where supported; release the decoded pixels too.
  const image: unknown = texture.source.data;
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
}

function disposeMaterial(material: Material): void {
  // Any material property may hold a texture (map, normalMap, emissiveMap, ...).
  for (const value of Object.values(material)) {
    if (value instanceof Texture) disposeTexture(value);
  }
  material.dispose();
}

/**
 * Releases GPU resources owned by `root` and its children: geometries, materials, textures and
 * skeleton bone textures (created by the renderer for skinned meshes, not reachable via materials).
 */
export function disposeObject3D(root: Object3D): void {
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    if (object instanceof SkinnedMesh) object.skeleton.dispose();
    const list: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) materials.add(material);
  });
  for (const material of materials) disposeMaterial(material);
  root.removeFromParent();
}
