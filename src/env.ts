const DEV_MANIFEST_PATH = '/dev-models/index.json';

/**
 * Absolute manifest URL from `VITE_MANIFEST_URL`. Falls back to the local fixtures in dev;
 * returns null in production builds without the variable so the UI can show an error.
 */
export function resolveManifestUrl(base: string = location.href): string | null {
  const configured = import.meta.env.VITE_MANIFEST_URL?.trim();
  const value = configured || (import.meta.env.DEV ? DEV_MANIFEST_PATH : '');
  return value ? new URL(value, base).href : null;
}
