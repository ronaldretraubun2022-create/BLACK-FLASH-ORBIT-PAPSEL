const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { redactText, summarizeOutput } = require("./redaction");

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_OUTPUT_CHARS = 40000;
const SHELL_META_PATTERN = /[;&|`$<>]/;
const BLOCKED_COMMAND_PATTERN =
  /\b(rm\s+-rf|del\s+\/s|format|diskpart|ssh|curl|wget|git\s+reset\s+--hard|git\s+clean\s+-fd|git\s+push\s+--force(?:-with-lease)?|git\s+tag\s+-d|env|printenv|set)\b/i;

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

const EXACT_COMMANDS = new Map([
  ["git status", { command: "git", args: ["status", "--short", "--branch"], id: "git_status", readOnly: true }],
  ["git diff", { command: "git", args: ["diff"], id: "git_diff", readOnly: true }],
  ["git diff --check", { command: "git", args: ["diff", "--check"], id: "git_diff_check", readOnly: true }],
  ["git diff --name-only", { command: "git", args: ["diff", "--name-only"], id: "git_diff_name_only", readOnly: true }],
  ["git diff --stat", { command: "git", args: ["diff", "--stat"], id: "git_diff_stat", readOnly: true }],
  ["git log --oneline", { command: "git", args: ["log", "--oneline", "-20"], id: "git_log_oneline", readOnly: true }],
  ["git branch --show-current", { command: "git", args: ["branch", "--show-current"], id: "git_branch_current", readOnly: true }],
  ["npm run lint", { command: npmExecutable, args: ["run", "lint"], id: "npm_lint" }],
  ["npm run test:security", { command: npmExecutable, args: ["run", "test:security"], id: "npm_test_security" }],
  ["npm run test", { command: npmExecutable, args: ["run", "test"], id: "npm_test" }],
  ["npm run build", { command: npmExecutable, args: ["run", "build"], id: "npm_build" }],
  ["npm audit --omit=dev", { command: npmExecutable, args: ["audit", "--omit=dev"], id: "npm_audit" }],
]);

function createAgentError(message, statusCode = 400, code = "AGENT_COMMAND_REJECTED") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertNoShellMetacharacters(value) {
  const text = String(value || "");

  if (SHELL_META_PATTERN.test(text) || BLOCKED_COMMAND_PATTERN.test(text)) {
    throw createAgentError("Command rejected by ORBIT Agent allowlist.", 400, "AGENT_COMMAND_BLOCKED");
  }
}

function realpathExisting(targetPath) {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    throw createAgentError("Repository path tidak valid.", 400, "AGENT_PATH_INVALID");
  }
}

function assertRepoFilePath(repoRoot, requestedPath) {
  const rawPath = String(requestedPath || "").trim();

  assertNoShellMetacharacters(rawPath);

  if (!rawPath || rawPath.includes("\0")) {
    throw createAgentError("File target wajib tersedia.", 400, "AGENT_FILE_REQUIRED");
  }

  if (
    path.isAbsolute(rawPath) ||
    rawPath.startsWith("\\\\") ||
    rawPath.startsWith("//") ||
    rawPath.includes("..") ||
    /^\\\\[.?]\\/.test(rawPath)
  ) {
    throw createAgentError("Path keluar repository ditolak.", 400, "AGENT_PATH_ESCAPE");
  }

  const root = realpathExisting(repoRoot);
  const absolutePath = path.resolve(root, rawPath);
  const realTarget = realpathExisting(absolutePath);
  const relative = path.relative(root, realTarget);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw createAgentError("Path keluar repository ditolak.", 400, "AGENT_PATH_ESCAPE");
  }

  if (/^\.env(?:\.|$)/i.test(path.basename(realTarget))) {
    throw createAgentError(".env tidak boleh dibaca oleh Agent Bridge.", 400, "AGENT_ENV_READ_BLOCKED");
  }

  return relative.replace(/\\/g, "/");
}

function resolveAllowedCommand(commandInput, repoRoot) {
  const rawCommand = Array.isArray(commandInput)
    ? commandInput.join(" ")
    : String(commandInput || "").trim();

  assertNoShellMetacharacters(rawCommand);

  if (EXACT_COMMANDS.has(rawCommand)) {
    return EXACT_COMMANDS.get(rawCommand);
  }

  const nodeCheckMatch = rawCommand.match(/^node --check ([A-Za-z0-9_./\\-]+)$/);

  if (nodeCheckMatch) {
    const safePath = assertRepoFilePath(repoRoot, nodeCheckMatch[1]);

    return {
      args: ["--check", safePath],
      command: "node",
      id: "node_check",
      readOnly: true,
    };
  }

  throw createAgentError("Command tidak ada dalam allowlist ORBIT Agent.", 400, "AGENT_COMMAND_NOT_ALLOWED");
}

function createSafeChildEnv(repoRoot = "") {
  const env = {
    CI: "true",
    NODE_ENV: process.env.NODE_ENV || "test",
    Path: process.env.Path || process.env.PATH || "",
    PATH: process.env.PATH || process.env.Path || "",
    SystemRoot: process.env.SystemRoot || "",
    TEMP: process.env.TEMP || process.env.TMP || "",
    TMP: process.env.TMP || process.env.TEMP || "",
  };

  if (repoRoot) {
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "safe.directory";
    env.GIT_CONFIG_VALUE_0 = repoRoot;
  }

  return env;
}

function appendBounded(current, chunk) {
  return `${current}${chunk}`.slice(0, MAX_OUTPUT_CHARS);
}

function runAllowedCommand({ command, repoRoot, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const allowed = resolveAllowedCommand(command, repoRoot);

  return new Promise((resolve) => {
    const child = spawn(allowed.command, allowed.args, {
      cwd: repoRoot,
      env: createSafeChildEnv(repoRoot),
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputOverflow = false;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, Math.max(1000, timeoutMs));

    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk.toString("utf8"));
      if (stdout.length >= MAX_OUTPUT_CHARS) outputOverflow = true;
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk.toString("utf8"));
      if (stderr.length >= MAX_OUTPUT_CHARS) outputOverflow = true;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        commandId: allowed.id,
        durationMs: Date.now() - startedAt,
        exitCode: 127,
        safeSummary: summarizeOutput({
          exitCode: 127,
          stderr: error.message,
          stdout,
          timedOut,
        }),
        stderr: redactText(error.message),
        stdout: redactText(stdout),
        timedOut,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        commandId: allowed.id,
        durationMs: Date.now() - startedAt,
        exitCode: timedOut ? 124 : code,
        outputOverflow,
        safeSummary: summarizeOutput({
          exitCode: timedOut ? 124 : code,
          stderr,
          stdout,
          timedOut,
        }),
        stderr: redactText(stderr, MAX_OUTPUT_CHARS),
        stdout: redactText(stdout, MAX_OUTPUT_CHARS),
        timedOut,
      });
    });
  });
}

module.exports = {
  createAgentError,
  createSafeChildEnv,
  resolveAllowedCommand,
  runAllowedCommand,
};
