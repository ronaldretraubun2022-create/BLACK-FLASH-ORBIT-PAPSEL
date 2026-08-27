"use strict";

const DEFAULT_MAX_ENTRIES = 500;
const LOG_SOURCES = new Set(["cache", "inflight", "miss"]);

function normalizeKey(key) {
  const value = String(key || "").trim();
  if (!value) {
    throw new Error("Request coalescer key is required.");
  }
  return value;
}

function getSafeFingerprint(value) {
  const text = String(value || "");
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fp-${(hash >>> 0).toString(16)}`;
}

function isCoalesceLoggingEnabled() {
  const value = String(process.env.ORBIT_COALESCE_LOG || "").toLowerCase();

  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;

  return process.env.NODE_ENV !== "production";
}

function createDefaultLogger() {
  return function logCoalescerEvent(event) {
    if (!isCoalesceLoggingEnabled()) return;

    console.info("[ORBIT COALESCE]", event);
  };
}

function pruneMapToLimit(map, maxEntries) {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    map.delete(oldestKey);
  }
}

function createRequestCoalescer({
  logger = createDefaultLogger(),
  maxEntries = DEFAULT_MAX_ENTRIES,
  resource = "request",
  ttlMs = 0,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const entryLimit = Math.max(1, Number(maxEntries) || DEFAULT_MAX_ENTRIES);

  function prune(now = Date.now()) {
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) cache.delete(key);
    }

    pruneMapToLimit(cache, entryLimit);
    pruneMapToLimit(inFlight, entryLimit);
  }

  function log(source, normalizedKey, metadata = {}) {
    if (!LOG_SOURCES.has(source) || typeof logger !== "function") return;

    logger({
      resource: metadata.resource || resource,
      source,
      user: metadata.userFingerprint || getSafeFingerprint(normalizedKey),
    });
  }

  async function resolve(key, loader, { force = false, metadata = {} } = {}) {
    const normalizedKey = normalizeKey(key);
    const now = Date.now();

    if (typeof loader !== "function") {
      throw new TypeError("Request coalescer loader must be a function.");
    }

    prune(now);

    if (!force) {
      const cached = cache.get(normalizedKey);
      if (cached && cached.expiresAt > now) {
        log("cache", normalizedKey, metadata);
        return cached.value;
      }

      const pending = inFlight.get(normalizedKey);
      if (pending) {
        log("inflight", normalizedKey, metadata);
        return pending;
      }
    }

    log("miss", normalizedKey, metadata);

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
    prune();
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
        maxEntries: entryLimit,
      };
    },
  };
}

module.exports = {
  createRequestCoalescer,
  getSafeFingerprint,
};
