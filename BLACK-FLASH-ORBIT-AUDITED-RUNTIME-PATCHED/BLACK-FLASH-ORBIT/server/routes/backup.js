const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const APP_NAME = "BLACK FLASH ORBIT";
const APP_VERSION = "1.0.0";
const MAX_IMPORT_BYTES = 900 * 1024;
const MAX_TEXT_LENGTH = 20000;
const MAX_TITLE_LENGTH = 180;
const MAX_CATEGORY_LENGTH = 80;
const MAX_MODEL_LENGTH = 120;
const ALLOWED_MESSAGE_ROLES = new Set(["system", "user", "assistant"]);

function createHttpError(message, statusCode = 500, code = "SERVER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getSupabaseAuthConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createHttpError(
      "Supabase environment belum lengkap untuk backup.",
      500,
      "SUPABASE_ENV_MISSING",
    );
  }

  return { supabaseAnonKey, supabaseUrl };
}

function getBearerToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw createHttpError(
      "Authorization Bearer token wajib dikirim.",
      401,
      "AUTH_REQUIRED",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw createHttpError(
      "Authorization Bearer token tidak valid.",
      401,
      "AUTH_REQUIRED",
    );
  }

  return token;
}

function createUserSupabaseClient(req) {
  const { supabaseAnonKey, supabaseUrl } = getSupabaseAuthConfig();
  const token = getBearerToken(req);

  return {
    client: createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }),
    token,
  };
}

async function getAuthenticatedUser(client, token) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error) throw error;

  if (!user?.id) {
    throw createHttpError(
      "Session login tidak aktif. Silakan login ulang.",
      401,
      "AUTH_REQUIRED",
    );
  }

  return user;
}

function sendError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || error.status || 500;
  const message =
    statusCode >= 500 ? fallbackMessage : error.message || fallbackMessage;

  return res.status(statusCode).json({
    success: false,
    error: message,
    code: error.code || null,
  });
}

function recordImportError(errors, scope, error) {
  console.warn("[ORBIT Backup Import] table import failed", {
    code: error?.code || null,
    scope,
    status: error?.status || null,
  });

  errors.push(`${scope}: gagal import data`);
}

function safeString(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeBoolean(value) {
  return Boolean(value);
}

function normalizeDate(value) {
  if (typeof value !== "string") return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString();
}

function normalizeId(value) {
  return safeString(value, 80);
}

function sanitizeSession(record, userId) {
  const id = normalizeId(record?.id);
  const title = safeString(record?.title, MAX_TITLE_LENGTH);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    user_id: userId,
    title,
    pinned: safeBoolean(record?.pinned),
    model: safeString(record?.model, MAX_MODEL_LENGTH) || "openrouter/auto",
    created_at: normalizeDate(record?.created_at || record?.createdAt),
  };
}

function sanitizeMessage(record, userId, sessionIds) {
  const id = normalizeId(record?.id);
  const sessionId = normalizeId(record?.session_id || record?.sessionId);
  const role = safeString(record?.role, 20);
  const content = safeString(record?.content, MAX_TEXT_LENGTH);

  if (
    !id ||
    !sessionId ||
    !sessionIds.has(sessionId) ||
    !ALLOWED_MESSAGE_ROLES.has(role) ||
    !content
  ) {
    return null;
  }

  return {
    id,
    session_id: sessionId,
    user_id: userId,
    role,
    content,
    model: safeString(record?.model, MAX_MODEL_LENGTH) || "openrouter/auto",
    created_at: normalizeDate(record?.created_at || record?.createdAt),
  };
}

function sanitizePromptTemplate(record, userId) {
  const id = normalizeId(record?.id);
  const title = safeString(record?.title, MAX_TITLE_LENGTH);
  const prompt = safeString(record?.prompt, MAX_TEXT_LENGTH);

  if (!id || !title || !prompt) {
    return null;
  }

  return {
    id,
    user_id: userId,
    title,
    category: safeString(record?.category, MAX_CATEGORY_LENGTH) || "Umum",
    prompt,
    is_favorite: safeBoolean(record?.is_favorite || record?.isFavorite),
    created_at: normalizeDate(record?.created_at || record?.createdAt),
    updated_at: normalizeDate(record?.updated_at || record?.updatedAt),
  };
}

function removeUndefinedValues(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(
      "Payload backup harus berupa JSON object.",
      400,
      "INVALID_BACKUP",
    );
  }

  if (!payload.metadata || payload.metadata.app !== APP_NAME) {
    throw createHttpError(
      "Payload backup bukan file BLACK FLASH ORBIT yang valid.",
      400,
      "INVALID_BACKUP",
    );
  }

  if (!Array.isArray(payload.sessions) || !Array.isArray(payload.messages)) {
    throw createHttpError(
      "Payload backup wajib memiliki sessions dan messages array.",
      400,
      "INVALID_BACKUP",
    );
  }
}

async function safeSelect(client, table, columns, userId) {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq("user_id", userId);

  if (error) {
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

function createBackupMetadata({ messages, promptTemplates, sessions }) {
  return {
    app: APP_NAME,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    recordCounts: {
      sessions: sessions.length,
      messages: messages.length,
      promptTemplates: promptTemplates.length,
    },
  };
}

router.get("/export", async (req, res) => {
  try {
    const { client, token } = createUserSupabaseClient(req);
    const user = await getAuthenticatedUser(client, token);

    const [sessionsResult, messagesResult, profileResult, promptsResult] =
      await Promise.all([
        safeSelect(
          client,
          "chat_sessions",
          "id, user_id, title, pinned, model, created_at, updated_at",
          user.id,
        ),
        safeSelect(
          client,
          "chat_messages",
          "id, session_id, user_id, role, model, content, created_at",
          user.id,
        ),
        client
          .from("profiles")
          .select("id, email, role")
          .eq("id", user.id)
          .maybeSingle(),
        safeSelect(
          client,
          "prompt_templates",
          "id, user_id, title, category, prompt, is_favorite, created_at, updated_at",
          user.id,
        ),
      ]);

    if (sessionsResult.error) throw sessionsResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const promptTemplates = promptsResult.error ? [] : promptsResult.data;
    const userSettings = profileResult.error
      ? null
      : {
          profile: profileResult.data
            ? {
                id: profileResult.data.id,
                email: profileResult.data.email,
                role: profileResult.data.role,
              }
            : null,
        };

    const backup = {
      metadata: createBackupMetadata({
        sessions: sessionsResult.data,
        messages: messagesResult.data,
        promptTemplates,
      }),
      sessions: sessionsResult.data,
      messages: messagesResult.data,
      promptTemplates,
      userSettings,
    };

    return res.json({
      success: true,
      data: backup,
    });
  } catch (error) {
    return sendError(res, error, "Gagal export backup.");
  }
});

router.post("/import", async (req, res) => {
  try {
    const contentLength = Number(req.headers["content-length"] || 0);

    if (contentLength > MAX_IMPORT_BYTES) {
      throw createHttpError(
        "Ukuran backup terlalu besar.",
        413,
        "PAYLOAD_TOO_LARGE",
      );
    }

    const { client, token } = createUserSupabaseClient(req);
    const user = await getAuthenticatedUser(client, token);
    const payload = req.body;

    validateImportPayload(payload);

    const errors = [];
    let skippedRecords = 0;

    const sessions = payload.sessions
      .map((record) => sanitizeSession(record, user.id))
      .filter((record) => {
        if (record) return true;
        skippedRecords += 1;
        return false;
      })
      .map(removeUndefinedValues);

    const sessionIds = new Set(sessions.map((session) => session.id));

    const messages = payload.messages
      .map((record) => sanitizeMessage(record, user.id, sessionIds))
      .filter((record) => {
        if (record) return true;
        skippedRecords += 1;
        return false;
      })
      .map(removeUndefinedValues);

    const promptTemplates = Array.isArray(payload.promptTemplates)
      ? payload.promptTemplates
          .map((record) => sanitizePromptTemplate(record, user.id))
          .filter((record) => {
            if (record) return true;
            skippedRecords += 1;
            return false;
          })
          .map(removeUndefinedValues)
      : [];

    if (sessions.length > 0) {
      const { error } = await client
        .from("chat_sessions")
        .upsert(sessions, { onConflict: "id" });

      if (error) {
        recordImportError(errors, "sessions", error);
      }
    }

    if (messages.length > 0) {
      const { error } = await client
        .from("chat_messages")
        .upsert(messages, { onConflict: "id" });

      if (error) {
        recordImportError(errors, "messages", error);
      }
    }

    if (promptTemplates.length > 0) {
      const { error } = await client
        .from("prompt_templates")
        .upsert(promptTemplates, { onConflict: "id" });

      if (error) {
        recordImportError(errors, "prompt_templates", error);
      }
    }

    return res.json({
      success: errors.length === 0,
      data: {
        importedSessions: errors.some((item) => item.startsWith("sessions:"))
          ? 0
          : sessions.length,
        importedMessages: errors.some((item) => item.startsWith("messages:"))
          ? 0
          : messages.length,
        importedPromptTemplates: errors.some((item) =>
          item.startsWith("prompt_templates:"),
        )
          ? 0
          : promptTemplates.length,
        skippedRecords,
        errors,
      },
    });
  } catch (error) {
    return sendError(res, error, "Gagal import backup.");
  }
});

module.exports = router;
