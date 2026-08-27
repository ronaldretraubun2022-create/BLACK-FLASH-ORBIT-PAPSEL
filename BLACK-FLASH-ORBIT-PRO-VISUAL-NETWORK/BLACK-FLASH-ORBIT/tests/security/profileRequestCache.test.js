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
