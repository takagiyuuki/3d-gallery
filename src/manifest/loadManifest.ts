import * as v from 'valibot';
import { ManifestEnvelopeSchema, type ModelEntry, ModelEntrySchema } from './schema.ts';

/** A manifest entry with its asset paths resolved to absolute URLs. */
export interface GalleryModel extends ModelEntry {
  glbUrl: string;
  thumbnailUrl: string | null;
}

export interface LoadedManifest {
  models: GalleryModel[];
  /** Human-readable reasons for skipped entries. */
  warnings: string[];
}

export type ManifestErrorKind = 'network' | 'http' | 'parse' | 'invalid';

export class ManifestError extends Error {
  readonly kind: ManifestErrorKind;

  constructor(kind: ManifestErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ManifestError';
    this.kind = kind;
  }
}

function formatIssues(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .map((issue) => {
      const path = v.getDotPath(issue);
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/**
 * Validates parsed manifest JSON. Throws `ManifestError('invalid')` when the top level is
 * unusable; invalid or duplicate entries are skipped and reported in `warnings`.
 */
export function parseManifest(data: unknown, manifestUrl: string): LoadedManifest {
  const envelope = v.safeParse(ManifestEnvelopeSchema, data);
  if (!envelope.success) {
    throw new ManifestError('invalid', `Invalid manifest: ${formatIssues(envelope.issues)}`);
  }

  const models: GalleryModel[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  envelope.output.models.forEach((raw, index) => {
    const entry = v.safeParse(ModelEntrySchema, raw);
    if (!entry.success) {
      warnings.push(`models[${index}] skipped: ${formatIssues(entry.issues)}`);
      return;
    }
    const model = entry.output;
    if (seen.has(model.id)) {
      warnings.push(`models[${index}] skipped: duplicate id "${model.id}"`);
      return;
    }
    seen.add(model.id);
    models.push({
      ...model,
      glbUrl: new URL(model.glb, manifestUrl).href,
      thumbnailUrl: model.thumbnail ? new URL(model.thumbnail, manifestUrl).href : null,
    });
  });

  return { models, warnings };
}

/** Fetches and validates the manifest. `manifestUrl` must be absolute. */
export async function loadManifest(
  manifestUrl: string,
  init?: { signal?: AbortSignal; fetch?: typeof fetch },
): Promise<LoadedManifest> {
  const fetchImpl = init?.fetch ?? fetch;
  let response: Response;
  try {
    // `no-cache` revalidates with the server so newly published models show up promptly.
    response = await fetchImpl(manifestUrl, { signal: init?.signal, cache: 'no-cache' });
  } catch (cause) {
    throw new ManifestError('network', `Failed to fetch manifest: ${manifestUrl}`, { cause });
  }
  if (!response.ok) {
    throw new ManifestError('http', `Manifest request failed with HTTP ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    throw new ManifestError('parse', 'Manifest is not valid JSON', { cause });
  }
  return parseManifest(data, response.url || manifestUrl);
}
