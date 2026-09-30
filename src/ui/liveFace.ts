import type { Features } from '../features';

/**
 * The "Live emoji face" display: a drawn face that mirrors the visitor.
 *
 * It reads the same smoothed signals as the rule list, so what it shows is
 * derived from the same numbers that picked the emoji. Nothing here is stored
 * or sent anywhere, and the face is rebuilt from attributes on every frame
 * rather than from a string of markup.
 *
 * The element is `aria-hidden`, because the label beside it already names the
 * expression and a screen reader should not read a decorative face out loud.
 */

export const FACE_VIEWBOX = 200;

/** Clamp a signal to 0..1 so a stray score cannot throw the drawing. */
function unit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** A point on the face, in viewBox units. */
interface Point {
  x: number;
  y: number;
}

const FACE_RADIUS = 90;
const EYE_Y = 78;
const EYE_LEFT_X = 64;
const EYE_RIGHT_X = 136;
const BROW_Y = 52;
const MOUTH_Y = 138;

function svgElement(name: string): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

/** The mouth as a closed shape that opens with the jaw. */
function mouthPath(curve: number, open: number, halfWidth: number): string {
  const left: Point = { x: 100 - halfWidth, y: MOUTH_Y };
  const right: Point = { x: 100 + halfWidth, y: MOUTH_Y };
  const lip = MOUTH_Y + curve;
  const chin = MOUTH_Y + curve + open;
  return [
    `M ${left.x.toFixed(1)} ${left.y.toFixed(1)}`,
    `Q 100 ${lip.toFixed(1)} ${right.x.toFixed(1)} ${right.y.toFixed(1)}`,
    `Q 100 ${chin.toFixed(1)} ${left.x.toFixed(1)} ${left.y.toFixed(1)}`,
    'Z',
  ].join(' ');
}

export interface LiveFace {
  /** Redraw from the current signals. Cheap enough to call every frame. */
  update(features: Features): void;
  /** Put the face on screen. */
  show(): void;
  /** Take it off screen. */
  hide(): void;
  /** Whether the face is on screen. */
  visible(): boolean;
}

export function createLiveFace(container: HTMLElement): LiveFace {
  const svg = svgElement('svg');
  svg.setAttribute('viewBox', `0 0 ${FACE_VIEWBOX} ${FACE_VIEWBOX}`);
  svg.setAttribute('class', 'live-face');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const face = svgElement('circle');
  face.setAttribute('cx', '100');
  face.setAttribute('cy', '100');
  face.setAttribute('r', String(FACE_RADIUS));
  face.setAttribute('class', 'lf-face');
  svg.append(face);

  const makeBrow = (side: 'l' | 'r'): SVGElement => {
    const brow = svgElement('rect');
    brow.setAttribute('width', '30');
    brow.setAttribute('height', '7');
    brow.setAttribute('rx', '3.5');
    brow.setAttribute('class', `lf-brow lf-brow-${side}`);
    brow.setAttribute('x', side === 'l' ? '49' : '121');
    brow.setAttribute('y', String(BROW_Y));
    svg.append(brow);
    return brow;
  };

  const makeEye = (side: 'l' | 'r'): SVGElement => {
    const eye = svgElement('ellipse');
    eye.setAttribute('rx', '11');
    eye.setAttribute('ry', '13');
    eye.setAttribute('class', `lf-eye lf-eye-${side}`);
    eye.setAttribute('cx', String(side === 'l' ? EYE_LEFT_X : EYE_RIGHT_X));
    eye.setAttribute('cy', String(EYE_Y));
    svg.append(eye);
    return eye;
  };

  const browLeft = makeBrow('l');
  const browRight = makeBrow('r');
  const eyeLeft = makeEye('l');
  const eyeRight = makeEye('r');

  const mouth = svgElement('path');
  mouth.setAttribute('class', 'lf-mouth');
  svg.append(mouth);

  const tongue = svgElement('ellipse');
  tongue.setAttribute('class', 'lf-tongue');
  tongue.setAttribute('cx', '100');
  tongue.setAttribute('rx', '16');
  tongue.setAttribute('ry', '9');
  tongue.setAttribute('opacity', '0');
  svg.append(tongue);

  container.append(svg);

  let shown = false;

  return {
    update(features: Features): void {
      const blinkL = unit(features.blinkL);
      const blinkR = unit(features.blinkR);
      const wide = unit(features.eyeWide);
      const browUp = unit(features.browUp);
      const browDown = unit(features.browDown);
      const smile = unit(features.smile);
      const frown = unit(features.frown);
      const jaw = unit(features.jaw);
      const pucker = unit(features.pucker);
      const stretch = unit(features.stretch);
      const tongueOut = unit(features.tongue);

      // Eyes: blink closes them, eyeWide opens them past their resting size.
      const openL = 1 - blinkL * 0.92;
      const openR = 1 - blinkR * 0.92;
      eyeLeft.setAttribute('transform', `scale(1 ${openL.toFixed(3)})`);
      eyeRight.setAttribute('transform', `scale(1 ${openR.toFixed(3)})`);
      eyeLeft.setAttribute('ry', String(13 * (1 + wide * 0.35)));
      eyeRight.setAttribute('ry', String(13 * (1 + wide * 0.35)));

      // Brows: inner-up lifts them, brow-down pulls them down and inward.
      const lift = browUp * 10 - browDown * 8;
      const tiltL = browDown * 0.35;
      const tiltR = -browDown * 0.35;
      browLeft.setAttribute('y', String(BROW_Y - lift));
      browRight.setAttribute('y', String(BROW_Y - lift));
      browLeft.setAttribute('transform', `rotate(${(-tiltL * 57.3).toFixed(1)} 64 ${BROW_Y})`);
      browRight.setAttribute('transform', `rotate(${(-tiltR * 57.3).toFixed(1)} 136 ${BROW_Y})`);

      // Mouth: smile curves up, frown curves down, the jaw opens it, pucker
      // pulls it into a small ring, and stretch widens it.
      const curve = (frown - smile) * 30;
      const open = jaw * 26;
      const halfWidth = pucker > 0.45 ? 10 + (1 - pucker) * 22 : 30 + stretch * 12;
      mouth.setAttribute('d', mouthPath(curve, open, halfWidth));
      mouth.setAttribute('opacity', pucker > 0.45 ? '0' : '1');

      // The tongue only shows when the mouth is open.
      const tongueOpacity = tongueOut * Math.min(1, jaw * 2.5);
      tongue.setAttribute('opacity', tongueOpacity.toFixed(3));
      tongue.setAttribute('cy', String(MOUTH_Y + curve + open * 0.55));
    },

    show(): void {
      container.hidden = false;
      shown = true;
    },

    hide(): void {
      container.hidden = true;
      shown = false;
    },

    visible(): boolean {
      return shown;
    },
  };
}
