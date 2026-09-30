import type { Blendshapes } from './features';

/**
 * Smoothing and neutral-face calibration, as pure functions.
 *
 * The camera produces noisy numbers frame to frame. Two things happen to them
 * before the rules see them: an exponential moving average, and an optional
 * rescale against a neutral face the visitor captured themselves.
 */

/** `s = s + 0.5 * (v - s)`. Half of last frame's error carries over. */
export const SMOOTHING_ALPHA = 0.5;

/** Frames averaged when capturing a neutral face. */
export const NEUTRAL_FRAMES = 30;

/**
 * The cap applied to each sample before averaging. A high resting value, for
 * example a permanent smile, would otherwise divide by a very small number and
 * blow every later score up to 1.
 */
export const NEUTRAL_SAMPLE_CAP = 0.5;

/** One exponential moving average step. */
export function ema(previous: number, value: number, alpha: number = SMOOTHING_ALPHA): number {
  return previous + alpha * (value - previous);
}

/**
 * One smoothing step over a whole frame. The `_neutral` entry is carried through
 * untouched so a caller can still see it, and any key missing from `previous`
 * starts from its own current value.
 */
export function smoothBlendshapes(previous: Blendshapes, current: Blendshapes): Blendshapes {
  const next: Blendshapes = {};
  for (const [name, value] of Object.entries(current)) {
    if (name === '_neutral') {
      next[name] = value;
      continue;
    }
    next[name] = ema(previous[name] ?? value, value);
  }
  return next;
}

/**
 * A neutral face captured over `NEUTRAL_FRAMES` frames, and the rescale it
 * implies. Nothing here is persisted: it lives in memory and dies on reload.
 */
export interface NeutralCalibration {
  /** Per-name resting values, each capped and averaged. */
  readonly base: Blendshapes;
  /** How many frames have been collected so far, out of `NEUTRAL_FRAMES`. */
  readonly samples: number;
  readonly complete: boolean;
}

export function emptyCalibration(): NeutralCalibration {
  return { base: {}, samples: 0, complete: false };
}

/**
 * Add one capped frame to the running average. Returns the updated state; the
 * average is only usable once `complete` is true.
 */
export function addCalibrationSample(
  calibration: NeutralCalibration,
  frame: Blendshapes,
): NeutralCalibration {
  if (calibration.complete) return calibration;

  const base: Blendshapes = { ...calibration.base };
  for (const [name, value] of Object.entries(frame)) {
    if (name === '_neutral') continue;
    const capped = Math.min(value, NEUTRAL_SAMPLE_CAP);
    base[name] = ((base[name] ?? 0) * calibration.samples + capped) / (calibration.samples + 1);
  }

  const samples = calibration.samples + 1;
  return { base, samples, complete: samples >= NEUTRAL_FRAMES };
}

/** True once enough frames have been collected. */
export function calibrationProgress(calibration: NeutralCalibration): number {
  return Math.min(1, calibration.samples / NEUTRAL_FRAMES);
}

/**
 * Rescale one score against the neutral baseline: how much of the possible
 * range is left above the resting value.
 */
export function rescale(value: number, base: number): number {
  const span = Math.max(1 - base, 1e-6);
  return Math.min(1, Math.max(0, (value - base) / span));
}

/** Rescale a whole frame. No-op when there is no baseline yet. */
export function applyCalibration(values: Blendshapes, base: Blendshapes): Blendshapes {
  if (Object.keys(base).length === 0) return values;
  const out: Blendshapes = {};
  for (const [name, value] of Object.entries(values)) {
    if (name === '_neutral') {
      out[name] = value;
      continue;
    }
    out[name] = rescale(value, base[name] ?? 0);
  }
  return out;
}
