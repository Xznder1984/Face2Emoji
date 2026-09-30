import { describe, expect, it } from 'vitest';

import {
  LEFT_EYE_OUTER,
  RIGHT_EYE_OUTER,
  ROLL_CLAMP_DEG,
  ROLL_DIRECT,
  ROLL_SMOOTHING,
  rollTarget,
  stepRoll,
} from '../roll';

const W = 640;
const H = 480;

/** Angle of the 33-to-263 line, in degrees, with the sign the brief asks for. */
const tilt = (fromX: number, fromY: number, toX: number, toY: number) =>
  rollTarget({ x: fromX, y: fromY }, { x: toX, y: toY }, W, H);

describe('roll', () => {
  it('uses the outer eye corners', () => {
    expect(LEFT_EYE_OUTER).toBe(33);
    expect(RIGHT_EYE_OUTER).toBe(263);
  });

  it('is zero on a level head', () => {
    expect(tilt(0.2, 0.5, 0.8, 0.5)).toBeCloseTo(0, 10);
  });

  it('negates the landmark angle, because the preview is mirrored', () => {
    // dy is positive, so the raw atan2 is positive, so the emoji goes negative.
    const raw = (Math.atan2(0.25 * H, 0.5 * W) * 180) / Math.PI;
    expect(tilt(0.2, 0.4, 0.7, 0.65)).toBeCloseTo(-raw, 10);
  });

  it('flips the other way when the dy sign flips', () => {
    const up = tilt(0.2, 0.6, 0.7, 0.35);
    const down = tilt(0.2, 0.35, 0.7, 0.6);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeLessThan(0);
    expect(up).toBeCloseTo(-down, 10);
  });

  it('scales by the frame, not by normalised units', () => {
    // The same normalised points on a 4:3 frame give the same angle as on a
    // doubled frame, because both axes scale together.
    const small = rollTarget({ x: 0.2, y: 0.4 }, { x: 0.7, y: 0.65 }, 640, 480);
    const large = rollTarget({ x: 0.2, y: 0.4 }, { x: 0.7, y: 0.65 }, 1280, 960);
    expect(large).toBeCloseTo(small, 10);
  });

  it('clamps to plus or minus 45 degrees', () => {
    expect(ROLL_CLAMP_DEG).toBe(45);
    // An 80 degree lean in normalised space becomes roughly 63 in pixels.
    expect(tilt(0.45, 0.5, 0.55, 1.0)).toBe(-ROLL_CLAMP_DEG);
    expect(tilt(0.45, 1.0, 0.55, 0.5)).toBe(ROLL_CLAMP_DEG);
  });

  it('does not clamp an ordinary lean', () => {
    const value = tilt(0.2, 0.5, 0.8, 0.62);
    expect(Math.abs(value)).toBeLessThan(ROLL_CLAMP_DEG);
    expect(value).toBeLessThan(0);
  });
});

describe('roll smoothing', () => {
  it('closes 35 percent of the gap each frame', () => {
    expect(ROLL_SMOOTHING).toBe(0.35);
    expect(stepRoll(0, 100)).toBeCloseTo(35, 10);
    expect(stepRoll(35, 100)).toBeCloseTo(57.75, 10);
  });

  it('converges on the target', () => {
    let roll = 0;
    for (let i = 0; i < 40; i += 1) roll = stepRoll(roll, 20);
    expect(roll).toBeCloseTo(20, 4);
  });

  it('goes straight there for reduced motion', () => {
    expect(ROLL_DIRECT).toBe(1);
    expect(stepRoll(-12, 20, ROLL_DIRECT)).toBe(20);
  });
});
