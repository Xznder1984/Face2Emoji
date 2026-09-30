import type { Features } from '../features';

/** A Features object with everything at zero, for overriding in tests. */
export function features(overrides: Partial<Features> = {}): Features {
  return {
    smile: 0,
    frown: 0,
    squint: 0,
    cheekSquint: 0,
    eyeWide: 0,
    browDown: 0,
    sneer: 0,
    press: 0,
    stretch: 0,
    upperUp: 0,
    blink: 0,
    jaw: 0,
    browUp: 0,
    pucker: 0,
    tongue: 0,
    blinkL: 0,
    blinkR: 0,
    browDiff: 0,
    winkDiff: 0,
    ...overrides,
  };
}

/** A blendshape map with only the named scores set. */
export function shapes(overrides: Record<string, number>): Record<string, number> {
  return { _neutral: 0.02, ...overrides };
}
