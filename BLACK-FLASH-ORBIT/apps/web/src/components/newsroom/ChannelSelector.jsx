export function ChannelSelector({
  options,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Editorial Target
      </span>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-[#070d1a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((item) => (
          <option key={item.id} value={item.id} className="bg-[#070d1a]">
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
