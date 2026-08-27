import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  getConfiguredRepoRoot,
  getRepositoryStatus,
  getSafeDiffSummary,
} = require("../server/services/agent/repositoryInspector");
const { runAllowedCommand } = require("../server/services/agent/commandAllowlist");
const { redactObject } = require("../server/services/agent/redaction");

const mode = String(process.argv[2] || "status").trim();
const repoRoot = getConfiguredRepoRoot();

const MODES = new Set(["status", "diagnose", "validate"]);

if (!MODES.has(mode)) {
  console.error("Usage: node scripts/orbit-agent-runner.mjs status|diagnose|validate");
  process.exit(2);
}

async function runCommands(commands) {
  const results = [];

  for (const command of commands) {
    results.push(await runAllowedCommand({ command, repoRoot, timeoutMs: 10 * 60 * 1000 }));
  }

  return results.map(({ commandId, exitCode, safeSummary, timedOut }) => ({
    commandId,
    exitCode,
    safeSummary,
    timedOut,
  }));
}

const payload =
  mode === "status"
    ? await getRepositoryStatus()
    : mode === "diagnose"
      ? {
          diff: await getSafeDiffSummary(),
          results: await runCommands([
            "git branch --show-current",
            "git status",
            "git diff --check",
            "git log --oneline",
          ]),
        }
      : {
          results: await runCommands([
            "npm run lint",
            "npm run test:security",
            "npm run test",
            "npm run build",
            "npm audit --omit=dev",
            "git diff --check",
          ]),
        };

console.log(JSON.stringify(redactObject(payload), null, 2));
