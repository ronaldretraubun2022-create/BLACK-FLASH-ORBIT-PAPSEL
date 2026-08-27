const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const apiServicePath = path.resolve(
  __dirname,
  "../../apps/web/src/services/api.js",
);
const appEntryPath = path.resolve(__dirname, "../../apps/web/src/App.jsx");

test("frontend API service imports browser-safe ESM URL helpers before API_BASE_URL", () => {
  const source = fs.readFileSync(apiServicePath, "utf8");
  const helperImportIndex = source.indexOf(
    '} from "./apiUrlUtils.mjs";',
  );
  const apiBaseUrlIndex = source.indexOf(
    "const API_BASE_URL = normalizeApiBaseUrl(getConfiguredApiBaseUrl());",
  );

  assert(helperImportIndex >= 0, "browser-safe apiUrlUtils.mjs import must exist");
  assert(
    !source.includes('import apiUrlUtils from "./apiUrlUtils.cjs";'),
    "frontend must not import CommonJS utilities directly in the browser",
  );
  assert(
    apiBaseUrlIndex > helperImportIndex,
    "API_BASE_URL must initialize after URL helper import",
  );
});

test("frontend Command Center imports browser-safe ESM telemetry state", () => {
  const source = fs.readFileSync(appEntryPath, "utf8");

  assert(
    source.includes('from "./services/dashboardTelemetryState.mjs";'),
    "App.jsx must import dashboardTelemetryState.mjs for browser builds",
  );
  assert(
    !source.includes('from "./services/dashboardTelemetryState.cjs";'),
    "App.jsx must not import CommonJS telemetry state directly",
  );
});
