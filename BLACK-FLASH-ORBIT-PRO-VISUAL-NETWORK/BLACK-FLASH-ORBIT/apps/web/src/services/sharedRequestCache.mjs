export class SharedRequestCache {
  constructor({ ttlMs = 15_000 } = {}) {
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.pending = new Map();
  }

  get(key) {
    if (!key) return null;
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

  async resolve(key, loader, { force = false } = {}) {
    if (!key) return loader();

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

    try {
      return await request;
    } finally {
      if (this.pending.get(key) === request) {
        this.pending.delete(key);
      }
    }
  }
}
