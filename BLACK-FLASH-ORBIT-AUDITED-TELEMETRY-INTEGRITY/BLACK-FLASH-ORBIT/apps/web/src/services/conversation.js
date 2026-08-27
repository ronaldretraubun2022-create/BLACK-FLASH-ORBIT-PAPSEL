import { supabase } from "../lib/supabase";

const DEFAULT_MODEL = "openrouter/auto";
const AI_CHAT_ENDPOINT = "/api/ai/chat";
const API_HEALTH_ENDPOINT = "/api/v1/health";

async function getAccessToken() {
  if (supabase) {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (data.session?.access_token) {
      return data.session.access_token;
    }
  }

  return localStorage.getItem("orbit_access_token") || "";
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request gagal dengan status HTTP ${response.status}.`;

    throw new Error(message);
  }

  return data;
}

export async function sendOrbitMessage({
  message,
  model = DEFAULT_MODEL,
  sessionId = "legacy-ai-chat",
}) {
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage) {
    throw new Error("Message tidak boleh kosong.");
  }

  const token = await getAccessToken();

  if (!token) {
    throw new Error("Session login tidak aktif. Silakan login ulang.");
  }

  const response = await fetch(AI_CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: cleanMessage,
      model,
      sessionId,
    }),
  });

  const data = await parseJsonResponse(response);

  return {
    model: data?.model || model,
    response: data?.response || "",
  };
}

export async function checkOrbitBackend() {
  const response = await fetch(API_HEALTH_ENDPOINT, {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await parseJsonResponse(response);

  return {
    data,
    ok: true,
    status: response.status,
  };
}
