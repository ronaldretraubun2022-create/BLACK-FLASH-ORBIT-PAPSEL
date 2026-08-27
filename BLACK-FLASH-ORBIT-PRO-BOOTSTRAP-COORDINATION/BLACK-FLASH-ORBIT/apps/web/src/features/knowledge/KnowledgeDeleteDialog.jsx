import { AlertTriangle, X } from "lucide-react";

export function KnowledgeDeleteDialog({
  document,
  isLoading,
  onClose,
  onConfirm,
}) {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <article className="w-full max-w-md rounded-2xl border border-rose-300/20 bg-[#070b12] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-11 place-items-center rounded-xl border border-rose-300/25 bg-rose-300/10 text-rose-200">
            <AlertTriangle size={20} />
          </span>
          <button
            aria-label="Close delete dialog"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-rose-300/30 hover:text-rose-100"
            onClick={onClose}
            type="button">
            <X size={18} />
          </button>
        </div>

        <h3 className="mt-5 text-xl font-black text-white">
          Delete Knowledge
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Delete "{document.title}" from your personal knowledge base?
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-black text-slate-300 transition hover:bg-white/[0.06]"
            onClick={onClose}
            type="button">
            Cancel
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-300/30 bg-rose-300/15 px-5 text-sm font-black text-rose-100 transition hover:bg-rose-300/20 disabled:opacity-50"
            disabled={isLoading}
            onClick={onConfirm}
            type="button">
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </article>
    </div>
  );
}
