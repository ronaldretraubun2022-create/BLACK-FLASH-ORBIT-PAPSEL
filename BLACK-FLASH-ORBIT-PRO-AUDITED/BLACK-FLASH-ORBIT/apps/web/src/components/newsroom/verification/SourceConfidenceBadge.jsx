const LEVEL_LABELS = {
  HIGH: "High confidence",
  INSUFFICIENT: "Insufficient evidence",
  LOW: "Low confidence",
  MEDIUM: "Medium confidence",
};

const LEVEL_CLASSES = {
  HIGH: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  INSUFFICIENT: "border-rose-300/25 bg-rose-300/10 text-rose-100",
  LOW: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  MEDIUM: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
};

export function SourceConfidenceBadge({ sourceConfidence }) {
  const level = sourceConfidence?.level || "INSUFFICIENT";
  const score = Number(sourceConfidence?.score || 0);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${LEVEL_CLASSES[level] || LEVEL_CLASSES.INSUFFICIENT}`}
    >
      {LEVEL_LABELS[level] || LEVEL_LABELS.INSUFFICIENT}
      <span className="text-white/80">{score}%</span>
    </span>
  );
}
