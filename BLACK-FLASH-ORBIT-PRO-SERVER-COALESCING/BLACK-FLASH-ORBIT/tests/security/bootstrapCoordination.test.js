const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("profile bootstrap is centralized behind a single ProfileProvider", () => {
  const main = read("apps/web/src/main.jsx");
  const hook = read("apps/web/src/hooks/useProfile.js");

  assert.match(main, /<ProfileProvider>/);
  assert.match(hook, /const ProfileContext = createContext\(null\)/);
  assert.match(hook, /export function ProfileProvider/);
  assert.match(hook, /useContext\(ProfileContext\)/);
});

test("Command Center and legacy dashboard share dashboard-status bootstrap service", () => {
  const app = read("apps/web/src/App.jsx");
  const dashboard = read("apps/web/src/pages/Dashboard.jsx");
  const service = read("apps/web/src/services/dashboardStatus.js");

  assert.match(app, /getSharedDashboardStatus\(user\?\.id\)/);
  assert.match(dashboard, /load: \(userId\) => getSharedDashboardStatus\(userId\)/);
  assert.match(service, /SharedRequestCache/);
  assert.match(service, /DASHBOARD_STATUS_TTL_MS = 5_000/);
  assert.match(service, /dashboard-status:\$\{normalizedUserId\}/);
});
