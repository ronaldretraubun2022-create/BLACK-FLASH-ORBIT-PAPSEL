import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Edit3,
  Library,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Star,
  StarOff,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ALL_PROMPT_CATEGORIES_LABEL,
  buildPromptCategoryOptions,
  getPromptCategoryMeta,
  normalizePromptCategory,
} from "../data/promptCategories";
import * as localPromptTemplates from "../data/promptTemplates";
import { api } from "../services/api";

const EMPTY_FORM = {
  category: "newsroom",
  content: "",
  isFavorite: false,
  isPinned: false,
  title: "",
};

function toPromptText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function normalizePromptItem(prompt, fallbackId) {
  const category = normalizePromptCategory(prompt?.category);

  return {
    ...(prompt && typeof prompt === "object" ? prompt : {}),
    id: prompt?.id || fallbackId,
    title: toPromptText(prompt?.title || prompt?.name, "Prompt Template"),
    category,
    content: toPromptText(prompt?.content || prompt?.prompt),
    isFavorite: Boolean(prompt?.isFavorite || prompt?.is_favorite),
    isPinned: Boolean(prompt?.isPinned || prompt?.is_pinned),
    lastUsedAt: prompt?.lastUsedAt || prompt?.last_used_at || "",
    usageCount: Number(prompt?.usageCount || prompt?.usage_count || 0),
    categoryMeta: getPromptCategoryMeta(prompt?.category || category),
    createdAt: prompt?.createdAt || prompt?.created_at || "",
    updatedAt: prompt?.updatedAt || prompt?.updated_at || "",
  };
}

function getLocalPromptTemplates() {
  const source = localPromptTemplates.promptTemplates || [];

  return Array.isArray(source)
    ? source.map((template, index) =>
        normalizePromptItem(template, `local-prompt-${index}`),
      )
    : [];
}

function getPromptLibraryErrorMessage(error) {
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal memproses prompt library.";
  }
}

function isReadOnlyPrompt(prompt) {
  const id = String(prompt?.id || "");

  return id.startsWith("local-") || id.startsWith("fallback-");
}

function sortPrompts(promptList) {
  return [...promptList].sort((first, second) => {
    if (first.isPinned !== second.isPinned) {
      return first.isPinned ? -1 : 1;
    }

    if (first.isFavorite !== second.isFavorite) {
      return first.isFavorite ? -1 : 1;
    }

    return (
      new Date(second.updatedAt || second.createdAt || 0) -
      new Date(first.updatedAt || first.createdAt || 0)
    );
  });
}

function getResponsePrompt(response) {
  return response?.data || response;
}

function validatePromptForm(formState) {
  const title = toPromptText(formState.title).trim();
  const content = toPromptText(formState.content).trim();

  if (!title) return "Judul prompt wajib diisi.";
  if (!content) return "Isi prompt wajib diisi.";

  return "";
}

function downloadJson({ filename, payload }) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getImportPromptCount(payload) {
  if (Array.isArray(payload)) return payload.length;
  if (Array.isArray(payload?.prompts)) return payload.prompts.length;
  if (Array.isArray(payload?.data?.prompts)) return payload.data.prompts.length;

  return 0;
}

function createCurrentPromptTitle(value) {
  const words = toPromptText(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);

  return words ? `Current Prompt - ${words}` : "Current Workspace Prompt";
}

export function PromptLibrary({
  currentPrompt = "",
  latestAssistantResponse = "",
  onSelectTemplate,
}) {
  const [prompts, setPrompts] = useState([]);
  const [serverCategories, setServerCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    ALL_PROMPT_CATEGORIES_LABEL,
  );
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionPromptId, setActionPromptId] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [includeAssistantResponse, setIncludeAssistantResponse] =
    useState(false);
  const importInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPrompts() {
      try {
        setIsLoading(true);
        setError("");

        const [promptsResult, categoriesResult] = await Promise.allSettled([
          api.getPrompts(),
          api.getPromptCategories(),
        ]);
        const localPrompts = getLocalPromptTemplates();
        const promptsData =
          promptsResult.status === "fulfilled"
            ? promptsResult.value
            : localPrompts;
        const categoriesData =
          categoriesResult.status === "fulfilled" ? categoriesResult.value : null;

        if (!isMounted) return;

        setServerCategories(
          Array.isArray(categoriesData?.data)
            ? categoriesData.data.map(getPromptCategoryMeta)
            : [],
        );
        setPrompts(
          sortPrompts(
            Array.isArray(promptsData)
              ? promptsData.map((prompt, index) =>
                  normalizePromptItem(prompt, `remote-prompt-${index}`),
                )
              : [],
          ),
        );
      } catch (loadError) {
        const localPrompts = getLocalPromptTemplates();

        if (!isMounted) return;

        setError(localPrompts.length ? "" : getPromptLibraryErrorMessage(loadError));
        setPrompts(sortPrompts(localPrompts));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPrompts();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    return buildPromptCategoryOptions([
      ...serverCategories,
      ...prompts.map((prompt) => prompt.categoryMeta || prompt.category),
    ]);
  }, [prompts, serverCategories]);

  const selectableCategories = categoryOptions.filter(
    (category) => category.slug !== ALL_PROMPT_CATEGORIES_LABEL,
  );

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return prompts.filter((template) => {
      const categoryMeta = getPromptCategoryMeta(
        template.categoryMeta || template.category,
      );
      const matchesCategory =
        selectedCategory === ALL_PROMPT_CATEGORIES_LABEL ||
        normalizePromptCategory(template.category) === selectedCategory;
      const matchesSearch =
        !query ||
        [template.title, template.category, categoryMeta.label, template.content]
          .filter(Boolean)
          .some((value) => toPromptText(value).toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [prompts, searchQuery, selectedCategory]);

  function resetForm() {
    setFormState(EMPTY_FORM);
    setEditingPrompt(null);
    setIsFormOpen(false);
  }

  function openCreateForm() {
    setError("");
    setStatusMessage("");
    setEditingPrompt(null);
    setFormState({
      ...EMPTY_FORM,
      category:
        selectedCategory === ALL_PROMPT_CATEGORIES_LABEL
          ? "newsroom"
          : selectedCategory,
    });
    setIsFormOpen(true);
  }

  function openEditForm(prompt) {
    setError("");
    setStatusMessage("");
    setEditingPrompt(prompt);
    setFormState({
      category: normalizePromptCategory(prompt.category),
      content: prompt.content,
      isFavorite: Boolean(prompt.isFavorite),
      isPinned: Boolean(prompt.isPinned),
      title: prompt.title,
    });
    setIsFormOpen(true);
  }

  async function handleSubmitPrompt(event) {
    event.preventDefault();

    const validationMessage = validatePromptForm(formState);

    if (validationMessage || isSaving) {
      setError(validationMessage);
      return;
    }

    if (editingPrompt && isReadOnlyPrompt(editingPrompt)) {
      setError("Prompt bawaan tidak bisa diedit. Buat salinan baru.");
      return;
    }

    setIsSaving(true);
    setError("");
    setStatusMessage("");

    try {
      const payload = {
        category: formState.category,
        content: formState.content,
        isFavorite: formState.isFavorite,
        isPinned: formState.isPinned,
        title: formState.title,
      };
      const response = editingPrompt
        ? await api.updatePrompt({ ...payload, id: editingPrompt.id })
        : await api.createPrompt(payload);
      const savedPrompt = normalizePromptItem(
        getResponsePrompt(response),
        editingPrompt?.id || `prompt-${Date.now()}`,
      );

      setPrompts((currentPrompts) =>
        sortPrompts(
          editingPrompt
            ? currentPrompts.map((prompt) =>
                prompt.id === savedPrompt.id ? savedPrompt : prompt,
              )
            : [savedPrompt, ...currentPrompts],
        ),
      );
      setStatusMessage(
        editingPrompt ? "Prompt berhasil diperbarui." : "Prompt berhasil dibuat.",
      );
      resetForm();
    } catch (saveError) {
      setError(getPromptLibraryErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleFavorite(prompt) {
    if (isReadOnlyPrompt(prompt) || actionPromptId) return;

    const nextFavorite = !prompt.isFavorite;
    const previousPrompts = prompts;

    setActionPromptId(prompt.id);
    setError("");
    setStatusMessage("");
    setPrompts((currentPrompts) =>
      sortPrompts(
        currentPrompts.map((item) =>
          item.id === prompt.id ? { ...item, isFavorite: nextFavorite } : item,
        ),
      ),
    );

    try {
      const response = await api.togglePromptFavorite({
        id: prompt.id,
        isFavorite: nextFavorite,
      });
      const savedPrompt = normalizePromptItem(
        getResponsePrompt(response),
        prompt.id,
      );

      setPrompts((currentPrompts) =>
        sortPrompts(
          currentPrompts.map((item) =>
            item.id === savedPrompt.id ? savedPrompt : item,
          ),
        ),
      );
    } catch (favoriteError) {
      setPrompts(previousPrompts);
      setError(getPromptLibraryErrorMessage(favoriteError));
    } finally {
      setActionPromptId("");
    }
  }

  async function handleTogglePin(prompt) {
    if (isReadOnlyPrompt(prompt) || actionPromptId) return;

    const nextPinned = !prompt.isPinned;
    const previousPrompts = prompts;

    setActionPromptId(prompt.id);
    setError("");
    setStatusMessage("");
    setPrompts((currentPrompts) =>
      sortPrompts(
        currentPrompts.map((item) =>
          item.id === prompt.id ? { ...item, isPinned: nextPinned } : item,
        ),
      ),
    );

    try {
      const response = await api.togglePromptPin({
        id: prompt.id,
        isPinned: nextPinned,
      });
      const savedPrompt = normalizePromptItem(
        getResponsePrompt(response),
        prompt.id,
      );

      setPrompts((currentPrompts) =>
        sortPrompts(
          currentPrompts.map((item) =>
            item.id === savedPrompt.id ? savedPrompt : item,
          ),
        ),
      );
    } catch (pinError) {
      setPrompts(previousPrompts);
      setError(getPromptLibraryErrorMessage(pinError));
    } finally {
      setActionPromptId("");
    }
  }

  async function handleDuplicatePrompt(prompt) {
    if (isReadOnlyPrompt(prompt) || actionPromptId) return;

    setActionPromptId(prompt.id);
    setError("");
    setStatusMessage("");

    try {
      const response = await api.duplicatePrompt(prompt.id);
      const duplicatedPrompt = normalizePromptItem(
        getResponsePrompt(response),
        `duplicate-${Date.now()}`,
      );

      setPrompts((currentPrompts) =>
        sortPrompts([duplicatedPrompt, ...currentPrompts]),
      );
      setStatusMessage("Prompt berhasil diduplikasi.");
    } catch (duplicateError) {
      setError(getPromptLibraryErrorMessage(duplicateError));
    } finally {
      setActionPromptId("");
    }
  }

  async function handleDeletePrompt(prompt) {
    if (isReadOnlyPrompt(prompt) || actionPromptId) return;

    const shouldDelete = window.confirm(`Hapus prompt "${prompt.title}"?`);

    if (!shouldDelete) return;

    const previousPrompts = prompts;

    setActionPromptId(prompt.id);
    setError("");
    setStatusMessage("");
    setPrompts((currentPrompts) =>
      currentPrompts.filter((item) => item.id !== prompt.id),
    );

    try {
      await api.deletePrompt(prompt.id);
      if (editingPrompt?.id === prompt.id) resetForm();
      setStatusMessage("Prompt berhasil dihapus.");
    } catch (deleteError) {
      setPrompts(previousPrompts);
      setError(getPromptLibraryErrorMessage(deleteError));
    } finally {
      setActionPromptId("");
    }
  }

  async function handleSelectTemplate(template) {
    if (typeof onSelectTemplate === "function") {
      onSelectTemplate(template.content || "");
    }

    setStatusMessage("Prompt dimasukkan ke input AI Workspace.");

    if (isReadOnlyPrompt(template) || actionPromptId) return;

    const previousPrompts = prompts;
    const usedAt = new Date().toISOString();

    setActionPromptId(template.id);
    setPrompts((currentPrompts) =>
      sortPrompts(
        currentPrompts.map((item) =>
          item.id === template.id
            ? {
                ...item,
                lastUsedAt: usedAt,
                usageCount: Number(item.usageCount || 0) + 1,
              }
            : item,
        ),
      ),
    );

    try {
      const response = await api.markPromptUsed(template.id);
      const savedPrompt = normalizePromptItem(
        getResponsePrompt(response),
        template.id,
      );

      setPrompts((currentPrompts) =>
        sortPrompts(
          currentPrompts.map((item) =>
            item.id === savedPrompt.id ? savedPrompt : item,
          ),
        ),
      );
    } catch (useError) {
      setPrompts(previousPrompts);
      setError(getPromptLibraryErrorMessage(useError));
    } finally {
      setActionPromptId("");
    }
  }

  async function handleExportPrompts() {
    setError("");
    setStatusMessage("");

    try {
      const response = await api.exportPrompts();
      const payload = response?.data || response;

      downloadJson({
        filename: `black-flash-orbit-prompts-${new Date()
          .toISOString()
          .slice(0, 10)}.json`,
        payload,
      });
      setStatusMessage("Prompt library diexport ke JSON.");
    } catch (exportError) {
      setError(getPromptLibraryErrorMessage(exportError));
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setError("");
    setStatusMessage("");
    setIsSaving(true);

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const count = getImportPromptCount(payload);

      if (!count) {
        throw new Error("File import tidak berisi array prompts.");
      }

      const response = await api.importPrompts(payload);
      const importedPrompts = Array.isArray(response?.data)
        ? response.data.map((prompt, index) =>
            normalizePromptItem(prompt, `imported-${index}`),
          )
        : [];

      setPrompts((currentPrompts) =>
        sortPrompts([...importedPrompts, ...currentPrompts]),
      );
      setStatusMessage(`${importedPrompts.length} prompt berhasil diimport.`);
    } catch (importError) {
      setError(getPromptLibraryErrorMessage(importError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCurrentPrompt() {
    const cleanPrompt = toPromptText(currentPrompt).trim();

    if (!cleanPrompt || isSaving) {
      setError("Input AI Workspace kosong.");
      return;
    }

    const assistantText = toPromptText(latestAssistantResponse).trim();
    const content =
      includeAssistantResponse && assistantText
        ? `${cleanPrompt}\n\n---\nAI Response Reference:\n${assistantText}`
        : cleanPrompt;

    setIsSaving(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await api.createPrompt({
        category: selectedCategory === ALL_PROMPT_CATEGORIES_LABEL
          ? "newsroom"
          : selectedCategory,
        content,
        isFavorite: false,
        isPinned: false,
        title: createCurrentPromptTitle(cleanPrompt),
      });
      const savedPrompt = normalizePromptItem(
        getResponsePrompt(response),
        `current-${Date.now()}`,
      );

      setPrompts((currentPrompts) =>
        sortPrompts([savedPrompt, ...currentPrompts]),
      );
      setStatusMessage("Current Workspace prompt disimpan ke library.");
    } catch (saveError) {
      setError(getPromptLibraryErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Library className="text-[#d6a93a]" size={18} />
          <p className="text-[10px] font-black tracking-[0.24em] text-[#d6a93a]">
            PROMPT LIBRARY
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-[#d6a93a]/30 hover:text-[#f8e7b0]"
            onClick={handleExportPrompts}
            type="button">
            <Download size={14} />
            Export
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-[#d6a93a]/30 hover:text-[#f8e7b0]"
            onClick={() => importInputRef.current?.click()}
            type="button">
            <Upload size={14} />
            Import
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d6a93a]/30 bg-[#d6a93a]/10 px-3 py-2 text-xs font-black text-[#f8e7b0] transition hover:bg-[#d6a93a]/15"
            onClick={openCreateForm}
            type="button">
            <Plus size={14} />
            Baru
          </button>
        </div>
      </div>
      <input
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
        ref={importInputRef}
        type="file"
      />

      <div className="mt-4 grid gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-500 transition focus-within:border-[#d6a93a]/40">
          <Search size={15} />
          <input
            className="w-full bg-transparent text-xs font-bold text-slate-100 outline-none placeholder:text-slate-600"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari title, isi, kategori..."
            value={searchQuery}
          />
        </label>

        <select
          className="rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-xs font-bold text-slate-100 outline-none transition focus:border-[#d6a93a]/40"
          onChange={(event) => setSelectedCategory(event.target.value)}
          value={selectedCategory}>
          {categoryOptions.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      {isFormOpen && (
        <form
          className="mt-4 grid gap-3 rounded-2xl border border-[#d6a93a]/20 bg-black/25 p-4"
          onSubmit={handleSubmitPrompt}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black text-white">
              {editingPrompt ? "Edit Prompt" : "Buat Prompt"}
            </p>
            <button
              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:text-white"
              onClick={resetForm}
              type="button">
              <X size={15} />
            </button>
          </div>

          <label className="grid gap-2 text-[11px] font-bold text-slate-400">
            Judul
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d6a93a]/40"
              maxLength={140}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              value={formState.title}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-[11px] font-bold text-slate-400">
              Kategori
              <select
                className="rounded-xl border border-white/10 bg-[#0c1320] px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#d6a93a]/40"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                value={formState.category}>
                {selectableCategories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-end gap-2 pb-2 text-[11px] font-bold text-slate-300">
              <input
                checked={formState.isFavorite}
                className="size-4 accent-[#d6a93a]"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    isFavorite: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Favorite
            </label>
            <label className="flex items-end gap-2 pb-2 text-[11px] font-bold text-slate-300">
              <input
                checked={formState.isPinned}
                className="size-4 accent-[#d6a93a]"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    isPinned: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Pin
            </label>
          </div>

          <label className="grid gap-2 text-[11px] font-bold text-slate-400">
            Isi Prompt
            <textarea
              className="min-h-32 resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs leading-5 text-white outline-none focus:border-[#d6a93a]/40"
              maxLength={12000}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  content: event.target.value,
                }))
              }
              value={formState.content}
            />
          </label>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d6a93a]/30 bg-[#d6a93a]/15 px-4 py-3 text-xs font-black text-[#f8e7b0] transition hover:bg-[#d6a93a]/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            type="submit">
            {isSaving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            {editingPrompt ? "Simpan Perubahan" : "Simpan Prompt"}
          </button>
        </form>
      )}

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black text-white">
              Save Current Conversation as Prompt
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Simpan input aktif dari AI Workspace tanpa auto-submit.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!toPromptText(currentPrompt).trim() || isSaving}
            onClick={handleSaveCurrentPrompt}
            type="button">
            <Save size={14} />
            Save Current
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-400">
          <input
            checked={includeAssistantResponse}
            className="size-4 accent-cyan-300"
            disabled={!toPromptText(latestAssistantResponse).trim()}
            onChange={(event) =>
              setIncludeAssistantResponse(event.target.checked)
            }
            type="checkbox"
          />
          Include latest AI response
        </label>
      </div>

      <div className="mt-4 grid gap-2">
        {statusMessage && (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-100">
            <Check size={15} />
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs leading-5 text-rose-200">
            <AlertCircle size={15} />
            {error}
          </div>
        )}
      </div>

      <div className="mt-4 grid max-h-[640px] gap-3 overflow-y-auto pr-1">
        {isLoading && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs font-bold text-slate-400">
            <Loader2 className="animate-spin text-[#d6a93a]" size={16} />
            Memuat prompt dari Supabase...
          </div>
        )}

        {!isLoading &&
          filteredTemplates.map((template) => {
            const categoryMeta = getPromptCategoryMeta(
              template.categoryMeta || template.category,
            );
            const readOnly = isReadOnlyPrompt(template);
            const isActionLoading = actionPromptId === template.id;

            return (
              <article
                className="rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:border-[#d6a93a]/30"
                key={template.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="line-clamp-1 text-sm font-black text-white">
                      {template.title}
                    </h4>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: categoryMeta.color }}
                        />
                        {categoryMeta.label}
                      </span>
                      {template.isFavorite && (
                        <span className="rounded-full border border-[#d6a93a]/30 bg-[#d6a93a]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#f8e7b0]">
                          Favorite
                        </span>
                      )}
                      {template.isPinned && (
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
                          Pinned
                        </span>
                      )}
                      {readOnly && (
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-500">
                          Template
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:border-[#d6a93a]/30 hover:text-[#f8e7b0] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={readOnly || Boolean(actionPromptId)}
                    onClick={() => handleToggleFavorite(template)}
                    title={template.isFavorite ? "Unfavorite" : "Favorite"}
                    type="button">
                    {isActionLoading ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : template.isFavorite ? (
                      <Star size={15} />
                    ) : (
                      <StarOff size={15} />
                    )}
                  </button>
                  <button
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={readOnly || Boolean(actionPromptId)}
                    onClick={() => handleTogglePin(template)}
                    title={template.isPinned ? "Unpin prompt" : "Pin prompt"}
                    type="button">
                    {template.isPinned ? <PinOff size={15} /> : <Pin size={15} />}
                  </button>
                </div>

                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-slate-400">
                  {template.content}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  <span>Used {template.usageCount || 0}x</span>
                  {template.lastUsedAt && (
                    <span>
                      Last {new Date(template.lastUsedAt).toLocaleDateString("id-ID")}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/15"
                    onClick={() => handleSelectTemplate(template)}
                    type="button">
                    Use Prompt
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={readOnly || Boolean(actionPromptId)}
                    onClick={() => handleDuplicatePrompt(template)}
                    type="button">
                    <Copy size={14} />
                    Copy
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-[#d6a93a]/30 hover:text-[#f8e7b0] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={readOnly}
                    onClick={() => openEditForm(template)}
                    type="button">
                    <Edit3 size={14} />
                    Edit
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={readOnly || Boolean(actionPromptId)}
                    onClick={() => handleDeletePrompt(template)}
                    type="button">
                    <Trash2 size={14} />
                    Hapus
                  </button>
                </div>
              </article>
            );
          })}

        {!isLoading && filteredTemplates.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">
            Prompt tidak ditemukan.
          </p>
        )}
      </div>
    </section>
  );
}
