import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { UserMenu } from "./components/auth/UserMenu.jsx";
import { useProfile } from "./hooks/useProfile.js";
import { useAuth } from "./context/AuthContext.jsx";
import {
  Archive,
  Bell,
  Bot,
  BrainCircuit,
  CheckCircle2,
  FileText,
  GitBranch,
  Gauge,
  Image,
  Globe2,
  Lock,
  Layers3,
  Mic2,
  LayoutDashboard,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Workflow,
  UploadCloud,
  Zap,
} from "lucide-react";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./components/auth/ProtectedRoute.jsx";
import { CommandCenterHero } from "./components/CommandCenterHero.jsx";
import { CommandCenterActivityPanel } from "./components/CommandCenterActivityPanel.jsx";
import { CommandCenterMetricGrid } from "./components/CommandCenterMetricGrid.jsx";
import { CommandCenterOperationsPanel } from "./components/CommandCenterOperationsPanel.jsx";
import { CommandCenterReleasePanel } from "./components/CommandCenterReleasePanel.jsx";
import { CommandCenterSecurityPanel } from "./components/CommandCenterSecurityPanel.jsx";
import { CommandCenterSidebar } from "./components/CommandCenterSidebar.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";
import { api, isAuthProviderUnavailableError } from "./services/api.js";
import { getSharedDashboardStatus } from "./services/dashboardStatus.js";
import {
  getObjectValues,
  resolveCommandCenterTelemetryState,
} from "./services/dashboardTelemetryState.mjs";
import { ORBIT_RELEASE_STATE } from "./config/releaseMetadata.js";


const AINewsroom = lazy(() =>
  import("./pages/AINewsroom.jsx").then((module) => ({
    default: module.AINewsroom,
  })),
);

const AIWorkspace = lazy(() =>
  import("./pages/AIWorkspace.jsx").then((module) => ({
    default: module.AIWorkspace,
  })),
);

const KnowledgeBase = lazy(() =>
  import("./pages/KnowledgeBase.jsx").then((module) => ({
    default: module.KnowledgeBase,
  })),
);

const WorkflowAutomation = lazy(() =>
  import("./pages/WorkflowAutomation.jsx").then((module) => ({
    default: module.WorkflowAutomation,
  })),
);

const Intelligence = lazy(() =>
  import("./pages/Intelligence.jsx").then((module) => ({
    default: module.Intelligence,
  })),
);

const AgentBridge = lazy(() =>
  import("./pages/AgentBridge.jsx").then((module) => ({
    default: module.AgentBridge,
  })),
);

const WebBuilder = lazy(() =>
  import("./pages/WebBuilder.jsx").then((module) => ({
    default: module.WebBuilder,
  })),
);

const Login = lazy(() =>
  import("./pages/Login.jsx").then((module) => ({
    default: module.Login,
  })),
);

const Register = lazy(() =>
  import("./pages/Register.jsx").then((module) => ({
    default: module.Register,
  })),
);

const adminRoles = new Set(["admin", "owner", "super_admin"]);

const releaseState = ORBIT_RELEASE_STATE;

const commandStats = [
  {
    label: "Workflow Events",
    value: "—",
    detail: "awaiting telemetry",
    icon: Workflow,
  },
  {
    label: "Projects",
    value: "—",
    detail: "awaiting telemetry",
    icon: Layers3,
  },
  {
    label: "Activity Signals",
    value: "—",
    detail: "awaiting telemetry",
    icon: Radio,
  },
  {
    label: "Ops Health",
    value: "—",
    detail: "awaiting telemetry",
    icon: Gauge,
  },
];

const newsroomFlow = [
  {
    title: "Capture",
    body: "Audio lapangan, foto, catatan, dan metadata lokasi masuk ke intake desk.",
    icon: UploadCloud,
    progress: "Configured",
  },
  {
    title: "Transcribe",
    body: "Speech-to-text diproses untuk membuat kutipan, ringkasan, dan kronologi.",
    icon: Radio,
    progress: "Configured",
  },
  {
    title: "Compose",
    body: "AI newsroom menyusun lead, isi berita, kutipan, dan penutup jurnalistik.",
    icon: Bot,
    progress: "Configured",
  },
  {
    title: "Archive",
    body: "Draft, sumber, PDF, dan riwayat editorial diamankan ke arsip terstruktur.",
    icon: Archive,
    progress: "Configured",
  },
];

const aiModules = [
  { name: "News Generator", icon: FileText, state: "configured" },
  { name: "Audio Transcript", icon: Mic2, state: "configured" },
  { name: "Image Prompt Studio", icon: Sparkles, state: "configured" },
  { name: "Admin Control", icon: ShieldCheck, state: "configured" },
];

const liveBriefs = [
  {
    desk: "Telemetry",
    title: "Waiting for live editorial activity.",
    time: "offline",
  },
];

const securitySignals = [
  { label: "Session Role", value: "not reported", icon: Lock },
  { label: "Supabase Data Layer", value: "not reported", icon: Zap },
  { label: "Runtime Audit", value: "not reported", icon: CheckCircle2 },
];

function isAdminRole(role) {
  return adminRoles.has(String(role || "").toLowerCase());
}

function formatMetric(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: value % 1 === 0 ? 0 : 1,
    }).format(value);
  }

  return String(value);
}

function formatUptime(seconds, fallback = "live") {
  if (!Number.isFinite(seconds)) return fallback;

  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;

  return `${Math.max(0, Math.floor(seconds))}s`;
}

function formatTime(value, fallback) {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jayapura",
  });
}



function formatTelemetrySource(value, fallback = "Unknown source") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const labels = {
    backend: "Backend",
    stored_metadata: "Stored metadata",
    stored_measurement: "Stored measurement",
    supabase_record: "Supabase record",
  };

  if (labels[normalized]) return labels[normalized];
  if (!normalized) return fallback;

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
function formatActivityTime(value, fallback = "timestamp unavailable") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Jayapura",
  });
}

function CommandCenterDashboard({ onOpenCommandPalette }) {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [isTelemetryLoading, setIsTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState("");
  const { profile } = useProfile();
  const { user } = useAuth();

  const userRole = profile?.role || "user";
  const canAccessSecurity = isAdminRole(userRole);

  useEffect(() => {
    let isActive = true;

    async function loadDashboardTelemetry() {
      setIsTelemetryLoading(true);
      setTelemetryError("");

      try {
        // Use the shared API client so dashboard fallbacks and auth handling
        // stay aligned with the rest of the app.
        const payload = await getSharedDashboardStatus(user?.id);

        if (!isActive) return;
        setDashboardData(payload?.data ?? null);
        setTelemetryError(
          payload?.degraded
            ? payload?.message || "Dashboard telemetry degraded."
            : "",
        );
      } catch (error) {
        if (!isActive) return;

        if (isAuthProviderUnavailableError(error)) {
          setTelemetryError(
            error?.message ||
              "Limited connectivity: auth provider temporarily unavailable.",
          );
          setDashboardData(null);
          return;
        }

        setTelemetryError(error?.message || "Telemetry unavailable");
        setDashboardData(null);
      } finally {
        if (isActive) {
          setIsTelemetryLoading(false);
        }
      }
    }

    loadDashboardTelemetry();

    return () => {
      isActive = false;
    };
  }, [user?.id]);

  const {
    hasActivity,
    hasAutomation,
    hasProjects,
    isTelemetryConnected,
    isUsingFallback,
    telemetryStatusText,
  } = resolveCommandCenterTelemetryState({
    dashboardData,
    isTelemetryLoading,
    telemetryError,
  });

  const telemetryLabels = [
    {
      label: "Auth Session",
      value:
        dashboardData?.operationalIntelligence?.authSession?.session ||
        "not reported",
    },
    {
      label: "Runtime",
      value: dashboardData?.system?.runtime || "not reported",
    },
    {
      label: "Health Module",
      value: dashboardData?.health?.module || "not reported",
    },
    {
      label: "Metrics Timestamp",
      value: dashboardData?.metrics?.timestamp
        ? formatTime(dashboardData.metrics.timestamp, "not reported")
        : "not reported",
    },
    {
      label: "Provider Latency",
      value: Number.isFinite(
        dashboardData?.operationalIntelligence?.aiChat
          ?.averageProviderLatencyMs,
      )
        ? `${dashboardData.operationalIntelligence.aiChat.averageProviderLatencyMs}ms`
        : "no samples",
    },
    {
      label: "Deploy",
      value:
        dashboardData?.operationalIntelligence?.deployment?.branch ||
        "not reported",
    },
    {
      label: "Workflow Persistence",
      value:
        dashboardData?.readiness?.dependencies?.workflowPersistence?.status ||
        dashboardData?.health?.dependencies?.workflowPersistence?.status ||
        "not reported",
    },
  ];

  const {
    automationItems,
    dashboardStats,
    healthStatus,
    liveBriefItems,
    projectFlow,
    securityItems,
    uptimeLabel,
  } = useMemo(() => {
    const metrics = dashboardData?.metrics ?? {};
    const health = dashboardData?.health ?? {};
    const projects = Array.isArray(dashboardData?.projects)
      ? dashboardData.projects
      : [];
    const security = dashboardData?.security ?? {};
    const operational = dashboardData?.operationalIntelligence ?? {};
    const aiChat = operational?.aiChat ?? {};
    const runtimeErrors = Array.isArray(operational?.recentRuntimeErrors)
      ? operational.recentRuntimeErrors
      : [];
    const workflow = operational?.workflow ?? {};
    const activity = Array.isArray(dashboardData?.activity)
      ? dashboardData.activity
      : [];
    const automation = getObjectValues(dashboardData?.automation);
    const projectCount = metrics?.projects ?? projects.length;
    const reportCount = metrics?.reports;
    const uptime = metrics?.uptime ?? health?.uptime;
    const computedUptime = formatUptime(uptime, commandStats[3].value);
    const computedHealth = health?.status || commandStats[3].value;

    return {
      automationItems: automation,
      dashboardStats: [
        {
          ...commandStats[0],
          value: formatMetric(
            workflow.total ?? aiChat.total ?? reportCount,
            commandStats[0].value,
          ),
          detail:
            workflow.total !== null && workflow.total !== undefined
              ? "workflow events observed"
              : aiChat.total !== null && aiChat.total !== undefined
                ? "AI chat events observed"
                : reportCount === null || reportCount === undefined
                  ? commandStats[0].detail
                  : "report records tracked",
        },
        {
          ...commandStats[1],
          value: formatMetric(projectCount, commandStats[1].value),
          detail:
            projectCount === null || projectCount === undefined
              ? commandStats[1].detail
              : "projects synced",
        },
        {
          ...commandStats[2],
          value: formatMetric(activity.length || null, commandStats[2].value),
          detail: activity.length ? "activity signals" : commandStats[2].detail,
        },
        {
          ...commandStats[3],
          value: formatMetric(computedHealth, commandStats[3].value),
          detail: `uptime ${computedUptime}`,
        },
      ],
      healthStatus: computedHealth,
      liveBriefItems: hasActivity
        ? activity.slice(0, 3).map((item, index) => ({
            desk: `${item?.type || "system"} desk`,
            title:
              item?.message || liveBriefs[index]?.title || "Telemetry event",
            time: formatActivityTime(
              item?.time,
              liveBriefs[index]?.time || "Timestamp unavailable",
            ),
            rawTime: item?.time || "",
            source:
              item?.telemetrySource ||
              dashboardData?.provenance?.activity ||
              "unknown",
          }))
        : isTelemetryConnected
          ? [
              {
                desk: "Telemetry",
                title: "No activity records reported by the connected provider.",
                time: "no records",
                source: dashboardData?.provenance?.activity || "backend",
              },
            ]
          : liveBriefs,
      projectFlow: hasProjects
        ? projects.slice(0, 4).map((project, index) => {
            const hasMeasuredScore = Number.isFinite(project?.score);
            const hasRecordedSignal = Boolean(project?.lastScan);
            const status = project?.status || "CONFIGURED";
            const projectSource =
              project?.telemetrySource ||
              dashboardData?.provenance?.projects ||
              "unknown";
            const readableProjectSource = formatTelemetrySource(projectSource);
            const recordedAt = hasRecordedSignal
              ? formatActivityTime(project.lastScan, "")
              : "";
            return {
              title:
                project?.name || newsroomFlow[index]?.title || "ORBIT Module",
              body: `${project?.type || "workspace"} • ${status}`,
              icon: newsroomFlow[index]?.icon || Archive,
              progress:
                hasMeasuredScore && hasRecordedSignal
                  ? `${formatMetric(project.score, "0")}% recorded`
                  : status,
              provenance: readableProjectSource,
              recordedAt:
                recordedAt ||
                (hasRecordedSignal ? "Timestamp unavailable" : "Metadata only"),
            };
          })
        : isTelemetryConnected
          ? [
              {
                title: "No synced projects yet.",
                body: "Backend telemetry connected. Project records belum tersedia.",
                icon: Archive,
                progress: "—",
              },
            ]
          : newsroomFlow,
      securityItems: [
        {
          ...securitySignals[0],
          value:
            operational?.authSession?.authenticated === true
              ? `${userRole} • validated`
              : `${userRole} • not validated`,
        },
        {
          ...securitySignals[1],
          value:
            health?.dependencies?.supabase?.status ||
            securitySignals[1].value,
        },
        {
          ...securitySignals[2],
          value:
            runtimeErrors.length > 0
              ? `${runtimeErrors.length} recent error(s)`
              : security?.issues?.length
                ? `${security.issues.length} issue(s)`
                : "no runtime issues reported",
        },
      ],
      uptimeLabel: computedUptime,
    };
  }, [
    dashboardData,
    hasActivity,
    hasProjects,
    isTelemetryConnected,
    userRole,
  ]);

  const moduleItems = useMemo(() => {
    const moduleHealth = Array.isArray(
      dashboardData?.operationalIntelligence?.moduleHealth,
    )
      ? dashboardData.operationalIntelligence.moduleHealth
      : [];

    if (moduleHealth.length) {
      return moduleHealth.slice(0, 4).map((module, index) => ({
        name: module?.module || aiModules[index]?.name || "Runtime Module",
        icon: aiModules[index]?.icon || Bot,
        state: module?.status || aiModules[index]?.state || "Ready",
      }));
    }

    if (!automationItems.length) return aiModules;

    return automationItems.slice(0, 4).map((engine, index) => ({
      name: engine?.name || aiModules[index]?.name || "Automation Engine",
      icon: aiModules[index]?.icon || Bot,
      state: engine?.status || aiModules[index]?.state || "Ready",
    }));
  }, [automationItems, dashboardData?.operationalIntelligence?.moduleHealth]);

  const displayedModuleItems = useMemo(() => {
    if (hasAutomation) return moduleItems;

    return moduleItems.map((module) => ({
      ...module,
      state: isTelemetryConnected ? "configured metadata" : module.state,
    }));
  }, [hasAutomation, isTelemetryConnected, moduleItems]);

  return (
    <main className="min-h-screen bg-[#050506] text-zinc-100">
      <div className="orbit-shell">
        <CommandCenterSidebar releaseState={releaseState} userRole={userRole} />

        <section className="min-w-0 flex-1">
          <header className="orbit-topbar">
            <div>
              <p className="orbit-kicker">Command Center</p>
              <h2 className="text-xl font-black text-white md:text-2xl">
                Newsroom Intelligence Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                aria-label="Open command palette"
                className="orbit-icon-button"
                onClick={onOpenCommandPalette}
                type="button">
                <Search size={18} />
              </button>

              <button aria-label="Notifications" className="orbit-icon-button">
                <Bell size={18} />
              </button>

              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="grid gap-4">
              <CommandCenterHero
                healthStatus={formatMetric(healthStatus, "No Signal")}
                isTelemetryLoading={isTelemetryLoading}
                isUsingFallback={isUsingFallback}
                releaseState={releaseState}
                telemetryError={telemetryError}
                telemetryLabels={telemetryLabels}
                telemetryStatusText={telemetryStatusText}
                uptimeLabel={uptimeLabel}
                onStartEditorialPulse={() => navigate("/ai-newsroom")}
                onViewSystemReport={() =>
                  document
                    .getElementById("system-report")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              />

              <CommandCenterMetricGrid dashboardStats={dashboardStats} />
              <CommandCenterReleasePanel
                dashboardData={dashboardData}
                isTelemetryConnected={isTelemetryConnected}
                isTelemetryLoading={isTelemetryLoading}
              />

              <CommandCenterOperationsPanel
                displayedModuleItems={displayedModuleItems}
                projectFlow={projectFlow}
              />
            </section>

            <aside className="grid gap-4">
              <CommandCenterActivityPanel
                liveBriefItems={liveBriefItems}
                securityItems={securityItems}
                userRole={userRole}
              />

              {canAccessSecurity && (
                <CommandCenterSecurityPanel
                  securityItems={securityItems}
                  healthStatus={formatMetric(healthStatus, "READY")}
                />
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}


function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050506] px-4 text-zinc-100">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-white"
        />
        <p className="mt-3 text-sm font-medium text-zinc-300">
          Loading ORBIT module...
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Menyiapkan workspace yang Anda buka.
        </p>
      </div>
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const commands = useMemo(
    () => [
      {
        id: "slash-build",
        label: "/build",
        description: "Mock build check for the current release workspace.",
        icon: LayoutDashboard,
        keywords: ["build", "release", "workspace", "command"],
        kind: "slash",
        closeOnExecute: false,
        mockResult: "Mock build completed. No deployment was triggered.",
      },
      {
        id: "slash-scan",
        label: "/scan",
        description: "Mock scan for runtime and module health.",
        icon: Search,
        keywords: ["scan", "health", "runtime", "audit"],
        kind: "slash",
        closeOnExecute: false,
        mockResult: "Mock scan completed. Runtime checks returned healthy.",
      },
      {
        id: "slash-security",
        label: "/security",
        description: "Mock security review summary for the dashboard.",
        icon: ShieldCheck,
        keywords: ["security", "audit", "policy", "protection"],
        kind: "slash",
        closeOnExecute: false,
        mockResult:
          "Mock security summary prepared. No live changes were made.",
      },
      {
        id: "slash-report",
        label: "/report",
        description: "Mock project health report for the command center.",
        icon: FileText,
        keywords: ["report", "system", "summary", "status"],
        kind: "slash",
        closeOnExecute: false,
        mockResult:
          "Mock report generated. Dashboard telemetry remains unchanged.",
      },
      {
        id: "slash-release",
        label: "/release",
        description: "Mock release snapshot for the active branch.",
        icon: Archive,
        keywords: ["release", "branch", "snapshot", "version"],
        kind: "slash",
        closeOnExecute: false,
        mockResult: "Mock release snapshot saved. No repository state changed.",
      },
      {
        id: "slash-health",
        label: "/health",
        description: "Mock health summary for runtime and modules.",
        icon: Gauge,
        keywords: ["health", "runtime", "monitor", "status"],
        kind: "slash",
        closeOnExecute: false,
        mockResult: "Mock health check passed. All indicators are read-only.",
      },
      {
        id: "go-command-center",
        label: "Go to Command Center",
        description: "Open the main BLACK FLASH ORBIT dashboard.",
        icon: LayoutDashboard,
        keywords: ["dashboard", "home", "command center", "main"],
        to: "/",
      },
      {
        id: "open-ai-newsroom",
        label: "Open AI Newsroom",
        description: "Jump into newsroom drafting and editorial tools.",
        icon: Bot,
        keywords: ["newsroom", "editorial", "ai", "draft"],
        to: "/ai-newsroom",
      },
      {
        id: "open-web-builder",
        label: "Open Web Builder",
        description: "Build protected newsroom web projects.",
        icon: Globe2,
        keywords: ["web", "builder", "site", "pages"],
        to: "/web-builder",
      },
      {
        id: "open-knowledge-base",
        label: "Open Knowledge Base",
        description: "Open the protected newsroom knowledge dashboard.",
        icon: BrainCircuit,
        keywords: ["knowledge", "rag", "document", "source", "citation"],
        to: "/knowledge-base",
      },
      {
        id: "ai-knowledge-copilot",
        label: "AI Knowledge Copilot",
        description: "Open the source-aware Knowledge RAG copilot panel.",
        icon: BrainCircuit,
        keywords: ["knowledge", "copilot", "rag", "ai", "context"],
        to: "/knowledge-base#copilot",
      },
      {
        id: "search-knowledge",
        label: "Search Knowledge",
        description: "Jump to knowledge semantic search.",
        icon: Search,
        keywords: ["knowledge", "search", "documents", "sources"],
        to: "/knowledge-base#knowledge-search",
      },
      {
        id: "open-knowledge-favorites",
        label: "Open Favorites",
        description: "Jump to pinned knowledge source cards.",
        icon: Star,
        keywords: ["knowledge", "favorites", "pinned", "sources"],
        to: "/knowledge-base#knowledge-favorites",
      },
      {
        id: "view-rag-context",
        label: "View RAG Context",
        description: "Jump to the retrieved context preview.",
        icon: Layers3,
        keywords: ["knowledge", "rag", "context", "retrieval"],
        to: "/knowledge-base#knowledge-rag-preview",
      },
      {
        id: "open-intelligence",
        label: "Open Intelligence",
        description: "Open entity, claim, timeline, and source evidence search.",
        icon: BrainCircuit,
        keywords: ["intelligence", "entities", "claims", "timeline", "search"],
        to: "/intelligence",
      },
      {
        id: "open-agent-bridge",
        label: "Open Agent Bridge",
        description: "Open local repository diagnostics and repair controls.",
        icon: GitBranch,
        keywords: ["agent", "bridge", "codex", "diagnostics", "repair"],
        to: "/agent-bridge",
      },
      {
        id: "open-workflow-automation",
        label: "Open Workflow Automation",
        description: "Open the automation dashboard.",
        icon: Workflow,
        keywords: ["workflow", "automation", "pipeline", "scheduler"],
        to: "/workflow-automation",
      },
      {
        id: "open-media-intel",
        label: "Open Media Intel",
        description: "Open the media intelligence workspace.",
        icon: Sparkles,
        keywords: ["media", "intel", "intelligence"],
        to: "/media-intel",
      },
      {
        id: "open-archive",
        label: "Open Archive",
        description: "Open the archive and history workspace.",
        icon: Archive,
        keywords: ["archive", "history", "records"],
        to: "/archive",
      },
      {
        id: "start-editorial-pulse",
        label: "Start Editorial Pulse",
        description: "Jump into the newsroom production flow.",
        icon: FileText,
        keywords: ["editorial", "pulse", "newsroom", "start"],
        to: "/ai-newsroom",
        hotkey: "action",
      },
      {
        id: "view-system-report",
        label: "View System Report",
        description: "Return to the system command view.",
        icon: Gauge,
        keywords: ["system", "report", "status", "dashboard"],
        to: "/",
        hotkey: "report",
      },
    ],
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;

      const target = event.target;
      const isTypingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (isTypingField) return;

      event.preventDefault();
      setIsCommandPaletteOpen((current) => !current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setIsCommandPaletteOpen(false);
  }, [location.pathname]);

  function handleCommandSelect(command) {
    if (command?.closeOnExecute === false) return;

    setIsCommandPaletteOpen(false);

    if (command.to) {
      navigate(command.to);
    }

    if (command.id === "view-system-report") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ behavior: "smooth", top: 0 });
      });
    }
  }

  return (
    <>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={
              <CommandCenterDashboard
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              />
            }
          />
          <Route path="/ai-workspace" element={<AIWorkspace />} />
          <Route path="/ai-newsroom" element={<AINewsroom />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/agent-bridge" element={<AgentBridge />} />
          <Route
            path="/knowledge"
            element={<Navigate replace to="/knowledge-base" />}
          />
          <Route path="/web-builder" element={<WebBuilder />} />
          <Route path="/workflow-automation" element={<WorkflowAutomation />} />
          <Route
            path="/media-intel"
            element={
              <CommandCenterDashboard
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              />
            }
          />
          <Route
            path="/archive"
            element={
              <CommandCenterDashboard
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              />
            }
          />
        </Route>

          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </Suspense>

      <CommandPalette
        commands={commands}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelect={handleCommandSelect}
      />
    </>
  );
}

function App() {
  return <AppShell />;
}

export default App;
