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

test("profile coalescer collapses six same-user operations", async () => {
  const coalescer = createRequestCoalescer({
    resource: "profile",
    ttlMs: 1000,
  });
  let providerExecutions = 0;

  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      coalescer.resolve("profile:user-1", async () => ({
        id: "user-1",
        sequence: ++providerExecutions,
      })),
    ),
  );

  assert.equal(providerExecutions, 1);
  assert.ok(results.every((item) => item.sequence === 1));
});

test("dashboard coalescer collapses six same-user provider operations", async () => {
  const coalescer = createRequestCoalescer({
    resource: "dashboard-provider",
    ttlMs: 1000,
  });
  let providerExecutions = 0;

  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      coalescer.resolve("dashboard-provider:user-1", async () => ({
        projects: [],
        sequence: ++providerExecutions,
      })),
    ),
  );

  assert.equal(providerExecutions, 1);
  assert.ok(results.every((item) => item.sequence === 1));
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

test("request coalescer executes provider again after cache expiry", async () => {
  const coalescer = createRequestCoalescer({ ttlMs: 5 });
  let calls = 0;

  const first = await coalescer.resolve("user-1", async () => ++calls);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const second = await coalescer.resolve("user-1", async () => ++calls);

  assert.equal(first, 1);
  assert.equal(second, 2);
  assert.equal(calls, 2);
});

test("request coalescer bounds cache size and reports source safely", async () => {
  const events = [];
  const coalescer = createRequestCoalescer({
    logger: (event) => events.push(event),
    maxEntries: 2,
    resource: "profile",
    ttlMs: 1000,
  });

  await coalescer.resolve("profile:user-secret-1", async () => "first");
  await coalescer.resolve("profile:user-secret-1", async () => "cached");
  await Promise.all([
    coalescer.resolve("profile:user-secret-2", async () => "second"),
    coalescer.resolve("profile:user-secret-2", async () => "shared"),
  ]);
  await coalescer.resolve("profile:user-secret-3", async () => "third");

  const snapshot = coalescer.snapshot();

  assert(snapshot.cachedEntries <= 2);
  assert(snapshot.inFlightEntries <= 2);
  assert.deepEqual(
    events.map((event) => event.source),
    ["miss", "cache", "miss", "inflight", "miss"],
  );
  assert.ok(events.every((event) => event.resource === "profile"));
  assert.ok(events.every((event) => !event.user.includes("user-secret")));
});
