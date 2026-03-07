/**
 * In-memory TTL cache with stale-while-revalidate.
 * - Fresh period: ttlMs → returns cached value
 * - Stale period: ttlMs ~ ttlMs*3 → returns stale value, revalidates in background
 * - Expired: beyond stale period → computes fresh value
 * - In-flight dedup: concurrent requests for the same key share one computation
 */

const store = new Map();
const inflight = new Map();

/**
 * Get a cached value with stale-while-revalidate semantics.
 * @param {string} key
 * @param {number} ttlMs - Fresh TTL in milliseconds
 * @param {() => Promise<any>} fn - Async function to compute value on miss
 * @returns {Promise<any>}
 */
export async function cached(key, ttlMs, fn) {
  const now = Date.now();
  const entry = store.get(key);
  const staleTtlMs = ttlMs * 3;

  // Fresh hit
  if (entry && now < entry.freshUntil) {
    return entry.value;
  }

  // Stale hit — return stale value, revalidate in background
  if (entry && now < entry.staleUntil) {
    if (!inflight.has(key)) {
      const p = fn()
        .then(value => {
          store.set(key, {
            value,
            freshUntil: Date.now() + ttlMs,
            staleUntil: Date.now() + staleTtlMs,
          });
        })
        .catch(() => {})
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return entry.value;
  }

  // Miss or fully expired — deduplicate concurrent requests
  if (inflight.has(key)) {
    await inflight.get(key);
    const fresh = store.get(key);
    if (fresh) return fresh.value;
  }

  const p = fn().then(value => {
    store.set(key, {
      value,
      freshUntil: Date.now() + ttlMs,
      staleUntil: Date.now() + staleTtlMs,
    });
    inflight.delete(key);
    return value;
  }).catch(err => {
    inflight.delete(key);
    throw err;
  });
  inflight.set(key, p);
  return p;
}

/** Invalidate a specific key or all keys matching a prefix. */
export function invalidate(keyOrPrefix) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(keyOrPrefix)) store.delete(k);
  }
}

/**
 * Warm up a cache entry. Calls fn() in the background, doesn't block.
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<any>} fn
 */
export function warmup(key, ttlMs, fn) {
  if (store.has(key)) return;
  const staleTtlMs = ttlMs * 3;
  const p = fn()
    .then(value => {
      store.set(key, {
        value,
        freshUntil: Date.now() + ttlMs,
        staleUntil: Date.now() + staleTtlMs,
      });
    })
    .catch(() => {})
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
}
