import { Link2 } from "lucide-react";

function getReliabilityClass(reliability) {
  if (reliability === "High") {
    return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  }

  if (reliability === "Medium") {
    return "border-[#d9ad57]/25 bg-[#d9ad57]/10 text-[#f1c36f]";
  }

  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

export function SourceCitationCard({ citation }) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <Link2 className="shrink-0 text-[#d9ad57]" size={14} />
            <span className="truncate">{citation.label}</span>
          </p>
          <p className="mt-1 text-xs font-bold text-zinc-500">
            {citation.documentTitle || citation.source}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-black uppercase ${getReliabilityClass(
            citation.reliability,
          )}`}>
          {citation.reliability || "Source"}
        </span>
      </div>

      <p className="mt-3 text-xs font-bold text-zinc-500">{citation.locator}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-300">{citation.quote}</p>
    </article>
  );
}
