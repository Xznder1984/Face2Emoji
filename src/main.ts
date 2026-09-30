import { PHOTOS_DEFAULT_ON, contactEmail, repoUrl } from '../config';
import {
  CameraError,
  NO_FACE_MESSAGE,
  cameraErrorMessage,
  startCamera,
  type Camera,
} from './camera';
import { deriveFeatures, type Blendshapes, type Features } from './features';
import { createLandmarker, type LandmarkerHandle } from './landmarker';
import {
  LEFT_EYE_OUTER,
  RIGHT_EYE_OUTER,
  ROLL_DIRECT,
  ROLL_SMOOTHING,
  rollTarget,
  stepRoll,
} from './roll';
import { matchRule, NEUTRAL_RULE } from './rules';
import {
  addCalibrationSample,
  applyCalibration,
  emptyCalibration,
  smoothBlendshapes,
  type NeutralCalibration,
} from './smoothing';
import { createSettle, stepSettle } from './settle';
import { createReadout, prefersReducedMotion } from './ui/readout';
import { createReadings } from './ui/readings';
import { createStatus } from './ui/status';

/**
 * Page bootstrap. The markup in index.html is complete and usable on its own;
 * this file adds the behaviour and finds the elements it needs.
 *
 * Nothing here stores, logs, uploads or records a frame. Frames go from the
 * video element into the landmarker and come back out as numbers.
 */

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`missing element: ${selector}`);
  return element;
}

const statusEl = need<HTMLElement>('#status');
const photoStatusEl = need<HTMLElement>('#photo-status');
const cameraNoteEl = need<HTMLElement>('#camera-note');
const photosToggle = need<HTMLInputElement>('#photos-toggle');
const videoEl = need<HTMLVideoElement>('#preview');
const canvasEl = need<HTMLCanvasElement>('#overlay');
const startBtn = need<HTMLButtonElement>('#start');
const stopBtn = need<HTMLButtonElement>('#stop');
const neutralBtn = need<HTMLButtonElement>('#neutral');
const readingsDetails = need<HTMLDetailsElement>('#readings');
const readingsBody = need<HTMLElement>('#readings-body');

const status = createStatus(statusEl);
const photoStatus = createStatus(photoStatusEl);
const readout = createReadout({
  roll: need<HTMLElement>('#emoji-roll'),
  glyph: need<HTMLElement>('#emoji-glyph'),
  label: need<HTMLElement>('#expression-label'),
});
const readings = createReadings(readingsDetails, readingsBody);
const faceCtx = canvasEl.getContext('2d');

/* Constants --------------------------------------------------------------- */

/** How long the camera can run with no face before we say so. */
const NO_FACE_MS = 800;

/** Fallback frame size if the video has not reported one yet. */
const FALLBACK_WIDTH = 640;
const FALLBACK_HEIGHT = 480;

const PHOTOS_OFF_MESSAGE = 'Photo lookup is off. Nothing is sent to Wikimedia.';
const PHOTOS_ON_MESSAGE = 'Photo lookup is on. Short search phrases go to Wikimedia Commons.';

/* State ------------------------------------------------------------------- */

let camera: Camera | null = null;
let model: LandmarkerHandle | null = null;
let loadingModel: Promise<LandmarkerHandle> | null = null;
let running = false;
let starting = false;
let frameRequest = 0;

let smoothed: Blendshapes = {};
let calibration: NeutralCalibration = emptyCalibration();
let sampling = false;
let settle = createSettle(NEUTRAL_RULE.id);
let roll = 0;

let lastVideoTime = -1;
let lastFaceAt = 0;
let everSawFace = false;
let labelSynced = false;
let noFaceShown = false;

let faceColour = '#ffd23f';

/* Optional footer links --------------------------------------------------- */

function isSafeWebUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * `config.ts` ships with both of these empty, so this renders nothing. There is
 * deliberately no placeholder text for a value that is not there.
 */
function renderOptionalLinks(): void {
  const list = document.querySelector<HTMLElement>('.footer-links');
  if (!list) return;

  for (const [label, href] of [
    ['Source code', repoUrl],
    ['Contact', contactEmail ? `mailto:${contactEmail}` : ''],
  ] as const) {
    if (!href) continue;
    if (href.startsWith('mailto:') === false && !isSafeWebUrl(href)) continue;

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    item.append(link);
    list.append(item);
  }
}

/* Photos: off until the visitor ticks the box. ---------------------------- */

photosToggle.checked = PHOTOS_DEFAULT_ON;
photoStatus.set(photosToggle.checked ? PHOTOS_ON_MESSAGE : PHOTOS_OFF_MESSAGE);
photosToggle.addEventListener('change', () => {
  photoStatus.set(photosToggle.checked ? PHOTOS_ON_MESSAGE : PHOTOS_OFF_MESSAGE);
});

/* Buttons ----------------------------------------------------------------- */

function refreshButtons(): void {
  startBtn.setAttribute('aria-disabled', String(running || starting));
  stopBtn.setAttribute('aria-disabled', String(!running));
  neutralBtn.setAttribute('aria-disabled', String(!running || sampling));
}

function blocked(button: HTMLElement): boolean {
  return button.getAttribute('aria-disabled') === 'true';
}

async function loadModel(): Promise<LandmarkerHandle> {
  if (model) return model;
  if (!loadingModel) {
    status.set('Loading the face model...');
    loadingModel = createLandmarker()
      .then((handle) => {
        model = handle;
        loadingModel = null;
        return handle;
      })
      .catch((error: unknown) => {
        loadingModel = null;
        throw new CameraError('unknown', error);
      });
  }
  return loadingModel;
}

startBtn.addEventListener('click', () => {
  if (blocked(startBtn)) {
    status.set('The camera is already on. Press Stop camera first.', 'error');
    return;
  }
  void begin();
});

stopBtn.addEventListener('click', () => {
  if (blocked(stopBtn)) {
    status.set('The camera is already off.', 'error');
    return;
  }
  stop();
});

neutralBtn.addEventListener('click', () => {
  if (blocked(neutralBtn)) {
    status.set(sampling ? 'Still sampling. Hold the pose.' : 'Start the camera before setting a neutral face.', 'error');
    return;
  }
  calibration = emptyCalibration();
  sampling = true;
  refreshButtons();
  status.set('Hold a relaxed, neutral face for a second...');
});

/* Start and stop ---------------------------------------------------------- */

async function begin(): Promise<void> {
  if (starting) return;
  starting = true;
  refreshButtons();

  let delegate: string;
  try {
    const handle = await loadModel();
    delegate = handle.delegate;
    camera = await startCamera(videoEl);
  } catch (error) {
    starting = false;
    refreshButtons();
    const failure = error instanceof CameraError ? error.failure : 'unknown';
    status.set(cameraErrorMessage(failure, error), 'error');
    return;
  }

  starting = false;
  running = true;
  everSawFace = false;
  labelSynced = false;
  noFaceShown = false;
  lastVideoTime = -1;
  smoothed = {};
  settle = createSettle(NEUTRAL_RULE.id);
  videoEl.hidden = false;
  cameraNoteEl.hidden = true;
  refreshButtons();
  status.set(`Camera is on, running on the ${delegate} delegate. Look at the camera.`);
  frameRequest = requestAnimationFrame(tick);
}

function stop(): void {
  if (frameRequest) cancelAnimationFrame(frameRequest);
  frameRequest = 0;
  running = false;
  starting = false;
  sampling = false;
  camera?.stop();
  camera = null;
  videoEl.hidden = true;
  cameraNoteEl.hidden = false;
  lastVideoTime = -1;
  smoothed = {};
  readout.setRoll(0);
  refreshButtons();
  status.set('Camera is off.');
}

// Never leave a camera light on when the page goes away.
window.addEventListener('pagehide', () => {
  camera?.stop();
  running = false;
});

/* The frame loop ---------------------------------------------------------- */

function tick(): void {
  frameRequest = requestAnimationFrame(tick);
  // Do no work at all while the tab is in the background.
  if (!running || document.hidden) return;

  // Only re-run the model when the video actually produced a new frame.
  if (videoEl.currentTime === lastVideoTime) return;
  lastVideoTime = videoEl.currentTime;

  const handle = model;
  if (!handle) return;

  const now = performance.now();
  let result;
  try {
    result = handle.landmarker.detectForVideo(videoEl, now);
  } catch (error) {
    stop();
    status.set(cameraErrorMessage('unknown', error), 'error');
    return;
  }

  const landmarks = result.faceLandmarks[0];
  const categories = result.faceBlendshapes?.[0]?.categories;

  if (!landmarks || !categories) {
    if (sampling) return;
    if (everSawFace && !noFaceShown && now - lastFaceAt > NO_FACE_MS) {
      noFaceShown = true;
      status.set(NO_FACE_MESSAGE, 'error');
    }
    return;
  }

  lastFaceAt = now;
  if (!everSawFace) everSawFace = true;
  if (noFaceShown) {
    noFaceShown = false;
    status.set('Face found.');
  }

  const frame: Blendshapes = {};
  for (const category of categories) {
    if (category.categoryName !== '_neutral') frame[category.categoryName] = category.score;
  }

  if (sampling) {
    calibration = addCalibrationSample(calibration, frame);
    if (calibration.complete) {
      sampling = false;
      refreshButtons();
      status.set('Neutral face saved until you reload the page.');
    }
    return;
  }

  smoothed = smoothBlendshapes(smoothed, frame);
  const scored = calibration.complete ? applyCalibration(smoothed, calibration.base) : smoothed;
  const features: Features = deriveFeatures(scored);

  const rule = matchRule(features);
  const step = stepSettle(settle, rule.id, rule.hold, now);
  settle = step.state;

  // The first frame with a face on screen also settles the label, which starts
  // out saying it is waiting for a face.
  if (step.changed || !labelSynced) {
    labelSynced = true;
    readout.setRule(rule);
  }

  updateRoll(landmarks);
  drawOverlay(landmarks);
  readings.update(features, now);
}

/* Head tilt --------------------------------------------------------------- */

function updateRoll(landmarks: readonly { x: number; y: number }[]): void {
  const from = landmarks[LEFT_EYE_OUTER];
  const to = landmarks[RIGHT_EYE_OUTER];
  if (!from || !to) return;

  const target = rollTarget(
    from,
    to,
    videoEl.videoWidth || FALLBACK_WIDTH,
    videoEl.videoHeight || FALLBACK_HEIGHT,
  );
  // Reduced motion means no easing at all, just a direct 1:1 rotation.
  roll = stepRoll(roll, target, prefersReducedMotion() ? ROLL_DIRECT : ROLL_SMOOTHING);
  readout.setRoll(roll);
}

/* Face-point overlay ------------------------------------------------------ */

function drawOverlay(landmarks: readonly { x: number; y: number }[]): void {
  if (!faceCtx) return;
  const width = videoEl.videoWidth;
  const height = videoEl.videoHeight;
  if (width === 0 || height === 0) return;

  if (canvasEl.width !== width || canvasEl.height !== height) {
    canvasEl.width = width;
    canvasEl.height = height;
  }

  faceCtx.clearRect(0, 0, width, height);
  faceCtx.fillStyle = faceColour;
  for (const index of [LEFT_EYE_OUTER, RIGHT_EYE_OUTER]) {
    const landmark = landmarks[index];
    if (!landmark) continue;
    faceCtx.beginPath();
    faceCtx.arc(landmark.x * width, landmark.y * height, 6, 0, Math.PI * 2);
    faceCtx.fill();
  }
}

/* Go ----------------------------------------------------------------------- */

faceColour = getComputedStyle(document.documentElement).getPropertyValue('--face').trim() || '#ffd23f';
renderOptionalLinks();
refreshButtons();
status.set('Camera is off.');
