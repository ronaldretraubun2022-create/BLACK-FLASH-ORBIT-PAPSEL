const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sourcePath = path.join(
  __dirname,
  "..",
  "..",
  "apps",
  "web",
  "src",
  "services",
  "newsroomAI.js",
);

class TestSharedRequestCache {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
  }

  clearAll() {
    this.cache.clear();
    this.pending.clear();
  }

  async resolve(key, loader) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.pending.has(key)) return this.pending.get(key);

    const request = Promise.resolve()
      .then(loader)
      .then((value) => {
        this.cache.set(key, value);
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

function loadClient({ fetchHandler, responseBody, responseStatus = 200 } = {}) {
  const source = fs.readFileSync(sourcePath, "utf8")
    .replace(/^import .*;$/gm, "")
    .replace(/import\.meta\.env\.DEV/g, "false")
    .replace(/import\.meta\.env\.VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK/g, '"false"')
    .replace(/export async function/g, "async function")
    .replace(/export function/g, "function")
    .concat(
      "\nmodule.exports = { clearNewsroomHistoryCache, listNewsroomHistory, saveNewsroomGeneration };",
    );

  const calls = [];
  const sandbox = {
    URLSearchParams,
    SharedRequestCache: TestSharedRequestCache,
    fetch: async (url, options) => {
      calls.push({ options, url });
      if (typeof fetchHandler === "function") {
        return fetchHandler(url, options, calls.length);
      }

      return new Response(JSON.stringify(responseBody), {
        headers: { "content-type": "application/json" },
        status: responseStatus,
      });
    },
    getAuthenticatedHeaders: async () => ({
      Authorization: "Bearer mocked-history-token",
    }),
    resolveApiUrl: (url) => url,
  };
  const module = { exports: {} };
  const runner = new Function(
    "module",
    "exports",
    "fetch",
    "getAuthenticatedHeaders",
    "resolveApiUrl",
    "URLSearchParams",
    "SharedRequestCache",
    source,
  );

  runner(
    module,
    module.exports,
    sandbox.fetch,
    sandbox.getAuthenticatedHeaders,
    sandbox.resolveApiUrl,
    sandbox.URLSearchParams,
    sandbox.SharedRequestCache,
  );

  return { calls, client: module.exports };
}

test("newsroom client accepts empty history without throwing", async () => {
  const { calls, client } = loadClient({
    responseBody: {
      success: true,
      data: { items: [], pagination: { hasMore: false } },
      items: [],
    },
  });

  const response = await client.listNewsroomHistory();

  assert.deepStrictEqual(response.data.items, []);
  assert.strictEqual(calls[0].url, "/api/ai/newsroom/history");
  assert.strictEqual(
    calls[0].options.headers.Authorization,
    "Bearer mocked-history-token",
  );
});

test("newsroom client deduplicates parallel history list consumers", async () => {
  const { calls, client } = loadClient({
    fetchHandler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));

      return new Response(
        JSON.stringify({
          success: true,
          data: { items: [{ id: "history-1" }], pagination: { hasMore: false } },
          items: [{ id: "history-1" }],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    },
  });

  const responses = await Promise.all(
    Array.from({ length: 6 }, () => client.listNewsroomHistory({ limit: 12 })),
  );

  assert.strictEqual(calls.length, 1);
  assert.ok(responses.every((response) => response.items[0].id === "history-1"));
});

test("newsroom client clears history cache after mutation", async () => {
  const { calls, client } = loadClient({
    fetchHandler: async (url, options) => {
      if (
        url === "/api/ai/newsroom/history" &&
        options?.method === "POST"
      ) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "content-type": "application/json" },
          status: 201,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: { items: [], pagination: { hasMore: false } },
          items: [],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    },
  });

  await client.listNewsroomHistory({ limit: 12 });
  await client.listNewsroomHistory({ limit: 12 });
  await client.saveNewsroomGeneration({ draft: "safe draft", topic: "topic" });
  await client.listNewsroomHistory({ limit: 12 });

  assert.strictEqual(calls.length, 3);
});

test("newsroom client treats HTTP 304 as non-error", async () => {
  const { client } = loadClient({
    responseStatus: 304,
  });

  const response = await client.listNewsroomHistory({ limit: 12 });

  assert.strictEqual(response.success, true);
  assert.strictEqual(response.notModified, true);
});
