import { describe, expect, it } from 'vitest';
import { loadManifest, ManifestError, parseManifest } from './loadManifest.ts';

const MANIFEST_URL = 'https://models.example.com/models/index.json';

const validEntry = {
  id: 'robot',
  name: 'Robot',
  glb: 'robot/model.glb',
  thumbnail: 'robot/thumbnail.webp',
  stats: { triangles: 12400, textureCount: 2, maxTextureSize: 2048, drawCalls: 6 },
  notes: 'memo',
};

describe('parseManifest', () => {
  it('resolves asset paths relative to the manifest URL', () => {
    const { models, warnings } = parseManifest({ version: 1, models: [validEntry] }, MANIFEST_URL);
    expect(warnings).toEqual([]);
    expect(models).toHaveLength(1);
    expect(models[0]?.glbUrl).toBe('https://models.example.com/models/robot/model.glb');
    expect(models[0]?.thumbnailUrl).toBe('https://models.example.com/models/robot/thumbnail.webp');
  });

  it('accepts entries without optional fields', () => {
    const { models } = parseManifest(
      { version: 1, models: [{ id: 'a', name: 'A', glb: 'a.glb' }] },
      MANIFEST_URL,
    );
    expect(models[0]?.thumbnailUrl).toBeNull();
    expect(models[0]?.stats).toBeUndefined();
  });

  it.each([
    ['unsupported version', { version: 2, models: [] }],
    ['missing models', { version: 1 }],
    ['non-object', 'hello'],
    ['null', null],
  ])('rejects %s', (_label, data) => {
    expect(() => parseManifest(data, MANIFEST_URL)).toThrow(ManifestError);
  });

  it.each([
    ['bad id', { ...validEntry, id: 'Robot Model' }],
    ['absolute glb URL', { ...validEntry, glb: 'https://evil.example/x.glb' }],
    ['root-relative glb', { ...validEntry, glb: '/x.glb' }],
    ['parent traversal', { ...validEntry, glb: '../x.glb' }],
    ['negative stat', { ...validEntry, stats: { triangles: -1 } }],
    ['missing name', { id: 'x', glb: 'x.glb' }],
  ])('skips an entry with %s and keeps the rest', (_label, bad) => {
    const ok = { id: 'ok', name: 'OK', glb: 'ok.glb' };
    const { models, warnings } = parseManifest({ version: 1, models: [bad, ok] }, MANIFEST_URL);
    expect(models.map((m) => m.id)).toEqual(['ok']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^models\[0\] skipped/);
  });

  it('keeps the first of duplicate ids', () => {
    const { models, warnings } = parseManifest(
      { version: 1, models: [validEntry, { ...validEntry, name: 'Second' }] },
      MANIFEST_URL,
    );
    expect(models.map((m) => m.name)).toEqual(['Robot']);
    expect(warnings[0]).toMatch(/duplicate id/);
  });
});

describe('loadManifest', () => {
  const fakeFetch = (response: Response | Error): typeof fetch =>
    (async () => {
      if (response instanceof Error) throw response;
      return response;
    }) as typeof fetch;

  it('classifies network errors', async () => {
    await expect(
      loadManifest(MANIFEST_URL, { fetch: fakeFetch(new TypeError('offline')) }),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('classifies HTTP errors', async () => {
    await expect(
      loadManifest(MANIFEST_URL, { fetch: fakeFetch(new Response('nope', { status: 404 })) }),
    ).rejects.toMatchObject({ kind: 'http' });
  });

  it('classifies JSON parse errors', async () => {
    await expect(
      loadManifest(MANIFEST_URL, { fetch: fakeFetch(new Response('<html>')) }),
    ).rejects.toMatchObject({ kind: 'parse' });
  });

  it('returns validated models', async () => {
    const body = JSON.stringify({ version: 1, models: [validEntry] });
    const result = await loadManifest(MANIFEST_URL, { fetch: fakeFetch(new Response(body)) });
    expect(result.models[0]?.id).toBe('robot');
  });
});
