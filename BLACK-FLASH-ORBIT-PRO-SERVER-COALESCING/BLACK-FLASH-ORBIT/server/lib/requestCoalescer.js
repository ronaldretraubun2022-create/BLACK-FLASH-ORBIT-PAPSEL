"use strict";

function normalizeKey(key) {
  const value = String(key || "").trim();
  if (!value) {
    throw new Error("Request coalescer key is required.");
  }
  return value;
}

function createRequestCoalescer({ ttlMs = 0, maxEntries = 500 } = {}) {
  const cache = new Map();
  const inFlight = new Map();

  function prune(now = Date.now()) {
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) cache.delete(key);
    }

    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  async function resolve(key, loader, { force = false } = {}) {
    const normalizedKey = normalizeKey(key);
    const now = Date.now();

    if (typeof loader !== "function") {
      throw new TypeError("Request coalescer loader must be a function.");
    }

    prune(now);

    if (!force) {
      const cached = cache.get(normalizedKey);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const pending = inFlight.get(normalizedKey);
      if (pending) return pending;
    }

    const promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (ttlMs > 0) {
          cache.set(normalizedKey, {
            value,
            expiresAt: Date.now() + ttlMs,
          });
          prune();
        }
        return value;
      })
      .finally(() => {
        if (inFlight.get(normalizedKey) === promise) {
          inFlight.delete(normalizedKey);
        }
      });

    inFlight.set(normalizedKey, promise);
    return promise;
  }

  function clear(key) {
    if (key === undefined || key === null || String(key).trim() === "") {
      cache.clear();
      return;
    }
    cache.delete(String(key).trim());
  }

  function clearAll() {
    cache.clear();
  }

  return {
    clear,
    clearAll,
    resolve,
    snapshot() {
      prune();
      return {
        cachedEntries: cache.size,
        inFlightEntries: inFlight.size,
      };
    },
  };
}

module.exports = {
  createRequestCoalescer,
};
