import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerOptions,
} from '@mediapipe/tasks-vision';

/**
 * Load MediaPipe from this site's own origin.
 *
 * The WASM runtime and the model file are both in `public/mediapipe/`, put there
 * by `fetch-assets.mjs`. Nothing on the camera path touches a third party.
 * The GPU delegate is tried first because it is much faster, and the CPU
 * delegate is the fallback for machines with no usable GPU.
 */

const ASSET_BASE = new URL(import.meta.env.BASE_URL, document.baseURI).href;

export const WASM_PATH = new URL('mediapipe/wasm', ASSET_BASE).href;
export const MODEL_PATH = new URL('mediapipe/face_landmarker.task', ASSET_BASE).href;

export type Delegate = 'GPU' | 'CPU';

export interface LandmarkerHandle {
  landmarker: FaceLandmarker;
  delegate: Delegate;
}

function options(delegate: Delegate): FaceLandmarkerOptions {
  return {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  };
}

/** Create the landmarker, falling back from the GPU to the CPU. */
export async function createLandmarker(): Promise<LandmarkerHandle> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  try {
    const landmarker = await FaceLandmarker.createFromOptions(fileset, options('GPU'));
    return { landmarker, delegate: 'GPU' };
  } catch {
    const landmarker = await FaceLandmarker.createFromOptions(fileset, options('CPU'));
    return { landmarker, delegate: 'CPU' };
  }
}
