const REVIEW_LABELS = {
  AI_REVIEWED: "AI reviewed",
  DRAFT: "Draft",
  NEEDS_REVIEW: "Needs editor review",
  READY_FOR_EDITOR: "Ready for editor",
};

const REVIEW_CLASSES = {
  AI_REVIEWED: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  DRAFT: "border-white/10 bg-white/[0.04] text-slate-200",
  NEEDS_REVIEW: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  READY_FOR_EDITOR: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
};

export function EditorialReviewBadge({ status }) {
  const value = status || "DRAFT";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${REVIEW_CLASSES[value] || REVIEW_CLASSES.DRAFT}`}
    >
      {REVIEW_LABELS[value] || value}
    </span>
  );
}
