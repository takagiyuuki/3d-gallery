import type { Insets } from './viewOffset.ts';

export type { Insets };

export type ViewerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ViewerState {
  status: ViewerStatus;
  /** Download progress 0..1 while loading; null when the size is unknown. */
  progress: number | null;
  error: Error | null;
  /** True when the current model has at least one animation clip. */
  hasAnimation: boolean;
  autoRotate: boolean;
  /** User preference; the animation only runs when `hasAnimation` is also true. */
  playing: boolean;
}

export interface ViewerOptions {
  autoRotate?: boolean;
  playing?: boolean;
  /** Upper bound for devicePixelRatio (GPU load on high-DPI mobiles). Default 2. */
  maxPixelRatio?: number;
  /** Directory serving draco_wasm_wrapper.js / draco_decoder.wasm. Default `/draco/`. */
  dracoDecoderPath?: string;
}

export interface Viewer {
  /**
   * Loads a GLB and replaces the current model. Rejects with an `AbortError` DOMException when a
   * newer `load()` supersedes it; other failures also set `status: 'error'`.
   */
  load(url: string): Promise<void>;
  setAutoRotate(on: boolean): void;
  setPlaying(on: boolean): void;
  /** Area covered by overlay UI; the model is centered in the rest of the canvas. */
  setInsets(insets: Insets): void;
  getState(): Readonly<ViewerState>;
  /** Calls `listener` on every state change. Returns an unsubscribe function. */
  subscribe(listener: (state: Readonly<ViewerState>) => void): () => void;
  /** GPU resource counters (for leak checks). */
  getMemoryInfo(): { geometries: number; textures: number };
  dispose(): void;
}
