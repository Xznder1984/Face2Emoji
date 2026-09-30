import type { Rule } from '../rules';

/**
 * The right-hand panel: one emoji, one text label, and a tilt.
 *
 * The label element is the page's polite live region for the expression name,
 * so it is only written when the words actually change. The glyph is
 * `aria-hidden`, because the label beside it already says what the emoji means
 * and a screen reader should not read a decorative glyph out loud.
 */

/** How long the scale pop lasts, matching the CSS transition. */
export const POP_MS = 140;

export interface ReadoutElements {
  /** The element that is rotated. */
  roll: HTMLElement;
  /** The emoji glyph itself, which is what the pop scales. */
  glyph: HTMLElement;
  /** The text label, and the polite live region. */
  label: HTMLElement;
}

export interface Readout {
  /** Show a matched rule: glyph, label, and a short pop. */
  setRule(rule: Rule): void;
  /** Write the live-region label, if it is different from what is there. */
  setLabel(text: string): void;
  /** Tilt the panel, in degrees. */
  setRoll(degrees: number): void;
  /** The label as it stands. */
  label(): string;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createReadout(elements: ReadoutElements): Readout {
  let popTimer = 0;
  let lastLabel = elements.label.textContent ?? '';

  function setLabel(text: string): void {
    if (lastLabel === text) return;
    lastLabel = text;
    elements.label.textContent = text;
  }

  return {
    setRule(rule: Rule): void {
      elements.glyph.textContent = rule.emoji;
      setLabel(rule.label);

      if (prefersReducedMotion()) return;
      elements.glyph.dataset['pop'] = 'on';
      window.clearTimeout(popTimer);
      popTimer = window.setTimeout(() => {
        delete elements.glyph.dataset['pop'];
      }, POP_MS);
    },

    setLabel,

    setRoll(degrees: number): void {
      // The rotation lives on the wrapper and the pop on the glyph, so the two
      // transforms never overwrite each other.
      elements.roll.style.setProperty('--roll', `${degrees.toFixed(2)}deg`);
    },

    label(): string {
      return lastLabel;
    },
  };
}
