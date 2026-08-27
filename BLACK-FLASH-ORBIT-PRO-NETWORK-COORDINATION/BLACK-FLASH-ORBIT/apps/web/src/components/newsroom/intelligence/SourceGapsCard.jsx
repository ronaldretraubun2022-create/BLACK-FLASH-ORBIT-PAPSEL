export function SourceGapsCard({ gaps = [] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Source Gaps
      </p>

      {!gaps.length ? (
        <p className="text-xs leading-5 text-slate-500">
          No major source gaps were detected from the supplied evidence.
        </p>
      ) : (
        <div className="grid gap-2">
          {gaps.slice(0, 6).map((gap, index) => (
            <div
              key={`${gap.type}-${gap.claimId || index}`}
              className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-50"
            >
              <p className="font-black">{gap.type}</p>
              <p className="mt-1 leading-5 text-cyan-50/80">{gap.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
