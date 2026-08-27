const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(
  path.join(
    __dirname,
    "../../apps/web/src/services/sharedRequestCache.mjs",
  ),
).href;

test("shared profile request cache deduplicates parallel consumers", async () => {
  const { SharedRequestCache } = await import(moduleUrl);
  const cache = new SharedRequestCache({ ttlMs: 15_000 });
  let calls = 0;

  const loader = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { id: "user-1", role: "user" };
  };

  const results = await Promise.all(
    Array.from({ length: 6 }, () => cache.resolve("user-1", loader)),
  );

  assert.equal(calls, 1);
  assert.equal(results.length, 6);
  assert.ok(results.every((item) => item.id === "user-1"));
});

test("shared profile request cache reuses fresh values and force refresh bypasses cache", async () => {
  const { SharedRequestCache } = await import(moduleUrl);
  const cache = new SharedRequestCache({ ttlMs: 15_000 });
  let calls = 0;

  const loader = async () => ({ sequence: ++calls });

  const first = await cache.resolve("user-1", loader);
  const cached = await cache.resolve("user-1", loader);
  const refreshed = await cache.resolve("user-1", loader, { force: true });

  assert.equal(first.sequence, 1);
  assert.equal(cached.sequence, 1);
  assert.equal(refreshed.sequence, 2);
  assert.equal(calls, 2);
});


test("shared request cache clearAll invalidates cached values", async () => {
  const { SharedRequestCache } = await import(moduleUrl);
  const cache = new SharedRequestCache({ ttlMs: 15_000 });
  let calls = 0;
  const loader = async () => ({ sequence: ++calls });

  await cache.resolve("user-1", loader);
  cache.clearAll();
  const reloaded = await cache.resolve("user-1", loader);

  assert.equal(reloaded.sequence, 2);
  assert.equal(calls, 2);
});

test("shared request cache does not retain rejected calls", async () => {
  const { SharedRequestCache } = await import(moduleUrl);
  const cache = new SharedRequestCache({ ttlMs: 15_000 });
  let calls = 0;

  await assert.rejects(
    cache.resolve("user-1", async () => {
      calls += 1;
      throw new Error("provider unavailable");
    }),
  );

  const recovered = await cache.resolve("user-1", async () => {
    calls += 1;
    return { ok: true };
  });

  assert.deepEqual(recovered, { ok: true });
  assert.equal(calls, 2);
});

test("shared request cache expires values and stays bounded", async () => {
  const { SharedRequestCache } = await import(moduleUrl);
  const cache = new SharedRequestCache({ maxEntries: 2, ttlMs: 5 });
  let calls = 0;

  await cache.resolve("user-1", async () => ++calls);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const expired = await cache.resolve("user-1", async () => ++calls);

  await cache.resolve("user-2", async () => ++calls);
  await cache.resolve("user-3", async () => ++calls);

  const snapshot = cache.snapshot();

  assert.equal(expired, 2);
  assert(snapshot.cachedEntries <= 2);
  assert(snapshot.inFlightEntries <= 2);
  assert.equal(snapshot.maxEntries, 2);
});
