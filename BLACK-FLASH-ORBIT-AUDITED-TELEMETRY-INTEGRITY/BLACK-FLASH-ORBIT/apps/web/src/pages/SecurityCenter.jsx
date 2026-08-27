import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cpu,
  FileText,
  FileWarning,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { api } from "../services/api";

const severityStyles = {
  critical: "border-red-300/30 bg-red-500/15 text-red-100",
  high: "border-orange-300/30 bg-orange-500/15 text-orange-100",
  medium: "border-amber-300/30 bg-amber-400/15 text-amber-100",
  low: "border-emerald-300/30 bg-emerald-400/15 text-emerald-100",
};

const fallbackSecurity = {
  cors: "CHECKING",
  helmet: "CHECKING",
  issues: [],
  lastAudit: "-",
  rateLimit: "CHECKING",
  securityScore: 0,
};

const dependencySummary = [
  { label: "React", value: "Connected", tone: "text-cyan-200" },
  { label: "React Router", value: "Active", tone: "text-emerald-200" },
  { label: "Supabase", value: "Ready", tone: "text-amber-200" },
  { label: "Lucide Icons", value: "Loaded", tone: "text-sky-200" },
];

function getScoreLabel(score) {
  if (score >= 95) return "Hardened";
  if (score >= 85) return "Protected";
  if (score >= 70) return "Watchlist";
  return "Action Required";
}

function getScoreTone(score) {
  if (score >= 90) return "text-emerald-200";
  if (score >= 75) return "text-amber-200";
  return "text-red-200";
}

function normalizeSeverity(value) {
  const severity = String(value || "low").toLowerCase();

  return severityStyles[severity] ? severity : "low";
}

function buildAuditTimeline(security) {
  const issues = Array.isArray(security.issues) ? security.issues : [];

  return [
    {
      detail: `Audit terakhir tercatat ${security.lastAudit || "-"}.`,
      icon: Clock3,
      status: "Synced",
      title: "Audit Snapshot",
    },
    {
      detail: `Helmet middleware berada dalam status ${security.helmet || "-"}.`,
      icon: ShieldCheck,
      status: security.helmet || "-",
      title: "HTTP Headers",
    },
    {
      detail: `CORS policy berada dalam status ${security.cors || "-"}.`,
      icon: LockKeyhole,
      status: security.cors || "-",
      title: "Access Boundary",
    },
    {
      detail: `${issues.length} issue keamanan aktif masuk backlog review.`,
      icon: issues.length > 0 ? FileWarning : CheckCircle2,
      status: issues.length > 0 ? "Review" : "Clear",
      title: "Issue Review",
    },
  ];
}

function getEnvironmentAudit() {
  const hasSupabaseUrl = Boolean(import.meta.env.VITE_SUPABASE_URL);
  const hasSupabaseAnonKey = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  const hasApiBase = Boolean(import.meta.env.VITE_API_BASE_URL);

  return [
    {
      label: "API Base",
      value: hasApiBase ? "Configured" : "Relative /api",
      tone: hasApiBase ? "text-emerald-200" : "text-amber-200",
    },
    {
      label: "Supabase URL",
      value: hasSupabaseUrl ? "Set" : "Missing",
      tone: hasSupabaseUrl ? "text-emerald-200" : "text-amber-200",
    },
    {
      label: "Anon Key",
      value: hasSupabaseAnonKey ? "Present" : "Missing",
      tone: hasSupabaseAnonKey ? "text-emerald-200" : "text-rose-200",
    },
    {
      label: "Browser Context",
      value: typeof window !== "undefined" ? "Client" : "SSR",
      tone: "text-cyan-200",
    },
  ];
}

export function SecurityCenter() {
  const [security, setSecurity] = useState(fallbackSecurity);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const loadSecurity = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await api.getSecurity();

      setSecurity({
        ...fallbackSecurity,
        ...data,
        issues: Array.isArray(data?.issues) ? data.issues : [],
      });
      setLastUpdated(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError) ||
          "Gagal mengambil data Security Center dari /api/v1/security.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity]);

  const issues = Array.isArray(security.issues) ? security.issues : [];
  const score = Number(security.securityScore || 0);
  const scoreLabel = getScoreLabel(score);
  const scoreTone = getScoreTone(score);
  const timeline = useMemo(() => buildAuditTimeline(security), [security]);
  const environmentAudit = useMemo(() => getEnvironmentAudit(), []);
  const statusCards = useMemo(
    () => [
      {
        icon: ShieldCheck,
        label: "HTTP Headers",
        value: security.helmet || "CHECKING",
        detail: "Helmet middleware posture",
      },
      {
        icon: LockKeyhole,
        label: "CORS Boundary",
        value: security.cors || "CHECKING",
        detail: "Cross-origin access control",
      },
      {
        icon: Siren,
        label: "Rate Limit",
        value: security.rateLimit || "CHECKING",
        detail: "Abuse protection and throttle",
      },
      {
        icon: FileWarning,
        label: "Open Issues",
        value: String(issues.length),
        detail: "Pending security review items",
      },
    ],
    [issues.length, security.cors, security.helmet, security.rateLimit],
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="orbit-hero-card">
          <div className="min-w-0">
            <p className="orbit-eyebrow">DEFENSIVE CONTROL</p>
            <h2 className="mt-3 text-4xl font-black leading-none text-white sm:text-5xl lg:text-6xl">
              Security Center v0.6
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400 sm:text-base">
              Pusat monitoring keamanan untuk headers, CORS, rate limiting,
              audit env, dependency summary, event log, dan kesiapan deploy
              BLACK FLASH ORBIT.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                className="orbit-primary-button"
                disabled={isLoading}
                onClick={loadSecurity}
                type="button">
                <RefreshCw
                  className={isLoading ? "animate-spin" : ""}
                  size={17}
                />
                Scan Security
              </button>
              <button
                className="orbit-secondary-button"
                disabled={isLoading}
                onClick={loadSecurity}
                type="button">
                <Cpu size={17} />
                Refresh Audit
              </button>
              <span className="orbit-secondary-button">
                Last Sync: {lastUpdated || "loading"}
              </span>
            </div>
          </div>

          <div className="orbit-live-core">
            <span
              className={score >= 90 ? "orbit-pulse online" : "orbit-pulse"}
            />
            <strong>{score}%</strong>
            <span>{scoreLabel} Security Posture</span>
          </div>
        </article>

        <article className="orbit-status-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">SECURITY SCORE</p>
              <h3 className={`mt-2 text-5xl font-black ${scoreTone}`}>
                {score}%
              </h3>
            </div>
            <ShieldCheck className="text-cyan-200" size={28} />
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-300 to-emerald-300"
              style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-400">
            Status:{" "}
            <span className="font-black text-stone-100">{scoreLabel}</span>.
            Fokus utama modul ini adalah visibility, triage cepat, dan audit
            readiness sebelum production deploy.
          </p>
          {error && (
            <div className="mt-4 flex gap-2 rounded-lg border border-red-300/25 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
              <AlertTriangle className="mt-0.5 shrink-0" size={15} />
              {error}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <StatusCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <article className="orbit-widget">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="orbit-eyebrow">ISSUES TABLE</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Security Findings
              </h3>
            </div>
            <span className="w-fit rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase text-cyan-100">
              /api/v1/security
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="hidden grid-cols-[120px_120px_minmax(0,1fr)] border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-black uppercase text-stone-500 md:grid">
              <span>ID</span>
              <span>Severity</span>
              <span>Message</span>
            </div>

            <div className="grid">
              {issues.length > 0 ? (
                issues.map((issue) => (
                  <IssueRow issue={issue} key={issue.id || issue.message} />
                ))
              ) : (
                <div className="p-5 text-sm leading-6 text-stone-400">
                  Tidak ada issue aktif dari endpoint security.
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="orbit-widget">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">AUDIT EVENT LOG</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Defensive Trail
              </h3>
            </div>
            <Clock3 className="text-cyan-200" size={22} />
          </div>

          <div className="grid gap-3">
            {timeline.map(({ detail, icon: Icon, status, title }) => (
              <article
                className="rounded-lg border border-white/10 bg-black/20 p-4"
                key={title}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-black text-white">{title}</h4>
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-black uppercase text-stone-300">
                        {status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-stone-500">
                      {detail}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <article className="orbit-widget">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">ENV AUDIT</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Runtime Exposure
              </h3>
            </div>
            <ShieldCheck className="text-cyan-200" size={22} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {environmentAudit.map((item) => (
              <div
                className="rounded-lg border border-white/10 bg-black/20 p-4"
                key={item.label}>
                <p className="text-xs font-bold uppercase text-stone-500">
                  {item.label}
                </p>
                <p className={`mt-2 text-sm font-black ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-5 text-stone-500">
            Audit ini hanya menampilkan status lingkungan tanpa mengekspos token
            atau nilai rahasia.
          </p>
        </article>

        <article className="orbit-widget">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">DEPENDENCY SUMMARY</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Frontend Stack
              </h3>
            </div>
            <FileText className="text-cyan-200" size={22} />
          </div>

          <div className="grid gap-3">
            {dependencySummary.map((item) => (
              <div
                className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3"
                key={item.label}>
                <span className="text-sm font-bold text-white">
                  {item.label}
                </span>
                <span className={`text-xs font-black uppercase ${item.tone}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function StatusCard({ detail, icon: Icon, label, value }) {
  return (
    <article className="orbit-signal-card tone-green">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-lg border border-current/30 bg-white/5">
          <Icon size={18} />
        </span>
        <span className="orbit-live-dot" />
      </div>
      <p className="mt-5 text-xs font-bold uppercase text-stone-500">{label}</p>
      <strong className="mt-2 block text-2xl font-black uppercase text-white">
        {value || "-"}
      </strong>
      <span className="mt-2 block text-sm text-stone-500">{detail}</span>
    </article>
  );
}

function IssueRow({ issue }) {
  const severity = normalizeSeverity(issue.severity);
  const badgeClass = severityStyles[severity];

  return (
    <article className="grid gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 md:grid-cols-[120px_120px_minmax(0,1fr)] md:items-center">
      <div>
        <span className="md:hidden text-xs font-black uppercase text-stone-500">
          ID
        </span>
        <strong className="block text-sm font-black text-white">
          {issue.id || "SEC"}
        </strong>
      </div>
      <div>
        <span className="md:hidden text-xs font-black uppercase text-stone-500">
          Severity
        </span>
        <SeverityBadge className={badgeClass} severity={severity} />
      </div>
      <div>
        <span className="md:hidden text-xs font-black uppercase text-stone-500">
          Message
        </span>
        <p className="text-sm leading-6 text-stone-400">{issue.message}</p>
      </div>
    </article>
  );
}

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal mengambil data Security Center dari /api/v1/security.";
  }
}

function SeverityBadge({ className, severity }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black uppercase ${className}`}>
      {severity}
    </span>
  );
}
```

COMMAND:
`npm.cmd exec vite -- build`

TEST:
`npm.cmd exec vite -- build`
`git diff --check`
`git diff -- apps/web/src/pages/SecurityCenter.jsx`
Security Center renders with score, status cards, env audit, dependency summary, and event log
Refresh/scan buttons work
No routing changes
No secrets exposed in env audit output
Mobile layout remains responsive
