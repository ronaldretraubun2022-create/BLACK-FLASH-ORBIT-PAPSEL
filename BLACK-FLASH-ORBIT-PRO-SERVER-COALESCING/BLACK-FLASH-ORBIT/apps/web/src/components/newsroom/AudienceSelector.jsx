export function AudienceSelector({
  options,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Target Audience
      </legend>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = option.id === value;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-cyan-300/50 bg-cyan-300/12 text-white"
                  : "border-white/10 bg-[#070d1a] text-slate-300 hover:border-cyan-300/35"
              }`}
            >
              <span className="block text-sm font-black">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
