/**
 * Manifest (`models/index.json`) schema.
 *
 * This module depends only on valibot so that it can later be extracted into a package
 * shared with the `3d-models` repository, which generates the manifest.
 */
import * as v from 'valibot';

export const MANIFEST_VERSION = 1;

/** URL- and path-safe model id, e.g. `damaged-helmet`. */
export const ModelIdSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be lowercase alphanumerics and hyphens'),
  v.maxLength(64),
);

/** Path relative to the manifest URL. Absolute URLs, root-relative paths and `..` are rejected. */
export const RelativePathSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.check(
    (path) => !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('/') && !path.startsWith('\\'),
    'path must be relative to the manifest',
  ),
  v.check((path) => !path.split(/[/\\]/).includes('..'), 'path must not contain ".."'),
);

const CountSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

export const ModelStatsSchema = v.object({
  triangles: v.optional(CountSchema),
  textureCount: v.optional(CountSchema),
  /** Largest texture edge in pixels. */
  maxTextureSize: v.optional(CountSchema),
  drawCalls: v.optional(CountSchema),
  fileSizeBytes: v.optional(CountSchema),
});

export const ModelCreditSchema = v.object({
  author: v.pipe(v.string(), v.minLength(1)),
  /** SPDX identifier when possible, e.g. `CC-BY-4.0`. */
  license: v.optional(v.string()),
  url: v.optional(v.pipe(v.string(), v.url())),
});

export const ModelEntrySchema = v.object({
  id: ModelIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  glb: RelativePathSchema,
  thumbnail: v.optional(RelativePathSchema),
  stats: v.optional(ModelStatsSchema),
  notes: v.optional(v.string()),
  credit: v.optional(ModelCreditSchema),
});

/** Top-level shape. Entries are validated one by one so that a single bad entry is skipped. */
export const ManifestEnvelopeSchema = v.object({
  version: v.literal(MANIFEST_VERSION),
  generatedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  models: v.array(v.unknown()),
});

/** Strict schema for producers (e.g. `3d-models`): every entry must be valid. */
export const ManifestSchema = v.object({
  ...ManifestEnvelopeSchema.entries,
  models: v.array(ModelEntrySchema),
});

export type ModelStats = v.InferOutput<typeof ModelStatsSchema>;
export type ModelCredit = v.InferOutput<typeof ModelCreditSchema>;
export type ModelEntry = v.InferOutput<typeof ModelEntrySchema>;
export type Manifest = v.InferOutput<typeof ManifestSchema>;
