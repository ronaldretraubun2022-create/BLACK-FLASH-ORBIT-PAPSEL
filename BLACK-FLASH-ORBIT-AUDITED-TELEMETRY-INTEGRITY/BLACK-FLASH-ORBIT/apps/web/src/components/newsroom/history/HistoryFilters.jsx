const REVIEW_STATUSES = [
  { label: "All", value: "" },
  { label: "Needs Review", value: "NEEDS_REVIEW" },
  { label: "Ready", value: "READY_FOR_EDITOR" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export function HistoryFilters({ filters, onChange, onRefresh }) {
  return (
    <div className="grid gap-3">
      <input
        value={filters.search}
        onChange={(event) =>
          onChange({
            ...filters,
            search: event.target.value,
          })
        }
        placeholder="Search history"
        className="w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-[#f1c36f]/60 focus:ring-4 focus:ring-[#f1c36f]/10"
      />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select
          value={filters.reviewStatus}
          onChange={(event) =>
            onChange({
              ...filters,
              reviewStatus: event.target.value,
            })
          }
          className="w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white outline-none focus:border-[#f1c36f]/60"
        >
          {REVIEW_STATUSES.map((item) => (
            <option
              key={item.label}
              value={item.value}
              className="bg-[#070d1a]"
            >
              {item.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRefresh}
          className="rounded-2xl border border-[#f1c36f]/30 bg-[#f1c36f]/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#f1c36f] transition hover:bg-[#f1c36f] hover:text-slate-950"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
