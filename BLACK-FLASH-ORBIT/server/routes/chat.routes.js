const express = require("express");
const supabase = require("../lib/supabase");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan Baru";
const PERSISTED_MESSAGE_ROLES = ["user", "assistant"];

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function createHttpError(message, statusCode = 500, code = "SERVER_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
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

function requireSupabase() {
  if (!supabase) {
    throw createHttpError(
      "Supabase belum dikonfigurasi.",
      500,
      "SUPABASE_NOT_CONFIGURED",
    );
  }

  return supabase;
}

function getAuthenticatedEmail(req) {
  const email = normalizeEmail(req.user?.email);

  if (!email) {
    throw createHttpError(
      "Email user login tidak tersedia.",
      400,
      "AUTH_EMAIL_REQUIRED",
    );
  }

  return email;
}

async function getOwnedSession(db, sessionId, userEmail) {
  const { data, error } = await db
    .from("orbit_chat_sessions")
    .select("id, title, user_email, model, pinned, created_at, updated_at")
    .eq("id", sessionId)
    .eq("user_email", userEmail)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw createHttpError(
      "Chat session tidak ditemukan atau bukan milik user login.",
      404,
      "SESSION_NOT_FOUND",
    );
  }

  return data;
}

function mapSession(row) {
  return {
    id: row.id,
    title: row.title,
    userEmail: row.user_email,
    model: row.model,
    pinned: Boolean(row.pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  if (!PERSISTED_MESSAGE_ROLES.includes(row.role)) return null;

  return {
    id: row.id,
    sessionId: row.session_id,
    userEmail: row.user_email,
    role: row.role,
    content: row.content,
    model: row.model,
    createdAt: row.created_at,
  };
}

router.use(requireAuth);

router.get("/sessions", async (req, res) => {
  try {
    const db = requireSupabase();
    const userEmail = getAuthenticatedEmail(req);

    const { data, error } = await db
      .from("orbit_chat_sessions")
      .select("id, title, user_email, model, pinned, created_at, updated_at")
      .eq("user_email", userEmail)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({
      success: true,
      data: (data || []).map(mapSession),
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil chat sessions.");
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const db = requireSupabase();
    const userEmail = getAuthenticatedEmail(req);

    const title = normalizeText(req.body?.title, DEFAULT_SESSION_TITLE);
    const model = normalizeText(req.body?.model, DEFAULT_MODEL);

    const payload = {
      title,
      model,
      user_email: userEmail,
      pinned: false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from("orbit_chat_sessions")
      .insert([payload])
      .select("id, title, user_email, model, pinned, created_at, updated_at")
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data: mapSession(data),
    });
  } catch (error) {
    return sendError(res, error, "Gagal membuat chat session.");
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    const db = requireSupabase();
    const userEmail = getAuthenticatedEmail(req);

    const sessionId = normalizeText(req.params?.id);
    const title = normalizeText(req.body?.title);

    if (!sessionId || !title) {
      throw createHttpError(
        "session id dan title wajib diisi.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const { data, error } = await db
      .from("orbit_chat_sessions")
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_email", userEmail)
      .select("id, title, user_email, model, pinned, created_at, updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw createHttpError(
        "Chat session tidak ditemukan.",
        404,
        "SESSION_NOT_FOUND",
      );
    }

    return res.json({
      success: true,
      data: mapSession(data),
    });
  } catch (error) {
    return sendError(res, error, "Gagal rename chat session.");
  }
});

router.post("/sessions/:id/pin", async (req, res) => {
  try {
    const db = requireSupabase();
    const userEmail = getAuthenticatedEmail(req);

    const sessionId = normalizeText(req.params?.id);
    const pinned = Boolean(req.body?.pinned);

    if (!sessionId) {
      throw createHttpError("session id wajib diisi.", 400, "VALIDATION_ERROR");
    }

    const { data, error } = await db
      .from("orbit_chat_sessions")
      .update({
        pinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_email", userEmail)
      .select("id, title, user_email, model, pinned, created_at, updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw createHttpError(
        "Chat session tidak ditemukan.",
        404,
        "SESSION_NOT_FOUND",
      );
    }

    return res.json({
      success: true,
      data: mapSession(data),
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengubah status pin session.");
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const db = requireSupabase();
    const userEmail = getAuthenticatedEmail(req);

    const sessionId = normalizeText(req.params?.id);

    if (!sessionId) {
      throw createHttpError("session id wajib diisi.", 400, "VALIDATION_ERROR");
    }

    await getOwnedSession(db, sessionId, userEmail);

    const { error: messagesError } = await db
      .from("orbit_chat_messages")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_email", userEmail);

    if (messagesError) throw messagesError;

    const { error: sessionError } = await db
      .from("orbit_chat_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_email", userEmail);

    if (sessionError) throw sessionError;

    return res.json({
      success: true,
      data: { id: sessionId },
    });
  } catch (error) {
    return sendError(res, error, "Gagal menghapus chat session.");
  }
});

router.get("/messages", async (req, res) => {
  try {
    const db = requireSupabase();
    const userEmail = getAuthenticatedEmail(req);
    const sessionId = normalizeText(req.query?.session_id);

    let query = db
      .from("orbit_chat_messages")
      .select("id, session_id, user_email, role, content, model, created_at")
      .eq("user_email", userEmail)
      .in("role", PERSISTED_MESSAGE_ROLES)
      .order("created_at", { ascending: true });

    if (sessionId) {
      await getOwnedSession(db, sessionId, userEmail);
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query.limit(200);

    if (error) throw error;

    return res.json({
      success: true,
      data: (data || []).map(mapMessage).filter(Boolean),
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil chat messages.");
  }
});

router.post("/messages", async (req, res) => {
  try {
    const db = requireSupabase();
    const userEmail = getAuthenticatedEmail(req);

    const sessionId = normalizeText(
      req.body?.session_id || req.body?.sessionId,
    );
    const role = normalizeText(req.body?.role);
    const content = normalizeText(req.body?.content);
    const model = normalizeText(req.body?.model, DEFAULT_MODEL);

    if (!sessionId || !role || !content) {
      throw createHttpError(
        "session_id, role, dan content wajib diisi.",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (!PERSISTED_MESSAGE_ROLES.includes(role)) {
      throw createHttpError(
        "role harus user atau assistant.",
        400,
        "VALIDATION_ERROR",
      );
    }

    await getOwnedSession(db, sessionId, userEmail);

    const payload = {
      session_id: sessionId,
      user_email: userEmail,
      role,
      content,
      model,
    };

    const { data, error } = await db
      .from("orbit_chat_messages")
      .insert([payload])
      .select("id, session_id, user_email, role, content, model, created_at")
      .single();

    if (error) throw error;

    const { error: updateSessionError } = await db
      .from("orbit_chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_email", userEmail);

    if (updateSessionError) throw updateSessionError;

    return res.status(201).json({
      success: true,
      data: mapMessage(data),
    });
  } catch (error) {
    return sendError(res, error, "Gagal menyimpan chat message.");
  }
});

module.exports = router;
