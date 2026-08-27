import { supabase } from "../lib/supabase";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan AI Workspace";
const SCHEMA_SYNC_MESSAGE =
  "Schema chat belum sinkron. Jalankan SQL migration model chat, lalu refresh Supabase schema cache.";
const PERSISTED_MESSAGE_ROLES = new Set(["user", "assistant"]);
const SESSION_COLUMNS =
  "id, title, user_email, model, pinned, created_at, updated_at";
const MESSAGE_COLUMNS =
  "id, session_id, user_email, role, content, model, created_at";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  return supabase;
}

function normalizeUserEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeModel(model) {
  if (typeof model !== "string") return DEFAULT_MODEL;

  const trimmedModel = model.trim();
  return trimmedModel || DEFAULT_MODEL;
}

async function getCurrentUserEmail() {
  const client = requireSupabase();

  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) throw error;

  const userEmail = normalizeUserEmail(session?.user?.email);

  if (!userEmail) {
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  return userEmail;
}

async function getOwnedSession(sessionId, userEmail) {
  const client = requireSupabase();
  const ownerEmail = normalizeUserEmail(
    userEmail || (await getCurrentUserEmail()),
  );

  if (!sessionId || !ownerEmail) {
    throw new Error("Session chat dan email user wajib tersedia.");
  }

  const { data, error } = await client
    .from("orbit_chat_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("user_email", ownerEmail)
    .maybeSingle();

  if (error) throw getFriendlyError(error);

  if (!data) {
    throw new Error(
      "Chat session tidak ditemukan atau bukan milik user login.",
    );
  }

  return data;
}

function normalizeMessage(message) {
  const role = typeof message?.role === "string" ? message.role.trim() : "";

  if (!PERSISTED_MESSAGE_ROLES.has(role)) return null;

  return {
    id: message.id,
    sessionId: message.session_id,
    userEmail: message.user_email,
    role,
    model: message.model || DEFAULT_MODEL,
    content: message.content,
    createdAt: message.created_at,
  };
}

function normalizeSession(session) {
  return {
    id: session.id,
    userEmail: session.user_email,
    title: session.title || DEFAULT_SESSION_TITLE,
    model: session.model || DEFAULT_MODEL,
    pinned: Boolean(session.pinned),
    createdAt: session.created_at,
    updatedAt: session.updated_at || session.created_at,
  };
}

function isModelSchemaError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;

  return (
    error?.code === "PGRST204" &&
    (message.includes("model") ||
      message.includes("pinned") ||
      message.includes("user_email")) &&
    (message.includes("schema cache") || message.includes("column"))
  );
}

function getFriendlyError(error) {
  if (isModelSchemaError(error)) {
    return new Error(SCHEMA_SYNC_MESSAGE);
  }

  return error;
}

export async function getChatSessions(userEmail) {
  const client = requireSupabase();
  const ownerEmail = normalizeUserEmail(userEmail);

  if (!ownerEmail) {
    return [];
  }

  const { data, error } = await client
    .from("orbit_chat_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_email", ownerEmail)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw getFriendlyError(error);

  return (data || []).map(normalizeSession);
}

export async function createChatSession({ model, title, userEmail }) {
  const client = requireSupabase();
  const ownerEmail = normalizeUserEmail(userEmail);

  if (!ownerEmail) {
    throw new Error("Email user wajib tersedia untuk membuat chat session.");
  }

  const nextModel = normalizeModel(model);

  const { data, error } = await client
    .from("orbit_chat_sessions")
    .insert([
      {
        user_email: ownerEmail,
        title: title || DEFAULT_SESSION_TITLE,
        model: nextModel,
        pinned: false,
        updated_at: new Date().toISOString(),
      },
    ])
    .select(SESSION_COLUMNS)
    .single();

  if (error) throw getFriendlyError(error);

  return normalizeSession(data);
}

export async function getOrCreateActiveChatSession({ model, userEmail }) {
  const sessions = await getChatSessions(userEmail);

  if (sessions.length > 0) return sessions[0];

  return createChatSession({
    model,
    title: DEFAULT_SESSION_TITLE,
    userEmail,
  });
}

export async function renameChatSession({ sessionId, title }) {
  const client = requireSupabase();
  const userEmail = await getCurrentUserEmail();
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("Nama chat tidak boleh kosong.");
  }

  const { data, error } = await client
    .from("orbit_chat_sessions")
    .update({ title: cleanTitle, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_email", userEmail)
    .select(SESSION_COLUMNS)
    .maybeSingle();

  if (error) throw getFriendlyError(error);

  if (!data) {
    throw new Error(
      "Chat session tidak ditemukan atau bukan milik user login.",
    );
  }

  return normalizeSession(data);
}

export async function deleteChatSession(sessionId) {
  const client = requireSupabase();
  const userEmail = await getCurrentUserEmail();

  const { error: messagesError } = await client
    .from("orbit_chat_messages")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_email", userEmail);

  if (messagesError) throw getFriendlyError(messagesError);

  const { error: sessionError } = await client
    .from("orbit_chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_email", userEmail);

  if (sessionError) throw getFriendlyError(sessionError);

  return { id: sessionId };
}

export async function togglePinChatSession({ pinned, sessionId }) {
  const client = requireSupabase();
  const userEmail = await getCurrentUserEmail();

  const { data, error } = await client
    .from("orbit_chat_sessions")
    .update({ pinned: Boolean(pinned), updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_email", userEmail)
    .select(SESSION_COLUMNS)
    .maybeSingle();

  if (error) throw getFriendlyError(error);

  if (!data) {
    throw new Error(
      "Chat session tidak ditemukan atau bukan milik user login.",
    );
  }

  return normalizeSession(data);
}

export async function updateChatSessionModel({ model, sessionId }) {
  const client = requireSupabase();
  const userEmail = await getCurrentUserEmail();
  const nextModel = normalizeModel(model);

  const { data, error } = await client
    .from("orbit_chat_sessions")
    .update({ model: nextModel, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_email", userEmail)
    .select(SESSION_COLUMNS)
    .maybeSingle();

  if (error) throw getFriendlyError(error);

  if (!data) {
    throw new Error(
      "Chat session tidak ditemukan atau bukan milik user login.",
    );
  }

  return normalizeSession(data);
}

export async function getChatMessages(sessionId) {
  const client = requireSupabase();
  const userEmail = await getCurrentUserEmail();

  await getOwnedSession(sessionId, userEmail);

  const { data, error } = await client
    .from("orbit_chat_messages")
    .select(MESSAGE_COLUMNS)
    .eq("session_id", sessionId)
    .eq("user_email", userEmail)
    .in("role", Array.from(PERSISTED_MESSAGE_ROLES))
    .order("created_at", { ascending: true });

  if (error) throw getFriendlyError(error);

  return (data || []).map(normalizeMessage).filter(Boolean);
}

export async function saveChatMessage({
  content,
  model,
  role,
  sessionId,
  userEmail,
}) {
  const client = requireSupabase();
  const cleanRole = typeof role === "string" ? role.trim() : "";
  const ownerEmail = normalizeUserEmail(userEmail);

  if (!PERSISTED_MESSAGE_ROLES.has(cleanRole)) {
    throw new Error(
      "Chat persistence hanya menerima role user atau assistant.",
    );
  }

  await getOwnedSession(sessionId, ownerEmail);

  const nextModel = normalizeModel(model);

  const { data, error } = await client
    .from("orbit_chat_messages")
    .insert([
      {
        session_id: sessionId,
        user_email: ownerEmail,
        role: cleanRole,
        content,
        model: nextModel,
      },
    ])
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) throw getFriendlyError(error);

  const { error: sessionError } = await client
    .from("orbit_chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_email", ownerEmail);

  if (sessionError) throw getFriendlyError(sessionError);

  return normalizeMessage(data);
}

export function getChatPersistenceErrorMessage(error) {
  return getFriendlyError(error).message || "Gagal memproses data chat.";
}
