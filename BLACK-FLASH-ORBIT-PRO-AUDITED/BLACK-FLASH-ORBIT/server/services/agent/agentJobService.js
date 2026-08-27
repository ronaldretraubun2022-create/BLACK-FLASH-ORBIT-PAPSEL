const { getSupabaseAdmin } = require("../supabaseAdmin");
const { runAllowedCommand } = require("./commandAllowlist");
const { getCodexStatus, hasActiveCodexProcess, runCodexRepairJob } = require("./codexBridge");
const { recordAgentAudit } = require("./agentAudit");
const {
  getChangedFiles,
  getConfiguredRepoRoot,
  getRepositoryStatus,
  getSafeDiffSummary,
} = require("./repositoryInspector");
const { getAgentBridgeState, isAgentBridgeEnabled } = require("./agentConfig");
const { redactObject, redactText } = require("./redaction");

const JOB_COLUMNS = "id, owner_id, title, status, created_at, updated_at";
const RUN_COLUMNS =
  "id, owner_id, job_id, stage, status, exit_code, started_at, completed_at, safe_summary, changed_files";
const ACTIVE_RUN_STATUSES = ["queued", "running"];
const ACTIVE_PROCESS_STATUSES = ["running"];
const CODEX_STALE_RUN_MS = 15 * 60 * 1000;
const VALIDATION_COMMANDS = [
  "npm run lint",
  "npm run test:security",
  "npm run test",
  "npm run build",
  "npm audit --omit=dev",
  "git diff --check",
];

function createAgentError(message, statusCode = 500, code = "AGENT_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getClient() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw createAgentError("Agent persistence belum dikonfigurasi.", 503, "AGENT_PERSISTENCE_NOT_CONFIGURED");
  }

  return client;
}

function normalizeDbError(error, code = "AGENT_PERSISTENCE_FAILED") {
  const text = String(error?.message || error?.details || error?.code || "").toLowerCase();

  if (text.includes("does not exist") || text.includes("schema")) {
    return createAgentError("Agent schema missing.", 503, "AGENT_SCHEMA_MISSING");
  }

  return createAgentError("Agent persistence gagal.", 500, code);
}

function mapPersistenceError(error) {
  const agentError =
    error?.code && /^AGENT_[A-Z0-9_]+$/.test(error.code)
      ? error
      : normalizeDbError(error, "AGENT_STATUS_FAILED");

  return {
    available: false,
    code: agentError.code || "AGENT_PERSISTENCE_FAILED",
    message: agentError.message || "Agent persistence gagal.",
    status: "unavailable",
  };
}

function buildEmptyMetrics(repoStatus, overrides = {}) {
  return {
    currentRepoBranch: repoStatus.branch,
    jobsFailed: 0,
    jobsQueued: 0,
    jobsRunning: 0,
    jobsSucceeded: 0,
    lastRun: null,
    lastValidation: null,
    workingTree: repoStatus.status,
    ...overrides,
  };
}

function mapJob(row) {
  return {
    createdAt: row.created_at,
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapRun(row) {
  return {
    changedFiles: Array.isArray(row.changed_files) ? row.changed_files : [],
    completedAt: row.completed_at || null,
    exitCode: row.exit_code,
    id: row.id,
    jobId: row.job_id,
    ownerId: row.owner_id,
    safeSummary: row.safe_summary || "",
    stage: row.stage,
    startedAt: row.started_at,
    status: row.status,
  };
}

function normalizeTitle(value) {
  const title = redactText(value, 160).replace(/\s+/g, " ").trim();

  return title || "ORBIT Agent Job";
}

function buildJobTitle(input = {}) {
  return normalizeTitle(input.title || input.task || input.taskText || input.task_text);
}

async function updateJobStatus({ jobId, ownerId, status }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", ownerId)
    .eq("id", jobId)
    .select(JOB_COLUMNS)
    .maybeSingle();

  if (error) throw normalizeDbError(error, "AGENT_JOB_UPDATE_FAILED");
  if (!data) throw createAgentError("Agent job tidak ditemukan.", 404, "AGENT_JOB_NOT_FOUND");

  return mapJob(data);
}

async function createRun({ changedFiles = [], exitCode = null, jobId, ownerId, safeSummary = "", stage, status }) {
  const client = getClient();
  const completedAt = ["succeeded", "failed", "blocked"].includes(status)
    ? new Date().toISOString()
    : null;
  const { data, error } = await client
    .from("orbit_agent_runs")
    .insert({
      changed_files: redactObject(changedFiles).slice(0, 100),
      completed_at: completedAt,
      exit_code: exitCode,
      job_id: jobId,
      owner_id: ownerId,
      safe_summary: redactText(safeSummary, 10000),
      stage,
      status,
      started_at: new Date().toISOString(),
    })
    .select(RUN_COLUMNS)
    .single();

  if (error) throw normalizeDbError(error, "AGENT_RUN_CREATE_FAILED");

  return mapRun(data);
}

async function updateRun({ changedFiles, exitCode, runId, ownerId, safeSummary, status }) {
  const client = getClient();
  const completedAt = ["succeeded", "failed", "blocked"].includes(status)
    ? new Date().toISOString()
    : null;
  const patch = {
    completed_at: completedAt,
    status,
  };

  if (changedFiles !== undefined) patch.changed_files = redactObject(changedFiles).slice(0, 100);
  if (exitCode !== undefined) patch.exit_code = exitCode;
  if (safeSummary !== undefined) patch.safe_summary = redactText(safeSummary, 10000);

  const { data, error } = await client
    .from("orbit_agent_runs")
    .update(patch)
    .eq("owner_id", ownerId)
    .eq("id", runId)
    .select(RUN_COLUMNS)
    .maybeSingle();

  if (error) throw normalizeDbError(error, "AGENT_RUN_UPDATE_FAILED");
  if (!data) throw createAgentError("Agent run tidak ditemukan.", 404, "AGENT_RUN_NOT_FOUND");

  return mapRun(data);
}

async function findActiveRepairRun({ jobId, ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_runs")
    .select(RUN_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("job_id", jobId)
    .eq("stage", "codex_repair")
    .in("status", ACTIVE_RUN_STATUSES)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeDbError(error, "AGENT_RUN_LOOKUP_FAILED");

  return data ? mapRun(data) : null;
}

const localCodexRuns = new Map();
const pendingCodexJobs = new Set();
const abortedCodexRuns = new Set();
let repositoryRepairLock = null;

function createRepositoryBusyError() {
  const error = createAgentError("Repository sedang menjalankan Codex repair; repair sudah berjalan.", 409, "AGENT_REPOSITORY_BUSY");
  error.safeMetadata = { active: true, stage: "codex_repair" };
  return error;
}

function acquireRepositoryRepairLock({ jobId, ownerId, repoRoot }) {
  if (repositoryRepairLock) throw createRepositoryBusyError();

  repositoryRepairLock = {
    jobId,
    ownerId,
    repoRoot,
    runId: null,
    startedAt: Date.now(),
  };
}

function releaseRepositoryRepairLock(runId) {
  if (repositoryRepairLock?.runId === runId || (runId == null && repositoryRepairLock?.runId == null)) {
    repositoryRepairLock = null;
  }
}

function getStaleRunAgeMs() {
  const configured = Number(process.env.ORBIT_AGENT_STALE_RUN_MS);

  if (Number.isFinite(configured) && configured >= CODEX_STALE_RUN_MS && configured <= 24 * 60 * 60 * 1000) {
    return configured;
  }

  return CODEX_STALE_RUN_MS;
}

async function reconcileStaleAgentRuns({ ownerId = null } = {}) {
  const client = getClient();
  let query = client
    .from("orbit_agent_runs")
    .select(RUN_COLUMNS)
    .eq("stage", "codex_repair")
    .in("status", ACTIVE_PROCESS_STATUSES)
    .order("started_at", { ascending: true })
    .limit(50);
  if (ownerId) query = query.eq("owner_id", ownerId);

  const { data, error } = await query;

  if (error) throw normalizeDbError(error, "AGENT_RUN_RECONCILE_FAILED");

  let reconciled = 0;

  for (const row of data || []) {
    const localStartedAt = localCodexRuns.get(row.id);
    const localAgeMs = localStartedAt ? Date.now() - localStartedAt : 0;
    const locallyLocked = repositoryRepairLock?.runId === row.id;
    const childAlive = typeof hasActiveCodexProcess === "function"
      ? hasActiveCodexProcess(repositoryRepairLock?.repoRoot || "")
      : Boolean(localStartedAt && localAgeMs < getStaleRunAgeMs());

    const verifiedCurrentRun = localStartedAt && (childAlive || locallyLocked);
    const orphaned = !verifiedCurrentRun;

    if (!orphaned && localAgeMs < getStaleRunAgeMs()) continue;

    const exitCode = orphaned ? 125 : 124;
    const safeSummary = orphaned
      ? "Codex repair orphaned after Agent Bridge restart."
      : "Codex repair marked failed after runtime timeout.";
    await updateRun({
      changedFiles: [],
      exitCode,
      runId: row.id,
      ownerId: row.owner_id,
      safeSummary,
      status: "failed",
    });
    abortedCodexRuns.add(row.id);
    releaseRepositoryRepairLock(row.id);
    await updateJobStatus({ jobId: row.job_id, ownerId: row.owner_id, status: "failed" }).catch(() => null);
    await recordAgentAudit({
      eventType: "codex_repair_stale_reconciled",
      jobId: row.job_id,
      metadata: { code: orphaned ? "AGENT_RUN_ORPHANED" : "AGENT_CODEX_TIMEOUT", runId: row.id, exitCode },
      ownerId: row.owner_id,
    }).catch(() => null);
    reconciled += 1;
  }

  return reconciled;
}

async function findActiveRepositoryRun() {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_runs")
    .select(RUN_COLUMNS)
    .eq("stage", "codex_repair")
    .in("status", ACTIVE_PROCESS_STATUSES)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeDbError(error, "AGENT_RUN_LOOKUP_FAILED");

  return data || null;
}

async function reconcileOrphanedAgentJobs() {
  const client = getClient();
  const [{ data: jobs, error: jobsError }, { data: runs, error: runsError }] = await Promise.all([
    client
      .from("orbit_agent_jobs")
      .select(JOB_COLUMNS)
      .in("status", ["diagnosing", "running", "validating"])
      .order("updated_at", { ascending: true })
      .limit(50),
    client
      .from("orbit_agent_runs")
      .select(RUN_COLUMNS)
      .in("status", ACTIVE_RUN_STATUSES)
      .limit(100),
  ]);

  if (jobsError) throw normalizeDbError(jobsError, "AGENT_JOB_RECONCILE_FAILED");
  if (runsError) throw normalizeDbError(runsError, "AGENT_RUN_RECONCILE_FAILED");

  const activeJobIds = new Set((runs || []).map((run) => run.job_id));
  const cutoff = Date.now() - getStaleRunAgeMs();
  let reconciled = 0;

  for (const job of jobs || []) {
    if (activeJobIds.has(job.id)) continue;
    const updatedAt = Date.parse(job.updated_at || "");
    if (!Number.isFinite(updatedAt) || updatedAt > cutoff) continue;

    await updateJobStatus({ jobId: job.id, ownerId: job.owner_id, status: "failed" });
    await recordAgentAudit({
      eventType: "agent_job_orphan_reconciled",
      jobId: job.id,
      metadata: { reason: "no_active_run_after_runtime_limit" },
      ownerId: job.owner_id,
    }).catch(() => null);
    reconciled += 1;
  }

  return reconciled;
}

async function getRepositoryRepairState({ reconcile = true } = {}) {
  const repoRoot = getConfiguredRepoRoot();

  if (repositoryRepairLock?.repoRoot === repoRoot) {
    const activeChild = typeof hasActiveCodexProcess === "function"
      ? hasActiveCodexProcess(repoRoot)
      : Boolean(repositoryRepairLock.runId && localCodexRuns.has(repositoryRepairLock.runId));
    const queuedLocally = repositoryRepairLock.runId == null || pendingCodexJobs.has(
      `${repositoryRepairLock.ownerId}:${repositoryRepairLock.jobId}`,
    );

    if (activeChild || queuedLocally) {
      return { activeRepair: true, status: "busy" };
    }

    const localStartedAt = localCodexRuns.get(repositoryRepairLock.runId);
    if (localStartedAt && Date.now() - localStartedAt < getStaleRunAgeMs()) {
      return { activeRepair: true, status: "busy" };
    }

    releaseRepositoryRepairLock(repositoryRepairLock.runId);
  }

  if (reconcile) await reconcileStaleAgentRuns();

  const activeRun = await findActiveRepositoryRun();

  return activeRun
    ? { activeRepair: false, status: "stale" }
    : { activeRepair: false, status: "idle" };
}

async function listRunsForJob({ jobId, ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_runs")
    .select(RUN_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("job_id", jobId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) throw normalizeDbError(error, "AGENT_RUN_LIST_FAILED");

  return (data || []).map(mapRun);
}

async function getAgentStatus({ ownerId }) {
  const agentBridge = getAgentBridgeState();
  const codex = getCodexStatus();
  const disabledRepoStatus = {
    branch: "disabled",
    dirty: false,
    repoRootLabel: "BLACK-FLASH-ORBIT",
    status: "disabled",
    statusSummary: agentBridge.reason,
  };

  if (!isAgentBridgeEnabled()) {
    return {
      agentBridge,
      codex,
      metrics: buildEmptyMetrics(disabledRepoStatus),
      persistence: {
        available: false,
        code: "AGENT_BRIDGE_DISABLED",
        message: agentBridge.reason,
        status: "disabled",
      },
      repository: disabledRepoStatus,
      repositoryRepair: { activeRepair: false, status: "idle" },
    };
  }

  const repoStatus = await getRepositoryStatus();
  let client;

  try {
    client = getClient();
  } catch (error) {
    return {
      agentBridge,
      codex,
      metrics: buildEmptyMetrics(repoStatus),
      persistence: mapPersistenceError(error),
      repository: repoStatus,
    };
  }

  let repositoryRepair;
  try {
    repositoryRepair = await getRepositoryRepairState();
    await reconcileOrphanedAgentJobs();
  } catch {
    repositoryRepair = { activeRepair: false, status: "stale" };
  }

  const [jobsQueued, activeRepairRuns, jobsSucceeded, jobsFailed, lastRun, lastValidation] =
    await Promise.all([
      client.from("orbit_agent_jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "queued"),
      client.from("orbit_agent_runs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("stage", "codex_repair").eq("status", "running"),
      client.from("orbit_agent_jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).in("status", ["succeeded", "approved"]),
      client.from("orbit_agent_jobs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "failed"),
      client.from("orbit_agent_runs").select(RUN_COLUMNS).eq("owner_id", ownerId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("orbit_agent_runs").select(RUN_COLUMNS).eq("owner_id", ownerId).eq("stage", "validate").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
  const firstError =
    jobsQueued.error ||
    activeRepairRuns.error ||
    jobsSucceeded.error ||
    jobsFailed.error ||
    lastRun.error ||
    lastValidation.error;

  if (firstError) {
    return {
      agentBridge,
      codex,
      metrics: buildEmptyMetrics(repoStatus),
      persistence: mapPersistenceError(firstError),
      repository: repoStatus,
      repositoryRepair: { activeRepair: false, status: "idle" },
    };
  }

  return {
    agentBridge,
    codex,
    metrics: {
      currentRepoBranch: repoStatus.branch,
      jobsFailed: Number(jobsFailed.count || 0),
      jobsQueued: Number(jobsQueued.count || 0),
      jobsRunning: Number(activeRepairRuns.count || 0),
      jobsSucceeded: Number(jobsSucceeded.count || 0),
      lastRun: lastRun.data ? mapRun(lastRun.data) : null,
      lastValidation: lastValidation.data ? mapRun(lastValidation.data) : null,
      workingTree: repoStatus.status,
    },
    persistence: {
      available: true,
      code: null,
      message: "Agent persistence ready.",
      status: "ready",
    },
    repository: repoStatus,
    repositoryRepair,
  };
}

async function createAgentJob({ input = {}, ownerId }) {
  const title = buildJobTitle(input);
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .insert({
      owner_id: ownerId,
      status: "queued",
      title,
    })
    .select(JOB_COLUMNS)
    .single();

  if (error) throw normalizeDbError(error, "AGENT_JOB_CREATE_FAILED");

  const job = mapJob(data);

  await recordAgentAudit({
    eventType: "job_created",
    jobId: job.id,
    metadata: { title },
    ownerId,
  });

  return job;
}

async function listAgentJobs({ ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .select(JOB_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw normalizeDbError(error, "AGENT_JOB_LIST_FAILED");

  return (data || []).map(mapJob);
}

async function getAgentJob({ jobId, ownerId }) {
  const client = getClient();
  const { data, error } = await client
    .from("orbit_agent_jobs")
    .select(JOB_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw normalizeDbError(error, "AGENT_JOB_LOOKUP_FAILED");
  if (!data) throw createAgentError("Agent job tidak ditemukan.", 404, "AGENT_JOB_NOT_FOUND");

  return {
    ...mapJob(data),
    runs: await listRunsForJob({ jobId, ownerId }),
  };
}

async function runAgentDiagnostics({ jobId, ownerId }) {
  const repoRoot = getConfiguredRepoRoot();

  await updateJobStatus({ jobId, ownerId, status: "diagnosing" });

  const commands = ["git branch --show-current", "git status", "git diff --check", "git log --oneline"];
  const results = [];

  for (const command of commands) {
    results.push(await runAllowedCommand({ command, repoRoot, timeoutMs: 30000 }));
  }

  const failed = results.some((result) => Number(result.exitCode) !== 0);
  const changedFiles = await getChangedFiles();
  const run = await createRun({
    changedFiles,
    exitCode: failed ? 1 : 0,
    jobId,
    ownerId,
    safeSummary: results.map((result) => `${result.commandId}\n${result.safeSummary}`).join("\n\n"),
    stage: "diagnose",
    status: failed ? "failed" : "succeeded",
  });

  await updateJobStatus({ jobId, ownerId, status: failed ? "failed" : "diagnosed" });
  await recordAgentAudit({
    eventType: "diagnostics_completed",
    jobId,
    metadata: { changedFileCount: changedFiles.length, failed },
    ownerId,
  });

  return run;
}

async function runAgentRepair({ input = {}, jobId, ownerId }) {
  const repoRoot = getConfiguredRepoRoot();
  const job = await getAgentJob({ jobId, ownerId });
  const taskText = input.taskText || input.task || job.title;
  const codex = getCodexStatus();

  if (!codex.available || !codex.nonInteractive) {
    throw getCodexRepairUnavailableError(codex);
  }

  const repoStatus = await getRepositoryStatus();
  const repositoryRepair = await getRepositoryRepairState();

  if (repositoryRepair.status !== "idle") {
    throw createRepositoryBusyError();
  }

  if (repoStatus.dirty) {
    throw createAgentError(
      "Working tree berubah. Bersihkan atau review perubahan sebelum Codex repair.",
      409,
      "AGENT_REPOSITORY_DIRTY",
    );
  }

  const activeRun = await findActiveRepairRun({ jobId, ownerId });

  if (activeRun || pendingCodexJobs.has(`${ownerId}:${jobId}`)) {
    throw createAgentError("Agent repair run sudah berjalan untuk job ini.", 409, "AGENT_RUN_ALREADY_ACTIVE");
  }

  const lockKey = `${ownerId}:${jobId}`;
  pendingCodexJobs.add(lockKey);
  acquireRepositoryRepairLock({ jobId, ownerId, repoRoot });
  let run;

  try {
    run = await createRun({
      changedFiles: [],
      exitCode: null,
      jobId,
      ownerId,
      safeSummary: "Codex repair queued.",
      stage: "codex_repair",
      status: "queued",
    });
    repositoryRepairLock.runId = run.id;

    await updateJobStatus({ jobId, ownerId, status: "running" });
    await recordAgentAudit({
      eventType: "codex_repair_queued",
      jobId,
      metadata: { runId: run.id },
      ownerId,
    });

    queueCodexRepairExecution({ jobId, ownerId, repoRoot, runId: run.id, taskText });
  } catch (error) {
    if (run?.id) {
      await updateRun({
        changedFiles: [],
        exitCode: 1,
        runId: run.id,
        ownerId,
        safeSummary: "Codex repair could not be queued safely.",
        status: "failed",
      }).catch(() => null);
      await updateJobStatus({ jobId, ownerId, status: "failed" }).catch(() => null);
    }
    pendingCodexJobs.delete(lockKey);
    releaseRepositoryRepairLock(run?.id);
    throw error;
  }

  return {
    jobId,
    run,
    runId: run.id,
    status: run.status,
  };
}

function queueCodexRepairExecution({ jobId, ownerId, repoRoot, runId, taskText }) {
  setImmediate(() => {
    executeCodexRepairRun({ jobId, ownerId, repoRoot, runId, taskText }).catch(() => {
      // executeCodexRepairRun persists its terminal state; this guard prevents detached rejections.
    });
  });
}

async function executeCodexRepairRun({ jobId, ownerId, repoRoot, runId, taskText }) {
  const lockKey = `${ownerId}:${jobId}`;
  pendingCodexJobs.delete(lockKey);
  localCodexRuns.set(runId, Date.now());

  try {
    await updateRun({
      runId,
      ownerId,
      safeSummary: "Codex repair running.",
      status: "running",
    });
    const result = await runCodexRepairJob({ repoRoot, taskText });
    if (abortedCodexRuns.has(runId)) return;
    const succeeded = Number(result.exitCode) === 0;

    await updateRun({
      changedFiles: result.changedFiles,
      exitCode: result.exitCode,
      runId,
      ownerId,
      safeSummary: result.safeSummary,
      status: succeeded ? "succeeded" : "failed",
    });
    await updateJobStatus({
      jobId,
      ownerId,
      status: succeeded ? "awaiting_approval" : "failed",
    });
    await recordAgentAudit({
      eventType: "codex_repair_completed",
      jobId,
      metadata: {
        changedFileCount: result.changedFiles.length,
        exitCode: result.exitCode,
        runId,
        timedOut: Boolean(result.timedOut),
      },
      ownerId,
    }).catch(() => null);
  } catch (error) {
    if (abortedCodexRuns.has(runId)) return;
    const errorCode = error?.code || "AGENT_CODEX_RUN_FAILED";
    const safeSummary = `${errorCode}: ${redactText(error?.message || "Codex repair gagal.", 240)}`;
    await updateRun({
      changedFiles: [],
      exitCode: error?.code === "AGENT_CODEX_TIMEOUT" ? 124 : 1,
      runId,
      ownerId,
      safeSummary,
      status: "failed",
    }).catch(() => null);
    await updateJobStatus({ jobId, ownerId, status: "failed" }).catch(() => null);
    await recordAgentAudit({
      eventType: "codex_repair_failed",
      jobId,
      metadata: { code: errorCode, runId },
      ownerId,
    }).catch(() => null);
  } finally {
    localCodexRuns.delete(runId);
    abortedCodexRuns.delete(runId);
    pendingCodexJobs.delete(lockKey);
    releaseRepositoryRepairLock(runId);
  }
}

async function waitForCodexRepairCompletionForTest({ jobId, ownerId, runId, taskText }) {
  const repoRoot = getConfiguredRepoRoot();

  await executeCodexRepairRun({
    jobId,
    ownerId,
    repoRoot,
    runId,
    taskText,
  });
}

async function validateAgentJob({ jobId, ownerId }) {
  const repoRoot = getConfiguredRepoRoot();

  await updateJobStatus({ jobId, ownerId, status: "validating" });

  const results = [];

  for (const command of VALIDATION_COMMANDS) {
    results.push(await runAllowedCommand({ command, repoRoot, timeoutMs: 10 * 60 * 1000 }));
  }

  const failed = results.some((result) => Number(result.exitCode) !== 0);
  const changedFiles = await getChangedFiles();
  const run = await createRun({
    changedFiles,
    exitCode: failed ? 1 : 0,
    jobId,
    ownerId,
    safeSummary: results.map((result) => `${result.commandId}\n${result.safeSummary}`).join("\n\n"),
    stage: "validate",
    status: failed ? "failed" : "succeeded",
  });

  await updateJobStatus({ jobId, ownerId, status: failed ? "failed" : "awaiting_approval" });
  await recordAgentAudit({
    eventType: "validation_completed",
    jobId,
    metadata: { changedFileCount: changedFiles.length, failed },
    ownerId,
  });

  return run;
}

async function approveAgentJob({ jobId, ownerId }) {
  const job = await updateJobStatus({ jobId, ownerId, status: "approved" });

  await recordAgentAudit({
    eventType: "job_approved",
    jobId,
    metadata: { commitCreated: false, pushCreated: false, tagCreated: false },
    ownerId,
  });

  return job;
}

async function rejectAgentJob({ jobId, ownerId }) {
  const job = await updateJobStatus({ jobId, ownerId, status: "rejected" });

  await recordAgentAudit({
    eventType: "job_rejected",
    jobId,
    metadata: { destructiveCleanup: false },
    ownerId,
  });

  return job;
}

async function getAgentJobDiff({ jobId, ownerId }) {
  await getAgentJob({ jobId, ownerId });

  return getSafeDiffSummary();
}

function getCodexRepairUnavailableError(codex = {}) {
  const modeUnsupported = codex.available === true && codex.nonInteractive !== true;

  return createAgentError(
    modeUnsupported
      ? "Codex CLI tersedia, tetapi mode exec non-interaktif belum didukung untuk Prepare Repair."
      : "Codex CLI tidak tersedia untuk Prepare Repair.",
    503,
    codex.code || (modeUnsupported ? "AGENT_CODEX_MODE_UNSUPPORTED" : "AGENT_CODEX_NOT_FOUND"),
  );
}

module.exports = {
  approveAgentJob,
  createAgentJob,
  getAgentJob,
  getAgentJobDiff,
  getAgentStatus,
  listAgentJobs,
  rejectAgentJob,
  runAgentDiagnostics,
  runAgentRepair,
  reconcileStaleAgentRuns,
  validateAgentJob,
  waitForCodexRepairCompletionForTest,
};
