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

function loadClient({ responseBody, responseStatus = 200 } = {}) {
  const source = fs.readFileSync(sourcePath, "utf8")
    .replace(/^import .*;$/gm, "")
    .replace(/import\.meta\.env\.DEV/g, "false")
    .replace(/import\.meta\.env\.VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK/g, '"false"')
    .replace(/export async function/g, "async function")
    .replace(/export function/g, "function")
    .concat("\nmodule.exports = { listNewsroomHistory };");

  const calls = [];
  const sandbox = {
    URLSearchParams,
    fetch: async (url, options) => {
      calls.push({ options, url });
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
    source,
  );

  runner(
    module,
    module.exports,
    sandbox.fetch,
    sandbox.getAuthenticatedHeaders,
    sandbox.resolveApiUrl,
    sandbox.URLSearchParams,
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
