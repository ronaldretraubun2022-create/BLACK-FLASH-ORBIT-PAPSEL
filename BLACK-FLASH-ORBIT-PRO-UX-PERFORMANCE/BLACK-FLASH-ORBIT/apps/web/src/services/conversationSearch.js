import { supabase } from "../lib/supabase";

const DEFAULT_MODEL = "openrouter/auto";
const DEFAULT_SESSION_TITLE = "Percakapan AI Workspace";
const SEARCH_LIMIT = 20;
const SEARCHABLE_MESSAGE_ROLES = ["user", "assistant"];

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment belum dikonfigurasi.");
  }

  return supabase;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSession(session) {
  return {
    id: session?.id,
    userEmail: session?.user_email,
    title: session?.title || DEFAULT_SESSION_TITLE,
    model: session?.model || DEFAULT_MODEL,
    pinned: Boolean(session?.pinned),
    createdAt: session?.created_at,
    updatedAt: session?.updated_at || session?.created_at,
  };
}

function normalizeMessage(message) {
  const role = normalizeText(message?.role);

  if (!SEARCHABLE_MESSAGE_ROLES.includes(role)) return null;

  return {
    id: message?.id,
    sessionId: message?.session_id,
    userEmail: message?.user_email,
    role,
    model: message?.model || DEFAULT_MODEL,
    content: message?.content || "",
    createdAt: message?.created_at,
  };
}

function createLikePattern(query) {
  const safeQuery = query.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();

  return safeQuery ? `%${safeQuery}%` : "";
}

function scoreResult(result, query) {
  const normalizedQuery = query.toLowerCase();
  const title = result.session.title.toLowerCase();

  if (title === normalizedQuery) return 0;
  if (title.includes(normalizedQuery)) return 1;
  if (result.messages.some((message) => message.role === "user")) return 2;

  return 3;
}

export async function searchConversations({ query, userId }) {
  const client = requireSupabase();
  const cleanQuery = normalizeText(query);
  const userEmail = normalizeText(userId).toLowerCase();

  if (!userEmail || !cleanQuery) {
    return [];
  }

  const likePattern = createLikePattern(cleanQuery);

  if (!likePattern) {
    return [];
  }

  const [sessionsResponse, messagesResponse] = await Promise.all([
    client
      .from("orbit_chat_sessions")
      .select("*")
      .eq("user_email", userEmail)
      .or(`title.ilike.${likePattern},model.ilike.${likePattern}`)
      .limit(SEARCH_LIMIT),
    client
      .from("orbit_chat_messages")
      .select("id, session_id, user_email, role, model, content, created_at")
      .eq("user_email", userEmail)
      .in("role", SEARCHABLE_MESSAGE_ROLES)
      .or(`content.ilike.${likePattern},model.ilike.${likePattern}`)
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT),
  ]);

  if (sessionsResponse.error) throw sessionsResponse.error;
  if (messagesResponse.error) throw messagesResponse.error;

  const resultMap = new Map();
  const messages = (messagesResponse.data || [])
    .map(normalizeMessage)
    .filter(Boolean);
  const messageSessionIds = Array.from(
    new Set(messages.map((message) => message.sessionId).filter(Boolean)),
  );
  const messageSessionMap = new Map();

  if (messageSessionIds.length > 0) {
    const { data: messageSessions, error: messageSessionsError } = await client
      .from("orbit_chat_sessions")
      .select("*")
      .eq("user_email", userEmail)
      .in("id", messageSessionIds);

    if (messageSessionsError) throw messageSessionsError;

    (messageSessions || []).forEach((session) => {
      const normalizedSession = normalizeSession(session);

      if (normalizedSession.id) {
        messageSessionMap.set(normalizedSession.id, normalizedSession);
      }
    });
  }

  (sessionsResponse.data || []).forEach((session) => {
    const normalizedSession = normalizeSession(session);

    if (!normalizedSession.id) return;

    resultMap.set(normalizedSession.id, {
      id: normalizedSession.id,
      matchType: "session",
      session: normalizedSession,
      messages: [],
    });
  });

  messages.forEach((message) => {
    const session = messageSessionMap.get(message.sessionId);
    const sessionId = session?.id || message.sessionId;

    if (!sessionId || !session?.id) return;

    const existingResult =
      resultMap.get(sessionId) ||
      {
        id: sessionId,
        matchType: "message",
        session,
        messages: [],
      };

    existingResult.messages.push(message);
    existingResult.matchType =
      existingResult.matchType === "session" ? "session_message" : "message";
    resultMap.set(sessionId, existingResult);
  });

  return Array.from(resultMap.values())
    .sort((first, second) => {
      const scoreDelta = scoreResult(first, cleanQuery) - scoreResult(second, cleanQuery);

      if (scoreDelta !== 0) return scoreDelta;

      return (
        new Date(second.session.updatedAt || second.session.createdAt || 0) -
        new Date(first.session.updatedAt || first.session.createdAt || 0)
      );
    })
    .slice(0, SEARCH_LIMIT);
}

export function getConversationSearchErrorMessage(error) {
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal mencari conversation.";
  }
}
