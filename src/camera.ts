/**
 * Starting and stopping the camera, and turning the many ways `getUserMedia`
 * can fail into one plain sentence.
 *
 * Frames are read from the returned MediaStream and handed straight to the
 * landmarker. Nothing is stored, copied out or uploaded.
 */

export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: 'user',
};

export type CameraFailure =
  | 'no-media-devices'
  | 'not-allowed'
  | 'not-found'
  | 'not-readable'
  | 'unknown';

/** The exact wording shown to the visitor, per failure. */
export const CAMERA_MESSAGES: Record<CameraFailure, string> = {
  'no-media-devices':
    'The camera needs a secure address. Open this page from http://localhost or an https:// link instead of double-clicking the file.',
  'not-allowed':
    'Camera access was blocked. Allow the camera for this site in the address bar, then press Start camera again.',
  'not-found': 'No camera was found. Plug one in, then press Start camera again.',
  'not-readable':
    'The camera is being used by another app. Close that app, then press Start camera again.',
  unknown: 'Could not start: {message}. Check that the model files loaded.',
};

/** Shown when the camera runs but no face turns up for a moment. */
export const NO_FACE_MESSAGE = 'No face found. Face the camera in even light.';

export class CameraError extends Error {
  readonly failure: CameraFailure;

  constructor(failure: CameraFailure, cause?: unknown) {
    super(failure, { cause });
    this.name = 'CameraError';
    this.failure = failure;
  }
}

function nameOf(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name: unknown }).name);
  }
  return '';
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/** Map a thrown value from `getUserMedia` onto one of our failures. */
export function classifyCameraError(error: unknown): CameraFailure {
  switch (nameOf(error)) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'not-allowed';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'not-readable';
    default:
      return 'unknown';
  }
}

/** The sentence to show for a failure. */
export function cameraErrorMessage(failure: CameraFailure, cause?: unknown): string {
  const template = CAMERA_MESSAGES[failure];
  if (failure !== 'unknown') return template;
  // A `CameraError` keeps the failure code as its own message, so passing one in
  // directly would print the word "unknown" at the visitor. Unwrap it.
  const detail = cause instanceof CameraError ? cause.cause : cause;
  return template.replace('{message}', messageOf(detail));
}

export interface Camera {
  stream: MediaStream;
  stop(): void;
}

function requireMediaDevices(): MediaDevices {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('no-media-devices');
  }
  return navigator.mediaDevices;
}

/**
 * Ask for the camera and attach the stream to the video element. Only run
 * detection once the element reports ready, so the first frame is not missed.
 */
export async function startCamera(video: HTMLVideoElement): Promise<Camera> {
  const devices = requireMediaDevices();
  let stream: MediaStream;
  try {
    stream = await devices.getUserMedia({ video: VIDEO_CONSTRAINTS, audio: false });
  } catch (error) {
    throw new CameraError(classifyCameraError(error), error);
  }

  video.srcObject = stream;
  // The element is muted and inline in the markup, so this is allowed without
  // a gesture. Without it `currentTime` never moves and no frame is ever
  // processed.
  try {
    await video.play();
  } catch (error) {
    throw new CameraError('unknown', error);
  }
  await waitForVideo(video);

  return {
    stream,
    stop(): void {
      for (const track of stream.getTracks()) track.stop();
      video.pause();
      video.srcObject = null;
    },
  };
}

/** Wait for real dimensions, but never hang the start button forever. */
function waitForVideo(video: HTMLVideoElement, timeoutMs = 10_000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error): void => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', onData);
      video.removeEventListener('canplay', onData);
      if (error) reject(error);
      else resolve();
    };
    const onData = (): void => {
      if (video.videoWidth > 0) finish();
    };
    const timer = window.setTimeout(
      () => finish(new Error('the camera stream produced no picture')),
      timeoutMs,
    );
    video.addEventListener('loadeddata', onData);
    video.addEventListener('canplay', onData);
    onData();
  });
}
