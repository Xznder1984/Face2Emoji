/**
 * A trailing debounce, used to hold a photo search back until the visitor has
 * settled on one expression.
 *
 * The rule list only switches after its hold time, so without this a single
 * expression would be searched for as many times as it lasted. Seven hundred
 * milliseconds is longer than every rule's hold time, so in practice one
 * settled expression produces exactly one search.
 */

export const SETTLE_MS = 700;

export interface Debounce {
  /** Note that something happened. The call happens later, or not at all. */
  (): void;
  /** Run now, if anything is waiting. */
  flush(): void;
  /** Forget anything waiting. */
  cancel(): void;
  /** True when something is waiting. */
  pending(): boolean;
}

export function createDebounce(run: () => void, waitMs = SETTLE_MS): Debounce {
  let timer = 0;

  const fire = (): void => {
    timer = 0;
    run();
  };

  const debounce = (): void => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(fire, waitMs);
  };

  debounce.flush = (): void => {
    if (!timer) return;
    window.clearTimeout(timer);
    fire();
  };
  debounce.cancel = (): void => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = 0;
  };
  debounce.pending = (): boolean => timer !== 0;

  return debounce;
}
