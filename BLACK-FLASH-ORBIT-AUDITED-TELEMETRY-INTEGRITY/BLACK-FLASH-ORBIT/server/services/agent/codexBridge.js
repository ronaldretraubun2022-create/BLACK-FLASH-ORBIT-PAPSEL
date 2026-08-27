const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { getChangedFiles, getRepositoryStatus } = require("./repositoryInspector");
const { createSafeChildEnv } = require("./commandAllowlist");
const { redactObject, redactText, summarizeOutput } = require("./redaction");

const CODEX_TIMEOUT_MS = 10 * 60 * 1000;
const CODEX_TIMEOUT_GRACE_MS = 5 * 60 * 1000;
const CODEX_STATUS_TIMEOUT_MS = 5000;
const MAX_CODEX_OUTPUT_CHARS = 50000;
const MAX_CODEX_TASK_CHARS = 12000;
const CODEX_ENTRYPOINT_SEGMENTS = ["node_modules", "@openai", "codex", "bin", "codex.js"];
const activeCodexProcesses = new Map();
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

function createCodexError(message, statusCode = 503, code = "AGENT_CODEX_NOT_FOUND") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeTaskText(value) {
  const taskText = redactText(value, MAX_CODEX_TASK_CHARS).trim();

  if (taskText.length < 8) {
    const error = new Error("Task repair terlalu pendek.");
    error.statusCode = 400;
    error.code = "AGENT_TASK_REQUIRED";
    throw error;
  }

  return taskText;
}

function appendBounded(current, chunk) {
  return `${current}${chunk}`.slice(0, MAX_CODEX_OUTPUT_CHARS);
}

function createSafeCodexEnv(repoRoot = "") {
  const env = createSafeChildEnv(repoRoot);

  for (const key of ["APPDATA", "CODEX_HOME", "HOME", "LOCALAPPDATA", "USERPROFILE"]) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }

  return env;
}

function isNetworkOrDevicePath(value) {
  const rawPath = String(value || "");

  return rawPath.startsWith("\\\\") || rawPath.startsWith("//") || /^\\\\[.?]\\/.test(rawPath);
}

function isTrustedCodexEntrypoint(realPath) {
  const segments = realPath.replace(/\\/g, "/").split("/").map((segment) => segment.toLowerCase());
  const suffix = segments.slice(-CODEX_ENTRYPOINT_SEGMENTS.length);

  return CODEX_ENTRYPOINT_SEGMENTS.every((segment, index) => suffix[index] === segment);
}

function validateCodexEntrypoint(candidatePath) {
  const rawPath = String(candidatePath || "").trim();

  if (!rawPath || rawPath.includes("\0") || isNetworkOrDevicePath(rawPath)) {
    throw createCodexError("Codex entrypoint tidak valid.", 503, "AGENT_CODEX_NOT_FOUND");
  }

  let realPath;
  let stat;

  try {
    realPath = fs.realpathSync.native(path.resolve(rawPath));
    stat = fs.statSync(realPath);
  } catch {
    throw createCodexError("Codex entrypoint tidak ditemukan.", 503, "AGENT_CODEX_NOT_FOUND");
  }

  if (!stat.isFile()) {
    throw createCodexError("Codex entrypoint bukan file valid.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
  }

  if (!isTrustedCodexEntrypoint(realPath)) {
    throw createCodexError("Codex entrypoint tidak berada dalam paket @openai/codex.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
  }

  return realPath;
}

function readNpmGlobalRoot() {
  const result = spawnSync(npmExecutable, ["root", "-g"], {
    encoding: "utf8",
    env: createSafeChildEnv(),
    shell: false,
    timeout: CODEX_STATUS_TIMEOUT_MS,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) return "";

  return String(result.stdout || "").split(/\r?\n/)[0]?.trim() || "";
}

function getTrustedCodexCandidates() {
  const configured = String(process.env.ORBIT_CODEX_ENTRYPOINT || "").trim();

  if (configured) return [configured];

  const roots = [];

  if (process.platform === "win32" && process.env.APPDATA) {
    roots.push(path.join(process.env.APPDATA, "npm", "node_modules"));
  }

  roots.push(readNpmGlobalRoot());

  return Array.from(new Set(roots.filter(Boolean))).map((root) =>
    path.join(root, "@openai", "codex", "bin", "codex.js"),
  );
}

function resolveCodexEntrypoint() {
  const candidates = getTrustedCodexCandidates();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      return validateCodexEntrypoint(candidate);
    } catch (error) {
      lastError = error;
      if (process.env.ORBIT_CODEX_ENTRYPOINT) break;
    }
  }

  throw lastError || createCodexError("Codex CLI tidak ditemukan.", 503, "AGENT_CODEX_NOT_FOUND");
}

function mapCodexError(error) {
  if (error?.code === "ENOENT") {
    return createCodexError("Codex CLI tidak ditemukan.", 503, "AGENT_CODEX_NOT_FOUND");
  }

  if (error?.code === "EACCES" || error?.code === "EPERM") {
    return createCodexError("Codex CLI tidak dapat dieksekusi.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
  }

  if (error?.code === "ETIMEDOUT" || error?.code === "AGENT_CODEX_TIMEOUT") {
    return createCodexError("Codex CLI melewati batas waktu.", 504, "AGENT_CODEX_TIMEOUT");
  }

  if (error?.code === "AGENT_CODEX_NONINTERACTIVE_REQUIRED") {
    return createCodexError("Codex CLI membutuhkan mode non-interaktif.", 503, "AGENT_CODEX_NONINTERACTIVE_REQUIRED");
  }

  if (error?.code === "AGENT_CODEX_MODE_UNSUPPORTED") {
    return createCodexError("Codex CLI tidak mendukung mode non-interaktif yang dibutuhkan.", 503, "AGENT_CODEX_MODE_UNSUPPORTED");
  }

  if (error?.code && /^AGENT_CODEX_/.test(error.code)) return error;

  return createCodexError("Codex CLI gagal dijalankan.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
}

function buildCodexFailureResult({ error, startedAt }) {
  const mapped = mapCodexError(error);
  const exitCode = mapped.code === "AGENT_CODEX_TIMEOUT" ? 124 : mapped.code === "AGENT_CODEX_NOT_EXECUTABLE" ? 126 : 127;

  return {
    changedFiles: [],
    durationMs: Date.now() - startedAt,
    errorCode: mapped.code,
    exitCode,
    safeSummary: `${mapped.code}: ${mapped.message}`,
    timedOut: mapped.code === "AGENT_CODEX_TIMEOUT",
  };
}

function getSafeCodexInvocationSummary({ args, cwd, shell, stdio }) {
  const safeArgs = (args || []).map((arg, index) => {
    if (index === 0) return "codex.js";
    if (arg === cwd) return "repoRoot";
    return arg;
  });

  return [
    "Codex invocation:",
    "mode=node-entrypoint",
    `executable=${path.basename(process.execPath)}`,
    "usesProcessExecPath=true",
    `argCount=${safeArgs.length}`,
    `args=${safeArgs.join(" ")}`,
    `execSubcommand=${safeArgs.includes("exec") ? "true" : "false"}`,
    `hasExec=${safeArgs.includes("exec") ? "true" : "false"}`,
    `stdinMode=${Array.isArray(stdio) ? stdio[0] : "unknown"}`,
    `shell=${shell === true ? "true" : "false"}`,
    `cwd=${path.basename(cwd || "")}`,
  ].join(" ");
}

function shouldIncludeCodexDiagnostics() {
  return process.env.NODE_ENV !== "production" || process.env.ORBIT_AGENT_DIAGNOSTICS === "true";
}

function buildCodexExecInvocation({ codexEntrypoint, repoRoot }) {
  return {
    args: [
      codexEntrypoint,
      "exec",
      "--cd",
      repoRoot,
      "--sandbox",
      "workspace-write",
      "--color",
      "never",
      "-",
    ],
    executable: process.execPath,
  };
}

function buildCodexSpawnSpec({ entrypoint, repoRoot }) {
  const invocation = buildCodexExecInvocation({ codexEntrypoint: entrypoint, repoRoot });
  const options = {
    cwd: repoRoot,
    env: createSafeCodexEnv(repoRoot),
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  };

  return {
    args: invocation.args,
    command: invocation.executable,
    options,
    safeInvocationSummary: getSafeCodexInvocationSummary({
      args: invocation.args,
      cwd: repoRoot,
      shell: options.shell,
      stdio: options.stdio,
    }),
  };
}

function mapCodexExitFailure({ code, stderr = "", timedOut = false }) {
  if (timedOut) {
    return createCodexError("Codex CLI melewati batas waktu.", 504, "AGENT_CODEX_TIMEOUT");
  }

  const output = String(stderr || "").toLowerCase();

  if (output.includes("stdin is not a terminal") || output.includes("not a terminal") || output.includes("tty")) {
    return createCodexError("Codex CLI membutuhkan mode non-interaktif.", 503, "AGENT_CODEX_NONINTERACTIVE_REQUIRED");
  }

  if (output.includes("unrecognized subcommand") || output.includes("unknown command") || output.includes("invalid subcommand")) {
    return createCodexError("Codex CLI tidak mendukung mode non-interaktif yang dibutuhkan.", 503, "AGENT_CODEX_MODE_UNSUPPORTED");
  }

  if (Number(code) === 127) {
    return createCodexError("Codex CLI tidak ditemukan.", 503, "AGENT_CODEX_NOT_FOUND");
  }

  if (Number(code) === 126) {
    return createCodexError("Codex CLI tidak dapat dieksekusi.", 503, "AGENT_CODEX_NOT_EXECUTABLE");
  }

  return null;
}

function getCodexExecHelp(entrypoint) {
  return spawnSync(process.execPath, [entrypoint, "exec", "--help"], {
    encoding: "utf8",
    env: createSafeCodexEnv(),
    shell: false,
    timeout: CODEX_STATUS_TIMEOUT_MS,
    windowsHide: true,
  });
}

function hasNonInteractiveExecSupport(entrypoint) {
  const result = getCodexExecHelp(entrypoint);

  if (result.error) return false;
  if (result.status !== 0) return false;

  const helpText = `${result.stdout || ""}\n${result.stderr || ""}`;

  return /Run Codex non-interactively/i.test(helpText) && /instructions are read from stdin/i.test(helpText);
}

function getCodexStatus() {
  try {
    const entrypoint = resolveCodexEntrypoint();
    const result = spawnSync(process.execPath, [entrypoint, "--version"], {
      encoding: "utf8",
      env: createSafeCodexEnv(),
      shell: false,
      timeout: CODEX_STATUS_TIMEOUT_MS,
      windowsHide: true,
    });
    const nonInteractive = hasNonInteractiveExecSupport(entrypoint);

    if (result.error) {
      const mapped = mapCodexError(result.error);

      return {
        available: false,
        code: mapped.code,
        mode: "node-entrypoint",
        nonInteractive,
        version: null,
      };
    }

    if (result.status !== 0) {
      return {
        available: false,
        code: "AGENT_CODEX_NOT_EXECUTABLE",
        mode: "node-entrypoint",
        nonInteractive,
        version: null,
      };
    }

    return {
      available: true,
      mode: "node-entrypoint",
      nonInteractive,
      version: redactText(result.stdout || result.stderr || "", 120).trim(),
    };
  } catch (error) {
    const mapped = mapCodexError(error);

    return {
      available: false,
      code: mapped.code,
      mode: "node-entrypoint",
      nonInteractive: false,
      version: null,
    };
  }
}

async function buildCodexTask({ repoRoot, taskText }) {
  const status = await getRepositoryStatus();
  const safeContext = redactObject({
    branch: status.branch,
    dirty: status.dirty,
    repoRoot,
    task: taskText,
  });

  return [
    "You are Codex running inside BLACK FLASH ORBIT Agent Bridge.",
    "Only edit this repository. Do not read .env files. Do not run destructive git operations. Do not commit, push, merge, or tag.",
    `Safe context: ${JSON.stringify(safeContext)}`,
    "Task:",
    taskText,
  ].join("\n\n");
}

function writeCodexTaskToStdin(child, safeTaskPayload) {
  if (!child.stdin) return;

  child.stdin.on("error", () => {});
  child.stdin.write(safeTaskPayload);
  child.stdin.end();
}

function hasActiveCodexProcess(repoRoot) {
  return Boolean(activeCodexProcesses.get(repoRoot)?.active);
}

function buildRunSummary({ mappedFailure, spec, stderr, stdout, timedOut, exitCode }) {
  return [
    shouldIncludeCodexDiagnostics() ? spec.safeInvocationSummary : "",
    mappedFailure ? `${mappedFailure.code}: ${mappedFailure.message}` : "",
    summarizeOutput({
      exitCode,
      stderr,
      stdout,
      timedOut,
    }),
  ].filter(Boolean).join("\n");
}

async function runCodexRepairJob({ repoRoot, taskText }) {
  const startedAt = Date.now();
  const safeTask = normalizeTaskText(taskText);
  const prompt = await buildCodexTask({ repoRoot, taskText: safeTask });
  let entrypoint;

  try {
    entrypoint = resolveCodexEntrypoint();
  } catch (error) {
    return buildCodexFailureResult({ error, startedAt });
  }

  if (!hasNonInteractiveExecSupport(entrypoint)) {
    return buildCodexFailureResult({
      error: createCodexError(
        "Codex CLI tidak mendukung mode non-interaktif yang dibutuhkan.",
        503,
        "AGENT_CODEX_MODE_UNSUPPORTED",
      ),
      startedAt,
    });
  }

  return new Promise((resolve) => {
    const spec = buildCodexSpawnSpec({ entrypoint, repoRoot });
    let child;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let forceTimer;
    const finish = async (code, error = null) => {
      if (settled) return;
      settled = true;
      const processState = activeCodexProcesses.get(repoRoot);
      if (processState?.child === child) activeCodexProcesses.delete(repoRoot);
      clearTimeout(timer);
      clearTimeout(forceTimer);

      if (error) {
        const mapped = buildCodexFailureResult({ error, startedAt });

        resolve({
          changedFiles: await getChangedFiles().catch(() => []),
          durationMs: mapped.durationMs,
          errorCode: mapped.errorCode,
          exitCode: mapped.exitCode,
          safeSummary: [shouldIncludeCodexDiagnostics() ? spec.safeInvocationSummary : "", mapped.safeSummary]
            .filter(Boolean)
            .join("\n"),
          timedOut: mapped.timedOut,
        });
        return;
      }

      const mappedFailure = mapCodexExitFailure({ code, stderr, timedOut });

      resolve({
        changedFiles: await getChangedFiles().catch(() => []),
        durationMs: Date.now() - startedAt,
        errorCode: mappedFailure?.code || null,
        exitCode: timedOut ? 124 : code,
        safeSummary: buildRunSummary({
          exitCode: timedOut ? 124 : code,
          mappedFailure,
          spec,
          stderr,
          stdout,
          timedOut,
        }),
        timedOut,
      });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child?.kill("SIGTERM");
      } catch {
        // close/error will still finalize the bounded run when available.
      }
      forceTimer = setTimeout(() => finish(124), CODEX_TIMEOUT_GRACE_MS);
    }, CODEX_TIMEOUT_MS);

    try {
      child = spawn(spec.command, spec.args, spec.options);
      activeCodexProcesses.set(repoRoot, { active: true, child });
    } catch (error) {
      void finish(null, error);
      return;
    }

    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk.toString("utf8"));
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk.toString("utf8"));
    });
    writeCodexTaskToStdin(child, prompt);
    child.on("error", (error) => void finish(null, error));
    child.on("close", (code) => void finish(code));
  });
}

module.exports = {
  buildCodexExecInvocation,
  buildCodexTask,
  buildCodexSpawnSpec,
  createSafeCodexEnv,
  getSafeCodexInvocationSummary,
  getCodexStatus,
  hasActiveCodexProcess,
  hasNonInteractiveExecSupport,
  mapCodexExitFailure,
  resolveCodexEntrypoint,
  runCodexRepairJob,
  validateCodexEntrypoint,
};
