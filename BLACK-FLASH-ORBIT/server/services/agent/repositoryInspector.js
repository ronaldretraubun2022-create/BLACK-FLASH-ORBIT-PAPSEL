const fs = require("node:fs");
const path = require("node:path");
const { createAgentError, runAllowedCommand } = require("./commandAllowlist");
const { redactText } = require("./redaction");

function getConfiguredRepoRoot() {
  const configured = String(process.env.ORBIT_REPO_ROOT || "").trim();
  const fallback = path.resolve(__dirname, "../../..");

  return getCanonicalRepoRoot(configured || fallback);
}

function getCanonicalRepoRoot(rootPath) {
  if (!rootPath || rootPath.startsWith("\\\\") || /^\\\\[.?]\\/.test(rootPath)) {
    throw createAgentError("Repository root tidak valid.", 500, "AGENT_REPO_ROOT_INVALID");
  }

  const resolved = fs.realpathSync.native(path.resolve(rootPath));
  const gitDir = path.join(resolved, ".git");

  if (!fs.existsSync(gitDir)) {
    throw createAgentError("Repository ORBIT tidak ditemukan.", 500, "AGENT_REPO_NOT_FOUND");
  }

  return resolved;
}

function assertPathInsideRepo(candidatePath, repoRoot = getConfiguredRepoRoot()) {
  const root = fs.realpathSync.native(repoRoot);
  const target = fs.realpathSync.native(path.resolve(root, candidatePath));
  const relative = path.relative(root, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw createAgentError("Repository escape ditolak.", 400, "AGENT_PATH_ESCAPE");
  }

  return relative.replace(/\\/g, "/");
}

function parseChangedFiles(output = "") {
  return Array.from(
    new Set(
      String(output || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => !line.startsWith("##"))
        .map((line) => line.replace(/^[MADRCU?! ]{1,2}\s+/, ""))
        .map((line) => line.split(" -> ").pop())
        .filter(Boolean)
        .filter((file) => !file.startsWith("..") && !path.isAbsolute(file))
        .slice(0, 100),
    ),
  );
}

async function getRepositoryStatus() {
  const repoRoot = getConfiguredRepoRoot();
  const [branchResult, statusResult] = await Promise.all([
    runAllowedCommand({ command: "git branch --show-current", repoRoot, timeoutMs: 15000 }),
    runAllowedCommand({ command: "git status", repoRoot, timeoutMs: 15000 }),
  ]);
  const branch = redactText(branchResult.stdout, 120).trim() || "unknown";
  const statusText = redactText(statusResult.stdout, 4000);
  const dirty = statusText
    .split(/\r?\n/)
    .some((line) => line.trim() && !line.startsWith("##"));

  return {
    branch,
    dirty,
    repoRootLabel: path.basename(repoRoot),
    status: dirty ? "dirty" : "clean",
    statusSummary: statusText.slice(0, 4000),
  };
}

async function getChangedFiles() {
  const repoRoot = getConfiguredRepoRoot();
  const result = await runAllowedCommand({
    command: "git status",
    repoRoot,
    timeoutMs: 15000,
  });

  return parseChangedFiles(result.stdout);
}

async function getSafeDiffSummary() {
  const repoRoot = getConfiguredRepoRoot();
  const [statResult, checkResult, fileResult] = await Promise.all([
    runAllowedCommand({ command: "git diff --stat", repoRoot, timeoutMs: 15000 }),
    runAllowedCommand({ command: "git diff --check", repoRoot, timeoutMs: 15000 }),
    runAllowedCommand({ command: "git status", repoRoot, timeoutMs: 15000 }),
  ]);
  const changedFiles = parseChangedFiles(fileResult.stdout);

  return {
    changedFiles,
    diffCheckExitCode: checkResult.exitCode,
    safeSummary: redactText(
      [
        statResult.stdout ? `Changed files:\n${statResult.stdout}` : "No unstaged diff.",
        checkResult.exitCode === 0 ? "git diff --check passed." : checkResult.safeSummary,
      ].join("\n\n"),
      8000,
    ),
  };
}

module.exports = {
  assertPathInsideRepo,
  getChangedFiles,
  getConfiguredRepoRoot,
  getRepositoryStatus,
  getSafeDiffSummary,
};
