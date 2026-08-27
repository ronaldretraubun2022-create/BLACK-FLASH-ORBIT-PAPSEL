const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

test("Vercel config serves Vite dist/web and keeps API before SPA fallback", () => {
  const config = readJson("vercel.json");
  const filesystemIndex = config.routes.findIndex(
    (route) => route.handle === "filesystem",
  );
  const spaFallbackIndex = config.routes.findIndex(
    (route) => route.src === "/.*" && route.dest === "/index.html",
  );

  assert.strictEqual(config.buildCommand, "npm run build");
  assert.strictEqual(config.outputDirectory, "dist/web");
  assert(filesystemIndex >= 0);
  assert(spaFallbackIndex > filesystemIndex);
  assert(
    config.routes.some(
      (route) =>
        route.src === "/api/health" && route.dest === "/api/v1/health",
    ),
  );
});

test("Vercel ignore excludes local secrets and transient build output", () => {
  const ignore = fs
    .readFileSync(path.join(rootDir, ".vercelignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert(ignore.includes(".env"));
  assert(ignore.includes(".env.*"));
  assert(ignore.includes("!.env.example"));
  assert(ignore.includes(".vercel"));
  assert(ignore.includes("node_modules"));
  assert(ignore.includes("dist"));
});

test("newsroom serverless adapter avoids importing the full Express server", () => {
  const source = fs.readFileSync(path.join(rootDir, "api/ai/newsroom.js"), "utf8");

  assert(!source.includes('require("../../server/index.js")'));
  assert(source.includes('require("../../server/routes/newsroom.js")'));
});
