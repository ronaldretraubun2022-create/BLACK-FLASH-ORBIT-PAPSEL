import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileDiff,
  GitBranch,
  Play,
  RefreshCcw,
  ShieldCheck,
  TestTube2,
  XCircle,
} from "lucide-react";
import { UserMenu } from "../components/auth/UserMenu.jsx";
import { CommandCenterSidebar } from "../components/CommandCenterSidebar.jsx";
import { useProfile } from "../hooks/useProfile.js";
import { api } from "../services/api.js";
import { ORBIT_RELEASE_METADATA } from "../config/releaseMetadata.js";

const releaseState = [
  {
    label: "Branch",
    value: ORBIT_RELEASE_METADATA.releaseChannel,
    tone: "text-[#f1c36f]",
  },
  { label: "Module", value: ORBIT_RELEASE_METADATA.module, tone: "text-white" },
  { label: "Mode", value: ORBIT_RELEASE_METADATA.status, tone: "text-emerald-300" },
];
const activeJobStatuses = new Set(["diagnosing", "running", "validating"]);
const activeRunStatuses = new Set(["queued", "running"]);

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSafeError(error) {
  const status = Number(error?.status || error?.body?.status || 0);
  const code = String(error?.code || error?.body?.code || "").trim();
  const bodyMessage = String(error?.body?.message || "").trim();
  const baseMessage = bodyMessage || error?.message || "Agent Bridge request gagal.";
  const message = String(baseMessage).slice(0, 240);

  if (/authorization|bearer|token|secret|api[_-]?key|service[_-]?role/i.test(message)) {
    return "Agent Bridge request gagal.";
  }

  const prefix = [status || "", code].filter(Boolean).join(" ");

  return prefix ? `${prefix}: ${message}` : message;
}

function getCodexUnavailableMessage(codex = {}) {
  if (codex.available === false) {
    return `${codex.code || "AGENT_CODEX_NOT_FOUND"}: Codex CLI belum tersedia untuk Prepare Repair.`;
  }

  if (codex.nonInteractive === false) {
    return `${codex.code || "AGENT_CODEX_MODE_UNSUPPORTED"}: Codex CLI tersedia, tetapi mode exec non-interaktif belum siap.`;
  }

  return "AGENT_CODEX_MODE_UNSUPPORTED: Codex repair unavailable.";
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Jayapura",
    year: "numeric",
  });
}

export function AgentBridge() {
  const { profile } = useProfile();
  const [status, setStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [diffSummary, setDiffSummary] = useState(null);
  const [taskText, setTaskText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const agentState = status?.agentBridge || {};
  const codexState = status?.codex || {};
  const persistenceState = status?.persistence || {};
  const isBridgeEnabled = agentState.enabled === true;
  const isCodexAvailable = codexState.available === true;
  const isCodexNonInteractive = codexState.nonInteractive === true;
  const isPersistenceAvailable = persistenceState.available !== false;
  const isRepositoryBusy = status?.repositoryRepair?.status === "busy";
  const isRepositoryDirty = status?.repository?.dirty === true;
  const selectedJobId = selectedJob?.id || jobs[0]?.id || "";
  const selectedRunStateKey = getArray(selectedJob?.runs)
    .map((run) => `${run.id}:${run.status}`)
    .join("|");
  const isSelectedJobActive =
    activeJobStatuses.has(selectedJob?.status) ||
    getArray(selectedJob?.runs).some((run) => activeRunStatuses.has(run.status));
  const canUseJobs = isBridgeEnabled && isPersistenceAvailable;
  const canCreateJob = canUseJobs && taskText.trim().length >= 8 && !activeAction;
  const canActOnJob = canUseJobs && Boolean(selectedJobId) && !activeAction && !isSelectedJobActive;
  const canRunRepair =
    canActOnJob && !isRepositoryBusy && !isRepositoryDirty && isCodexAvailable && isCodexNonInteractive;

  const metrics = useMemo(() => {
    const data = status?.metrics || {};

    return [
      { label: "Queued", value: data.jobsQueued || 0 },
      { label: "Running", value: data.jobsRunning || 0 },
      { label: "Succeeded", value: data.jobsSucceeded || 0 },
      { label: "Failed", value: data.jobsFailed || 0 },
    ];
  }, [status]);

  async function loadAgentBridge() {
    setIsLoading(true);
    setError("");

    try {
      const statusResponse = await api.getAgentStatus();
      const nextStatus = statusResponse?.data || null;
      const enabled = nextStatus?.agentBridge?.enabled === true;
      const persistenceReady = nextStatus?.persistence?.available !== false;

      if (!enabled || !persistenceReady) {
        setStatus(nextStatus);
        setJobs([]);
        setSelectedJob(null);
        setDiffSummary(null);
        return;
      }

      const jobsResponse = await api.getAgentJobs();
      const nextJobs = getArray(jobsResponse?.data);

      setStatus(nextStatus);
      setJobs(nextJobs);

      if (!selectedJob && nextJobs[0]?.id) {
        const detail = await api.getAgentJob(nextJobs[0].id);
        setSelectedJob(detail?.data || nextJobs[0]);
      }
    } catch (loadError) {
      setError(getSafeError(loadError));
      setStatus(null);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAgentBridge();
  }, []);

  useEffect(() => {
    if (!selectedJobId || !isSelectedJobActive) return undefined;

    let canceled = false;
    const poll = async () => {
      try {
        const [statusResponse, jobsResponse, detailResponse] = await Promise.all([
          api.getAgentStatus(),
          api.getAgentJobs(),
          api.getAgentJob(selectedJobId),
        ]);

        if (canceled) return;

        setStatus(statusResponse?.data || null);
        setJobs(getArray(jobsResponse?.data));
        setSelectedJob(detailResponse?.data || null);
      } catch (pollError) {
        if (!canceled) {
          setError(getSafeError(pollError));
        }
      }
    };
    const pollId = window.setInterval(poll, 3000);

    poll();

    return () => {
      canceled = true;
      window.clearInterval(pollId);
    };
  }, [isSelectedJobActive, selectedJob?.status, selectedJobId, selectedRunStateKey]);

  async function refreshSelectedJob(jobId = selectedJobId) {
    if (!jobId) return;

    const detail = await api.getAgentJob(jobId);
    setSelectedJob(detail?.data || null);
  }

  async function handleCreateJob(event) {
    event.preventDefault();
    if (!canCreateJob) return;

    setActiveAction("create");
    setError("");
    setMessage("");

    try {
      const response = await api.createAgentJob({ task: taskText });
      const job = response?.data;

      setSelectedJob(job);
      setMessage("Agent job created.");
      await loadAgentBridge();
    } catch (createError) {
      setError(getSafeError(createError));
    } finally {
      setActiveAction("");
    }
  }

  async function runAction(action, handler, successMessage) {
    if (!canActOnJob) return;

    setActiveAction(action);
    setError("");
    setMessage("");

    try {
      await handler();
      setMessage(successMessage);
      await refreshSelectedJob();
      await loadAgentBridge();
    } catch (actionError) {
      setError(getSafeError(actionError));
    } finally {
      setActiveAction("");
    }
  }

  async function handleSelectJob(jobId) {
    setError("");
    setMessage("");
    setDiffSummary(null);
    setActiveAction("select");

    try {
      const response = await api.getAgentJob(jobId);
      setSelectedJob(response?.data || null);
    } catch (selectError) {
      setError(getSafeError(selectError));
    } finally {
      setActiveAction("");
    }
  }

  async function handleViewDiff() {
    await runAction(
      "diff",
      async () => {
        const response = await api.getAgentJobDiff(selectedJobId);
        setDiffSummary(response?.data || null);
      },
      "Safe diff summary loaded.",
    );
  }

  async function handleRunRepair() {
    if (!canRunRepair) return;

    setActiveAction("run");
    setError("");
    setMessage("");

    try {
      await api.runAgentJob(selectedJobId, { taskText });
      setMessage("Codex repair queued. Status will update automatically.");
      await refreshSelectedJob(selectedJobId);
      await loadAgentBridge();
    } catch (runError) {
      setError(getSafeError(runError));
    } finally {
      setActiveAction("");
    }
  }

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <CommandCenterSidebar
          releaseState={releaseState}
          userRole={profile?.role || "user"}
        />

        <section className="min-w-0 flex-1">
          <header className="orbit-topbar">
            <div>
              <p className="orbit-kicker">Developer Agent Bridge v1.3</p>
              <h1 className="text-xl font-black text-white md:text-2xl">
                Local Repair Operator
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                aria-label="Refresh Agent Bridge"
                className="orbit-icon-button"
                disabled={isLoading || Boolean(activeAction)}
                onClick={loadAgentBridge}
                type="button">
                <RefreshCcw size={18} />
              </button>
              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6">
            <section className="rounded-lg border border-[#d9ad57]/20 bg-[radial-gradient(circle_at_top_right,_rgba(217,173,87,0.14),_transparent_36%),rgba(255,255,255,0.035)] p-4 md:p-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
                    <ShieldCheck size={14} />
                    {isBridgeEnabled ? "Authenticated local bridge" : "Local bridge disabled"}
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
                    Diagnose, repair, validate.
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                    {isBridgeEnabled
                      ? isPersistenceAvailable
                        ? isCodexAvailable && isCodexNonInteractive
                          ? "Agent Bridge menjalankan command allowlist, menyiapkan Codex repair lewat wrapper lokal, dan menunggu approval manusia."
                          : "Agent Bridge lokal aktif. Diagnose dan Run Tests tersedia, tetapi Codex repair belum tersedia."
                        : "Agent Bridge lokal aktif, tetapi persistence Agent belum siap untuk menyimpan job."
                      : "Agent Bridge tidak menjalankan command sampai server lokal mengaktifkan ORBIT_AGENT_BRIDGE_ENABLED=true."}
                  </p>
                </div>

                <RepositoryStatus status={status} isLoading={isLoading} />
              </div>

              {error ? (
                <div className="mt-4 rounded-lg border border-[#7d1f2f]/35 bg-[#7d1f2f]/15 px-4 py-3 text-sm font-bold text-rose-100">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">
                  {message}
                </div>
              ) : null}
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1fr)_minmax(300px,0.9fr)]">
              <Panel icon={Bot} kicker="Task" title="Prepare Job">
                <form className="grid gap-3" onSubmit={handleCreateJob}>
                  <textarea
                    className="min-h-36 rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-[#d9ad57]/45"
                    disabled={!canUseJobs || Boolean(activeAction)}
                    maxLength={4000}
                    onChange={(event) => setTaskText(event.target.value)}
                    placeholder="Describe the repository diagnosis or repair task. Do not paste secrets."
                    value={taskText}
                  />
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57]/15 px-4 text-sm font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canCreateJob}
                    type="submit">
                    <ClipboardCheck size={16} />
                    {activeAction === "create" ? "Creating..." : "Create Agent Job"}
                  </button>
                </form>
              </Panel>

              <Panel icon={Play} kicker="Actions" title="Job Control">
                <div className="grid gap-3">
                  <JobPicker
                    jobs={jobs}
                    onSelect={handleSelectJob}
                    selectedJobId={selectedJobId}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ActionButton
                      disabled={!canActOnJob}
                      icon={FileDiff}
                      label="Diagnose"
                      loading={activeAction === "diagnose"}
                      onClick={() =>
                        runAction(
                          "diagnose",
                          () => api.diagnoseAgentJob(selectedJobId),
                          "Diagnostics completed.",
                        )
                      }
                    />
                    <ActionButton
                      disabled={!canRunRepair}
                      icon={Bot}
                      label="Prepare Codex Repair"
                      loading={activeAction === "run"}
                      onClick={handleRunRepair}
                    />
                    <ActionButton
                      disabled={!canActOnJob}
                      icon={TestTube2}
                      label="Run Tests"
                      loading={activeAction === "validate"}
                      onClick={() =>
                        runAction(
                          "validate",
                          () => api.validateAgentJob(selectedJobId),
                          "Validation completed.",
                        )
                      }
                    />
                    <ActionButton
                      disabled={!canActOnJob}
                      icon={FileDiff}
                      label="View Diff"
                      loading={activeAction === "diff"}
                      onClick={handleViewDiff}
                    />
                    <ActionButton
                      disabled={!canActOnJob}
                      icon={CheckCircle2}
                      label="Approve Patch"
                      loading={activeAction === "approve"}
                      onClick={() =>
                        runAction(
                          "approve",
                          () => api.approveAgentJob(selectedJobId),
                          "Patch approved. No commit or push was performed.",
                        )
                      }
                    />
                    <ActionButton
                      disabled={!canActOnJob}
                      icon={XCircle}
                      label="Reject Patch"
                      loading={activeAction === "reject"}
                      onClick={() =>
                        runAction(
                          "reject",
                          () => api.rejectAgentJob(selectedJobId),
                          "Patch rejected.",
                        )
                      }
                    />
                  </div>
                  {isRepositoryBusy || isRepositoryDirty ? (
                    <p className="rounded-lg border border-[#d9ad57]/20 bg-[#d9ad57]/10 px-3 py-2 text-xs font-bold leading-5 text-[#f1c36f]">
                      {isRepositoryBusy
                        ? "Prepare Repair menunggu Codex repair yang sedang berjalan selesai."
                        : "Prepare Repair membutuhkan working tree bersih sebelum Codex dapat dijalankan."}
                    </p>
                  ) : null}
                  <JobDetail job={selectedJob} />
                </div>
              </Panel>

              <section className="grid gap-4">
                <Panel icon={GitBranch} kicker="History" title="Job History">
                  <JobHistory jobs={jobs} onSelect={handleSelectJob} />
                </Panel>
                <Panel icon={FileDiff} kicker="Diff" title="Safe Diff Summary">
                  <DiffSummary diffSummary={diffSummary} />
                </Panel>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RepositoryStatus({ isLoading, status }) {
  const repo = status?.repository || {};
  const agentBridge = status?.agentBridge || {};
  const codex = status?.codex || {};
  const persistence = status?.persistence || {};

  if (isLoading) return <EmptyState label="Loading repository status..." />;

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
      <p className="orbit-kicker">Repository</p>
      <h3 className="mt-1 text-lg font-black text-white">
        {repo.repoRootLabel || "BLACK-FLASH-ORBIT"}
      </h3>
      <div className="mt-4 grid gap-3 text-sm">
        <StatusLine
          label="Local Agent"
          value={agentBridge.enabled ? "enabled" : "disabled"}
        />
        <StatusLine
          label="Persistence"
          value={persistence.available === false ? "unavailable" : persistence.status || "ready"}
        />
        <StatusLine
          label="Codex"
          value={codex.available ? codex.version || "available" : codex.code || "unavailable"}
        />
        <StatusLine
          label="Codex Exec"
          value={codex.nonInteractive ? "non-interactive" : "unavailable"}
        />
        <StatusLine label="Branch" value={repo.branch || "-"} />
        <StatusLine label="Working Tree" value={repo.status || "-"} />
        <StatusLine label="Dirty" value={repo.dirty ? "yes" : "no"} />
        <StatusLine
          label="Repository Repair"
          value={status?.repositoryRepair?.status || "idle"}
        />
      </div>
      {!agentBridge.enabled ? (
        <p className="mt-3 rounded-lg border border-[#d9ad57]/20 bg-[#d9ad57]/10 px-3 py-2 text-xs font-bold leading-5 text-[#f1c36f]">
          {agentBridge.reason || "Local Agent Bridge is disabled."}
        </p>
      ) : null}
      {agentBridge.enabled && persistence.available === false ? (
        <p className="mt-3 rounded-lg border border-[#7d1f2f]/30 bg-[#7d1f2f]/10 px-3 py-2 text-xs font-bold leading-5 text-rose-100">
          {persistence.code ? `${persistence.code}: ` : ""}
          {persistence.message || "Agent persistence unavailable."}
        </p>
      ) : null}
      {agentBridge.enabled && (codex.available === false || codex.nonInteractive === false) ? (
        <p className="mt-3 rounded-lg border border-[#d9ad57]/20 bg-[#d9ad57]/10 px-3 py-2 text-xs font-bold leading-5 text-[#f1c36f]">
          {getCodexUnavailableMessage(codex)}
        </p>
      ) : null}
    </div>
  );
}

function StatusLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <span className="min-w-0 truncate text-right text-xs font-black text-white">
        {value}
      </span>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <p className="orbit-kicker">{label}</p>
      <h3 className="mt-3 text-2xl font-black text-white">{value}</h3>
    </article>
  );
}

function Panel({ children, icon: Icon, kicker, title }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="orbit-kicker">{kicker}</p>
          <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
        </div>
        <div className="rounded-lg border border-[#d9ad57]/25 bg-[#d9ad57]/10 p-2.5 text-[#f1c36f]">
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function JobPicker({ jobs, onSelect, selectedJobId }) {
  if (!jobs.length) return <EmptyState label="No agent jobs yet." />;

  return (
    <label className="grid gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
      Active Job
      <select
        className="min-h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-[#d9ad57]/45"
        onChange={(event) => onSelect(event.target.value)}
        value={selectedJobId}>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ disabled, icon: Icon, label, loading, onClick }) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-xs font-black text-white transition hover:border-[#d9ad57]/35 hover:text-[#f1c36f] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || loading}
      onClick={onClick}
      type="button">
      <Icon size={15} />
      {loading ? "Working..." : label}
    </button>
  );
}

function JobDetail({ job }) {
  if (!job?.id) return <EmptyState label="Select or create a job." />;

  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{job.title}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
              {job.status}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            {formatDate(job.updatedAt)}
          </span>
        </div>
      </div>
      <RunTimeline runs={job.runs} />
    </div>
  );
}

function RunTimeline({ runs = [] }) {
  const items = getArray(runs);

  if (!items.length) return <EmptyState label="No runs yet." />;

  return (
    <div className="grid gap-2">
      {items.map((run) => (
        <article className="rounded-lg border border-white/10 bg-black/20 p-3" key={run.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#f1c36f]">
                {run.stage}
              </p>
              <p className="mt-1 text-sm font-bold text-white">{run.status}</p>
            </div>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black text-zinc-300">
              {run.exitCode ?? "-"}
            </span>
          </div>
          <ChangedFiles files={run.changedFiles} />
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-5 text-zinc-400">
            {run.safeSummary || "No safe summary."}
          </pre>
        </article>
      ))}
    </div>
  );
}

function JobHistory({ jobs, onSelect }) {
  if (!jobs.length) return <EmptyState label="Job history is empty." />;

  return (
    <div className="grid gap-2">
      {jobs.map((job) => (
        <button
          className="rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#d9ad57]/30"
          key={job.id}
          onClick={() => onSelect(job.id)}
          type="button">
          <p className="truncate text-sm font-black text-white">{job.title}</p>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
            <span>{job.status}</span>
            <span>{formatDate(job.createdAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function ChangedFiles({ files = [] }) {
  const visibleFiles = getArray(files).slice(0, 12);

  if (!visibleFiles.length) {
    return (
      <p className="mt-2 text-xs font-bold text-zinc-500">
        No changed files reported.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {visibleFiles.map((file) => (
        <span
          className="rounded-md border border-[#d9ad57]/20 bg-[#d9ad57]/10 px-2 py-1 text-[10px] font-black text-[#f1c36f]"
          key={file}>
          {file}
        </span>
      ))}
    </div>
  );
}

function DiffSummary({ diffSummary }) {
  if (!diffSummary) return <EmptyState label="Open a safe diff summary." />;

  return (
    <div className="grid gap-3">
      <ChangedFiles files={diffSummary.changedFiles} />
      {diffSummary.diffCheckExitCode === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
          <CheckCircle2 size={14} />
          git diff --check passed
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-[#7d1f2f]/30 bg-[#7d1f2f]/10 px-3 py-2 text-xs font-bold text-rose-100">
          <AlertTriangle size={14} />
          git diff --check needs review
        </div>
      )}
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-5 text-zinc-400">
        {diffSummary.safeSummary || "No diff summary."}
      </pre>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-bold text-zinc-500">
      {label}
    </div>
  );
}
