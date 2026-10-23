import {
  type AnimationAction,
  AnimationMixer,
  NeutralToneMapping,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeObject3D } from './dispose.ts';
import { computeFraming } from './framing.ts';
import { createGltfLoaders, fetchWithProgress } from './loaders.ts';
import type { Insets, Viewer, ViewerOptions, ViewerState } from './types.ts';
import { computeViewOffset, ZERO_INSETS } from './viewOffset.ts';

const FOV = 40;
/** Initial camera direction from the target: front, slightly right and above. */
const VIEW_DIRECTION = new Vector3(0.5, 0.35, 1).normalize();

function abortError(): DOMException {
  return new DOMException('Superseded by a newer load', 'AbortError');
}

/**
 * Framework-agnostic glTF viewer bound to `canvas`. Throws if a WebGL context cannot be created.
 */
export function createViewer(canvas: HTMLCanvasElement, options: ViewerOptions = {}): Viewer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.maxPixelRatio ?? 2));
  renderer.toneMapping = NeutralToneMapping;
  renderer.setClearColor(0x000000, 0); // the page background shows through

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  scene.environment = environment;
  room.dispose();
  pmrem.dispose();

  const camera = new PerspectiveCamera(FOV, 1, 0.01, 100);
  camera.position.copy(VIEW_DIRECTION).multiplyScalar(5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotateSpeed = 1.5;

  const loaders = createGltfLoaders(options.dracoDecoderPath ?? '/draco/');

  let state: ViewerState = {
    status: 'idle',
    progress: null,
    error: null,
    hasAnimation: false,
    autoRotate: options.autoRotate ?? true,
    playing: options.playing ?? true,
  };
  controls.autoRotate = state.autoRotate;
  const listeners = new Set<(state: Readonly<ViewerState>) => void>();

  function setState(patch: Partial<ViewerState>): void {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  }

  // --- Size & view offset -------------------------------------------------------------------

  let size = { width: 1, height: 1 };
  let insets: Insets = ZERO_INSETS;

  function updateProjection(): void {
    const { width, height } = size;
    const offset = computeViewOffset(width, height, insets);
    camera.aspect = width / height;
    camera.setViewOffset(width, height, offset.x, offset.y, width, height);
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const width = Math.max(Math.round(entry.contentRect.width), 1);
    const height = Math.max(Math.round(entry.contentRect.height), 1);
    if (width === size.width && height === size.height) return;
    size = { width, height };
    renderer.setSize(width, height, false);
    updateProjection();
  });
  resizeObserver.observe(canvas);

  // --- Model & animation --------------------------------------------------------------------

  let model: Object3D | null = null;
  let mixer: AnimationMixer | null = null;
  let action: AnimationAction | null = null;
  let loadId = 0;
  let loadController: AbortController | null = null;

  function clearModel(): void {
    if (mixer && model) {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    }
    mixer = null;
    action = null;
    if (model) disposeObject3D(model);
    model = null;
  }

  function frame(object: Object3D): void {
    const offset = computeViewOffset(size.width, size.height, insets);
    const framing = computeFraming(object, FOV, {
      height: size.height,
      visibleWidth: offset.visibleWidth,
      visibleHeight: offset.visibleHeight,
    });
    controls.target.copy(framing.target);
    camera.position.copy(VIEW_DIRECTION).multiplyScalar(framing.distance).add(framing.target);
    camera.near = framing.radius / 100;
    camera.far = framing.distance + framing.radius * 100;
    controls.minDistance = framing.radius * 0.5;
    controls.maxDistance = framing.distance * 4;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function syncAnimation(): void {
    if (action) action.paused = !state.playing;
  }

  async function load(url: string): Promise<void> {
    const id = ++loadId;
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    setState({ status: 'loading', progress: 0, error: null });

    try {
      const buffer = await fetchWithProgress(url, controller.signal, (progress) => {
        if (id === loadId) setState({ progress });
      });
      if (id !== loadId) throw abortError();

      const resourcePath = new URL('.', url).href;
      const gltf = await loaders.gltf.parseAsync(buffer, resourcePath);
      // Parsing cannot be cancelled; discard the result if a newer load started meanwhile.
      if (id !== loadId) {
        disposeObject3D(gltf.scene);
        throw abortError();
      }

      clearModel();
      model = gltf.scene;
      scene.add(model);
      const clip = gltf.animations[0];
      if (clip) {
        mixer = new AnimationMixer(model);
        action = mixer.clipAction(clip).play();
        syncAnimation();
      }
      frame(model);
      setState({ status: 'ready', progress: null, hasAnimation: Boolean(clip) });
    } catch (error) {
      if (id !== loadId || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error instanceof DOMException ? error : abortError();
      }
      clearModel();
      const failure = error instanceof Error ? error : new Error(String(error));
      setState({ status: 'error', progress: null, error: failure, hasAnimation: false });
      throw failure;
    } finally {
      if (loadController === controller) loadController = null;
    }
  }

  // --- Render loop --------------------------------------------------------------------------

  let lastTime: number | null = null;
  renderer.setAnimationLoop((time) => {
    // Clamp the delta so the animation does not jump after the tab was hidden.
    const delta = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    controls.update(delta);
    mixer?.update(delta);
    renderer.render(scene, camera);
  });

  return {
    load,
    setAutoRotate(on) {
      controls.autoRotate = on;
      setState({ autoRotate: on });
    },
    setPlaying(on) {
      setState({ playing: on });
      syncAnimation();
    },
    setInsets(next) {
      insets = next;
      updateProjection();
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getMemoryInfo: () => ({ ...renderer.info.memory }),
    dispose() {
      loadId += 1;
      loadController?.abort();
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      clearModel();
      controls.dispose();
      environment.dispose();
      loaders.dispose();
      renderer.dispose();
      listeners.clear();
    },
  };
}
