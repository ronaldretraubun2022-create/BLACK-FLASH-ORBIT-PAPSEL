const STATUS_LABELS = {
  BLOCKED: "Blocked",
  NEEDS_REVIEW: "Needs review",
  READY_FOR_EDITOR: "Ready for editor",
};

const STATUS_CLASSES = {
  BLOCKED: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  NEEDS_REVIEW: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  READY_FOR_EDITOR: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
};

function formatConfidence(confidence) {
  const level = confidence?.level || "INSUFFICIENT";
  const score = Number(confidence?.score || 0);

  return score > 0 ? `${level} (${score}%)` : level;
}

export function EditorialStatusCard({ summary }) {
  const readiness = summary?.publicationReadiness || "NEEDS_REVIEW";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
            STATUS_CLASSES[readiness] || STATUS_CLASSES.NEEDS_REVIEW
          }`}
        >
          {STATUS_LABELS[readiness] || readiness}
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {summary?.editorialStatus || "NEEDS_REVIEW"}
        </span>
      </div>

      <p className="text-sm leading-6 text-slate-300">
        {summary?.overview || "Editorial intelligence summary is unavailable."}
      </p>

      <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
          Confidence
        </p>
        <p className="mt-1 text-sm font-black text-white">
          {formatConfidence(summary?.confidence)}
        </p>
      </div>
    </div>
  );
}
