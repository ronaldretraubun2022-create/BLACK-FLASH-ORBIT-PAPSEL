const STATUS_LABELS = {
  CONFLICTING: "Conflicting evidence",
  PARTIALLY_SUPPORTED: "Partial evidence",
  UNSUPPORTED: "Unsupported",
};

export function UnsupportedClaimsCard({ claims = [] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Claims Needing Attention
      </p>

      {!claims.length ? (
        <p className="text-xs leading-5 text-slate-500">
          No unsupported or conflicting claims were highlighted.
        </p>
      ) : (
        <div className="grid gap-2">
          {claims.map((claim) => (
            <article
              key={claim.id}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-100">
                  {STATUS_LABELS[claim.status] || claim.status}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black text-slate-400">
                  {claim.type}
                </span>
              </div>
              <p className="max-h-16 overflow-hidden text-xs leading-5 text-slate-300">
                {claim.text}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
