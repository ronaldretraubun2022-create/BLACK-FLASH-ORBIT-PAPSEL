import { Gauge } from "lucide-react";

export function ConfidenceMeter({ confidence = 0 }) {
  const safeConfidence = Math.max(0, Math.min(100, Number(confidence || 0)));
  const status =
    safeConfidence >= 82
      ? "Strong local context"
      : safeConfidence >= 58
        ? "Needs source review"
        : "No confidence yet";

  return (
    <section className="rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="orbit-kicker">Confidence Score</p>
          <h3 className="mt-1 text-lg font-black text-white">
            {safeConfidence ? `${safeConfidence}%` : "No score"}
          </h3>
        </div>
        <Gauge className="text-[#d9ad57]" size={20} />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-[#d9ad57] transition-all"
          style={{ width: `${safeConfidence}%` }}
        />
      </div>

      <p className="mt-3 text-xs font-bold text-zinc-500">{status}</p>
    </section>
  );
}
