function hasBlockers(summary, verification) {
  return Boolean(
    summary?.blockers?.length ||
    verification?.publicationBlockers?.length ||
    summary?.publicationReadiness === "BLOCKED",
  );
}

export function EditorialDecisionPanel({
  generation,
  isSubmitting,
  notes,
  onDecision,
  onNotesChange,
  overrideBlockers,
  overrideReason,
  onOverrideBlockersChange,
  onOverrideReasonChange,
  summary,
  verification,
}) {
  const criticalBlockers = hasBlockers(summary, verification);
  const status = generation?.reviewStatus || summary?.editorialStatus || "-";
  const readiness =
    generation?.publicationReadiness || summary?.publicationReadiness || "-";

  return (
    <section className="mb-5 rounded-3xl border border-[#f1c36f]/25 bg-[#f1c36f]/[0.05] p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f1c36f]">
            Human Editorial Approval
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            AI cannot approve content. Final decision requires human action.
          </p>
        </div>

        <span className="w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
          {status}
        </span>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Readiness
          </p>
          <p className="mt-2 text-sm font-black text-white">{readiness}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Critical Blockers
          </p>
          <p
            className={`mt-2 text-sm font-black ${
              criticalBlockers ? "text-[#f1c36f]" : "text-emerald-200"
            }`}
          >
            {criticalBlockers ? "Present" : "None detected"}
          </p>
        </div>
      </div>

      {criticalBlockers && (
        <div className="mb-4 rounded-2xl border border-[#7d1f2f]/50 bg-[#7d1f2f]/20 p-3 text-xs leading-5 text-[#f1c36f]">
          Publication blockers require documented override before approval.
        </div>
      )}

      <textarea
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        rows={4}
        placeholder="Editor notes"
        className="mb-3 w-full resize-none rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-[#f1c36f]/60 focus:ring-4 focus:ring-[#f1c36f]/10"
      />

      {criticalBlockers && (
        <div className="mb-4 grid gap-3">
          <label className="flex items-center gap-3 text-xs font-bold text-slate-300">
            <input
              type="checkbox"
              checked={overrideBlockers}
              onChange={(event) =>
                onOverrideBlockersChange(event.target.checked)
              }
              className="h-4 w-4 accent-[#f1c36f]"
            />
            Approve with documented override
          </label>

          {overrideBlockers && (
            <input
              value={overrideReason}
              onChange={(event) => onOverrideReasonChange(event.target.value)}
              placeholder="Override reason"
              className="w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-[#f1c36f]/60"
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onDecision("APPROVE")}
          disabled={!generation?.id || isSubmitting}
          className="rounded-2xl border border-emerald-300/35 bg-emerald-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 transition hover:bg-emerald-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => onDecision("REJECT")}
          disabled={!generation?.id || isSubmitting}
          className="rounded-2xl border border-[#7d1f2f]/50 bg-[#7d1f2f]/20 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#f1c36f] transition hover:bg-[#7d1f2f]/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => onDecision("RETURN_TO_REVIEW")}
          disabled={!generation?.id || isSubmitting}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-200 transition hover:border-[#f1c36f]/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Return
        </button>
      </div>
    </section>
  );
}
