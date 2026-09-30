import { describe, expect, it } from 'vitest';

import { createSettle, stepSettle } from '../settle';
import { DEFAULT_HOLD_MS } from '../rules';

const feed = (state: ReturnType<typeof createSettle>, id: string, hold: number, now: number) =>
  stepSettle(state, id, hold, now);

describe('hold-time debounce', () => {
  it('starts on the initial rule', () => {
    expect(createSettle('neutral').current).toBe('neutral');
  });

  it('does not switch on an ordinary 100ms blink', () => {
    let state = createSettle('neutral');

    // A blink: the candidate wins, then is gone 100ms later, well inside the
    // 200ms hold. Nothing on screen should change.
    let step = feed(state, 'eyes-closed', 600, 0);
    state = step.state;
    expect(step.changed).toBe(false);
    expect(state.current).toBe('neutral');

    step = feed(state, 'neutral', DEFAULT_HOLD_MS, 100);
    state = step.state;
    expect(step.changed).toBe(false);
    expect(state.current).toBe('neutral');
  });

  it('switches on a 600ms closed-eye hold', () => {
    let state = createSettle('neutral');

    let step = feed(state, 'eyes-closed', 600, 0);
    state = step.state;
    expect(step.changed).toBe(false);

    step = feed(state, 'eyes-closed', 600, 599);
    state = step.state;
    expect(step.changed).toBe(false);
    expect(state.current).toBe('neutral');

    step = feed(state, 'eyes-closed', 600, 600);
    state = step.state;
    expect(step.changed).toBe(true);
    expect(state.current).toBe('eyes-closed');
  });

  it('waits for exactly the rule hold, not the default', () => {
    let state = createSettle('neutral');
    state = feed(state, 'yawning', 500, 0).state;
    state = feed(state, 'yawning', 500, 200).state;
    expect(state.current).toBe('neutral');
    state = feed(state, 'yawning', 500, 500).state;
    expect(state.current).toBe('yawning');
  });

  it('restarts the clock when a different rule takes over', () => {
    let state = createSettle('neutral');
    state = feed(state, 'smiling', DEFAULT_HOLD_MS, 0).state;
    state = feed(state, 'grinning', DEFAULT_HOLD_MS, 150).state;
    // Smiling had 150ms of its 200ms hold. It must start again if it returns.
    state = feed(state, 'smiling', DEFAULT_HOLD_MS, 200).state;
    expect(state.current).toBe('neutral');
    state = feed(state, 'smiling', DEFAULT_HOLD_MS, 399).state;
    expect(state.current).toBe('neutral');
    state = feed(state, 'smiling', DEFAULT_HOLD_MS, 400).state;
    expect(state.current).toBe('smiling');
  });

  it('drops the pending rule when the winner comes back', () => {
    let state = createSettle('neutral');
    state = feed(state, 'smiling', DEFAULT_HOLD_MS, 0).state;
    expect(state.pending).toBe('smiling');
    state = feed(state, 'neutral', DEFAULT_HOLD_MS, 50).state;
    expect(state.pending).toBeNull();
    expect(state.current).toBe('neutral');
  });

  it('does not re-fire for a rule already on screen', () => {
    let state = createSettle('smiling');
    const step = feed(state, 'smiling', DEFAULT_HOLD_MS, 10_000);
    expect(step.changed).toBe(false);
    expect(step.state).toBe(state);
  });

  it('keeps the current rule when nothing else matches', () => {
    let state = createSettle('neutral');
    state = feed(state, 'neutral', DEFAULT_HOLD_MS, 0).state;
    expect(state.current).toBe('neutral');
    expect(state.pending).toBeNull();
  });
});
