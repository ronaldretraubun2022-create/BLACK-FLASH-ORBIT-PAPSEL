export class SharedRequestCache {
  constructor({ maxEntries = 500, ttlMs = 15_000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = Math.max(1, Number(maxEntries) || 500);
    this.cache = new Map();
    this.pending = new Map();
  }

  prune() {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt >= this.ttlMs) {
        this.cache.delete(key);
      }
    }

    while (this.cache.size > this.maxEntries) {
      this.cache.delete(this.cache.keys().next().value);
    }

    while (this.pending.size > this.maxEntries) {
      this.pending.delete(this.pending.keys().next().value);
    }
  }

  get(key) {
    if (!key) return null;
    this.prune();

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt >= this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(key) {
    if (!key) return;
    this.cache.delete(key);
    this.pending.delete(key);
  }

  clearAll() {
    this.cache.clear();
    this.pending.clear();
  }

  async resolve(key, loader, { force = false } = {}) {
    if (!key) return loader();
    this.prune();

    if (!force) {
      const cached = this.get(key);
      if (cached !== null) return cached;

      const inFlight = this.pending.get(key);
      if (inFlight) return inFlight;
    }

    const request = Promise.resolve()
      .then(loader)
      .then((value) => {
        this.cache.set(key, {
          cachedAt: Date.now(),
          value,
        });
        return value;
      });

    this.pending.set(key, request);
    this.prune();

    try {
      return await request;
    } finally {
      if (this.pending.get(key) === request) {
        this.pending.delete(key);
      }
    }
  }

  snapshot() {
    this.prune();

    return {
      cachedEntries: this.cache.size,
      inFlightEntries: this.pending.size,
      maxEntries: this.maxEntries,
    };
  }
}
