/**
 * Turn MediaPipe's 52 blendshape scores into the signals the rules use.
 *
 * Every function here is pure: it takes numbers in and gives numbers back, and
 * nothing in this file touches the DOM, the camera or any state.
 */

/** A blendshape name to score map, as MediaPipe reports it. `_neutral` included. */
export type Blendshapes = Record<string, number>;

/** The named signals the rules and the live face read. */
export interface Features {
  smile: number;
  frown: number;
  squint: number;
  cheekSquint: number;
  eyeWide: number;
  browDown: number;
  sneer: number;
  press: number;
  stretch: number;
  upperUp: number;
  blink: number;
  jaw: number;
  browUp: number;
  pucker: number;
  tongue: number;
  blinkL: number;
  blinkR: number;
  browDiff: number;
  winkDiff: number;
}

/** Average of the left and right scores, for a symmetric movement. */
export function pair(shapes: Blendshapes, left: string, right: string): number {
  return ((shapes[left] ?? 0) + (shapes[right] ?? 0)) / 2;
}

/** One named score, missing treated as zero. */
function score(shapes: Blendshapes, name: string): number {
  return shapes[name] ?? 0;
}

export function deriveFeatures(shapes: Blendshapes): Features {
  return {
    smile: pair(shapes, 'mouthSmileLeft', 'mouthSmileRight'),
    frown: pair(shapes, 'mouthFrownLeft', 'mouthFrownRight'),
    squint: pair(shapes, 'eyeSquintLeft', 'eyeSquintRight'),
    cheekSquint: pair(shapes, 'cheekSquintLeft', 'cheekSquintRight'),
    eyeWide: pair(shapes, 'eyeWideLeft', 'eyeWideRight'),
    browDown: pair(shapes, 'browDownLeft', 'browDownRight'),
    sneer: pair(shapes, 'noseSneerLeft', 'noseSneerRight'),
    press: pair(shapes, 'mouthPressLeft', 'mouthPressRight'),
    stretch: pair(shapes, 'mouthStretchLeft', 'mouthStretchRight'),
    upperUp: pair(shapes, 'mouthUpperUpLeft', 'mouthUpperUpRight'),
    blink: pair(shapes, 'eyeBlinkLeft', 'eyeBlinkRight'),
    jaw: score(shapes, 'jawOpen'),
    browUp: score(shapes, 'browInnerUp'),
    pucker: score(shapes, 'mouthPucker'),
    tongue: score(shapes, 'tongueOut'),
    blinkL: score(shapes, 'eyeBlinkLeft'),
    blinkR: score(shapes, 'eyeBlinkRight'),
    browDiff: Math.abs(score(shapes, 'browOuterUpLeft') - score(shapes, 'browOuterUpRight')),
    winkDiff: Math.abs(score(shapes, 'eyeBlinkLeft') - score(shapes, 'eyeBlinkRight')),
  };
}

/** The pairs the live face and the readings panel care about, in a stable order. */
export const PAIRED_NAMES: ReadonlyArray<readonly [keyof Features, string, string]> = [
  ['smile', 'mouthSmileLeft', 'mouthSmileRight'],
  ['frown', 'mouthFrownLeft', 'mouthFrownRight'],
  ['squint', 'eyeSquintLeft', 'eyeSquintRight'],
  ['cheekSquint', 'cheekSquintLeft', 'cheekSquintRight'],
  ['eyeWide', 'eyeWideLeft', 'eyeWideRight'],
  ['browDown', 'browDownLeft', 'browDownRight'],
  ['sneer', 'noseSneerLeft', 'noseSneerRight'],
  ['press', 'mouthPressLeft', 'mouthPressRight'],
  ['stretch', 'mouthStretchLeft', 'mouthStretchRight'],
  ['upperUp', 'mouthUpperUpLeft', 'mouthUpperUpRight'],
  ['blink', 'eyeBlinkLeft', 'eyeBlinkRight'],
];
