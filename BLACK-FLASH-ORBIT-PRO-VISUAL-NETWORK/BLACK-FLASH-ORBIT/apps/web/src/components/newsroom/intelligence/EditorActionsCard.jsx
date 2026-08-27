const PRIORITY_CLASSES = {
  CRITICAL: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  HIGH: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  LOW: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  MEDIUM: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
};

export function EditorActionsCard({ actions = [] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Editor Actions
      </p>

      {!actions.length ? (
        <p className="text-xs leading-5 text-slate-500">
          No editor actions are available yet.
        </p>
      ) : (
        <div className="grid gap-2">
          {actions.slice(0, 7).map((action) => (
            <article
              key={action.id}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] font-black ${
                    PRIORITY_CLASSES[action.priority] || PRIORITY_CLASSES.MEDIUM
                  }`}
                >
                  {action.priority}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black text-slate-400">
                  {action.type}
                </span>
              </div>
              <p className="text-xs leading-5 text-slate-300">
                {action.message}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
