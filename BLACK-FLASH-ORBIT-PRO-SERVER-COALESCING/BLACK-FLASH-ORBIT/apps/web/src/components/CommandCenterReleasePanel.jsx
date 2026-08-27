import {
  Activity,
  CheckCircle2,
  FileText,
  GitBranch,
  Rocket,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { ORBIT_RELEASE_METADATA } from "../config/releaseMetadata.js";

function normalizeStatus(value, fallback = "not reported") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function buildProjectHealthItems({
  dashboardData,
  isTelemetryConnected,
  isTelemetryLoading,
}) {
  const health = dashboardData?.health ?? {};
  const readiness = dashboardData?.readiness ?? {};
  const healthDependencies = health?.dependencies ?? {};
  const dependencies =
    readiness?.dependencies && typeof readiness.dependencies === "object"
      ? readiness.dependencies
      : healthDependencies;
  const runtimeStatus = isTelemetryLoading
    ? "Checking"
    : isTelemetryConnected
      ? normalizeStatus(health?.status, "connected")
      : "Unavailable";

  return [
    {
      label: "Runtime Health",
      value: runtimeStatus,
      detail: isTelemetryConnected
        ? `${normalizeStatus(health?.runtime, "node")} runtime telemetry`
        : "backend telemetry not connected",
      icon: Activity,
      tone: isTelemetryConnected ? "text-cyan-300" : "text-amber-200",
    },
    {
      label: "Supabase",
      value: normalizeStatus(dependencies?.supabase?.status),
      detail: "database and auth dependency",
      icon: ShieldCheck,
      tone:
        dependencies?.supabase?.status === "ready"
          ? "text-emerald-300"
          : "text-amber-200",
    },
    {
      label: "AI Provider",
      value: normalizeStatus(dependencies?.ai?.status),
      detail: dependencies?.ai?.provider
        ? `provider ${dependencies.ai.provider}`
        : "provider status not reported",
      icon: Rocket,
      tone:
        dependencies?.ai?.status === "ready"
          ? "text-emerald-300"
          : "text-amber-200",
    },
    {
      label: "Workflow Persistence",
      value: normalizeStatus(dependencies?.workflowPersistence?.status),
      detail: "workflow repository status",
      icon: FileText,
      tone:
        dependencies?.workflowPersistence?.status === "ready"
          ? "text-emerald-300"
          : "text-amber-200",
    },
  ];
}

function buildReadinessChecks(dashboardData, isTelemetryConnected) {
  const health = dashboardData?.health ?? {};
  const readiness = dashboardData?.readiness ?? {};
  const dependencies =
    readiness?.dependencies && typeof readiness.dependencies === "object"
      ? readiness.dependencies
      : health?.dependencies ?? {};
  const authValidated =
    dashboardData?.operationalIntelligence?.authSession?.authenticated === true;

  return [
    {
      label: "Backend telemetry connected",
      ready: Boolean(isTelemetryConnected),
    },
    {
      label: "Auth session validated",
      ready: authValidated,
    },
    {
      label: "Supabase dependency ready",
      ready: dependencies?.supabase?.status === "ready",
    },
    {
      label: "AI provider ready",
      ready: dependencies?.ai?.status === "ready",
    },
    {
      label: "Workflow persistence available",
      ready: dependencies?.workflowPersistence?.status === "ready",
    },
  ];
}

function buildModuleHealthItems(dashboardData, isTelemetryConnected) {
  const operational = dashboardData?.operationalIntelligence ?? {};
  const runtimeModules = Array.isArray(operational?.moduleHealth)
    ? operational.moduleHealth
    : [];
  const runtimeByName = new Map(
    runtimeModules.map((item) => [String(item?.module || "").toLowerCase(), item]),
  );
  const authValidated = operational?.authSession?.authenticated === true;
  const runtimeStatus = runtimeByName.get("runtime")?.status;
  const loggerStatus = runtimeByName.get("logger")?.status;
  const runtimeHealthy =
    isTelemetryConnected &&
    ["healthy", "ready"].includes(String(runtimeStatus || "").toLowerCase());

  return [
    {
      name: "Auth Layer",
      status: authValidated ? "Protected" : isTelemetryConnected ? "Pending" : "Unavailable",
      detail: authValidated
        ? "authenticated session validated by Supabase"
        : "authentication evidence not currently validated",
      source: "runtime evidence",
    },
    {
      name: "Newsroom Engine",
      status: runtimeHealthy ? "Available" : "Configured",
      detail: runtimeHealthy
        ? "runtime healthy; editorial routes remain configured"
        : "editorial routes are configured but not independently probed",
      source: runtimeHealthy ? "runtime + metadata" : "release metadata",
    },
    {
      name: "Web Builder",
      status: "Configured",
      detail: "preview, export, ZIP, and publish capabilities are release metadata",
      source: "release metadata",
    },
    {
      name: "Security Center",
      status:
        isTelemetryConnected && String(loggerStatus || "").toLowerCase() === "ready"
          ? "Monitored"
          : "Configured",
      detail:
        isTelemetryConnected && String(loggerStatus || "").toLowerCase() === "ready"
          ? "runtime logger and security telemetry are reporting"
          : "security controls are configured; runtime evidence is limited",
      source:
        isTelemetryConnected && String(loggerStatus || "").toLowerCase() === "ready"
          ? "runtime evidence"
          : "release metadata",
    },
  ];
}

const systemReport = [
  { label: "Mode", value: "Dark glass dashboard" },
  { label: "Routing", value: "Current routes preserved" },
  { label: "UI Scope", value: "Mobile-first responsive" },
  {
    label: "Release",
    value: `${ORBIT_RELEASE_METADATA.module} ${ORBIT_RELEASE_METADATA.releaseVersion}`,
  },
];

export function CommandCenterReleasePanel({
  dashboardData = null,
  isTelemetryConnected = false,
  isTelemetryLoading = false,
}) {
  const projectHealthItems = buildProjectHealthItems({
    dashboardData,
    isTelemetryConnected,
    isTelemetryLoading,
  });
  const readinessChecks = buildReadinessChecks(
    dashboardData,
    isTelemetryConnected,
  );
  const moduleHealthItems = buildModuleHealthItems(
    dashboardData,
    isTelemetryConnected,
  );
  return (
    <section
      className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]"
      id="system-report"
    >
      <article className="orbit-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="orbit-kicker">{ORBIT_RELEASE_METADATA.module}</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              {ORBIT_RELEASE_METADATA.releaseVersion} release status
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Dashboard ringkasan runtime, dependency readiness, dan metadata
              rilis untuk kontrol operasional yang cepat dibaca.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
            <Rocket className="h-5 w-5 text-cyan-300" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {projectHealthItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                    {item.label}
                  </p>
                  <Icon className={item.tone} size={18} />
                </div>
                <p className={`mt-3 text-lg font-black ${item.tone}`}>
                  {item.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
              Deployment Readiness
            </p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {readinessChecks.map((item) => (
              <div
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-200"
                key={item.label}>
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${
                    item.ready ? "text-emerald-300" : "text-zinc-600"
                  }`}
                />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
                  {item.ready ? "ready" : "pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="orbit-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="orbit-kicker">System Report</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              Runtime and module overview
            </h3>
          </div>
          <TerminalSquare className="text-cyan-300" size={26} />
        </div>

        <div className="mt-5 grid gap-3">
          {moduleHealthItems.map((item) => (
            <div
              className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
              key={item.name}>
              <div className="min-w-0">
                <p className="text-sm font-black text-white">{item.name}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {item.detail}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                  {item.source}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                {item.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
          {systemReport.map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
            System Note
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Runtime readiness uses backend evidence when available. Release,
            branch, and UI labels remain metadata and are not presented as live
            deployment verification.
          </p>
        </div>
      </article>
    </section>
  );
}
