/**
 * The status line.
 *
 * A `role="status"` element is a polite live region. Re-writing the same text
 * into a live region makes some screen readers repeat themselves, so every
 * setter here refuses to write text that is already there.
 */

export type StatusKind = 'info' | 'error';

export interface StatusLine {
  /** Show a message. Errors are announced as text, not by colour alone. */
  set(text: string, kind?: StatusKind): void;
  /** The text currently on screen. */
  text(): string;
}

export function createStatus(element: HTMLElement): StatusLine {
  return {
    set(text: string, kind: StatusKind = 'info'): void {
      if (element.textContent === text) return;
      element.textContent = text;
      if (kind === 'error') {
        element.dataset['kind'] = 'error';
      } else {
        delete element.dataset['kind'];
      }
    },
    text(): string {
      return element.textContent ?? '';
    },
  };
}
