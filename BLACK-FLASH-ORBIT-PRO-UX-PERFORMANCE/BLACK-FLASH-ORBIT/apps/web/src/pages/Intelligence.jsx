import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileSearch,
  Layers3,
  Link2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { UserMenu } from "../components/auth/UserMenu.jsx";
import { CommandCenterSidebar } from "../components/CommandCenterSidebar.jsx";
import { useProfile } from "../hooks/useProfile.js";
import { api } from "../services/api.js";
import {
  DEFAULT_MANUAL_NOTE,
  buildManualNotePayload,
  canSubmitManualNote,
  getSafeIntelligenceIntakeError,
  isValidManualSourceType,
} from "../services/intelligenceIntake.mjs";
import { ORBIT_RELEASE_METADATA } from "../config/releaseMetadata.js";

const releaseState = [
  {
    label: "Branch",
    value: ORBIT_RELEASE_METADATA.releaseChannel,
    tone: "text-[#f1c36f]",
  },
  { label: "Module", value: ORBIT_RELEASE_METADATA.module, tone: "text-white" },
  { label: "Status", value: "owner-scoped", tone: "text-emerald-300" },
];

const claimStatusOptions = [
  { label: "All", value: "" },
  { label: "Unverified", value: "unverified" },
  { label: "Conflicting", value: "conflicting" },
  { label: "Supported", value: "supported" },
  { label: "Inferred", value: "inferred" },
  { label: "Confirmed", value: "confirmed" },
];

const entityTypeOptions = [
  { label: "All", value: "" },
  { label: "Person", value: "person" },
  { label: "Organization", value: "organization" },
  { label: "Location", value: "location" },
  { label: "Project", value: "project" },
  { label: "Product", value: "product" },
  { label: "Event", value: "event" },
];

const sourceTypeOptions = [
  { label: "All", value: "" },
  { label: "Manual Note", value: "manual_note" },
  { label: "Knowledge", value: "knowledge_document" },
  { label: "Newsroom", value: "newsroom_generation" },
  { label: "Workflow", value: "workflow_run" },
];

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDate(value, fallback = "-") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Jayapura",
    year: "numeric",
  });
}

function getStatusClass(status) {
  if (status === "conflicting") {
    return "border-[#7d1f2f]/40 bg-[#7d1f2f]/20 text-rose-100";
  }

  if (status === "confirmed" || status === "supported") {
    return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  }

  if (status === "inferred") {
    return "border-sky-300/25 bg-sky-300/10 text-sky-100";
  }

  return "border-[#d9ad57]/30 bg-[#d9ad57]/10 text-[#f1c36f]";
}

function getLinkTypes(link) {
  if (Array.isArray(link?.linkTypes) && link.linkTypes.length) {
    return link.linkTypes;
  }

  return link?.linkType ? [link.linkType] : [];
}

export function Intelligence() {
  const { profile } = useProfile();
  const [overview, setOverview] = useState(null);
  const [entities, setEntities] = useState([]);
  const [claims, setClaims] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [sourceLinks, setSourceLinks] = useState([]);
  const [searchResults, setSearchResults] = useState({ claims: [], entities: [] });
  const [filters, setFilters] = useState({
    claimStatus: "",
    entityType: "",
    keyword: "",
    sourceType: "",
  });
  const [manualNote, setManualNote] = useState(DEFAULT_MANUAL_NOTE);
  const [error, setError] = useState("");
  const [intakeMessage, setIntakeMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reprocessMessage, setReprocessMessage] = useState("");
  const [reprocessingSourceId, setReprocessingSourceId] = useState("");
  const canProcessManualNote = canSubmitManualNote({
    content: manualNote.content,
    isProcessing,
    sourceType: manualNote.sourceType,
  });

  async function loadIntelligence(nextFilters = filters) {
    setIsLoading(true);
    setError("");

    try {
      const query = {
        claimStatus: nextFilters.claimStatus,
        entityType: nextFilters.entityType,
        keyword: nextFilters.keyword,
        sourceType: nextFilters.sourceType,
      };
      const [
        overviewResponse,
        entitiesResponse,
        claimsResponse,
        timelineResponse,
        searchResponse,
        sourceLinksResponse,
      ] = await Promise.all([
        api.getIntelligenceOverview(),
        api.getIntelligenceEntities(query),
        api.getIntelligenceClaims(query),
        api.getIntelligenceTimeline(query),
        api.searchIntelligence(query),
        api.getIntelligenceSourceLinks({ limit: 20 }),
      ]);

      setOverview(overviewResponse?.data || null);
      setEntities(getArray(entitiesResponse?.data));
      setClaims(getArray(claimsResponse?.data));
      setTimeline(getArray(timelineResponse?.data));
      setSearchResults(searchResponse?.data || { claims: [], entities: [] });
      setSourceLinks(getArray(sourceLinksResponse?.data));
    } catch (loadError) {
      setError(loadError?.message || "Gagal memuat Intelligence Engine.");
      setOverview(null);
      setEntities([]);
      setClaims([]);
      setTimeline([]);
      setSearchResults({ claims: [], entities: [] });
      setSourceLinks([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadIntelligence();
  }, []);

  const metrics = useMemo(() => {
    const data = overview?.metrics || {};

    return [
      {
        icon: Layers3,
        label: "Sources",
        value: data.sourcesProcessed || 0,
        detail: "processed",
      },
      {
        icon: BrainCircuit,
        label: "Entities",
        value: data.entitiesExtracted || 0,
        detail: "extracted",
      },
      {
        icon: FileSearch,
        label: "Claims",
        value: data.claimsExtracted || 0,
        detail: `${data.unverifiedClaimsCount || 0} unverified`,
      },
      {
        icon: AlertTriangle,
        label: "Conflicts",
        value: data.conflictingClaimsCount || 0,
        detail: "needs review",
      },
    ];
  }, [overview]);

  async function handleApplyFilters(event) {
    event.preventDefault();
    await loadIntelligence(filters);
  }

  async function handleProcessManualNote(event) {
    event.preventDefault();
    const payload = buildManualNotePayload({
      content: manualNote.content,
      sourceType: manualNote.sourceType,
      title: manualNote.title,
    });

    if (isProcessing || !payload) return;

    setIsProcessing(true);
    setError("");
    setIntakeMessage("");

    try {
      await api.processIntelligenceSource(payload);
      setManualNote(DEFAULT_MANUAL_NOTE);
      setIntakeMessage("Manual note processed.");
      await loadIntelligence(filters);
    } catch (processError) {
      setError(getSafeIntelligenceIntakeError(processError));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReprocessSource(source) {
    if (!source?.id || reprocessingSourceId) return;

    const confirmed = window.confirm(
      "Reprocess this source with the current intelligence extractor?",
    );

    if (!confirmed) return;

    setReprocessingSourceId(source.id);
    setError("");
    setReprocessMessage("");

    try {
      await api.reprocessIntelligenceSource(source.id);
      setReprocessMessage("Source reprocessed.");
      await loadIntelligence(filters);
    } catch (reprocessError) {
      setError(getSafeIntelligenceIntakeError(reprocessError));
    } finally {
      setReprocessingSourceId("");
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
              <p className="orbit-kicker">Intelligence Engine v1.2</p>
              <h1 className="text-xl font-black text-white md:text-2xl">
                Personal Intelligence System
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                aria-label="Refresh intelligence"
                className="orbit-icon-button"
                disabled={isLoading}
                onClick={() => loadIntelligence()}
                type="button">
                <RefreshCcw size={18} />
              </button>
              <button
                aria-label="Intelligence notifications"
                className="orbit-icon-button"
                type="button">
                <Bell size={18} />
              </button>
              <UserMenu />
            </div>
          </header>

          <div className="grid gap-4 p-4 md:p-6">
            <section className="rounded-lg border border-[#d9ad57]/20 bg-[radial-gradient(circle_at_top_right,_rgba(217,173,87,0.16),_transparent_38%),rgba(255,255,255,0.035)] p-4 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-[#d9ad57]/25 bg-[#d9ad57]/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#f1c36f]">
                    <ShieldCheck size={14} />
                    Owner scoped intelligence
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
                    Extract, correlate, search.
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                    ORBIT memproses dokumen knowledge, newsroom, workflow, dan
                    catatan aman menjadi entities, claims, timeline, serta
                    evidence links. Klaim baru tetap unverified sampai diverifikasi.
                  </p>
                </div>

                <form
                  className="rounded-lg border border-white/10 bg-black/25 p-4"
                  onSubmit={handleProcessManualNote}>
                  <p className="orbit-kicker">Source Intake</p>
                  <h3 className="mt-1 text-lg font-black text-white">
                    Manual Note
                  </h3>
                  <div className="mt-4 grid gap-3">
                    <input
                      className="min-h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-[#d9ad57]/45"
                      maxLength={180}
                      onChange={(event) =>
                        setManualNote((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Source title"
                      value={manualNote.title}
                    />
                    <label className="grid gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                      Source Type
                      <select
                        className="min-h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-[#d9ad57]/45"
                        onChange={(event) =>
                          setManualNote((current) => ({
                            ...current,
                            sourceType: event.target.value,
                          }))
                        }
                        value={manualNote.sourceType}>
                        <option value="manual_note">Manual Note</option>
                      </select>
                    </label>
                    <label
                      className="grid gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500"
                      htmlFor="manual-intelligence-note">
                      Manual Note Content
                      <textarea
                        aria-label="Manual note content"
                        className="min-h-28 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm font-semibold normal-case leading-6 tracking-normal text-white outline-none placeholder:text-zinc-600 focus:border-[#d9ad57]/45"
                        id="manual-intelligence-note"
                        maxLength={12000}
                        onChange={(event) =>
                          setManualNote((current) => ({
                            ...current,
                            content: event.target.value,
                          }))
                        }
                        placeholder="Paste safe source text. Tokens, secrets, and authorization values are redacted server-side."
                        value={manualNote.content}
                      />
                    </label>
                    {!isValidManualSourceType(manualNote.sourceType) ? (
                      <p className="rounded-lg border border-[#7d1f2f]/25 bg-[#7d1f2f]/10 px-3 py-2 text-xs font-bold text-rose-100">
                        Source type tidak valid.
                      </p>
                    ) : null}
                    {intakeMessage ? (
                      <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
                        {intakeMessage}
                      </p>
                    ) : null}
                    {reprocessMessage ? (
                      <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
                        {reprocessMessage}
                      </p>
                    ) : null}
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57]/15 px-4 text-sm font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/20 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canProcessManualNote}
                      type="submit">
                      <Sparkles size={16} />
                      {isProcessing ? "Processing..." : "Process Source"}
                    </button>
                  </div>
                </form>
              </div>

              {error ? (
                <div className="mt-4 rounded-lg border border-[#7d1f2f]/35 bg-[#7d1f2f]/15 px-4 py-3 text-sm font-bold text-rose-100">
                  {error}
                </div>
              ) : null}
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </section>

            <form
              className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px_auto]"
              onSubmit={handleApplyFilters}>
              <label className="grid gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                Deep Search
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 focus-within:border-[#d9ad57]/45">
                  <Search className="text-zinc-500" size={16} />
                  <input
                    className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-bold normal-case tracking-normal text-white outline-none placeholder:text-zinc-600"
                    maxLength={120}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        keyword: event.target.value,
                      }))
                    }
                    placeholder="Search entities, claims, evidence"
                    value={filters.keyword}
                  />
                </div>
              </label>
              <FilterSelect
                label="Entity Type"
                options={entityTypeOptions}
                value={filters.entityType}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, entityType: value }))
                }
              />
              <FilterSelect
                label="Claim Status"
                options={claimStatusOptions}
                value={filters.claimStatus}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, claimStatus: value }))
                }
              />
              <FilterSelect
                label="Source Type"
                options={sourceTypeOptions}
                value={filters.sourceType}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, sourceType: value }))
                }
              />
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg border border-white/10 bg-black/25 px-4 text-sm font-black text-white transition hover:border-[#d9ad57]/35 hover:text-[#f1c36f]"
                disabled={isLoading}
                type="submit">
                <FileSearch size={16} />
                Apply
              </button>
            </form>

            <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1fr)_minmax(300px,0.9fr)]">
              <Panel icon={BrainCircuit} kicker="Entity Graph" title="Entity List">
                <EntityList entities={entities} isLoading={isLoading} />
              </Panel>

              <section className="grid gap-4">
                <Panel icon={FileSearch} kicker="Claims" title="Claim List">
                  <ClaimList claims={claims} isLoading={isLoading} />
                </Panel>
                <Panel icon={Search} kicker="Deep Search" title="Search Results">
                  <SearchResults results={searchResults} />
                </Panel>
              </section>

              <section className="grid gap-4">
                <Panel icon={Clock3} kicker="Timeline" title="Dated Items">
                  <Timeline items={timeline} isLoading={isLoading} />
                </Panel>
                <Panel icon={Link2} kicker="Evidence" title="Source Evidence">
                  <EvidencePanel
                    links={sourceLinks}
                    isLoading={isLoading}
                    onReprocessSource={handleReprocessSource}
                    reprocessingSourceId={reprocessingSourceId}
                  />
                </Panel>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ detail, icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <Icon className="text-[#d9ad57]" size={19} />
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <h3 className="mt-2 text-2xl font-black text-white">{value}</h3>
      <p className="mt-1 text-xs font-bold text-zinc-500">{detail}</p>
    </article>
  );
}

function FilterSelect({ label, onChange, options, value }) {
  return (
    <label className="grid gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
      {label}
      <select
        className="min-h-11 rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-[#d9ad57]/45"
        onChange={(event) => onChange(event.target.value)}
        value={value}>
        {options.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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

function EntityList({ entities, isLoading }) {
  if (isLoading) return <EmptyState label="Loading entities..." />;
  if (!entities.length) return <EmptyState label="No entities extracted yet." />;

  return (
    <div className="grid gap-3">
      {entities.map((entity) => (
        <article
          className="rounded-lg border border-white/10 bg-black/20 p-3"
          key={entity.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {entity.canonicalName}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
                {entity.entityType}
              </p>
            </div>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black text-zinc-300">
              {Math.round(entity.confidence * 100)}%
            </span>
          </div>
          <EvidenceSummary references={entity.sourceReferences} />
        </article>
      ))}
    </div>
  );
}

function ClaimList({ claims, isLoading }) {
  if (isLoading) return <EmptyState label="Loading claims..." />;
  if (!claims.length) return <EmptyState label="No claims extracted yet." />;

  return (
    <div className="grid gap-3">
      {claims.map((claim) => (
        <article
          className="rounded-lg border border-white/10 bg-black/20 p-4"
          key={claim.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm font-semibold leading-6 text-zinc-200">
              {claim.claimText}
            </p>
            <span
              className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase ${getStatusClass(claim.status)}`}>
              {claim.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
            <span>{claim.polarity}</span>
            <span>{formatDate(claim.observedAt)}</span>
            <span>{Math.round(claim.confidence * 100)}%</span>
          </div>
          <EvidenceSummary references={claim.sourceReferences} />
        </article>
      ))}
    </div>
  );
}

function Timeline({ items, isLoading }) {
  if (isLoading) return <EmptyState label="Loading timeline..." />;
  if (!items.length) return <EmptyState label="No dated intelligence items yet." />;

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article
          className="rounded-lg border border-white/10 bg-black/20 p-3"
          key={item.id}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
            {formatDate(item.date)}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white">
            {item.title}
          </p>
          <EvidenceSummary references={item.sourceReferences} />
        </article>
      ))}
    </div>
  );
}

function SearchResults({ results }) {
  const entities = getArray(results?.entities).slice(0, 4);
  const claims = getArray(results?.claims).slice(0, 4);

  if (!entities.length && !claims.length) {
    return <EmptyState label="Search results will appear here." />;
  }

  return (
    <div className="grid gap-3">
      {entities.map((entity) => (
        <div
          className="rounded-lg border border-white/10 bg-black/20 p-3"
          key={`entity-${entity.id}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
            Entity
          </p>
          <p className="mt-2 text-sm font-black text-white">
            {entity.canonicalName}
          </p>
        </div>
      ))}
      {claims.map((claim) => (
        <div
          className="rounded-lg border border-white/10 bg-black/20 p-3"
          key={`claim-${claim.id}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
            Claim
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white">
            {claim.claimText}
          </p>
        </div>
      ))}
    </div>
  );
}

function EvidencePanel({
  isLoading,
  links,
  onReprocessSource,
  reprocessingSourceId,
}) {
  if (isLoading) return <EmptyState label="Loading source evidence..." />;
  if (!links.length) return <EmptyState label="No source links yet." />;

  return (
    <div className="grid gap-3">
      {links.map((link) => (
        <article
          className="rounded-lg border border-white/10 bg-black/20 p-3"
          key={link.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {link.source?.title || "Source evidence"}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#f1c36f]">
                {getLinkTypes(link).join(" + ") || "source_evidence"}
              </p>
            </div>
            <Link2 className="shrink-0 text-zinc-500" size={16} />
          </div>
          {link.source?.id ? (
            <button
              className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#d9ad57]/30 bg-[#d9ad57]/10 px-3 text-xs font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/15 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={Boolean(reprocessingSourceId)}
              onClick={() => onReprocessSource(link.source)}
              type="button">
              <RefreshCcw size={14} />
              {reprocessingSourceId === link.source.id
                ? "Reprocessing..."
                : "Reprocess Source"}
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {getLinkTypes(link).map((type) => (
              <span
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase text-zinc-400"
                key={type}>
                {type}
              </span>
            ))}
            <span className="rounded-md border border-[#d9ad57]/20 bg-[#d9ad57]/10 px-2 py-1 text-[10px] font-black uppercase text-[#f1c36f]">
              {getArray(link.entityIds).length} entities
            </span>
            <span className="rounded-md border border-[#d9ad57]/20 bg-[#d9ad57]/10 px-2 py-1 text-[10px] font-black uppercase text-[#f1c36f]">
              {getArray(link.claimIds).length} claims
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-400">
            {link.evidenceText}
          </p>
        </article>
      ))}
    </div>
  );
}

function EvidenceSummary({ references = [] }) {
  const visibleReferences = getArray(references).slice(0, 2);

  return (
    <div className="mt-3 grid gap-2">
      {visibleReferences.length ? (
        visibleReferences.map((reference) => (
          <div
            className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2"
            key={reference.id}>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
              <CheckCircle2 className="text-emerald-300" size={13} />
              {reference.source?.sourceType || "source"}
            </div>
            <p className="mt-1 truncate text-xs font-bold text-zinc-300">
              {reference.source?.title || reference.evidenceText || "Evidence linked"}
            </p>
          </div>
        ))
      ) : (
        <div className="rounded-md border border-[#7d1f2f]/30 bg-[#7d1f2f]/10 px-3 py-2 text-xs font-bold text-rose-100">
          Source evidence required.
        </div>
      )}
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
