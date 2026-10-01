import type { Classifications, NormalizedLandmark } from '@mediapipe/tasks-vision';

import type { WorkerResponse } from './landmarker.worker';

/**
 * The face model, loaded and run in a worker.
 *
 * `detectForVideo` blocks for as long as the inference takes, so it cannot run on the main thread
 * without freezing the page. This module is the main-thread half: it owns the worker, hands over
 * frames as they arrive, and reports results back through a callback.
 *
 * The WASM runtime and the model file are both fetched from this site's own origin, so loading the
 * model makes no third-party request on the camera path.
 */

const ASSET_BASE = new URL(import.meta.env.BASE_URL, document.baseURI).href;

export const WASM_PATH = new URL('mediapipe/wasm', ASSET_BASE).href;
export const MODEL_PATH = new URL('mediapipe/face_landmarker.task', ASSET_BASE).href;
export const BUNDLE_PATH = new URL('mediapipe/vision_bundle.js', ASSET_BASE).href;

export type Delegate = 'GPU' | 'CPU';

/** What the rest of the app needs back from one inference. */
export interface DetectionResult {
  landmarks: NormalizedLandmark[][];
  categories: Classifications[];
}

export interface LandmarkerHandle {
  /** Which delegate the worker settled on. */
  delegate: Delegate;
  /** Hand over one frame. The bitmap is transferred to the worker, which closes it. */
  detect(bitmap: ImageBitmap, now: number): void;
  /** Called with each inference result and the timestamp the frame was sent with. */
  onResult(handler: (result: DetectionResult, now: number) => void): void;
  /** Called if the model fails to load or an inference throws. */
  onError(handler: (message: string) => void): void;
  /** Stop the worker and release the model. */
  terminate(): void;
}

/**
 * Spawn the worker and load the model in it.
 *
 * The promise resolves once the worker reports the model is ready. Frames sent before then are
 * dropped rather than queued: the camera has only just started, and a backlog of stale frames would
 * only add latency.
 */
export function createLandmarker(): Promise<LandmarkerHandle> {
  // A classic worker, not a module worker: MediaPipe's WASM module only initialises when the
  // bundle is loaded with importScripts in global scope.
  const worker = new Worker(new URL('./landmarker.worker.ts', import.meta.url));

  let delegate: Delegate = 'CPU';
  let modelReady = false;
  let resultHandler: ((result: DetectionResult, now: number) => void) | null = null;
  let errorHandler: ((message: string) => void) | null = null;

  const handle: LandmarkerHandle = {
    get delegate(): Delegate {
      return delegate;
    },

    detect(bitmap: ImageBitmap, now: number): void {
      if (!modelReady) {
        bitmap.close();
        return;
      }
      worker.postMessage({ type: 'frame', bitmap, now }, [bitmap]);
    },

    onResult(handler: (result: DetectionResult, now: number) => void): void {
      resultHandler = handler;
    },

    onError(handler: (message: string) => void): void {
      errorHandler = handler;
    },

    terminate(): void {
      worker.terminate();
    },
  };

  const ready = new Promise<LandmarkerHandle>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === 'ready') {
        delegate = message.delegate;
        modelReady = true;
        resolve(handle);
        return;
      }

      if (message.type === 'result') {
        resultHandler?.({ landmarks: message.landmarks, categories: message.categories }, message.now);
        return;
      }

      if (message.type === 'error') {
        // Before the caller has registered a handler, this is a load failure.
        if (resultHandler) errorHandler?.(message.message);
        else reject(new Error(message.message));
      }
    };
  });

  worker.postMessage({
    type: 'init',
    bundlePath: BUNDLE_PATH,
    wasmPath: WASM_PATH,
    modelPath: MODEL_PATH,
  });

  return ready;
}
