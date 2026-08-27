import { HistoryFilters } from "./HistoryFilters.jsx";
import { HistoryItem } from "./HistoryItem.jsx";

export function GenerationHistory({
  activeId,
  filters,
  isLoading,
  items,
  onDelete,
  onFiltersChange,
  onOpen,
  onRefresh,
}) {
  return (
    <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f1c36f]">
            History
          </p>
          <h2 className="mt-2 text-xl font-black">Generation Archive</h2>
        </div>

        {isLoading && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Loading
          </span>
        )}
      </div>

      <HistoryFilters
        filters={filters}
        onChange={onFiltersChange}
        onRefresh={onRefresh}
      />

      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <HistoryItem
              key={item.id}
              generation={item}
              isActive={item.id === activeId}
              onDelete={() => onDelete(item)}
              onOpen={() => onOpen(item)}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm leading-6 text-slate-500">
            Belum ada generation history yang tersimpan.
          </p>
        )}
      </div>
    </section>
  );
}
