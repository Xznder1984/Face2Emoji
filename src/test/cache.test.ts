// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_IN_FLIGHT, createPhotoCache, type CacheState } from '../cache';
import { createDebounce } from '../debounce';

/** A fetch that never settles until the test says so. */
function deferredFetch(): {
  fetchImpl: typeof fetch;
  /** How many requests have been made in total. */
  requested: () => number;
  /** How many have been made but not yet settled. */
  outstanding: () => number;
  resolve: (term: string) => void;
  reject: (term: string, error: unknown) => void;
  terms: () => string[];
} {
  const open: { term: string; resolve: (value: Response) => void; reject: (error: unknown) => void }[] =
    [];
  const settled = new Set<string>();
  const terms: string[] = [];
  const find = (term: string) => open.findIndex((entry) => entry.term === term);

  const body = (): Response => new Response(JSON.stringify({ query: { pages: [] } }));

  return {
    fetchImpl: ((input: RequestInfo | URL) => {
      const term = new URL(String(input)).searchParams.get('gsrsearch') ?? '';
      terms.push(term);
      return new Promise<Response>((resolve, reject) => {
        open.push({ term, resolve, reject });
      });
    }) as typeof fetch,
    requested: () => terms.length,
    outstanding: () => open.filter((entry) => !settled.has(entry.term)).length,
    resolve: (term) => {
      const entry = open[find(term)];
      if (!entry) throw new Error(`nothing to resolve for ${term}`);
      settled.add(term);
      entry.resolve(body());
    },
    reject: (term, error) => {
      const entry = open[find(term)];
      if (!entry) throw new Error(`nothing to reject for ${term}`);
      settled.add(term);
      entry.reject(error);
    },
    terms: () => terms,
  };
}

/** Let both the promise queue and the response-body reader drain. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createPhotoCache', () => {
  it('starts idle and says so', () => {
    const cache = createPhotoCache({ fetchImpl: deferredFetch().fetchImpl });
    expect(cache.state()).toEqual({ status: 'idle' });
    expect(cache.inFlight()).toBe(0);
  });

  it('tells a new subscriber the current state immediately', () => {
    const cache = createPhotoCache({ fetchImpl: deferredFetch().fetchImpl });
    const seen: CacheState[] = [];
    cache.subscribe((state) => seen.push(state));
    expect(seen).toEqual([{ status: 'idle' }]);
  });

  it('publishes loading, then ready', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });
    const seen: string[] = [];
    cache.subscribe((state) => seen.push(state.status));

    const waiting = cache.select('yawning face');
    expect(cache.state()).toEqual({ status: 'loading', term: 'yawning face' });
    expect(net.requested()).toBe(1);

    net.resolve('yawning face');
    await waiting;
    await flush();

    expect(cache.state()).toEqual({ status: 'ready', term: 'yawning face', photos: [] });
    expect(seen).toEqual(['idle', 'loading', 'ready']);
  });

  it('asks Wikimedia once per expression, not once per frame', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    await cache.select('yawning face');
    net.resolve('yawning face');
    await flush();

    // Ten more selections of the same expression, as ten more frames would do.
    for (let i = 0; i < 10; i += 1) await cache.select('yawning face');

    expect(net.terms()).toEqual(['yawning face']);
    expect(cache.state().status).toBe('ready');
  });

  it('caches across going away and coming back', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    await cache.select('yawning face');
    net.resolve('yawning face');
    await flush();
    await cache.select(null);
    await cache.select('yawning face');

    expect(net.terms()).toHaveLength(1);
    expect(cache.state().status).toBe('ready');
  });

  it('publishes an error without throwing', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    const waiting = cache.select('yawning face');
    net.reject('yawning face', new Error('Wikimedia Commons returned 503.'));
    await waiting;
    await flush();

    expect(cache.state()).toEqual({
      status: 'error',
      term: 'yawning face',
      message: 'Photos could not be loaded from Wikimedia Commons.',
    });
  });

  it('retries after an error rather than caching the failure', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    const first = cache.select('yawning face');
    net.reject('yawning face', new Error('boom'));
    await first;
    await flush();

    await cache.select('yawning face');
    expect(net.terms()).toEqual(['yawning face', 'yawning face']);
    expect(cache.state().status).toBe('loading');
  });

  it('never has more than three requests open, however fast the expression changes', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    const terms = ['a face', 'b face', 'c face', 'd face', 'e face'];
    for (const term of terms) {
      await cache.select(term);
      expect(net.outstanding()).toBeLessThanOrEqual(MAX_IN_FLIGHT);
      expect(cache.inFlight()).toBeLessThanOrEqual(MAX_IN_FLIGHT);
    }

    // Three abandoned requests are still on the wire, so the newest expression
    // waits for one of them to actually stop rather than firing a fourth.
    expect(net.outstanding()).toBe(MAX_IN_FLIGHT);
    expect(net.terms()).toEqual(terms.slice(0, MAX_IN_FLIGHT));
    expect(cache.state()).toEqual({ status: 'loading', term: 'e face' });

    net.resolve('a face');
    await flush();

    // The freed slot goes to the expression the visitor is still holding, and
    // the two abandoned ones are never asked again.
    expect(net.terms()).toEqual([...terms.slice(0, MAX_IN_FLIGHT), 'e face']);
    expect(net.outstanding()).toBe(MAX_IN_FLIGHT);
  });

  it('releases a slot as soon as an abandoned request settles', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl, limit: 1 });

    await cache.select('a face');
    expect(net.requested()).toBe(1);

    // The cap stops a second request going out while the first is still open,
    // even though the first has been abandoned.
    await cache.select('b face');
    expect(net.requested()).toBe(1);
    expect(cache.inFlight()).toBe(1);
    expect(cache.state()).toEqual({ status: 'loading', term: 'b face' });

    net.resolve('a face');
    await flush();
    expect(net.requested()).toBe(2);

    net.resolve('b face');
    await flush();
    expect(cache.inFlight()).toBe(0);
    expect(cache.state()).toEqual({ status: 'ready', term: 'b face', photos: [] });
  });

  it('abandons the previous request when the expression changes', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    const first = cache.select('yawning face');
    await cache.select('smiling face');

    // The abandoned request resolves late; it must not overwrite the new state.
    net.resolve('yawning face');
    await first;
    await flush();

    expect(cache.state()).toEqual({ status: 'loading', term: 'smiling face' });
  });

  it('says nothing about an abandoned request when it fails', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    const first = cache.select('yawning face');
    await cache.select('smiling face');
    net.reject('yawning face', new DOMException('aborted', 'AbortError'));
    await first;
    await flush();

    expect(cache.state()).toEqual({ status: 'loading', term: 'smiling face' });
  });

  it('forgets everything when the visitor turns lookup off', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    await cache.select('yawning face');
    net.resolve('yawning face');
    await flush();

    cache.clear();
    expect(cache.state()).toEqual({ status: 'idle' });

    await cache.select('yawning face');
    expect(net.terms()).toEqual(['yawning face', 'yawning face']);
  });

  it('stops in-flight requests when cleared', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });

    const waiting = cache.select('yawning face');
    cache.clear();
    net.resolve('yawning face');
    await waiting;
    await flush();

    expect(cache.inFlight()).toBe(0);
    expect(cache.state()).toEqual({ status: 'idle' });
  });

  it('stops notifying an unsubscribed listener', async () => {
    const net = deferredFetch();
    const cache = createPhotoCache({ fetchImpl: net.fetchImpl });
    const seen: CacheState[] = [];
    const off = cache.subscribe((state) => seen.push(state));

    await cache.select('yawning face');
    off();
    net.resolve('yawning face');
    await flush();

    expect(seen.map((state) => state.status)).toEqual(['idle', 'loading']);
  });
});

describe('createDebounce', () => {
  it('waits for the pose to settle before searching', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const debounce = createDebounce(run, 700);

    debounce();
    debounce();
    debounce();
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(699);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('starts the clock over each time', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const debounce = createDebounce(run, 700);

    debounce();
    vi.advanceTimersByTime(600);
    debounce();
    vi.advanceTimersByTime(600);
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs nothing at all if nothing happened', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const debounce = createDebounce(run, 700);

    debounce.flush();
    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
    expect(debounce.pending()).toBe(false);
  });

  it('can be cancelled when lookup is turned off', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const debounce = createDebounce(run, 700);

    debounce();
    expect(debounce.pending()).toBe(true);
    debounce.cancel();
    vi.advanceTimersByTime(5_000);

    expect(run).not.toHaveBeenCalled();
    expect(debounce.pending()).toBe(false);
  });

  it('runs a waiting call straight away on flush', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const debounce = createDebounce(run, 700);

    debounce();
    debounce.flush();
    expect(run).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
