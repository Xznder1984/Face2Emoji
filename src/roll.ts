/**
 * Head tilt.
 *
 * Landmarks 33 and 263 are the outer corners of the eyes. The angle between
 * them is the roll of the head. The preview is mirrored with a CSS
 * `scaleX(-1)`, so the emoji is rotated by the negative of that angle to stay
 * in step with what the visitor sees.
 *
 * Pure and time-injected: the caller does the smoothing, so a reduced-motion
 * visitor can be given direct 1:1 rotation.
 */

/** Landmarks at the outer corners of the eyes. */
export const LEFT_EYE_OUTER = 33;
export const RIGHT_EYE_OUTER = 263;

/** The emoji never tilts further than this, in degrees. */
export const ROLL_CLAMP_DEG = 45;

/** `roll += 0.35 * (target - roll)`, the smoothing factor from the brief. */
export const ROLL_SMOOTHING = 0.35;

/** Used when a visitor prefers reduced motion: no smoothing at all. */
export const ROLL_DIRECT = 1;

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * The tilt target in degrees, clamped to plus or minus `ROLL_CLAMP_DEG`.
 * The offsets are scaled by the frame size so the angle is in pixels, not in
 * MediaPipe's normalised units, which would change with the video resolution.
 */
export function rollTarget(
  from: Point,
  to: Point,
  videoWidth: number,
  videoHeight: number,
): number {
  const dx = (to.x - from.x) * videoWidth;
  const dy = (to.y - from.y) * videoHeight;
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  return clamp(-degrees, -ROLL_CLAMP_DEG, ROLL_CLAMP_DEG);
}

/** One smoothing step towards the target. */
export function stepRoll(roll: number, target: number, factor: number = ROLL_SMOOTHING): number {
  return roll + factor * (target - roll);
}
