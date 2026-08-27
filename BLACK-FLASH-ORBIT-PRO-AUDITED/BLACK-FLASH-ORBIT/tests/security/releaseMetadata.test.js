const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "../..");
const metadataPath = path.join(
  rootDir,
  "apps/web/src/config/releaseMetadata.js",
);

const metadataSource = fs.readFileSync(metadataPath, "utf8");

const dashboardFiles = [
  "apps/web/src/App.jsx",
  "apps/web/src/components/CommandCenterReleasePanel.jsx",
  "apps/web/src/components/CommandPalette.jsx",
  "apps/web/src/pages/Intelligence.jsx",
  "apps/web/src/pages/AgentBridge.jsx",
].map((file) => ({
  file,
  source: fs.readFileSync(path.join(rootDir, file), "utf8"),
}));

test("release metadata is centralized on the active Agent Bridge release", () => {
  assert.match(
    metadataSource,
    /releaseChannel:\s*["']feature\/orbit-v1\.3-agent-bridge["']/,
  );
  assert.match(metadataSource, /releaseVersion:\s*["']v1\.3["']/);
  assert.match(metadataSource, /module:\s*["']Developer Agent Bridge["']/);
  assert.match(metadataSource, /status:\s*["']local-only["']/);
});

test("dashboard UI does not contain stale release metadata", () => {
  const staleValues = [
    "feature/orbit-v0.8",
    "Operational Intelligence v0.8",
    "feature/project-health-v0.7",
    "Project Health Monitor v0.7",
    "v0.7 release status",
    "AI Command Bar v0.8",
    "feature/orbit-v1.2",
  ];

  for (const { file, source } of dashboardFiles) {
    for (const staleValue of staleValues) {
      assert.doesNotMatch(
        source,
        new RegExp(staleValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${staleValue} remains in ${file}`,
      );
    }
  }
});

test("release-aware screens consume the shared metadata module", () => {
  for (const { file, source } of dashboardFiles) {
    assert.match(source, /releaseMetadata\.js/, `${file} must use shared release metadata`);
  }
});

test("Agent Bridge navigation remains available", () => {
  const appSource = fs.readFileSync(path.join(rootDir, "apps/web/src/App.jsx"), "utf8");
  const sidebarSource = fs.readFileSync(
    path.join(rootDir, "apps/web/src/components/CommandCenterSidebar.jsx"),
    "utf8",
  );

  assert.match(appSource, /path=\"\/agent-bridge\"/);
  assert.match(sidebarSource, /Agent Bridge/);
  assert.match(sidebarSource, /\/agent-bridge/);
});
