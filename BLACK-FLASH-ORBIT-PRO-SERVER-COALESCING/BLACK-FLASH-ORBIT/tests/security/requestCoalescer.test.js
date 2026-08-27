const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequestCoalescer } = require("../../server/lib/requestCoalescer");

test("request coalescer collapses parallel calls into one loader execution", async () => {
  const coalescer = createRequestCoalescer({ ttlMs: 1000 });
  let calls = 0;

  const loader = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true };
  };

  const results = await Promise.all(
    Array.from({ length: 6 }, () => coalescer.resolve("user-1", loader)),
  );

  assert.equal(calls, 1);
  assert.equal(results.length, 6);
  assert.ok(results.every((item) => item.ok === true));
});

test("request coalescer serves fresh cached values without a provider call", async () => {
  const coalescer = createRequestCoalescer({ ttlMs: 1000 });
  let calls = 0;
  const loader = async () => ({ sequence: ++calls });

  const first = await coalescer.resolve("user-1", loader);
  const second = await coalescer.resolve("user-1", loader);

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
});

test("request coalescer isolates cache entries by user key", async () => {
  const coalescer = createRequestCoalescer({ ttlMs: 1000 });
  let calls = 0;

  const a = await coalescer.resolve("user-a", async () => ({ value: ++calls }));
  const b = await coalescer.resolve("user-b", async () => ({ value: ++calls }));

  assert.equal(calls, 2);
  assert.notDeepEqual(a, b);
});

test("request coalescer does not cache rejected provider calls", async () => {
  const coalescer = createRequestCoalescer({ ttlMs: 1000 });
  let calls = 0;

  await assert.rejects(
    coalescer.resolve("user-1", async () => {
      calls += 1;
      throw new Error("provider unavailable");
    }),
  );

  const result = await coalescer.resolve("user-1", async () => {
    calls += 1;
    return "recovered";
  });

  assert.equal(result, "recovered");
  assert.equal(calls, 2);
});
