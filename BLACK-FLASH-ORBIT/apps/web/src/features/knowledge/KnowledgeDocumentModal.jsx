import { X } from "lucide-react";
import { useEffect, useState } from "react";

const emptyForm = {
  content: "",
  source: "manual",
  title: "",
  useInAiContext: true,
};

export function KnowledgeDocumentModal({
  document,
  isLoading,
  mode,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (document) {
      setForm({
        content: document.content || "",
        source: document.source || "manual",
        title: document.title || "",
        useInAiContext: Boolean(document.useInAiContext),
      });
      return;
    }

    setForm(emptyForm);
  }, [document]);

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  const isEditMode = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm">
      <form
        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#070b12] p-5 shadow-2xl shadow-black/60"
        onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              {isEditMode ? "EDIT KNOWLEDGE" : "ADD KNOWLEDGE"}
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              {isEditMode ? "Edit Knowledge" : "Add Knowledge"}
            </h3>
          </div>

          <button
            aria-label="Close modal"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
            onClick={onClose}
            type="button">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Title
            <input
              className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-bold normal-case tracking-normal text-white outline-none transition focus:border-cyan-300/40"
              maxLength={180}
              onChange={(event) => updateField("title", event.target.value)}
              required
              value={form.title}
            />
          </label>

          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Content
            <textarea
              className="min-h-72 resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm leading-6 normal-case tracking-normal text-white outline-none transition focus:border-cyan-300/40"
              onChange={(event) => updateField("content", event.target.value)}
              required
              value={form.content}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Source
              <input
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-bold normal-case tracking-normal text-white outline-none transition focus:border-cyan-300/40"
                maxLength={180}
                onChange={(event) => updateField("source", event.target.value)}
                value={form.source}
              />
            </label>

            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-slate-200">
              <input
                checked={form.useInAiContext}
                className="size-4 accent-cyan-300"
                onChange={(event) =>
                  updateField("useInAiContext", event.target.checked)
                }
                type="checkbox"
              />
              Use in AI Context
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-black text-slate-300 transition hover:bg-white/[0.06]"
            onClick={onClose}
            type="button">
            Cancel
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-5 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
            disabled={isLoading}
            type="submit">
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
