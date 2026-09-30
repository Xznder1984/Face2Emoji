import { searchCommons, searchErrorMessage, type CommonsPhoto } from './commons';

/**
 * One photo search per expression per session.
 *
 * The point is politeness rather than speed: the same expression is likely to
 * be matched again within a second or two while the visitor holds a pose, and
 * re-asking Wikimedia every time would be rude. Nothing is written to disk or
 * to storage, so a reload starts empty.
 */

export const MAX_IN_FLIGHT = 3;

export type CacheState =
  | { status: 'idle' }
  | { status: 'loading'; term: string }
  | { status: 'ready'; term: string; photos: CommonsPhoto[] }
  | { status: 'error'; term: string; message: string };

export interface PhotoCache {
  /** Show photos for a phrase, or nothing when `null`. */
  select(term: string | null): Promise<void>;
  /** The current state, for the caller to render. */
  state(): CacheState;
  /** How many requests are open right now. Never more than `MAX_IN_FLIGHT`. */
  inFlight(): number;
  /** A subscriber, called whenever the state changes. Returns an unsubscribe. */
  subscribe(listener: (state: CacheState) => void): () => void;
  /** Drop everything. Used when the visitor turns photo lookup off. */
  clear(): void;
}

export interface PhotoCacheOptions {
  fetchImpl?: typeof fetch;
  limit?: number;
}

/** A request that can be abandoned, plus the data to abandon it with. */
interface Entry {
  promise: Promise<CommonsPhoto[]>;
  controller: AbortController;
}

export function createPhotoCache(options: PhotoCacheOptions = {}): PhotoCache {
  const limit = options.limit ?? MAX_IN_FLIGHT;
  const cache = new Map<string, CommonsPhoto[]>();
  const open = new Map<string, Entry>();
  const queue: string[] = [];
  const listeners = new Set<(state: CacheState) => void>();

  let current: CacheState = { status: 'idle' };
  let currentTerm: string | null = null;

  function publish(): void {
    for (const listener of listeners) listener(current);
  }

  function settle(term: string): void {
    open.delete(term);
    const at = queue.indexOf(term);
    if (at !== -1) queue.splice(at, 1);
  }

  /** Start the next queued search, keeping the number of open requests low. */
  function pump(): void {
    while (open.size < limit && queue.length > 0) {
      const term = queue.shift();
      if (term === undefined) return;
      if (open.has(term)) continue;
      void start(term);
    }
  }

  async function start(term: string): Promise<void> {
    const controller = new AbortController();
    const promise = searchCommons(term, {
      signal: controller.signal,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
    open.set(term, { promise, controller });

    try {
      const photos = await promise;
      cache.set(term, photos);
      // Only show a result if the visitor is still looking at this expression.
      if (currentTerm === term) {
        current = { status: 'ready', term, photos };
        publish();
      }
    } catch (error) {
      // An abandoned request has already been reported as replaced, so saying
      // anything now would talk over the expression the visitor is holding.
      if (controller.signal.aborted) return;
      if (currentTerm === term) {
        current = { status: 'error', term, message: searchErrorMessage(error) };
        publish();
      }
    } finally {
      settle(term);
      pump();
    }
  }

  /** Drop everything queued and abort everything on the wire. */
  function abandonAll(): void {
    for (const entry of open.values()) entry.controller.abort();
    queue.length = 0;
  }

  return {
    async select(term) {
      if (term === null) {
        abandonAll();
        currentTerm = null;
        current = { status: 'idle' };
        publish();
        return;
      }

      // Switching expression abandons the previous request. This is what keeps
      // the queue down to one entry and stops a flicker of expressions from
      // turning into a burst of requests.
      for (const [other, entry] of open) {
        if (other !== term) entry.controller.abort();
      }
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        if (queue[index] !== term) queue.splice(index, 1);
      }

      currentTerm = term;
      const cached = cache.get(term);
      if (cached) {
        current = { status: 'ready', term, photos: cached };
        publish();
        return;
      }

      current = { status: 'loading', term };
      publish();

      // Already on the wire, or already waiting for a slot: nothing to add.
      if (open.has(term) || queue.includes(term)) return;

      queue.push(term);
      pump();
    },

    state() {
      return current;
    },

    inFlight() {
      return open.size;
    },

    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },

    clear() {
      for (const entry of open.values()) entry.controller.abort();
      open.clear();
      queue.length = 0;
      cache.clear();
      currentTerm = null;
      current = { status: 'idle' };
      publish();
    },
  };
}
