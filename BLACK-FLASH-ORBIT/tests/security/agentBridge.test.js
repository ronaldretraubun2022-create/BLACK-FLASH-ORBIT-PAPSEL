const assert = require("node:assert");
const { EventEmitter } = require("node:events");
const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

const rootDir = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  rootDir,
  "supabase/migrations/20260824060000_orbit_agent_bridge_v1_3.sql",
);
const routePath = path.join(rootDir, "server/routes/agent.js");
const serverPath = path.join(rootDir, "server/index.js");
const configPath = path.join(rootDir, "server/services/agent/agentConfig.js");
const allowlistPath = path.join(rootDir, "server/services/agent/commandAllowlist.js");
const codexBridgePath = path.join(rootDir, "server/services/agent/codexBridge.js");
const repositoryInspectorPath = path.join(
  rootDir,
  "server/services/agent/repositoryInspector.js",
);
const jobServicePath = path.join(rootDir, "server/services/agent/agentJobService.js");
const redactionPath = path.join(rootDir, "server/services/agent/redaction.js");
const pagePath = path.join(rootDir, "apps/web/src/pages/AgentBridge.jsx");
const apiPath = path.join(rootDir, "apps/web/src/services/api.js");
const appPath = path.join(rootDir, "apps/web/src/App.jsx");
const sidebarPath = path.join(rootDir, "apps/web/src/components/CommandCenterSidebar.jsx");
const runnerPath = path.join(rootDir, "scripts/orbit-agent-runner.mjs");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("agent bridge migration creates owner-scoped RLS tables", () => {
  const sql = read(migrationPath);

  for (const table of ["orbit_agent_jobs", "orbit_agent_runs", "orbit_agent_audit"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }

  assert.match(sql, /owner_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /using \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /with check \(owner_id = auth\.uid\(\)\)/);
  assert.match(sql, /for delete\s+using \(false\)/);
  assert.match(sql, /safe_summary text not null default ''/);
  assert.match(sql, /changed_files jsonb not null default '\[\]'::jsonb/);
  assert.match(sql, /safe_metadata jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /safe_metadata::text !~\*/);
  assert.match(sql, /create or replace function public\.set_orbit_agent_updated_at\(\)/);
  assert.match(sql, /execute function public\.set_orbit_agent_updated_at\(\)/);
  assert.doesNotMatch(sql, /set_orbit_intelligence_updated_at/);
});

test("agent bridge routes require auth and never accept client owner id", () => {
  const route = read(routePath);
  const server = read(serverPath);

  assert.match(route, /router\.use\(requireAuth\)/);
  assert.match(route, /rateLimit\(\{/);
  assert.match(route, /router\.get\(\s*["']\/status["']/);
  assert.match(route, /router\.use\(requireAgentBridgeEnabled\)/);
  assert.match(route, /metadata: safeMetadata/);
  assert.match(route, /ownerId: getOwnerId\(req\)/);
  assert.doesNotMatch(route, /ownerId:\s*req\.body/);
  assert.doesNotMatch(route, /ORBIT_CODEX_ENTRYPOINT|codexEntrypoint|entrypoint:\s*req\.body|req\.query\.entrypoint/);
  for (const endpoint of [
    "/status",
    "/jobs",
    "/jobs/:id",
    "/jobs/:id/diagnose",
    "/jobs/:id/run",
    "/jobs/:id/validate",
    "/jobs/:id/approve",
    "/jobs/:id/reject",
    "/jobs/:id/diff",
  ]) {
    assert(route.includes(endpoint), `${endpoint} missing`);
  }
  assert.match(server, /\/api\/v1\/agent/);
});

test("agent bridge is disabled by default unless local server flag is explicit", () => {
  const previous = process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  const { assertAgentBridgeEnabled, getAgentBridgeState, isAgentBridgeEnabled } =
    require("../../server/services/agent/agentConfig");
  const route = read(routePath);
  const service = read(jobServicePath);
  const page = read(pagePath);
  const config = read(configPath);

  delete process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  assert.strictEqual(isAgentBridgeEnabled(), false);
  assert.strictEqual(getAgentBridgeState().enabled, false);
  assert.throws(() => assertAgentBridgeEnabled(), /dinonaktifkan|disabled/i);

  process.env.ORBIT_AGENT_BRIDGE_ENABLED = "true";
  assert.strictEqual(isAgentBridgeEnabled(), true);
  assert.strictEqual(getAgentBridgeState().enabled, true);

  if (previous === undefined) {
    delete process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  } else {
    process.env.ORBIT_AGENT_BRIDGE_ENABLED = previous;
  }

  assert.match(config, /ORBIT_AGENT_BRIDGE_ENABLED/);
  assert.match(route, /AGENT_BRIDGE_DISABLED|assertAgentBridgeEnabled/);
  assert.match(service, /getAgentBridgeState/);
  assert.match(service, /status: "disabled"/);
  assert.match(page, /agentBridge/);
  assert.match(page, /Local bridge disabled/);
  assert.match(page, /ORBIT_AGENT_BRIDGE_ENABLED=true/);
});

function createFakeCodexEntrypoint() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-codex-"));
  const entrypoint = path.join(
    root,
    "node_modules",
    "@openai",
    "codex",
    "bin",
    "codex.js",
  );

  fs.mkdirSync(path.dirname(entrypoint), { recursive: true });
  fs.writeFileSync(
    entrypoint,
    [
      "#!/usr/bin/env node",
      "if (process.argv.includes('--version')) {",
      "  console.log('codex-cli 0.149.0');",
      "  process.exit(0);",
      "}",
      "if (process.argv[2] === 'exec' && process.argv.includes('--help')) {",
      "  console.log('Run Codex non-interactively');",
      "  console.log('instructions are read from stdin');",
      "  process.exit(0);",
      "}",
      "if (process.argv[2] === 'exec') {",
      "  let input = '';",
      "  process.stdin.setEncoding('utf8');",
      "  process.stdin.on('data', chunk => input += chunk);",
      "  process.stdin.on('end', () => {",
      "    console.log(JSON.stringify({",
      "      args: process.argv.slice(2),",
      "      hasInjectedFlag: process.argv.includes('--dangerously-bypass-approvals-and-sandbox'),",
      "      stdinClosed: true,",
      "      taskReceived: input.includes('ORBIT_CODEX_ENTRYPOINT=C:/unsafe/codex.js')",
      "    }));",
      "  });",
      "  process.exitCode = 0;",
      "}",
    ].join("\n"),
  );

  return { entrypoint, root };
}

function createAgentMemoryClient(seed = {}) {
  const state = {
    jobs: (seed.jobs || []).map((row) => ({ ...row })),
    runSeq: 0,
    runs: (seed.runs || []).map((row) => ({ ...row })),
  };
  const tableMap = {
    orbit_agent_jobs: state.jobs,
    orbit_agent_runs: state.runs,
  };
  const now = () => "2026-08-24T00:00:00.000Z";
  const createQuery = (table) => {
    const query = {
      _filters: [],
      _head: false,
      _inFilters: [],
      _insert: null,
      _limit: null,
      _op: "select",
      _order: null,
      _patch: null,
      eq(column, value) {
        this._filters.push({ column, value });
        return this;
      },
      in(column, values) {
        this._inFilters.push({ column, values });
        return this;
      },
      insert(payload) {
        this._op = "insert";
        this._insert = payload;
        return this;
      },
      limit(value) {
        this._limit = value;
        return this;
      },
      maybeSingle() {
        const rows = this._executeRows();

        return Promise.resolve({ data: rows[0] || null, error: null });
      },
      order(column, options = {}) {
        this._order = { ascending: options.ascending !== false, column };
        return this;
      },
      select(_columns, options = {}) {
        this._head = options.head === true;
        return this;
      },
      single() {
        if (this._op === "insert") {
          const row = {
            id: this._insert.id || `run-${++state.runSeq}`,
            created_at: now(),
            started_at: now(),
            updated_at: now(),
            ...this._insert,
          };

          tableMap[table].push(row);

          return Promise.resolve({ data: row, error: null });
        }

        const rows = this._executeRows();

        return Promise.resolve({ data: rows[0] || null, error: null });
      },
      then(resolve, reject) {
        return this._execute().then(resolve, reject);
      },
      update(patch) {
        this._op = "update";
        this._patch = patch;
        return this;
      },
      _execute() {
        const rows = this._executeRows();

        if (this._head) {
          return Promise.resolve({ count: rows.length, data: null, error: null });
        }

        return Promise.resolve({ data: rows, error: null });
      },
      _executeRows() {
        let rows = tableMap[table] || [];

        rows = rows.filter((row) =>
          this._filters.every((filter) => row[filter.column] === filter.value) &&
          this._inFilters.every((filter) => filter.values.includes(row[filter.column])),
        );

        if (this._op === "update") {
          rows.forEach((row) => {
            Object.assign(row, this._patch);
          });
        }

        if (this._order) {
          rows = [...rows].sort((left, right) => {
            const result = String(left[this._order.column] || "").localeCompare(String(right[this._order.column] || ""));

            return this._order.ascending ? result : -result;
          });
        }

        if (this._limit !== null) {
          rows = rows.slice(0, this._limit);
        }

        return rows;
      },
    };

    return query;
  };

  return {
    from(table) {
      return createQuery(table);
    },
    state,
  };
}

test("codex resolver uses verified node entrypoint without ps1 or cmd shims", async () => {
  const previous = process.env.ORBIT_CODEX_ENTRYPOINT;
  const { entrypoint } = createFakeCodexEntrypoint();
  const bridge = loadModuleWithMocks(codexBridgePath, {
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
      }),
    },
  });

  process.env.ORBIT_CODEX_ENTRYPOINT = entrypoint;

  try {
    assert.strictEqual(bridge.validateCodexEntrypoint(entrypoint), fs.realpathSync.native(entrypoint));
    assert.strictEqual(bridge.getCodexStatus().available, true);
    assert.strictEqual(bridge.getCodexStatus().mode, "node-entrypoint");
    assert.strictEqual(bridge.getCodexStatus().nonInteractive, true);
    assert.strictEqual(bridge.getCodexStatus().version, "codex-cli 0.149.0");

    const invocation = bridge.buildCodexExecInvocation({ codexEntrypoint: entrypoint, repoRoot: rootDir });
    const spec = bridge.buildCodexSpawnSpec({ entrypoint, repoRoot: rootDir });

    assert.strictEqual(invocation.executable, process.execPath);
    assert.deepStrictEqual(invocation.args, [
      entrypoint,
      "exec",
      "--cd",
      rootDir,
      "--sandbox",
      "workspace-write",
      "--color",
      "never",
      "-",
    ]);
    assert.strictEqual(spec.command, process.execPath);
    assert.deepStrictEqual(spec.args.slice(1), [
      "exec",
      "--cd",
      rootDir,
      "--sandbox",
      "workspace-write",
      "--color",
      "never",
      "-",
    ]);
    assert.strictEqual(spec.options.shell, false);
    assert.deepStrictEqual(spec.options.stdio, ["pipe", "pipe", "pipe"]);
    assert.match(spec.safeInvocationSummary, /args=codex\.js exec --cd repoRoot --sandbox workspace-write --color never -/);
    assert.match(spec.safeInvocationSummary, /hasExec=true/);
    assert.match(spec.safeInvocationSummary, /mode=node-entrypoint/);
    assert.match(spec.safeInvocationSummary, /execSubcommand=true/);
    assert.match(spec.safeInvocationSummary, /stdinMode=pipe/);
    assert.match(spec.safeInvocationSummary, /shell=false/);
    assert(!spec.safeInvocationSummary.includes(entrypoint));
    assert(!spec.safeInvocationSummary.includes(rootDir));

    const result = await bridge.runCodexRepairJob({
      repoRoot: rootDir,
      taskText: `Use this task text only. --dangerously-bypass-approvals-and-sandbox ORBIT_CODEX_ENTRYPOINT=C:/unsafe/codex.js`,
    });

    assert.strictEqual(result.exitCode, 0);
    assert.match(result.safeSummary, /"stdinClosed":true/);
    assert.match(result.safeSummary, /"taskReceived":true/);
    assert.match(result.safeSummary, /"hasInjectedFlag":false/);
    assert.match(result.safeSummary, /"exec"/);
    assert.match(result.safeSummary, /Codex invocation:/);
    assert.match(result.safeSummary, /hasExec=true/);
  } finally {
    if (previous === undefined) {
      delete process.env.ORBIT_CODEX_ENTRYPOINT;
    } else {
      process.env.ORBIT_CODEX_ENTRYPOINT = previous;
    }
  }
});

test("codex repair launches non-interactive exec with piped stdin write and close", async () => {
  const previousEntry = process.env.ORBIT_CODEX_ENTRYPOINT;
  const previousDiagnostics = process.env.ORBIT_AGENT_DIAGNOSTICS;
  const { entrypoint } = createFakeCodexEntrypoint();
  const spawned = {};
  const bridge = loadModuleWithMocks(codexBridgePath, {
    "node:child_process": {
      spawn(command, args, options) {
        spawned.command = command;
        spawned.args = args;
        spawned.options = options;
        spawned.stdinWrites = [];
        spawned.stdinEnded = false;

        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdin = new EventEmitter();
        child.stdin.write = (payload) => {
          spawned.stdinWrites.push(payload);
          return true;
        };
        child.stdin.end = () => {
          spawned.stdinEnded = true;
          setImmediate(() => {
            child.stdout.emit("data", Buffer.from(JSON.stringify({
              args,
              hasInjectedFlag: args.includes("--dangerously-bypass-approvals-and-sandbox"),
              stdinClosed: true,
              taskReceived: spawned.stdinWrites.join("").includes("--dangerously-bypass-approvals-and-sandbox"),
            })));
            child.emit("close", 0);
          });
        };
        child.kill = () => {};

        return child;
      },
      spawnSync(command, args) {
        if (command === process.execPath && args[0] === entrypoint && args[1] === "exec" && args[2] === "--help") {
          return {
            status: 0,
            stdout: "Run Codex non-interactively\ninstructions are read from stdin",
            stderr: "",
          };
        }
        if (command === process.execPath && args[0] === entrypoint && args[1] === "--version") {
          return {
            status: 0,
            stdout: "codex-cli 0.149.0",
            stderr: "",
          };
        }
        return { status: 1, stdout: "", stderr: "unexpected command" };
      },
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
      }),
    },
  });

  process.env.ORBIT_CODEX_ENTRYPOINT = entrypoint;
  process.env.ORBIT_AGENT_DIAGNOSTICS = "true";

  try {
    const result = await bridge.runCodexRepairJob({
      repoRoot: rootDir,
      taskText: "Inspect repository status only. --dangerously-bypass-approvals-and-sandbox",
    });

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(spawned.command, process.execPath);
    assert.deepStrictEqual(spawned.args, [
      entrypoint,
      "exec",
      "--cd",
      rootDir,
      "--sandbox",
      "workspace-write",
      "--color",
      "never",
      "-",
    ]);
    assert.strictEqual(spawned.options.cwd, rootDir);
    assert.strictEqual(spawned.options.shell, false);
    assert.deepStrictEqual(spawned.options.stdio, ["pipe", "pipe", "pipe"]);
    assert.strictEqual(spawned.options.windowsHide, true);
    assert.strictEqual(spawned.stdinWrites.length, 1);
    assert.match(spawned.stdinWrites[0], /Inspect repository status only/);
    assert.strictEqual(spawned.stdinEnded, true);
    assert.match(result.safeSummary, /"stdinClosed":true/);
    assert.match(result.safeSummary, /"taskReceived":true/);
    assert.match(result.safeSummary, /"hasInjectedFlag":false/);
    assert.match(result.safeSummary, /hasExec=true/);
  } finally {
    if (previousEntry === undefined) {
      delete process.env.ORBIT_CODEX_ENTRYPOINT;
    } else {
      process.env.ORBIT_CODEX_ENTRYPOINT = previousEntry;
    }
    if (previousDiagnostics === undefined) {
      delete process.env.ORBIT_AGENT_DIAGNOSTICS;
    } else {
      process.env.ORBIT_AGENT_DIAGNOSTICS = previousDiagnostics;
    }
  }
});

test("codex resolver rejects missing unsafe or non-package entrypoints safely", () => {
  const bridge = require("../../server/services/agent/codexBridge");
  const previous = process.env.ORBIT_CODEX_ENTRYPOINT;
  const unsafeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-codex-unsafe-"));
  const unsafeFile = path.join(unsafeRoot, "codex.js");

  fs.writeFileSync(unsafeFile, "console.log('unsafe');");

  assert.throws(() => bridge.validateCodexEntrypoint(""), /entrypoint|Codex/i);
  assert.throws(() => bridge.validateCodexEntrypoint("\\\\server\\share\\codex.js"), /entrypoint|Codex/i);
  assert.throws(() => bridge.validateCodexEntrypoint(unsafeFile), /@openai\/codex|entrypoint|Codex/i);

  process.env.ORBIT_CODEX_ENTRYPOINT = path.join(unsafeRoot, "missing.js");

  try {
    const status = bridge.getCodexStatus();

    assert.strictEqual(status.available, false);
    assert.strictEqual(status.code, "AGENT_CODEX_NOT_FOUND");
    assert.strictEqual(status.nonInteractive, false);
    assert(!JSON.stringify(status).includes(unsafeRoot));
  } finally {
    if (previous === undefined) {
      delete process.env.ORBIT_CODEX_ENTRYPOINT;
    } else {
      process.env.ORBIT_CODEX_ENTRYPOINT = previous;
    }
  }
});

test("agent status reports persistence failure without generic runtime failure", async () => {
  const previous = process.env.ORBIT_AGENT_BRIDGE_ENABLED;

  process.env.ORBIT_AGENT_BRIDGE_ENABLED = "true";

  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": {
      getSupabaseAdmin: () => null,
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
        repoRootLabel: "BLACK-FLASH-ORBIT",
        status: "clean",
        statusSummary: "",
      }),
      getSafeDiffSummary: async () => ({
        changedFiles: [],
        diffCheckExitCode: 0,
        safeSummary: "",
      }),
    },
    "./codexBridge": {
      getCodexStatus: () => ({
        available: true,
        mode: "node-entrypoint",
        nonInteractive: true,
        version: "codex-cli 0.149.0",
      }),
      runCodexRepairJob: async () => ({
        changedFiles: [],
        exitCode: 0,
        safeSummary: "",
      }),
    },
  });

  const status = await service.getAgentStatus({ ownerId: "owner-1" });

  if (previous === undefined) {
    delete process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  } else {
    process.env.ORBIT_AGENT_BRIDGE_ENABLED = previous;
  }

  assert.strictEqual(status.agentBridge.enabled, true);
  assert.strictEqual(status.codex.available, true);
  assert.strictEqual(status.codex.nonInteractive, true);
  assert.strictEqual(status.repository.branch, "feature/orbit-v1.3-agent-bridge");
  assert.strictEqual(status.persistence.available, false);
  assert.strictEqual(status.persistence.code, "AGENT_PERSISTENCE_NOT_CONFIGURED");
  assert.notStrictEqual(status.persistence.message, "Agent Bridge request gagal.");
});

test("agent API exposes safe code status and message for known runtime errors", async () => {
  const route = loadModuleWithMocks(routePath, {
    "../middleware/requireAuth": {
      requireAuth(req, _res, next) {
        req.userId = "owner-1";
        req.user = { id: "owner-1" };
        next();
      },
    },
    "../services/agent/agentConfig": {
      assertAgentBridgeEnabled() {},
    },
    "../services/agent/agentJobService": {
      getAgentStatus: async () => {
        const error = new Error("Agent schema missing.");

        error.statusCode = 503;
        error.code = "AGENT_SCHEMA_MISSING";
        throw error;
      },
    },
  });
  const app = express();

  app.use(express.json());
  app.use("/api/v1/agent", route);

  const server = await startServer(app);

  try {
    const { body, status } = await requestJson(server.baseUrl, "/api/v1/agent/status", {
      headers: { authorization: "Bearer test-token" },
    });

    assert.strictEqual(status, 503);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.status, 503);
    assert.strictEqual(body.code, "AGENT_SCHEMA_MISSING");
    assert.strictEqual(body.message, "Agent schema missing.");
  } finally {
    await server.close();
  }
});

test("agent repair route returns 202 accepted for queued background work", async () => {
  const route = loadModuleWithMocks(routePath, {
    "../middleware/requireAuth": {
      requireAuth(req, _res, next) {
        req.userId = "owner-1";
        req.user = { id: "owner-1" };
        next();
      },
    },
    "../services/agent/agentConfig": {
      assertAgentBridgeEnabled() {},
    },
    "../services/agent/agentJobService": {
      runAgentRepair: async () => ({
        jobId: "job-1",
        runId: "run-1",
        status: "queued",
      }),
    },
  });
  const app = express();

  app.use(express.json());
  app.use("/api/v1/agent", route);

  const server = await startServer(app);

  try {
    const { body, status } = await requestJson(server.baseUrl, "/api/v1/agent/jobs/job-1/run", {
      body: JSON.stringify({ taskText: "Inspect repository status only." }),
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(status, 202);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.jobId, "job-1");
    assert.strictEqual(body.data.runId, "run-1");
    assert.strictEqual(body.data.status, "queued");
    assert(!JSON.stringify(body).includes("stdout"));
    assert(!JSON.stringify(body).includes("Authorization"));
  } finally {
    await server.close();
  }
});

test("agent repair queues background Codex work without waiting for completion", async () => {
  const previous = process.env.ORBIT_AGENT_BRIDGE_ENABLED;
  const client = createAgentMemoryClient({
    jobs: [{
      created_at: "2026-08-24T00:00:00.000Z",
      id: "job-1",
      owner_id: "owner-1",
      status: "queued",
      title: "Inspect repository status only.",
      updated_at: "2026-08-24T00:00:00.000Z",
    }, {
      created_at: "2026-08-24T00:00:00.000Z",
      id: "job-2",
      owner_id: "owner-1",
      status: "queued",
      title: "Inspect another repair task.",
      updated_at: "2026-08-24T00:00:00.000Z",
    }],
  });
  let codexStarted = false;
  let releaseCodex;
  const codexGate = new Promise((resolve) => {
    releaseCodex = resolve;
  });
  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": {
      getSupabaseAdmin: () => client,
    },
    "./agentAudit": {
      recordAgentAudit: async () => null,
    },
    "./agentConfig": {
      getAgentBridgeState: () => ({ enabled: true }),
      isAgentBridgeEnabled: () => true,
    },
    "./codexBridge": {
      getCodexStatus: () => ({
        available: true,
        mode: "node-entrypoint",
        nonInteractive: true,
        version: "codex-cli 0.149.0",
      }),
      runCodexRepairJob: async () => {
        codexStarted = true;
        await codexGate;

        return {
          changedFiles: ["server/services/agent/codexBridge.js"],
          exitCode: 0,
          safeSummary: "repair complete",
          timedOut: false,
        };
      },
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
      }),
    },
  });

  process.env.ORBIT_AGENT_BRIDGE_ENABLED = "true";

  try {
    const queued = await service.runAgentRepair({
      input: { taskText: "Inspect repository status only." },
      jobId: "job-1",
      ownerId: "owner-1",
    });

    assert.strictEqual(queued.status, "queued");
    assert.strictEqual(queued.jobId, "job-1");
    assert.strictEqual(queued.runId, "run-1");
    assert.strictEqual(codexStarted, false);
    assert.strictEqual(client.state.runs.length, 1);
    assert.strictEqual(client.state.runs[0].status, "queued");

    await assert.rejects(
      () => service.runAgentRepair({
        input: { taskText: "Inspect repository status only." },
        jobId: "job-1",
        ownerId: "owner-1",
      }),
      /sudah berjalan|already/i,
    );

    await assert.rejects(
      () => service.runAgentRepair({
        input: { taskText: "Inspect another repair task." },
        jobId: "job-2",
        ownerId: "owner-1",
      }),
      (error) => error.code === "AGENT_REPOSITORY_BUSY" && error.statusCode === 409,
    );

    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(codexStarted, true);
    releaseCodex();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(client.state.runs[0].status, "succeeded");
    assert.strictEqual(client.state.jobs[0].status, "awaiting_approval");
  } finally {
    if (previous === undefined) {
      delete process.env.ORBIT_AGENT_BRIDGE_ENABLED;
    } else {
      process.env.ORBIT_AGENT_BRIDGE_ENABLED = previous;
    }
  }
});

test("agent repair failure persists a safe failed run summary", async () => {
  const client = createAgentMemoryClient({
    jobs: [{
      created_at: "2026-08-24T00:00:00.000Z",
      id: "job-1",
      owner_id: "owner-1",
      status: "queued",
      title: "Inspect repository status only.",
      updated_at: "2026-08-24T00:00:00.000Z",
    }],
  });
  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": {
      getSupabaseAdmin: () => client,
    },
    "./agentAudit": {
      recordAgentAudit: async () => null,
    },
    "./agentConfig": {
      getAgentBridgeState: () => ({ enabled: true }),
      isAgentBridgeEnabled: () => true,
    },
    "./codexBridge": {
      getCodexStatus: () => ({
        available: true,
        mode: "node-entrypoint",
        nonInteractive: true,
        version: "codex-cli 0.149.0",
      }),
      runCodexRepairJob: async () => ({
        changedFiles: [],
        exitCode: 1,
        safeSummary: "Authorization: Bearer secret-token",
        timedOut: false,
      }),
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
      }),
    },
  });

  await service.runAgentRepair({
    input: { taskText: "Inspect repository status only." },
    jobId: "job-1",
    ownerId: "owner-1",
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.strictEqual(client.state.runs[0].status, "failed");
  assert.strictEqual(client.state.jobs[0].status, "failed");
  assert(!client.state.runs[0].safe_summary.includes("secret-token"));
});

test("agent repair finalizes a timed-out background run", async () => {
  const client = createAgentMemoryClient({
    jobs: [{
      created_at: "2026-08-24T00:00:00.000Z",
      id: "job-1",
      owner_id: "owner-1",
      status: "queued",
      title: "Inspect repository status only.",
      updated_at: "2026-08-24T00:00:00.000Z",
    }],
  });
  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": { getSupabaseAdmin: () => client },
    "./agentAudit": { recordAgentAudit: async () => null },
    "./agentConfig": {
      getAgentBridgeState: () => ({ enabled: true }),
      isAgentBridgeEnabled: () => true,
    },
    "./codexBridge": {
      getCodexStatus: () => ({ available: true, mode: "node-entrypoint", nonInteractive: true }),
      runCodexRepairJob: async () => ({
        changedFiles: [],
        exitCode: 124,
        safeSummary: "AGENT_CODEX_TIMEOUT: Codex CLI melewati batas waktu.",
        timedOut: true,
      }),
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({ branch: "feature/orbit-v1.3-agent-bridge", dirty: false }),
    },
  });

  await service.runAgentRepair({
    input: { taskText: "Inspect repository status only." },
    jobId: "job-1",
    ownerId: "owner-1",
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.strictEqual(client.state.runs[0].status, "failed");
  assert.strictEqual(client.state.runs[0].exit_code, 124);
  assert.strictEqual(client.state.jobs[0].status, "failed");
});

test("detached Codex rejection is caught and persists terminal failure", async () => {
  const client = createAgentMemoryClient({
    jobs: [{
      created_at: "2026-08-24T00:00:00.000Z",
      id: "job-1",
      owner_id: "owner-1",
      status: "queued",
      title: "Inspect repository status only.",
      updated_at: "2026-08-24T00:00:00.000Z",
    }],
  });
  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": { getSupabaseAdmin: () => client },
    "./agentAudit": { recordAgentAudit: async () => null },
    "./agentConfig": {
      getAgentBridgeState: () => ({ enabled: true }),
      isAgentBridgeEnabled: () => true,
    },
    "./codexBridge": {
      getCodexStatus: () => ({ available: true, mode: "node-entrypoint", nonInteractive: true }),
      runCodexRepairJob: async () => {
        throw Object.assign(new Error("Codex child failed safely."), { code: "AGENT_CODEX_RUN_FAILED" });
      },
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({ branch: "feature/orbit-v1.3-agent-bridge", dirty: false }),
    },
  });

  await service.runAgentRepair({
    input: { taskText: "Inspect repository status only." },
    jobId: "job-1",
    ownerId: "owner-1",
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.strictEqual(client.state.runs[0].status, "failed");
  assert.strictEqual(client.state.jobs[0].status, "failed");
  assert.match(client.state.runs[0].safe_summary, /AGENT_CODEX_RUN_FAILED/);
});

test("agent status reconciles old non-local Codex runs without touching active local runs", async () => {
  const client = createAgentMemoryClient({
    jobs: [{
      created_at: "2026-08-24T00:00:00.000Z",
      id: "stale-job",
      owner_id: "owner-1",
      status: "running",
      title: "Stale repair",
      updated_at: "2026-08-24T00:00:00.000Z",
    }, {
      created_at: "2026-08-24T00:00:00.000Z",
      id: "fresh-job",
      owner_id: "owner-1",
      status: "queued",
      title: "Fresh repair",
      updated_at: "2026-08-24T00:00:00.000Z",
    }],
    runs: [{
      id: "stale-run",
      job_id: "stale-job",
      owner_id: "owner-1",
      stage: "codex_repair",
      status: "running",
      started_at: new Date().toISOString(),
      safe_summary: "Codex repair running.",
      changed_files: [],
    }, {
      id: "fresh-run",
      job_id: "fresh-job",
      owner_id: "owner-1",
      stage: "codex_repair",
      status: "queued",
      started_at: new Date().toISOString(),
      safe_summary: "Codex repair running.",
      changed_files: [],
    }],
  });
  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": { getSupabaseAdmin: () => client },
    "./agentAudit": { recordAgentAudit: async () => null },
    "./agentConfig": {
      getAgentBridgeState: () => ({ enabled: true }),
      isAgentBridgeEnabled: () => true,
    },
    "./codexBridge": {
      getCodexStatus: () => ({ available: false, nonInteractive: false, mode: "node-entrypoint" }),
    },
    "./repositoryInspector": {
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({ branch: "feature/orbit-v1.3-agent-bridge", dirty: false, status: "clean" }),
    },
  });

  await service.getAgentStatus({ ownerId: "owner-1" });

  const staleRun = client.state.runs.find((run) => run.id === "stale-run");
  const freshRun = client.state.runs.find((run) => run.id === "fresh-run");
  assert.strictEqual(staleRun.status, "failed");
  assert.strictEqual(staleRun.exit_code, 125);
  assert.match(staleRun.safe_summary, /orphaned|restart/i);
  assert.strictEqual(freshRun.status, "queued");
  assert.strictEqual(client.state.jobs.find((job) => job.id === "stale-job").status, "failed");
  assert.strictEqual(client.state.jobs.find((job) => job.id === "fresh-job").status, "queued");
});

test("active local Codex run is not reconciled before its runtime limit", async () => {
  const client = createAgentMemoryClient({
    jobs: [{
      created_at: "2020-01-01T00:00:00.000Z",
      id: "job-1",
      owner_id: "owner-1",
      status: "running",
      title: "Long repair",
      updated_at: "2020-01-01T00:00:00.000Z",
    }],
    runs: [{
      id: "run-1",
      job_id: "job-1",
      owner_id: "owner-1",
      stage: "codex_repair",
      status: "running",
      started_at: "2020-01-01T00:00:00.000Z",
      safe_summary: "Codex repair running.",
      changed_files: [],
    }],
  });
  let releaseCodex;
  const codexGate = new Promise((resolve) => { releaseCodex = resolve; });
  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": { getSupabaseAdmin: () => client },
    "./agentAudit": { recordAgentAudit: async () => null },
    "./agentConfig": {
      getAgentBridgeState: () => ({ enabled: true }),
      isAgentBridgeEnabled: () => true,
    },
    "./codexBridge": {
      getCodexStatus: () => ({ available: true, nonInteractive: true, mode: "node-entrypoint" }),
      runCodexRepairJob: async () => {
        await codexGate;
        return { changedFiles: [], exitCode: 0, safeSummary: "repair complete", timedOut: false };
      },
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({ branch: "feature/orbit-v1.3-agent-bridge", dirty: false }),
    },
  });

  const completion = service.waitForCodexRepairCompletionForTest({
    jobId: "job-1",
    ownerId: "owner-1",
    runId: "run-1",
    taskText: "Inspect repository status only.",
  });
  await new Promise((resolve) => setImmediate(resolve));
  await service.reconcileStaleAgentRuns();
  assert.strictEqual(client.state.runs[0].status, "running");
  releaseCodex();
  await completion;
  assert.strictEqual(client.state.runs[0].status, "succeeded");
});

test("agent repair remains owner scoped for queued background runs", async () => {
  const client = createAgentMemoryClient({
    jobs: [{
      created_at: "2026-08-24T00:00:00.000Z",
      id: "job-1",
      owner_id: "owner-1",
      status: "queued",
      title: "Inspect repository status only.",
      updated_at: "2026-08-24T00:00:00.000Z",
    }],
  });
  const service = loadModuleWithMocks(jobServicePath, {
    "../supabaseAdmin": {
      getSupabaseAdmin: () => client,
    },
    "./agentAudit": {
      recordAgentAudit: async () => null,
    },
    "./agentConfig": {
      getAgentBridgeState: () => ({ enabled: true }),
      isAgentBridgeEnabled: () => true,
    },
    "./codexBridge": {
      getCodexStatus: () => ({
        available: true,
        mode: "node-entrypoint",
        nonInteractive: true,
        version: "codex-cli 0.149.0",
      }),
      runCodexRepairJob: async () => ({
        changedFiles: [],
        exitCode: 0,
        safeSummary: "repair complete",
        timedOut: false,
      }),
    },
    "./repositoryInspector": {
      getChangedFiles: async () => [],
      getConfiguredRepoRoot: () => rootDir,
      getRepositoryStatus: async () => ({
        branch: "feature/orbit-v1.3-agent-bridge",
        dirty: false,
      }),
    },
  });

  await assert.rejects(
    () => service.runAgentRepair({
      input: { taskText: "Inspect repository status only." },
      jobId: "job-1",
      ownerId: "owner-2",
    }),
    /tidak ditemukan|not found/i,
  );
  assert.strictEqual(client.state.runs.length, 0);
});

test("agent command allowlist rejects arbitrary shell and destructive git", () => {
  const { resolveAllowedCommand } = require("../../server/services/agent/commandAllowlist");

  assert.strictEqual(resolveAllowedCommand("git status", rootDir).id, "git_status");
  assert.strictEqual(resolveAllowedCommand("npm run test:security", rootDir).id, "npm_test_security");
  assert.throws(() => resolveAllowedCommand("git reset --hard", rootDir), /rejected|allowlist|Command/i);
  assert.throws(() => resolveAllowedCommand("git push --force", rootDir), /rejected|allowlist|Command/i);
  assert.throws(() => resolveAllowedCommand("powershell Get-ChildItem", rootDir), /allowlist|Command/i);
  assert.throws(() => resolveAllowedCommand("git status && type .env", rootDir), /rejected|blocked/i);
  assert.throws(() => resolveAllowedCommand("curl https://example.test", rootDir), /rejected|allowlist|Command/i);
});

test("agent node check path validation rejects env and repository escape", () => {
  const { resolveAllowedCommand } = require("../../server/services/agent/commandAllowlist");

  assert.strictEqual(
    resolveAllowedCommand("node --check server/index.js", rootDir).args.join(" "),
    "--check server/index.js",
  );
  assert.throws(() => resolveAllowedCommand("node --check ../server/index.js", rootDir), /escape|ditolak|rejected/i);
  assert.throws(() => resolveAllowedCommand("node --check .env", rootDir), /env|invalid|blocked|rejected/i);
  assert.throws(() => resolveAllowedCommand("node --check C:/Windows/win.ini", rootDir), /allowlist|escape|ditolak/i);
  assert.throws(() => resolveAllowedCommand("node --check \\\\server\\share\\file.js", rootDir), /escape|ditolak|rejected/i);
  assert.throws(() => resolveAllowedCommand("node --check \\\\.\\NUL", rootDir), /escape|ditolak|rejected|invalid/i);
});

test("agent process execution uses spawn argument arrays without shell access", () => {
  const allowlist = read(allowlistPath);
  const codex = read(codexBridgePath);

  assert.match(allowlist, /spawn\(allowed\.command, allowed\.args/);
  assert.match(codex, /spawn\(spec\.command, spec\.args, spec\.options\)/);
  assert.match(codex, /buildCodexExecInvocation/);
  assert.match(codex, /"exec"/);
  assert.match(codex, /"--cd"/);
  assert.match(codex, /"--sandbox"/);
  assert.match(codex, /"workspace-write"/);
  assert.match(codex, /"-"/);
  assert.match(codex, /child\.stdin\.write\(safeTaskPayload\)/);
  assert.match(codex, /child\.stdin\.end\(\)/);
  assert.doesNotMatch(codex, /stdio:\s*["']inherit["']|process\.stdin|child\.stdin\?\.end\(prompt\)/);
  assert.match(codex, /spawnSync\(process\.execPath, \[entrypoint, "--version"\]/);
  assert.match(codex, /spawnSync\(process\.execPath, \[entrypoint, "exec", "--help"\]/);
  assert.match(allowlist, /shell: false/);
  assert.match(codex, /shell: false/);
  assert.doesNotMatch(allowlist, /exec\(/);
  assert.doesNotMatch(codex, /exec\(/);
  assert.match(codex, /ORBIT_CODEX_ENTRYPOINT/);
  assert.doesNotMatch(codex, /codex\.ps1|codex\.cmd|shell:\s*true|cmd\.exe|powershell/i);
  assert.doesNotMatch(codex, /CODEX_EXECUTABLE = "codex"|spawn\("codex"/);
});

test("codex non-interactive failures map to safe agent error codes", () => {
  const { mapCodexExitFailure } = require("../../server/services/agent/codexBridge");

  assert.strictEqual(
    mapCodexExitFailure({ code: 1, stderr: "Error: stdin is not a terminal" }).code,
    "AGENT_CODEX_NONINTERACTIVE_REQUIRED",
  );
  assert.strictEqual(
    mapCodexExitFailure({ code: 2, stderr: "unrecognized subcommand exec" }).code,
    "AGENT_CODEX_MODE_UNSUPPORTED",
  );
  assert.strictEqual(
    mapCodexExitFailure({ code: 1, stderr: "other failure" }),
    null,
  );
});

test("agent repository inspector confines paths to configured repo", () => {
  const inspector = read(repositoryInspectorPath);

  assert.match(inspector, /getConfiguredRepoRoot/);
  assert.match(inspector, /process\.env\.ORBIT_REPO_ROOT/);
  assert.match(inspector, /fs\.realpathSync\.native/);
  assert.match(inspector, /path\.relative\(root, target\)/);
  assert.match(inspector, /relative\.startsWith\(".."\)/);
  assert.match(inspector, /AGENT_PATH_ESCAPE/);
  assert.match(inspector, /git status/);
});

test("agent redaction removes secrets, tokens, service role strings, and emails", () => {
  const { redactObject, redactText } = require("../../server/services/agent/redaction");
  const text = redactText(
    "Authorization: Bearer secret-token OPENROUTER_API_KEY=secret SUPABASE_SERVICE_ROLE_KEY=role test@example.com",
  );
  const object = redactObject({
    Authorization: "Bearer secret",
    safe: "ok",
    token: "secret",
  });

  assert(!text.includes("secret-token"));
  assert(!text.includes("OPENROUTER_API_KEY=secret"));
  assert(!text.includes("SUPABASE_SERVICE_ROLE_KEY=role"));
  assert(!text.includes("test@example.com"));
  assert.strictEqual(object.Authorization, "[REDACTED]");
  assert.strictEqual(object.token, "[REDACTED]");
  assert.strictEqual(object.safe, "ok");
});

test("agent service enforces approval without commit push merge or tags", () => {
  const service = read(jobServicePath);

  assert.match(service, /approveAgentJob/);
  assert.match(service, /queueCodexRepairExecution/);
  assert.match(service, /setImmediate/);
  assert.match(service, /AGENT_RUN_ALREADY_ACTIVE/);
  assert.match(service, /AGENT_REPOSITORY_BUSY/);
  assert.match(service, /acquireRepositoryRepairLock/);
  assert.match(service, /releaseRepositoryRepairLock/);
  assert.match(service, /findActiveRepairRun/);
  assert.match(service, /status: "approved"/);
  assert.match(service, /commitCreated: false/);
  assert.match(service, /pushCreated: false/);
  assert.match(service, /tagCreated: false/);
  assert.doesNotMatch(service, /git commit/);
  assert.doesNotMatch(service, /git push/);
  assert.doesNotMatch(service, /git merge/);
  assert.doesNotMatch(service, /git tag/);
  assert.doesNotMatch(service, /entrypoint:\s*input|codexEntrypoint|ORBIT_CODEX_ENTRYPOINT:\s*input/);
});

test("agent service stores safe summaries and bounded changed file lists", () => {
  const service = read(jobServicePath);
  const redaction = read(redactionPath);
  const allowlist = read(allowlistPath);

  assert.match(service, /safe_summary: redactText\(safeSummary, 10000\)/);
  assert.match(service, /changed_files: redactObject\(changedFiles\)\.slice\(0, 100\)/);
  assert.match(allowlist, /const MAX_OUTPUT_CHARS = 40000/);
  assert.match(read(codexBridgePath), /const MAX_CODEX_OUTPUT_CHARS = 50000/);
  assert.match(read(codexBridgePath), /const CODEX_TIMEOUT_MS = 10 \* 60 \* 1000/);
  assert.match(allowlist, /setTimeout\(\(\) => \{/);
  assert.match(redaction, /SECRET_PATTERNS/);
});

test("agent API client and UI do not expose service role or provider secrets", () => {
  const api = read(apiPath);
  const page = read(pagePath);
  const app = read(appPath);
  const sidebar = read(sidebarPath);

  for (const method of [
    "getAgentStatus",
    "createAgentJob",
    "getAgentJobs",
    "getAgentJob",
    "diagnoseAgentJob",
    "runAgentJob",
    "validateAgentJob",
    "approveAgentJob",
    "rejectAgentJob",
    "getAgentJobDiff",
  ]) {
    assert(api.includes(method), `${method} missing`);
  }

  assert.match(api, /\/api\/v1\/agent\/status/);
  assert.match(api, /headers: await getAuthenticatedHeaders\(\)/);
  assert.match(app, /\/agent-bridge/);
  assert.match(app, /open-agent-bridge/);
  assert.match(sidebar, /Agent Bridge/);
  assert.match(page, /isRepositoryBusy/);
  assert.match(page, /isRepositoryDirty/);
  assert.match(page, /Repository Repair/);
  assert.match(page, /disabled=\{!canUseJobs \|\| Boolean\(activeAction\)\}/);
  assert.match(page, /persistence/);
  assert.match(page, /codex/);
  assert.match(page, /canRunRepair/);
  assert.match(page, /working tree bersih/);
  assert.match(page, /nonInteractive/);
  assert.match(page, /setInterval\(poll, 3000\)/);
  assert.match(page, /api\.getAgentJob\(selectedJobId\)/);
  assert.match(page, /Codex repair queued/);
  assert.match(page, /mode exec non-interaktif belum siap/);
  assert.match(page, /error\?\.body\?\.code/);
  assert.match(page, /error\?\.body\?\.status/);
  assert.match(page, /disabled=\{!canCreateJob\}/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|Authorization:\s*Bearer/);
});

test("orbit agent runner accepts modes only and no arbitrary command string", () => {
  const source = read(runnerPath);

  assert.match(source, /const MODES = new Set\(\["status", "diagnose", "validate"\]\)/);
  assert.doesNotMatch(source, /process\.argv\[3\]/);
  assert.doesNotMatch(source, /shell:\s*true/);
  assert.match(source, /runAllowedCommand/);
});
