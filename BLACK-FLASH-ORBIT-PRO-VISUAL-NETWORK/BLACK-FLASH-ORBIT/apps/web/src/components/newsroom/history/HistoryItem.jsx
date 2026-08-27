function formatDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function HistoryItem({ generation, isActive, onDelete, onOpen }) {
  return (
    <article
      className={`rounded-2xl border p-3 transition ${
        isActive
          ? "border-[#f1c36f]/50 bg-[#f1c36f]/10"
          : "border-white/10 bg-black/20 hover:border-[#f1c36f]/30"
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="mb-2 flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-sm font-black leading-5 text-white">
            {generation.topic}
          </p>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {generation.reviewStatus}
          </span>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          {generation.mode || "-"} / {generation.audience || "-"}
        </p>
        <p className="mt-2 text-[11px] font-bold text-slate-500">
          {formatDate(generation.createdAt)}
        </p>
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="mt-3 rounded-xl border border-[#7d1f2f]/45 bg-[#7d1f2f]/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#f1c36f] transition hover:bg-[#7d1f2f]/30"
      >
        Delete
      </button>
    </article>
  );
}
