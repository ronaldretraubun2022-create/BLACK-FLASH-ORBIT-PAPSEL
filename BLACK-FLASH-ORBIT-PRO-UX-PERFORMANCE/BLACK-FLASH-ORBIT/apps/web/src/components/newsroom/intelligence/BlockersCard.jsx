const SEVERITY_CLASSES = {
  CRITICAL: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  HIGH: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  LOW: "border-white/10 bg-white/[0.04] text-slate-300",
  MEDIUM: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
};

export function BlockersCard({ blockers = [] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Publication Blockers
      </p>

      {!blockers.length ? (
        <p className="text-xs leading-5 text-slate-500">
          No critical publication blockers detected. Human editor approval is
          still required.
        </p>
      ) : (
        <div className="grid gap-2">
          {blockers.slice(0, 5).map((blocker, index) => (
            <article
              key={`${blocker.type}-${blocker.claimId || index}`}
              className={`rounded-2xl border px-3 py-2 text-xs ${
                SEVERITY_CLASSES[blocker.severity] || SEVERITY_CLASSES.MEDIUM
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-black">{blocker.type}</span>
                <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-black">
                  {blocker.severity}
                </span>
              </div>
              <p className="leading-5 opacity-85">{blocker.message}</p>
              <p className="mt-1 font-bold opacity-80">
                Action: {blocker.recommendedAction}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
