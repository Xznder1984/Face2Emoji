import { describe, expect, it } from 'vitest';

import { deriveFeatures, pair, PAIRED_NAMES } from '../features';
import { shapes } from './helpers';

describe('pair', () => {
  it('averages the two sides', () => {
    expect(pair({ a: 0.2, b: 0.6 }, 'a', 'b')).toBeCloseTo(0.4, 10);
  });

  it('treats a missing side as zero', () => {
    expect(pair({ a: 0.5 }, 'a', 'b')).toBeCloseTo(0.25, 10);
  });
});

describe('deriveFeatures', () => {
  it('reads every documented signal', () => {
    const f = deriveFeatures(
      shapes({
        mouthSmileLeft: 0.4,
        mouthSmileRight: 0.6,
        mouthFrownLeft: 0.1,
        mouthFrownRight: 0.3,
        eyeSquintLeft: 0.2,
        eyeSquintRight: 0.2,
        cheekSquintLeft: 0.5,
        cheekSquintRight: 0.5,
        eyeWideLeft: 0.3,
        eyeWideRight: 0.3,
        browDownLeft: 0.7,
        browDownRight: 0.7,
        noseSneerLeft: 0.1,
        noseSneerRight: 0.1,
        mouthPressLeft: 0.8,
        mouthPressRight: 0.8,
        mouthStretchLeft: 0.05,
        mouthStretchRight: 0.05,
        mouthUpperUpLeft: 0.9,
        mouthUpperUpRight: 0.9,
        eyeBlinkLeft: 0.55,
        eyeBlinkRight: 0.15,
        jawOpen: 0.42,
        browInnerUp: 0.33,
        mouthPucker: 0.61,
        tongueOut: 0.77,
        browOuterUpLeft: 0.8,
        browOuterUpRight: 0.2,
      }),
    );

    expect(f.smile).toBeCloseTo(0.5, 10);
    expect(f.frown).toBeCloseTo(0.2, 10);
    expect(f.squint).toBeCloseTo(0.2, 10);
    expect(f.cheekSquint).toBeCloseTo(0.5, 10);
    expect(f.eyeWide).toBeCloseTo(0.3, 10);
    expect(f.browDown).toBeCloseTo(0.7, 10);
    expect(f.sneer).toBeCloseTo(0.1, 10);
    expect(f.press).toBeCloseTo(0.8, 10);
    expect(f.stretch).toBeCloseTo(0.05, 10);
    expect(f.upperUp).toBeCloseTo(0.9, 10);
    expect(f.blink).toBeCloseTo(0.35, 10);
    expect(f.jaw).toBeCloseTo(0.42, 10);
    expect(f.browUp).toBeCloseTo(0.33, 10);
    expect(f.pucker).toBeCloseTo(0.61, 10);
    expect(f.tongue).toBeCloseTo(0.77, 10);
  });

  it('keeps each eye blink separate for the wink rule', () => {
    const f = deriveFeatures(shapes({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.1 }));
    expect(f.blinkL).toBeCloseTo(0.9, 10);
    expect(f.blinkR).toBeCloseTo(0.1, 10);
    expect(f.winkDiff).toBeCloseTo(0.8, 10);
  });

  it('measures a one-sided brow raise', () => {
    const f = deriveFeatures(shapes({ browOuterUpLeft: 0.75, browOuterUpRight: 0.25 }));
    expect(f.browDiff).toBeCloseTo(0.5, 10);
  });

  it('ignores the _neutral entry', () => {
    const f = deriveFeatures(shapes({ _neutral: 0.99, jawOpen: 0 }));
    expect(f.jaw).toBe(0);
    expect(Object.keys(f)).not.toContain('_neutral');
  });

  it('covers every paired name it advertises', () => {
    for (const [feature, left, right] of PAIRED_NAMES) {
      const f = deriveFeatures(shapes({ [left]: 0.2, [right]: 0.6 }));
      expect(f[feature]).toBeCloseTo(0.4, 10);
    }
  });
});
