export function IntelligenceSummary({ items }) {
  return (
    <section className="mb-5 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
        Selected Intelligence
      </p>

      <div className="grid gap-3 text-sm text-slate-300">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start justify-between gap-3"
          >
            <span className="text-slate-500">{item.label}</span>
            <span className="max-w-[220px] text-right font-bold text-white">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
