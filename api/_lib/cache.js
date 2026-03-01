/**
 * Simple in-memory TTL cache for API responses.
 * Each entry expires after `ttl` milliseconds.
 */

const store = new Map();

/**
 * Get a cached value or compute it.
 * @param {string} key - Cache key
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @param {() => Promise<any>} fn - Async function to compute the value on miss
 * @returns {Promise<any>}
 */
export async function cached(key, ttlMs, fn) {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
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
