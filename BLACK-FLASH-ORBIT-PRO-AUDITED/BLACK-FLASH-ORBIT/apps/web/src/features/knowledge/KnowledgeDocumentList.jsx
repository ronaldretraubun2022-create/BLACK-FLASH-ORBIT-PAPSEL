import { Eye, Pencil, Trash2 } from "lucide-react";

export function KnowledgeDocumentList({
  documents,
  isLoading,
  onDelete,
  onEdit,
  onToggleContext,
  onView,
}) {
  const safeDocuments = Array.isArray(documents) ? documents : [];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
            KNOWLEDGE LIST
          </p>
          <h3 className="mt-2 text-xl font-black text-white">
            Documents
          </h3>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
          {safeDocuments.length} items
        </span>
      </div>

      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Title</th>
              <th className="py-3 pr-4">Source</th>
              <th className="py-3 pr-4">Created</th>
              <th className="py-3 pr-4">Updated</th>
              <th className="py-3 pr-4">AI Context Enabled</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="py-5 text-cyan-200" colSpan="6">
                  Loading knowledge...
                </td>
              </tr>
            ) : (
              safeDocuments.map((document) => (
                <tr className="border-b border-white/5" key={document.id}>
                  <td className="max-w-[280px] py-4 pr-4">
                    <strong className="block truncate text-white">
                      {document.title}
                    </strong>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {document.content}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-slate-300">
                    <SourceBadge source={document.source} />
                  </td>
                  <td className="py-4 pr-4 text-slate-500">
                    {formatDate(document.createdAt)}
                  </td>
                  <td className="py-4 pr-4 text-slate-500">
                    {formatDate(document.updatedAt)}
                  </td>
                  <td className="py-4 pr-4">
                    <ContextSwitch
                      checked={document.useInAiContext}
                      onChange={() =>
                        onToggleContext(document, !document.useInAiContext)
                      }
                    />
                  </td>
                  <td className="py-4 pr-4">
                    <ActionGroup
                      document={document}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onView={onView}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 lg:hidden">
        {isLoading ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm font-bold text-cyan-100">
            Loading knowledge...
          </div>
        ) : (
          safeDocuments.map((document) => (
            <article
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
              key={document.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="break-words text-base font-black text-white">
                    {document.title}
                  </h4>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                    {document.content}
                  </p>
                </div>
                <SourceBadge source={document.source} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <MetaItem label="Created" value={formatDate(document.createdAt)} />
                <MetaItem label="Updated" value={formatDate(document.updatedAt)} />
              </dl>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ContextSwitch
                  checked={document.useInAiContext}
                  onChange={() =>
                    onToggleContext(document, !document.useInAiContext)
                  }
                />
                <ActionGroup
                  document={document}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onView={onView}
                />
              </div>
            </article>
          ))
        )}
      </div>

      {!isLoading && safeDocuments.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-500">
          No knowledge documents found.
        </div>
      )}
    </section>
  );
}

function ActionGroup({ document, onDelete, onEdit, onView }) {
  return (
    <div className="flex flex-wrap gap-2">
      <IconButton label="View" onClick={() => onView(document)}>
        <Eye size={15} />
      </IconButton>
      <IconButton label="Edit" onClick={() => onEdit(document)}>
        <Pencil size={15} />
      </IconButton>
      <IconButton danger label="Delete" onClick={() => onDelete(document)}>
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}

function IconButton({ children, danger = false, label, onClick }) {
  return (
    <button
      className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
        danger
          ? "border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15"
          : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-300/30 hover:text-cyan-100"
      }`}
      onClick={onClick}
      title={label}
      type="button">
      {children}
      <span>{label}</span>
    </button>
  );
}

function ContextSwitch({ checked, onChange }) {
  return (
    <button
      aria-pressed={checked}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-black transition ${
        checked
          ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
          : "border-white/10 bg-white/[0.04] text-slate-400"
      }`}
      onClick={onChange}
      type="button">
      <span
        className={`size-2 rounded-full ${
          checked
            ? "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.8)]"
            : "bg-slate-500"
        }`}
      />
      {checked ? "ON" : "OFF"}
    </button>
  );
}

function SourceBadge({ source }) {
  return (
    <span className="inline-flex max-w-32 items-center truncate rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase text-cyan-100">
      {source || "manual"}
    </span>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <dt className="font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-slate-200">{value}</dd>
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
