import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, isAuthProviderUnavailableError } from "../services/api";

const POLL_INTERVAL_MS = 15000;

const dashboardStatusEndpoint = {
  key: "dashboardStatus",
  load: () => api.getDashboardStatus(),
  path: "/api/v1/dashboard/status",
  requiresDataObject: true,
};

const telemetryEndpoints = [
  {
    key: "health",
    load: () => api.getV1Health(),
    path: "/api/v1/health",
  },
  {
    key: "metrics",
    load: () => api.getMetrics(),
    path: "/api/v1/metrics",
  },
  {
    key: "projects",
    load: () => api.getProjects(),
    path: "/api/v1/projects",
  },
  {
    key: "security",
    load: () => api.getSecurity(),
    path: "/api/v1/security",
  },
  {
    key: "automation",
    load: () => api.getAutomation(),
    path: "/api/v1/automation",
  },
  {
    key: "activity",
    load: () => api.getActivity(),
    path: "/api/v1/activity",
  },
  {
    key: "system",
    load: () => api.getSystem(),
    path: "/api/v1/system",
  },
];

const fallbackActivity = [
  {
    type: "system",
    message: "Command Center siap menerima telemetry backend.",
    time: "Live",
  },
  {
    type: "ai",
    message:
      "ORBIT AI Workspace tetap tersambung ke auth dan chat persistence.",
    time: "Ready",
  },
];

function formatUptime(seconds) {
  const totalSeconds = Number(seconds || 0);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatBytes(value) {
  const bytes = Number(value || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function formatTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeAutomation(automation) {
  if (!automation || typeof automation !== "object") return [];

  return Object.entries(automation).map(([key, item]) => ({
    description: item?.description || "Automation module tersedia.",
    id: key,
    name: item?.name || key,
    status: item?.status || "READY",
  }));
}

function getResolvedData(result, fallback) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function isObjectData(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTelemetryEndpointFailure(result, endpoint) {
  if (result.status === "rejected") return true;
  if (endpoint.requiresDataObject) return !isObjectData(result.value?.data);

  return false;
}

function hasAuthProviderUnavailableFailure(results) {
  return results.some(
    (result) =>
      result.status === "rejected" &&
      isAuthProviderUnavailableError(result.reason),
  );
}

function hasDegradedTelemetry(results) {
  return results.some(
    (result) =>
      result.status === "fulfilled" &&
      (result.value?.degraded || result.value?.data?.metrics?.degraded),
  );
}

function getFailedTelemetryEndpoints(results, endpoints) {
  return results
    .map((result, index) =>
      isTelemetryEndpointFailure(result, endpoints[index])
        ? endpoints[index].path
        : null,
    )
    .filter(Boolean);
}

function getTelemetryWarning(
  failedEndpoints,
  { isDegradedTelemetry, isLimitedConnectivity },
) {
  if (isLimitedConnectivity) {
    return "Limited connectivity: auth provider temporarily unavailable. Data terakhir atau fallback tetap ditampilkan.";
  }

  if (isDegradedTelemetry) {
    return "Dashboard telemetry degraded. Data fallback tetap ditampilkan.";
  }

  if (failedEndpoints.length === 0) return "";

  return `${failedEndpoints.length} endpoint belum merespons. Data lain tetap ditampilkan.`;
}

function logTelemetryDebug(endpoints, results, failedEndpoints) {
  if (import.meta.env.VITE_ENABLE_API_DEBUG !== "true") return;

  console.log("Telemetry Endpoints", endpoints);
  console.log("Telemetry Results", results);
  console.log("Failed Endpoints", failedEndpoints);
}

function toDisplayString(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export function Dashboard() {
  const { user } = useAuth();
  const [telemetry, setTelemetry] = useState({
    activity: fallbackActivity,
    automation: {},
    health: null,
    metrics: null,
    projects: [],
    security: null,
    system: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [isDegradedTelemetry, setIsDegradedTelemetry] = useState(false);
  const [isLimitedConnectivity, setIsLimitedConnectivity] = useState(false);
  const [failedTelemetryEndpoints, setFailedTelemetryEndpoints] = useState([]);

  const loadTelemetry = useCallback(async () => {
    setIsLoading(true);

    const dashboardResults = await Promise.allSettled([
      dashboardStatusEndpoint.load(),
    ]);
    const [dashboardStatusResult] = dashboardResults;
    const isDashboardAuthUnavailable =
      hasAuthProviderUnavailableFailure(dashboardResults);

    if (isDashboardAuthUnavailable) {
      const failedEndpoints = [dashboardStatusEndpoint.path];

      logTelemetryDebug([dashboardStatusEndpoint], dashboardResults, failedEndpoints);
      setFailedTelemetryEndpoints(failedEndpoints);
      setIsDegradedTelemetry(false);
      setIsLimitedConnectivity(true);
      setLastUpdated(formatTime(new Date().toISOString()));
      setIsLoading(false);
      return;
    }

    const dashboardStatus =
      dashboardStatusResult.status === "fulfilled" &&
      isObjectData(dashboardStatusResult.value?.data)
        ? dashboardStatusResult.value
        : null;

    if (dashboardStatus) {
      setTelemetry((current) => ({
        activity: dashboardStatus.data.activity || current.activity,
        automation: dashboardStatus.data.automation || current.automation,
        health: dashboardStatus.data.health || current.health,
        metrics: dashboardStatus.data.metrics || current.metrics,
        projects: dashboardStatus.data.projects || current.projects,
        security: dashboardStatus.data.security || current.security,
        system: dashboardStatus.data.system || current.system,
      }));
      const failedEndpoints = getFailedTelemetryEndpoints(dashboardResults, [
        dashboardStatusEndpoint,
      ]);

      logTelemetryDebug([dashboardStatusEndpoint], dashboardResults, failedEndpoints);
      setFailedTelemetryEndpoints(failedEndpoints);
      setIsDegradedTelemetry(hasDegradedTelemetry(dashboardResults));
      setIsLimitedConnectivity(false);
    } else {
      const telemetryResults = await Promise.allSettled(
        telemetryEndpoints.map((endpoint) => endpoint.load()),
      );
      const results = [...dashboardResults, ...telemetryResults];
      const endpoints = [dashboardStatusEndpoint, ...telemetryEndpoints];
      const failedEndpoints = getFailedTelemetryEndpoints(results, endpoints);

      setTelemetry((current) => ({
        activity: getResolvedData(telemetryResults[5], current.activity),
        automation: getResolvedData(telemetryResults[4], current.automation),
        health: getResolvedData(telemetryResults[0], current.health),
        metrics: getResolvedData(telemetryResults[1], current.metrics),
        projects: getResolvedData(telemetryResults[2], current.projects),
        security: getResolvedData(telemetryResults[3], current.security),
        system: getResolvedData(telemetryResults[6], current.system),
      }));
      logTelemetryDebug(endpoints, results, failedEndpoints);
      setFailedTelemetryEndpoints(failedEndpoints);
      setIsDegradedTelemetry(hasDegradedTelemetry(results));
      setIsLimitedConnectivity(hasAuthProviderUnavailableFailure(results));
    }

    setLastUpdated(formatTime(new Date().toISOString()));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTelemetry();
    const intervalId = window.setInterval(loadTelemetry, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadTelemetry]);

  const automationItems = useMemo(
    () => normalizeAutomation(telemetry.automation),
    [telemetry.automation],
  );

  const projects = Array.isArray(telemetry.projects) ? telemetry.projects : [];
  const activity = Array.isArray(telemetry.activity)
    ? telemetry.activity
    : fallbackActivity;
  const healthStatus = telemetry.health?.status || "checking";
  const backendOnline = ["healthy", "online", "ready"].includes(healthStatus);
  const uptime = formatUptime(
    telemetry.health?.uptime || telemetry.metrics?.uptime,
  );
  const memoryUsed = formatBytes(telemetry.metrics?.memory?.heapUsed);
  const memoryRss = formatBytes(telemetry.metrics?.memory?.rss);
  const securityScore = telemetry.security?.securityScore || 0;
  const telemetryWarning = getTelemetryWarning(failedTelemetryEndpoints, {
    isDegradedTelemetry,
    isLimitedConnectivity,
  });

  return (
    <div className="orbit-command mx-auto grid max-w-7xl gap-5">
      {" "}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {" "}
        <div className="orbit-hero-card">
          {" "}
          <div className="min-w-0">
            {" "}
            <p className="orbit-eyebrow">BLACK FLASH ORBIT</p>{" "}
            <h2 className="mt-3 text-4xl font-black leading-none text-white sm:text-5xl lg:text-6xl">
              Realtime Command Center{" "}
            </h2>{" "}
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400 sm:text-base">
              Dashboard operasi untuk AI newsroom, monitoring backend, security,
              OSINT, automation, dan project intelligence.{" "}
            </p>{" "}
            <div className="mt-6 flex flex-wrap gap-2">
              {" "}
              <Link className="orbit-primary-button" to="/ai-workspace">
                {" "}
                <Bot size={17} />
                ORBIT AI{" "}
              </Link>{" "}
              <button
                className="orbit-secondary-button"
                disabled={isLoading}
                onClick={loadTelemetry}
                type="button">
                <RefreshCw
                  className={isLoading ? "animate-spin" : ""}
                  size={17}
                />
                Refresh Telemetry{" "}
              </button>{" "}
            </div>{" "}
            {telemetryWarning && (
              <div className="mt-4 flex gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                <span>{telemetryWarning}</span>
              </div>
            )}
          </div>
          <div className="orbit-live-core">
            <span
              className={backendOnline ? "orbit-pulse online" : "orbit-pulse"}
            />
            <strong>{backendOnline ? "LIVE" : "SYNC"}</strong>
            <span>{telemetry.health?.service || "BLACK FLASH ORBIT API"}</span>
          </div>
        </div>
        <aside className="orbit-status-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">SESSION</p>
              <h3 className="mt-2 text-xl font-black text-white">
                {user?.email || "Authenticated User"}
              </h3>
            </div>
            <RadioTower className="text-amber-300" size={24} />
          </div>
          <div className="mt-5 grid gap-3">
            <StatusLine
              label="API Version"
              value={telemetry.system?.apiVersion || "v1"}
            />
            <StatusLine
              label="Environment"
              value={telemetry.system?.environment || "-"}
            />
            <StatusLine label="Last Refresh" value={lastUpdated || "loading"} />
            <StatusLine
              label="Poll Rate"
              value={`${POLL_INTERVAL_MS / 1000}s`}
            />
          </div>
        </aside>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          icon={Activity}
          label="System Health"
          tone={backendOnline ? "green" : "gold"}
          value={healthStatus}
          meta={`${uptime} uptime`}
        />
        <SignalCard
          icon={Database}
          label="Metrics"
          tone="gold"
          value={`${telemetry.metrics?.reports || 0} reports`}
          meta={`${memoryUsed} heap`}
        />
        <SignalCard
          icon={ShieldCheck}
          label="Security"
          tone={securityScore >= 90 ? "green" : "maroon"}
          value={`${securityScore}%`}
          meta={telemetry.security?.rateLimit || "rate limit active"}
        />
        <SignalCard
          icon={Workflow}
          label="Automation"
          tone="red"
          value={`${automationItems.length} engines`}
          meta={telemetry.automation?.deployEngine?.status || "pipeline ready"}
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Widget title="System Health" eyebrow="/api/v1/health" icon={Activity}>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricBox label="Status" value={healthStatus} />
            <MetricBox label="Uptime" value={uptime} />
            <MetricBox
              label="Timestamp"
              value={formatTime(telemetry.health?.timestamp)}
            />
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-stone-400">
            Service:{" "}
            <span className="font-bold text-stone-100">
              {telemetry.health?.service || "BLACK FLASH ORBIT API"}
            </span>
          </div>
        </Widget>

        <Widget title="Metrics" eyebrow="/api/v1/metrics" icon={Cpu}>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricBox
              label="Projects"
              value={telemetry.metrics?.projects || 0}
            />
            <MetricBox
              label="Reports"
              value={telemetry.metrics?.reports || 0}
            />
            <MetricBox label="Heap Used" value={memoryUsed} />
            <MetricBox label="RSS Memory" value={memoryRss} />
          </div>
        </Widget>
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Widget title="Projects" eyebrow="/api/v1/projects" icon={HardDrive}>
          <div className="grid gap-3">
            {projects.map((project) => (
              <article className="orbit-list-row" key={project.name}>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-black text-white">
                    {project.name}
                  </h4>
                  <p className="mt-1 text-xs uppercase text-stone-500">
                    {toDisplayString(project.type)} -{" "}
                    {toDisplayString(project.lastScan)}
                  </p>
                </div>
                <div className="text-right">
                  <strong className="text-lg text-amber-200">
                    {project.score}
                  </strong>
                  <span className="block text-xs text-stone-500">
                    {project.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </Widget>

        <Widget
          title="Security Center"
          eyebrow="/api/v1/security"
          icon={ShieldCheck}>
          <div className="grid gap-3">
            <MetricBox
              label="Helmet"
              value={telemetry.security?.helmet || "-"}
            />
            <MetricBox label="CORS" value={telemetry.security?.cors || "-"} />
            <MetricBox
              label="Last Audit"
              value={telemetry.security?.lastAudit || "-"}
            />
          </div>
          <div className="mt-4 grid gap-2">
            {(telemetry.security?.issues || []).map((issue) => (
              <article
                className="rounded-lg border border-white/10 bg-black/20 p-3"
                key={issue.id}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-white">{issue.id}</strong>
                  <span className="rounded-md border border-red-200/20 bg-red-500/10 px-2 py-1 text-xs font-bold uppercase text-red-200">
                    {issue.severity}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-400">
                  {issue.message}
                </p>
              </article>
            ))}
          </div>
        </Widget>
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Widget
          title="Automation Hub"
          eyebrow="/api/v1/automation"
          icon={Workflow}>
          <div className="grid gap-3 sm:grid-cols-2">
            {automationItems.map((item) => (
              <article className="orbit-list-row items-start" key={item.id}>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-white">{item.name}</h4>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    {item.description}
                  </p>
                </div>
                <span className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-black text-amber-100">
                  {item.status}
                </span>
              </article>
            ))}
          </div>
        </Widget>

        <Widget title="Live Activity" eyebrow="/api/v1/activity" icon={Zap}>
          <div className="grid gap-3">
            {activity.map((item, index) => (
              <article
                className="flex gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                key={`${item.message}-${index}`}>
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.75)]" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {toDisplayString(item.message, "Activity")}
                  </h4>
                  <p className="mt-1 text-xs uppercase text-stone-500">
                    {toDisplayString(item.type, "system")} -{" "}
                    {toDisplayString(item.time, "Live")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Widget>
      </section>
      <section className="orbit-brief-card">
        <Sparkles className="text-amber-300" size={21} />
        <div>
          <p className="orbit-eyebrow">NEXT MODULES</p>
          <h3 className="mt-2 text-xl font-black text-white">
            AI newsroom pipeline tetap siap dikembangkan.
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-400">
            Auth, chat sessions, prompt library, backup center, dan Supabase
            persistence tetap dipertahankan di route existing.
          </p>
        </div>
      </section>
    </div>
  );
}

function Widget({ children, eyebrow, icon: Icon, title }) {
  return (
    <article className="orbit-widget">
      {" "}
      <div className="mb-5 flex items-start justify-between gap-3">
        {" "}
        <div>
          {" "}
          <p className="orbit-eyebrow">{eyebrow}</p>{" "}
          <h3 className="mt-2 text-xl font-black text-white">{title}</h3>{" "}
        </div>{" "}
        <span className="grid size-10 place-items-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-200">
          {" "}
          <Icon size={19} />{" "}
        </span>{" "}
      </div>
      {children}{" "}
    </article>
  );
}

function SignalCard({ icon: Icon, label, meta, tone, value }) {
  return (
    <article className={`orbit-signal-card tone-${tone}`}>
      {" "}
      <div className="flex items-center justify-between gap-3">
        {" "}
        <span className="grid size-10 place-items-center rounded-lg border border-current/30 bg-white/5">
          {" "}
          <Icon size={18} />{" "}
        </span>{" "}
        <span className="orbit-live-dot" />{" "}
      </div>{" "}
      <p className="mt-5 text-xs font-bold uppercase text-stone-500">{label}</p>{" "}
      <strong className="mt-2 block text-2xl font-black capitalize text-white">
        {toDisplayString(value)}{" "}
      </strong>{" "}
      <span className="mt-2 block text-sm text-stone-500">
        {toDisplayString(meta)}{" "}
      </span>{" "}
    </article>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      {" "}
      <span className="text-xs font-bold uppercase text-stone-500">
        {label}
      </span>{" "}
      <strong className="mt-2 block text-lg font-black capitalize text-stone-100">
        {toDisplayString(value)}{" "}
      </strong>{" "}
    </div>
  );
}

function StatusLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      {" "}
      <span className="text-xs uppercase text-stone-500">{label}</span>{" "}
      <strong className="truncate text-right text-sm text-stone-100">
        {toDisplayString(value)}{" "}
      </strong>{" "}
    </div>
  );
}
