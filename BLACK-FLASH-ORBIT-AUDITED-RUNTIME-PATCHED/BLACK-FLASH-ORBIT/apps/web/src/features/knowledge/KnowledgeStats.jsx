import { BrainCircuit, Database, Power, PowerOff } from "lucide-react";

export function KnowledgeStats({ documents }) {
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const activeCount = safeDocuments.filter(
    (document) => document.useInAiContext,
  ).length;
  const disabledCount = safeDocuments.length - activeCount;
  const lastUpdatedDocument = [...safeDocuments].sort(
    (first, second) =>
      new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0),
  )[0];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Database}
        label="Total Documents"
        value={safeDocuments.length}
      />
      <StatCard icon={Power} label="Active In AI" value={activeCount} />
      <StatCard icon={PowerOff} label="Disabled" value={disabledCount} />
      <StatCard
        icon={BrainCircuit}
        label="Last Updated"
        value={formatDate(lastUpdatedDocument?.updatedAt, "Never")}
      />
    </section>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Icon size={19} />
        </span>
        <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.75)]" />
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <strong className="mt-2 block truncate text-2xl font-black text-white">
        {value}
      </strong>
    </article>
  );
}

function formatDate(value, fallback = "-") {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
