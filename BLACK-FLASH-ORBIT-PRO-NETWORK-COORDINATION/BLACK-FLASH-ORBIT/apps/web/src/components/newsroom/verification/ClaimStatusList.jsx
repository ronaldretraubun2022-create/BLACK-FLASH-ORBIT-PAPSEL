const STATUS_LABELS = {
  CONFLICTING: "Conflicting evidence",
  NOT_VERIFIABLE: "Needs verification",
  PARTIALLY_SUPPORTED: "Partial evidence",
  SUPPORTED: "Supported",
  UNSUPPORTED: "Unsupported",
};

const STATUS_CLASSES = {
  CONFLICTING: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  NOT_VERIFIABLE: "border-white/10 bg-white/[0.04] text-slate-300",
  PARTIALLY_SUPPORTED: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  SUPPORTED: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  UNSUPPORTED: "border-rose-300/25 bg-rose-300/10 text-rose-100",
};

export function ClaimStatusList({ claims = [] }) {
  if (!claims.length) {
    return (
      <p className="text-xs leading-5 text-slate-500">
        No structured claims detected yet.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {claims.slice(0, 6).map((claim) => (
        <article
          key={claim.id}
          className="rounded-2xl border border-white/10 bg-black/20 p-3"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-1 text-[10px] font-black ${STATUS_CLASSES[claim.status] || STATUS_CLASSES.NOT_VERIFIABLE}`}
            >
              {STATUS_LABELS[claim.status] || claim.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black text-slate-400">
              {claim.type}
            </span>
          </div>
          <p className="max-h-16 overflow-hidden text-xs leading-5 text-slate-300">
            {claim.text}
          </p>
        </article>
      ))}
    </div>
  );
}
