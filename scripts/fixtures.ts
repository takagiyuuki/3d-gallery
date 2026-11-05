/**
 * Generates local development fixtures from Khronos glTF-Sample-Assets.
 *
 *   pnpm fixtures                 # public/dev-models/{index.json,<id>/...}
 *   pnpm fixtures --with-broken   # also add an entry whose GLB is missing (error UI check)
 *
 * Output mirrors the R2 layout produced by the `3d-models` repository. Compressed variants are
 * generated here (Draco / Meshopt) so the viewer's decoders are exercised.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Document, NodeIO, Primitive, type Transform } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, meshopt } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as v from 'valibot';
import {
  type Manifest,
  ManifestSchema,
  type ModelEntry,
  type ModelStats,
} from '../src/manifest/schema.ts';

/** Pinned for reproducibility; bump deliberately. */
const SAMPLE_ASSETS_SHA = '15cd02d304e54cb42a4db4eefe719f76190f4b68';
const RAW_BASE = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${SAMPLE_ASSETS_SHA}/Models`;
const OUT_DIR = path.resolve(import.meta.dirname, '../public/dev-models');

interface FixtureSpec {
  id: string;
  name: string;
  /** Directory name under `Models/`. */
  source: string;
  screenshot: string;
  compression: 'none' | 'draco' | 'meshopt';
  notes: string;
  credit: NonNullable<ModelEntry['credit']>;
}

const FIXTURES: FixtureSpec[] = [
  {
    id: 'fox',
    name: 'Fox',
    source: 'Fox',
    screenshot: 'screenshot.jpg',
    compression: 'none',
    notes:
      'Animated sample (Survey / Walk / Run). Model: PixelMannen (CC0-1.0). ' +
      'Rigging & animation: tomkranis (CC-BY-4.0). glTF conversion: @AsoboStudio and @scurest (CC-BY-4.0).',
    credit: {
      author: 'PixelMannen, tomkranis, @AsoboStudio, @scurest',
      license: 'CC0-1.0 AND CC-BY-4.0',
      url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox',
    },
  },
  {
    id: 'water-bottle',
    name: 'Water Bottle',
    source: 'WaterBottle',
    screenshot: 'screenshot.jpg',
    compression: 'meshopt',
    notes: 'Static PBR sample, re-encoded with EXT_meshopt_compression. Microsoft (CC0-1.0).',
    credit: {
      author: 'Microsoft',
      license: 'CC0-1.0',
      url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/WaterBottle',
    },
  },
  {
    id: 'lantern',
    name: 'Lantern',
    source: 'Lantern',
    screenshot: 'screenshot.jpg',
    compression: 'draco',
    notes:
      'Static sample, re-encoded with KHR_draco_mesh_compression. ' +
      'sbtron / Microsoft (CC0-1.0), Draco compression: Frank Galligan (CC0-1.0).',
    credit: {
      author: 'sbtron (Microsoft), Frank Galligan',
      license: 'CC0-1.0',
      url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern',
    },
  },
];

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Triangle / draw-call / texture stats, computed from the scene graph as rendered. */
function computeStats(document: Document, fileSizeBytes: number): ModelStats {
  let triangles = 0;
  let drawCalls = 0;
  for (const scene of document.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      for (const primitive of mesh.listPrimitives()) {
        drawCalls += 1;
        if (primitive.getMode() !== Primitive.Mode.TRIANGLES) continue;
        const count =
          primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')?.getCount() ?? 0;
        triangles += Math.floor(count / 3);
      }
    });
  }
  const textures = document.getRoot().listTextures();
  const maxTextureSize = Math.max(
    0,
    ...textures.map((texture) => Math.max(...(texture.getSize() ?? [0, 0]))),
  );
  return {
    triangles,
    textureCount: textures.length,
    maxTextureSize,
    drawCalls,
    fileSizeBytes,
  };
}

async function main(): Promise<void> {
  const withBroken = process.argv.includes('--with-broken');

  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

  await rm(OUT_DIR, { recursive: true, force: true });
  const entries: ModelEntry[] = [];

  for (const spec of FIXTURES) {
    const base = `${RAW_BASE}/${spec.source}`;
    console.info(`- ${spec.id}: downloading ${spec.source}`);
    const [glb, screenshot] = await Promise.all([
      download(`${base}/glTF-Binary/${spec.source}.glb`),
      download(`${base}/screenshot/${spec.screenshot}`),
    ]);

    const document = await io.readBinary(glb);
    const transforms: Transform[] = [];
    if (spec.compression === 'draco') transforms.push(draco({ method: 'edgebreaker' }));
    if (spec.compression === 'meshopt') {
      transforms.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    }
    await document.transform(...transforms);
    const output = await io.writeBinary(document);

    const dir = path.join(OUT_DIR, spec.id);
    const thumbnail = `thumbnail${path.extname(spec.screenshot)}`;
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'model.glb'), output);
    await writeFile(path.join(dir, thumbnail), screenshot);

    entries.push({
      id: spec.id,
      name: spec.name,
      glb: `${spec.id}/model.glb`,
      thumbnail: `${spec.id}/${thumbnail}`,
      stats: computeStats(document, output.byteLength),
      notes: spec.notes,
      credit: spec.credit,
    });
    console.info(
      `  ${spec.compression}: ${(glb.byteLength / 1e6).toFixed(1)} MB -> ${(output.byteLength / 1e6).toFixed(1)} MB`,
    );
  }

  if (withBroken) {
    entries.push({
      id: 'broken',
      name: 'Broken (missing GLB)',
      glb: 'broken/model.glb',
      notes: 'Dev-only entry pointing to a missing file to check the load error UI.',
    });
  }

  // Validate with the same strict schema producers are expected to satisfy.
  const manifest: Manifest = v.parse(ManifestSchema, {
    version: 1,
    generatedAt: new Date().toISOString(),
    models: entries,
  });
  await writeFile(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.info(`Wrote ${entries.length} models to ${path.relative(process.cwd(), OUT_DIR)}`);
}

await main();
