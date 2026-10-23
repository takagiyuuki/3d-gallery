import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface GltfLoaders {
  gltf: GLTFLoader;
  dispose(): void;
}

/**
 * GLTFLoader that can read Draco- and Meshopt-compressed files. DRACO_GLTF_CONFIG references the
 * glTF-specific decoder via `new URL(..., import.meta.url)`, so Vite bundles and self-hosts it.
 */
export function createGltfLoaders(): GltfLoaders {
  const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
  const gltf = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  return {
    gltf,
    dispose: () => draco.dispose(),
  };
}

/**
 * Downloads `url` while reporting progress (0..1, or null when the size is unknown).
 * Using fetch directly, instead of GLTFLoader.load, lets a superseded download be aborted.
 */
export async function fetchWithProgress(
  url: string,
  signal: AbortSignal,
  onProgress: (progress: number | null) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Failed to load model (HTTP ${response.status})`);

  // Content-Length is the encoded size; it is unusable when the body is content-encoded.
  const encoded = response.headers.get('Content-Encoding');
  const total = encoded ? 0 : Number(response.headers.get('Content-Length') ?? 0);
  if (!response.body || !(total > 0)) {
    onProgress(null);
    return response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const buffer = new Uint8Array(total);
  let received = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.byteLength <= total) buffer.set(value, received);
    else chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(received / total, 1));
  }
  if (received === total) return buffer.buffer;

  // Content-Length was wrong; fall back to concatenating everything we received.
  const merged = new Uint8Array(received);
  merged.set(buffer.subarray(0, Math.min(received, total)));
  let offset = Math.min(received, total);
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}
