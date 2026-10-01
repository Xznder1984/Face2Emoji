import type {
  Classifications,
  FaceLandmarker as FaceLandmarkerInstance,
  FaceLandmarkerOptions,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision';

/**
 * The face model, run in a worker.
 *
 * `detectForVideo` is a synchronous call that blocks for as long as the inference takes. On a
 * machine with no usable GPU that measured 2.3 seconds per frame on the main thread, which froze
 * the page the moment the camera was granted. Running it here keeps the main thread free to respond
 * to input; the price is that a result arrives a frame later, which expression matching does not
 * care about.
 *
 * Two things about loading MediaPipe here were found the hard way:
 *
 * - It has to be a classic worker, not a module worker. A module worker could not initialise the
 *   WASM module at all — every `createFromOptions` failed with "ModuleFactory not set", whether
 *   MediaPipe was bundled into the worker by Vite or imported at runtime.
 * - The bundle has to be the UMD build in `public/`, loaded with `importScripts`. That runs it in
 *   global scope and sets `self.Vision`, which is where `FaceLandmarker` and `FilesetResolver`
 *   live. The ES module build sets them on a module namespace instead, and the `.cjs` build is
 *   served as `application/node`, which a browser will not execute.
 *
 * The bundle URL, the WASM directory and the model file are all passed in by the main thread, which
 * knows the app's base path. Everything is fetched from this origin.
 */

type FaceLandmarkerFactory = {
  createFromOptions: (
    fileset: unknown,
    options: FaceLandmarkerOptions,
  ) => Promise<FaceLandmarkerInstance>;
};

type FilesetResolverFactory = {
  forVisionTasks: (path: string) => Promise<unknown>;
};

declare const importScripts: (source: string) => void;

let FaceLandmarker: FaceLandmarkerFactory;
let FilesetResolver: FilesetResolverFactory;

let landmarker: FaceLandmarkerInstance | null = null;

export interface WorkerInit {
  type: 'init';
  wasmPath: string;
  modelPath: string;
  bundlePath: string;
}

export interface WorkerFrame {
  type: 'frame';
  bitmap: ImageBitmap;
  now: number;
}

export type WorkerRequest = WorkerInit | WorkerFrame;

export interface WorkerReady {
  type: 'ready';
  delegate: 'GPU' | 'CPU';
}

export interface WorkerResult {
  type: 'result';
  /** The timestamp the frame was sent with, echoed back. */
  now: number;
  landmarks: NormalizedLandmark[][];
  categories: Classifications[];
}

export interface WorkerFailure {
  type: 'error';
  message: string;
}

export type WorkerResponse = WorkerReady | WorkerResult | WorkerFailure;

function options(delegate: 'GPU' | 'CPU', modelPath: string): FaceLandmarkerOptions {
  return {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  };
}

/** Create the landmarker, falling back from the GPU to the CPU. */
async function init(
  bundlePath: string,
  wasmPath: string,
  modelPath: string,
): Promise<'GPU' | 'CPU'> {
  importScripts(bundlePath);
  const vision = (self as unknown as { Vision: Record<string, unknown> }).Vision;
  FaceLandmarker = vision.FaceLandmarker as FaceLandmarkerFactory;
  FilesetResolver = vision.FilesetResolver as FilesetResolverFactory;

  const fileset = await FilesetResolver.forVisionTasks(wasmPath);
  try {
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU', modelPath));
    return 'GPU';
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU', modelPath));
    return 'CPU';
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === 'init') {
    try {
      const delegate = await init(message.bundlePath, message.wasmPath, message.modelPath);
      const response: WorkerReady = { type: 'ready', delegate };
      self.postMessage(response);
    } catch (error) {
      const response: WorkerFailure = { type: 'error', message: String(error) };
      self.postMessage(response);
    }
    return;
  }

  if (message.type === 'frame') {
    const { bitmap, now } = message;
    if (!landmarker) {
      bitmap.close();
      return;
    }
    try {
      // Draw onto an OffscreenCanvas rather than handing over the ImageBitmap: it is the input
      // detectForVideo is guaranteed to accept, and the draw costs a tenth of a millisecond.
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(bitmap, 0, 0);
      const result = ctx ? landmarker.detectForVideo(canvas, now) : null;
      const response: WorkerResult = {
        type: 'result',
        now,
        landmarks: result?.faceLandmarks ?? [],
        categories: result?.faceBlendshapes ?? [],
      };
      self.postMessage(response);
    } catch (error) {
      const response: WorkerFailure = { type: 'error', message: String(error) };
      self.postMessage(response);
    } finally {
      bitmap.close();
    }
  }
};
