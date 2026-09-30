/**
 * The hold-time debounce.
 *
 * A rule does not change the emoji the instant it starts winning. It has to
 * stay the winner for that rule's `hold` milliseconds first. That is what stops
 * an ordinary blink, which lasts about 100 ms, from flickering the display to
 * "Eyes closed", while a real 600 ms closed-eye hold still gets through.
 *
 * Pure and time-injected: the caller passes `now`, so tests need no timers.
 */

export interface SettleState {
  /** The rule id currently on screen. */
  current: string;
  /** The rule id waiting out its hold, if any. */
  pending: string | null;
  /** When the pending rule first started winning. */
  pendingSince: number;
}

export interface SettleStep {
  state: SettleState;
  /** True on the frame where the displayed rule actually changes. */
  changed: boolean;
}

export function createSettle(initial: string): SettleState {
  return { current: initial, pending: null, pendingSince: 0 };
}

/**
 * Feed one frame's winning rule in. `hold` is that rule's own hold time, so a
 * long-hold rule is not pre-empted by a short-hold one that flickers past.
 */
export function stepSettle(state: SettleState, candidateId: string, hold: number, now: number): SettleStep {
  if (candidateId === state.current) {
    if (state.pending === null) return { state, changed: false };
    return { state: { ...state, pending: null, pendingSince: 0 }, changed: false };
  }

  if (state.pending !== candidateId) {
    return {
      state: { current: state.current, pending: candidateId, pendingSince: now },
      changed: false,
    };
  }

  if (now - state.pendingSince >= hold) {
    return {
      state: { current: candidateId, pending: null, pendingSince: 0 },
      changed: true,
    };
  }

  return { state, changed: false };
}
