// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { createLiveFace, type LiveFace } from '../ui/liveFace';
import type { Features } from '../features';

const zero: Features = {
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
};

function features(overrides: Partial<Features> = {}): Features {
  return { ...zero, ...overrides };
}

let container: HTMLElement;
let face: LiveFace;

beforeEach(() => {
  document.body.replaceChildren();
  container = document.createElement('div');
  document.body.append(container);
  face = createLiveFace(container);
});

const svg = (): SVGElement | null => container.querySelector('svg');
const eye = (side: string): SVGElement | null =>
  container.querySelector(`.lf-eye-${side}`);
const brow = (side: string): SVGElement | null =>
  container.querySelector(`.lf-brow-${side}`);
const mouth = (): SVGElement | null => container.querySelector('.lf-mouth');
const tongue = (): SVGElement | null => container.querySelector('.lf-tongue');

describe('createLiveFace', () => {
  it('builds the face from elements, never from a string of markup', () => {
    const drawn = svg();
    expect(drawn).not.toBeNull();
    // One child, in the SVG namespace, put there by createElementNS.
    expect(container.childNodes).toHaveLength(1);
    expect(drawn?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(drawn?.getAttribute('aria-hidden')).toBe('true');
    expect(drawn?.getAttribute('viewBox')).toBe('0 0 200 200');
  });

  it('draws a face with two eyes, two brows, a mouth and a tongue', () => {
    expect(container.querySelectorAll('.lf-eye')).toHaveLength(2);
    expect(container.querySelectorAll('.lf-brow')).toHaveLength(2);
    expect(mouth()).not.toBeNull();
    expect(tongue()).not.toBeNull();
  });

  it('starts hidden', () => {
    expect(face.visible()).toBe(false);
  });

  it('shows and hides on request', () => {
    face.show();
    expect(face.visible()).toBe(true);
    expect(container.hidden).toBe(false);

    face.hide();
    expect(face.visible()).toBe(false);
    expect(container.hidden).toBe(true);
  });

  it('leaves the tongue hidden until the mouth is open', () => {
    face.update(features());
    expect(Number(tongue()?.getAttribute('opacity'))).toBe(0);
  });
});

describe('live face signals', () => {
  it('closes an eye on a blink and leaves the other open on a wink', () => {
    face.update(features({ blinkL: 1, blinkR: 0 }));
    expect(eye('l')?.getAttribute('transform')).toContain('0.080');
    expect(eye('r')?.getAttribute('transform')).toBe('scale(1 1.000)');

    face.update(features({ blinkL: 0, blinkR: 1 }));
    expect(eye('r')?.getAttribute('transform')).toContain('0.080');
  });

  it('opens the eyes wider on an eye-wide signal', () => {
    face.update(features({ eyeWide: 0 }));
    const resting = eye('l')?.getAttribute('ry');
    face.update(features({ eyeWide: 1 }));
    expect(Number(eye('l')?.getAttribute('ry'))).toBeGreaterThan(Number(resting));
  });

  it('lifts the brows on brow-up and drops them on brow-down', () => {
    face.update(features({ browUp: 0, browDown: 0 }));
    const resting = Number(brow('l')?.getAttribute('y'));

    face.update(features({ browUp: 1 }));
    expect(Number(brow('l')?.getAttribute('y'))).toBeLessThan(resting);

    face.update(features({ browDown: 1 }));
    expect(Number(brow('l')?.getAttribute('y'))).toBeGreaterThan(resting);
  });

  it('tils the brows inward when they come down', () => {
    face.update(features({ browDown: 0 }));
    expect(brow('l')?.getAttribute('transform')).toBe('rotate(0.0 64 52)');

    face.update(features({ browDown: 1 }));
    expect(brow('l')?.getAttribute('transform')).not.toBe('rotate(0 64 52)');
  });

  it('curves the mouth up for a smile and down for a frown', () => {
    face.update(features({ smile: 0, frown: 0 }));
    const neutral = mouth()?.getAttribute('d') ?? '';

    face.update(features({ smile: 1 }));
    const smiling = mouth()?.getAttribute('d') ?? '';
    expect(smiling).not.toBe(neutral);

    face.update(features({ frown: 1 }));
    const frowning = mouth()?.getAttribute('d') ?? '';
    expect(frowning).not.toBe(neutral);
    expect(frowning).not.toBe(smiling);
  });

  it('opens the mouth with the jaw', () => {
    face.update(features({ jaw: 0 }));
    const closed = mouth()?.getAttribute('d') ?? '';

    face.update(features({ jaw: 1 }));
    const open = mouth()?.getAttribute('d') ?? '';
    expect(open).not.toBe(closed);
  });

  it('pulls the mouth into a small ring on a pucker', () => {
    face.update(features({ pucker: 0 }));
    const normal = mouth()?.getAttribute('d') ?? '';

    face.update(features({ pucker: 1 }));
    const puckered = mouth()?.getAttribute('d') ?? '';
    expect(puckered).not.toBe(normal);
    expect(mouth()?.getAttribute('opacity')).toBe('0');
  });

  it('shows the tongue only when the mouth is open and the tongue is out', () => {
    face.update(features({ tongue: 1, jaw: 0 }));
    expect(Number(tongue()?.getAttribute('opacity'))).toBe(0);

    face.update(features({ tongue: 1, jaw: 1 }));
    expect(Number(tongue()?.getAttribute('opacity'))).toBeGreaterThan(0);
  });

  it('widens the mouth on a stretch', () => {
    face.update(features({ stretch: 0 }));
    const narrow = mouth()?.getAttribute('d') ?? '';
    face.update(features({ stretch: 1 }));
    expect(mouth()?.getAttribute('d')).not.toBe(narrow);
  });

  it('treats a missing or NaN signal as zero rather than breaking the drawing', () => {
    const broken = { ...zero, smile: Number.NaN, jaw: undefined as unknown as number };
    expect(() => face.update(broken)).not.toThrow();
    expect(mouth()?.getAttribute('d')).toBeTruthy();
  });

  it('clamps a signal that is out of range', () => {
    expect(() => face.update(features({ blink: 5, jaw: -3 }))).not.toThrow();
    expect(eye('l')?.getAttribute('transform')).toBeTruthy();
  });
});
