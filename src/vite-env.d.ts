/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Manifest URL (absolute, or relative to the page). Required in production builds. */
  readonly VITE_MANIFEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
