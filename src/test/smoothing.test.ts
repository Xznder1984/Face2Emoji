import { describe, expect, it } from 'vitest';

import {
  addCalibrationSample,
  applyCalibration,
  calibrationProgress,
  ema,
  emptyCalibration,
  NEUTRAL_FRAMES,
  NEUTRAL_SAMPLE_CAP,
  rescale,
  smoothBlendshapes,
  SMOOTHING_ALPHA,
} from '../smoothing';
import { shapes } from './helpers';

describe('exponential moving average', () => {
  it('uses a factor of 0.5', () => {
    expect(SMOOTHING_ALPHA).toBe(0.5);
    expect(ema(0, 1)).toBeCloseTo(0.5, 10);
  });

  it('converges on a steady value', () => {
    let value = 0;
    for (let i = 0; i < 30; i += 1) value = ema(value, 0.8);
    expect(value).toBeCloseTo(0.8, 5);
  });

  it('halves the error each frame', () => {
    let value = 0;
    for (let i = 0; i < 5; i += 1) value = ema(value, 1);
    expect(value).toBeCloseTo(1 - 1 / 32, 6);
  });
});

describe('smoothBlendshapes', () => {
  it('smooths a score towards its new value', () => {
    const next = smoothBlendshapes({ jawOpen: 0 }, { jawOpen: 1 });
    expect(next['jawOpen']).toBeCloseTo(0.5, 10);
  });

  it('starts a score that has no history at its own value', () => {
    const next = smoothBlendshapes({}, { jawOpen: 0.42 });
    expect(next['jawOpen']).toBeCloseTo(0.42, 10);
  });

  it('carries _neutral through untouched', () => {
    const next = smoothBlendshapes({ _neutral: 0.1, jawOpen: 0.4 }, { _neutral: 0.9, jawOpen: 0.8 });
    expect(next['_neutral']).toBeCloseTo(0.9, 10);
    expect(next['jawOpen']).toBeCloseTo(0.6, 10);
  });
});

describe('neutral calibration', () => {
  it('averages thirty frames', () => {
    expect(NEUTRAL_FRAMES).toBe(30);
    let calibration = emptyCalibration();
    for (let i = 0; i < NEUTRAL_FRAMES; i += 1) {
      calibration = addCalibrationSample(calibration, shapes({ jawOpen: 0.2 }));
    }
    expect(calibration.complete).toBe(true);
    expect(calibration.base['jawOpen']).toBeCloseTo(0.2, 10);
  });

  it('is not complete one frame early', () => {
    let calibration = emptyCalibration();
    for (let i = 0; i < NEUTRAL_FRAMES - 1; i += 1) {
      calibration = addCalibrationSample(calibration, shapes({ jawOpen: 0.2 }));
    }
    expect(calibration.complete).toBe(false);
    expect(calibrationProgress(calibration)).toBeCloseTo(29 / 30, 10);
  });

  it('caps each sample at 0.5 before averaging', () => {
    expect(NEUTRAL_SAMPLE_CAP).toBe(0.5);
    let calibration = emptyCalibration();
    for (let i = 0; i < NEUTRAL_FRAMES; i += 1) {
      calibration = addCalibrationSample(calibration, shapes({ mouthSmileLeft: 0.9 }));
    }
    expect(calibration.base['mouthSmileLeft']).toBeCloseTo(0.5, 10);
  });

  it('averages across differing frames', () => {
    let calibration = emptyCalibration();
    for (let i = 0; i < 15; i += 1) {
      calibration = addCalibrationSample(calibration, shapes({ jawOpen: 0.1 }));
    }
    for (let i = 0; i < 15; i += 1) {
      calibration = addCalibrationSample(calibration, shapes({ jawOpen: 0.3 }));
    }
    expect(calibration.base['jawOpen']).toBeCloseTo(0.2, 10);
  });

  it('ignores further samples once complete', () => {
    let calibration = emptyCalibration();
    for (let i = 0; i < NEUTRAL_FRAMES; i += 1) {
      calibration = addCalibrationSample(calibration, shapes({ jawOpen: 0.2 }));
    }
    const after = addCalibrationSample(calibration, shapes({ jawOpen: 0.9 }));
    expect(after).toBe(calibration);
    expect(after.base['jawOpen']).toBeCloseTo(0.2, 10);
  });

  it('ignores _neutral while sampling', () => {
    let calibration = emptyCalibration();
    for (let i = 0; i < NEUTRAL_FRAMES; i += 1) {
      calibration = addCalibrationSample(calibration, shapes({ jawOpen: 0.2, _neutral: 0.9 }));
    }
    expect(calibration.base['_neutral']).toBeUndefined();
  });
});

describe('rescale', () => {
  it('spreads the remaining range over 0 to 1', () => {
    expect(rescale(0.2, 0.2)).toBeCloseTo(0, 10);
    expect(rescale(0.6, 0.2)).toBeCloseTo(0.5, 10);
    expect(rescale(1, 0.2)).toBeCloseTo(1, 10);
  });

  it('clamps below the baseline to zero', () => {
    expect(rescale(0.1, 0.5)).toBe(0);
  });

  it('clamps above one', () => {
    expect(rescale(1.4, 0.5)).toBe(1);
  });

  it('keeps the cap from producing a divide by zero', () => {
    // Even with a baseline of 1, which the sampler prevents, this must not be
    // Infinity or NaN.
    expect(Number.isFinite(rescale(0.5, 1))).toBe(true);
  });
});

describe('applyCalibration', () => {
  it('is a no-op with no baseline', () => {
    const values = shapes({ jawOpen: 0.5 });
    expect(applyCalibration(values, {})).toBe(values);
  });

  it('rescales every score and leaves _neutral alone', () => {
    const out = applyCalibration(shapes({ jawOpen: 0.6, _neutral: 0.03 }), { jawOpen: 0.1 });
    expect(out['jawOpen']).toBeCloseTo(0.5 / 0.9, 10);
    expect(out['_neutral']).toBeCloseTo(0.03, 10);
  });

  it('treats a name with no baseline as unchanged', () => {
    const out = applyCalibration(shapes({ jawOpen: 0.4 }), { tongueOut: 0.1 });
    expect(out['jawOpen']).toBeCloseTo(0.4, 10);
  });
});
