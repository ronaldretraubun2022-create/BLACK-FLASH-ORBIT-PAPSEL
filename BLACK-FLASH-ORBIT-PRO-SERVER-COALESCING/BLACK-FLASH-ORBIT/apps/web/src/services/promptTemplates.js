import { supabase } from "../lib/supabase";
import { normalizePromptCategory } from "../data/promptCategories";

const DEFAULT_CATEGORY = "newsroom";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  return supabase;
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizePromptTemplate(template) {
  return {
    id: template.id,
    userId: template.user_id,
    title: template.title || "Prompt Tanpa Judul",
    prompt: template.prompt || "",
    category: normalizePromptCategory(template.category, DEFAULT_CATEGORY),
    isFavorite: Boolean(template.is_favorite),
    createdAt: template.created_at,
    updatedAt: template.updated_at || template.created_at,
  };
}

function sortPromptTemplates(templateList) {
  return [...templateList].sort((first, second) => {
    if (first.isFavorite !== second.isFavorite) {
      return first.isFavorite ? -1 : 1;
    }

    return new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0);
  });
}

function validatePromptTemplatePayload({ prompt, title }) {
  const cleanTitle = normalizeText(title);
  const cleanPrompt = normalizeText(prompt);

  if (!cleanTitle) {
    throw new Error("Judul prompt wajib diisi.");
  }

  if (!cleanPrompt) {
    throw new Error("Isi prompt wajib diisi.");
  }

  return {
    cleanPrompt,
    cleanTitle,
  };
}

export async function getPromptTemplates(userId) {
  const client = requireSupabase();

  if (!userId) {
    throw new Error("User login wajib tersedia untuk memuat prompt template.");
  }

  const { data, error } = await client
    .from("prompt_templates")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;

  return sortPromptTemplates((data || []).map(normalizePromptTemplate));
}

export async function createPromptTemplate({
  category,
  isFavorite = false,
  prompt,
  title,
  userId,
}) {
  const client = requireSupabase();
  const { cleanPrompt, cleanTitle } = validatePromptTemplatePayload({
    prompt,
    title,
  });

  if (!userId) {
    throw new Error("User login wajib tersedia untuk membuat prompt template.");
  }

  const { data, error } = await client
    .from("prompt_templates")
    .insert([
      {
        user_id: userId,
        title: cleanTitle,
        prompt: cleanPrompt,
        category: normalizePromptCategory(category, DEFAULT_CATEGORY),
        is_favorite: Boolean(isFavorite),
      },
    ])
    .select("*")
    .single();

  if (error) throw error;

  return normalizePromptTemplate(data);
}

export async function updatePromptTemplate({
  category,
  id,
  isFavorite,
  prompt,
  title,
  userId,
}) {
  const client = requireSupabase();
  const { cleanPrompt, cleanTitle } = validatePromptTemplatePayload({
    prompt,
    title,
  });

  if (!id || !userId) {
    throw new Error("Prompt template dan user login wajib tersedia.");
  }

  const { data, error } = await client
    .from("prompt_templates")
    .update({
      title: cleanTitle,
      prompt: cleanPrompt,
      category: normalizePromptCategory(category, DEFAULT_CATEGORY),
      is_favorite: Boolean(isFavorite),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Prompt template tidak ditemukan atau bukan milik user login.");
  }

  return normalizePromptTemplate(data);
}

export async function togglePromptTemplateFavorite({
  id,
  isFavorite,
  userId,
}) {
  const client = requireSupabase();

  if (!id || !userId) {
    throw new Error("Prompt template dan user login wajib tersedia.");
  }

  const { data, error } = await client
    .from("prompt_templates")
    .update({ is_favorite: Boolean(isFavorite) })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Prompt template tidak ditemukan atau bukan milik user login.");
  }

  return normalizePromptTemplate(data);
}

export async function deletePromptTemplate({ id, userId }) {
  const client = requireSupabase();

  if (!id || !userId) {
    throw new Error("Prompt template dan user login wajib tersedia.");
  }

  const { error } = await client
    .from("prompt_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;

  return { id };
}

export function getPromptTemplateErrorMessage(error) {
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal memproses prompt template.";
  }
}
