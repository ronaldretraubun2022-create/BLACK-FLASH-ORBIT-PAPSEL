import { getAuthenticatedHeaders, resolveApiUrl } from "./api";

export function isNewsroomLocalFallbackEnabled() {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK === "true"
  );
}

export async function generateIntelligenceDraft(payload) {
  try {
    const response = await fetch(resolveApiUrl("/api/ai/newsroom"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthenticatedHeaders()),
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const message =
        json?.message ||
        `AI Newsroom request failed with status ${response.status}`;
      throw new Error(message);
    }

    if (!json) {
      throw new Error("Respons AI Newsroom tidak valid.");
    }

    return json;
  } catch (error) {
    throw new Error(
      error?.message ||
        "Gagal menghubungi AI Newsroom. Silakan coba lagi nanti.",
    );
  }
}

async function requestNewsroomJson(path, options = {}) {
  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthenticatedHeaders()),
      ...(options.headers || {}),
    },
    credentials: "include",
  });
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(
      json?.message || `Newsroom request failed with status ${response.status}`,
    );
  }

  return json;
}

function createQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const cleanValue = String(value || "").trim();

    if (cleanValue) searchParams.set(key, cleanValue);
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

export async function listNewsroomHistory(filters = {}) {
  return requestNewsroomJson(
    `/api/ai/newsroom/history${createQueryString(filters)}`,
  );
}

export async function getNewsroomGeneration(id) {
  return requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}`,
  );
}

export async function saveNewsroomGeneration(payload, idempotencyKey) {
  return requestNewsroomJson("/api/ai/newsroom/history", {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(payload),
  });
}

export async function updateNewsroomGeneration(id, payload) {
  return requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function submitNewsroomDecision(id, payload) {
  return requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}/decision`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteNewsroomGeneration(id) {
  return requestNewsroomJson(
    `/api/ai/newsroom/history/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export async function exportNewsroomGeneration(id, { format, type }) {
  const response = await fetch(
    resolveApiUrl(
      `/api/ai/newsroom/history/${encodeURIComponent(id)}/export${createQueryString(
        {
          format,
          type,
        },
      )}`,
    ),
    {
      headers: {
        ...(await getAuthenticatedHeaders()),
      },
      credentials: "include",
    },
  );

  if (!response.ok) {
    let message = `Export gagal dengan status ${response.status}`;

    try {
      const error = await response.json();
      message = error?.message || message;
    } catch {
      message = `Export gagal dengan status ${response.status}`;
    }

    throw new Error(message);
  }

  return {
    blob: await response.blob(),
    filename:
      getFilenameFromDisposition(response.headers.get("content-disposition")) ||
      `black-flash-orbit-${type || "review"}.${format || "pdf"}`,
  };
}

function getFilenameFromDisposition(disposition) {
  const match = String(disposition || "").match(/filename="([^"]+)"/i);

  return match?.[1] || "";
}
