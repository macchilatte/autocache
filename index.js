const DEFAULT_TTL = 0;

export function createCache(options = {}) {
  const { ttl = DEFAULT_TTL, maxSize = 1000 } = options;

  if (!Number.isFinite(ttl) || ttl < 0)
    throw new TypeError("ttl must be non-negative");
  if (!Number.isInteger(maxSize) || maxSize < 1)
    throw new TypeError("maxSize must be a positive integer");

  const store = new Map();

  function has(key) {
    const entry = store.get(key);
    if (!entry) return false;

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return false;
    }
    return true;
  }

  function get(key) {
    if (!has(key)) return undefined;

    const entry = store.get(key);
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  function set(key, value, duration = ttl) {
    if (!Number.isFinite(duration) || duration < 0)
      throw new TypeError("ttl must be non-negative");

    store.delete(key);
    store.set(key, {
      value,
      expiresAt: duration ? Date.now() + duration : 0
    });

    prune();
    while (store.size > maxSize)
      store.delete(store.keys().next().value);

    return value;
  }

  function prune() {
    const now = Date.now();

    for (const [key, entry] of store) {
      if (entry.expiresAt && entry.expiresAt <= now)
        store.delete(key);
    }

    return store.size;
  }

  async function getOrSet(key, factory, duration = ttl) {
    if (has(key)) return get(key);

    const value = await factory();

    if (!has(key)) set(key, value, duration);
    return value;
  }

  return {
    get,
    set,
    has,
    delete: key => store.delete(key),
    clear: () => store.clear(),
    prune,
    getOrSet,
    get size() {
      return prune();
    }
  };
}

export default createCache;
    
