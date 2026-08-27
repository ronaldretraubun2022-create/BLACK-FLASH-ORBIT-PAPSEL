import { X } from "lucide-react";

export function KnowledgePreviewModal({ document, onClose }) {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm">
      <article className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#070b12] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              KNOWLEDGE PREVIEW
            </p>
            <h3 className="mt-2 break-words text-2xl font-black text-white">
              {document.title}
            </h3>
          </div>

          <button
            aria-label="Close preview"
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
            onClick={onClose}
            type="button">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewMeta label="Source" value={document.source} />
          <PreviewMeta label="AI Enabled" value={document.useInAiContext ? "ON" : "OFF"} />
          <PreviewMeta label="Created" value={formatDate(document.createdAt)} />
          <PreviewMeta label="Updated" value={formatDate(document.updatedAt)} />
        </dl>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Content
          </p>
          <pre className="mt-3 max-h-[52vh] whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
            {document.content}
          </pre>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Metadata
          </p>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">
            {JSON.stringify(document.metadata || {}, null, 2)}
          </pre>
        </div>
      </article>
    </div>
  );
}

function PreviewMeta({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 truncate text-sm font-black text-white">{value || "-"}</dd>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
