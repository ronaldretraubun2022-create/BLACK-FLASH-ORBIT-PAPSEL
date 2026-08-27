const express = require("express");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");
const supabaseDatabase = require("../lib/supabase");
const { buildOrbitRuntimeContext } = require("../lib/orbitRuntimeContext");
const { handleOrbitCommand } = require("../lib/orbitCommands");
const { buildOrbitKnowledgeContext } = require("../lib/orbitKnowledge");
const {
  buildOrbitMemoryContext,
  containsSensitiveData,
} = require("../lib/orbitMemory");
const { generateCompletion, AI_USE_CASES } = require("../services/ai/aiRouter");
const {
  recordAiChatTelemetry,
} = require("../services/observability/operationalTelemetry");

const router = express.Router();

const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
const OPENROUTER_TIMEOUT_MS = 30000;
const DEBUG_AI_AUTH =
  process.env.NODE_ENV !== "production" && process.env.DEBUG_AI_AUTH === "true";
const CHAT_MEMORY_LIMIT = 20;
const MAX_AI_MESSAGE_LENGTH = 12000;
const MAX_AI_HISTORY_ITEMS = 20;
const MAX_AI_MODEL_LENGTH = 120;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const INVALID_SUPABASE_TOKEN_MESSAGE =
  "Supabase auth token tidak valid atau sudah expired. Silakan login ulang.";
const ORBIT_SYSTEM_PROMPT =
  "Anda adalah BLACK FLASH ORBIT AI, asisten untuk AI Workspace, monitoring, security center, laporan, dan operasi dashboard. Jawab jelas, profesional, gunakan konteks percakapan aktif sebelumnya jika tersedia, dan boleh mengingat serta menjawab kode uji harmless yang diberikan user seperti ORBIT SATU, 111, atau frasa tes lain. Jangan menolak hanya karena ada kata kode, rahasia, atau nomor jika konteksnya jelas sebagai percakapan biasa. Tetap jangan meminta, membocorkan, menebak, atau memproses API key, password, token, private key, credential, cookie, seed phrase, atau rahasia autentikasi asli. Jika user mengirim kredensial asli, arahkan untuk mencabut/rotate credential tersebut.";

let supabaseAuthClient = null;
let supabaseAuthClientKey = "";

const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 20 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || "unknown-ai-user",
  message: {
    success: false,
    status: 429,
    code: "ai_rate_limited",
    message: "Terlalu banyak request AI. Coba lagi sebentar.",
  },
});

function createHttpError(
  message,
  statusCode = 500,
  code = "SERVER_ERROR",
  details = {},
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function sendSafeError(res, error, fallbackMessage = "Request AI gagal.") {
  const status = Number(error?.statusCode || error?.status || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  const message =
    safeStatus >= 500
      ? fallbackMessage
      : error?.safeMessage || error?.message || fallbackMessage;

  return res.status(safeStatus).json({
    success: false,
    status: safeStatus,
    code: error?.code || "ai_request_failed",
    message,
  });
}

function getSupabaseAuthConfig() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createHttpError(
      "Supabase environment belum lengkap untuk autentikasi AI.",
      500,
      "SUPABASE_ENV_MISSING",
    );
  }

  assertMatchingSupabaseProject({ supabaseAnonKey, supabaseUrl });

  return { supabaseAnonKey, supabaseUrl };
}

function assertMatchingSupabaseProject({ supabaseAnonKey, supabaseUrl }) {
  const urlProjectRef = getSupabaseProjectRefFromUrl(supabaseUrl);
  const keyProjectRef = getSupabaseProjectRefFromJwt(supabaseAnonKey);

  if (urlProjectRef && keyProjectRef && urlProjectRef !== keyProjectRef) {
    throw createHttpError(
      "Supabase URL dan anon key backend berasal dari project berbeda.",
      500,
      "SUPABASE_PROJECT_MISMATCH",
    );
  }
}

function getSupabaseProjectRefFromUrl(supabaseUrl) {
  const match = String(supabaseUrl || "").match(
    /^https:\/\/([^.]+)\.supabase\.co/i,
  );

  return match?.[1] || null;
}

function getSupabaseProjectRefFromJwt(token) {
  const [, payload] = String(token || "").split(".");

  if (!payload) return null;

  try {
    return (
      JSON.parse(
        Buffer.from(
          payload.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8"),
      )?.ref || null
    );
  } catch {
    return null;
  }
}

function getJwtPayload(token) {
  const [, payload] = String(token || "").split(".");

  if (!payload) return null;

  try {
    return JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    );
  } catch {
    return null;
  }
}

function getSupabaseAuthClient() {
  const { supabaseAnonKey, supabaseUrl } = getSupabaseAuthConfig();
  const nextClientKey = `${supabaseUrl}:${supabaseAnonKey.slice(0, 12)}`;

  if (!supabaseAuthClient || supabaseAuthClientKey !== nextClientKey) {
    supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    supabaseAuthClientKey = nextClientKey;
  }

  return supabaseAuthClient;
}

function getBearerToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization) {
    logAuthDebug(req, "missing_authorization");
    throw createHttpError(
      "missing_authorization",
      401,
      "missing_authorization",
    );
  }

  if (!authorization.startsWith("Bearer ")) {
    logAuthDebug(req, "invalid_bearer_format");
    throw createHttpError(
      "invalid_bearer_format",
      401,
      "invalid_bearer_format",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    logAuthDebug(req, "invalid_bearer_format");
    throw createHttpError(
      "invalid_bearer_format",
      401,
      "invalid_bearer_format",
    );
  }

  return token;
}

function getAuthDebug(req) {
  const authorization = req.headers.authorization || "";
  const authHeaderStartsWithBearer = authorization.startsWith("Bearer ");

  return {
    hasAuthorization: Boolean(authorization),
    authHeaderStartsWithBearer,
  };
}

function logAuthDebug(req, reason, details = {}) {
  const debugDetails = DEBUG_AI_AUTH
    ? {
        ...getAuthDebug(req),
        supabaseAuthStatus: details.supabaseAuthStatus || null,
        userId: details.userId || null,
      }
    : {};

  console.warn("[AI Auth]", {
    ...debugDetails,
    reason,
  });
}

async function requireAiAuth(req, res, next) {
  try {
    req.user = await requireAuthenticatedUser(req);
    return next();
  } catch (error) {
    return sendSafeError(res, error, "Autentikasi AI gagal.");
  }
}

async function requireAuthenticatedUser(req) {
  const token = getBearerToken(req);
  const supabase = getSupabaseAuthClient();

  let authResult = null;

  try {
    authResult = await supabase.auth.getUser(token);
  } catch (error) {
    logAuthDebug(req, "supabase_auth_unavailable", {
      supabaseAuthStatus: error.status || null,
    });
    throw createHttpError(
      "Gagal validasi Supabase auth token.",
      502,
      "supabase_auth_unavailable",
      {
        supabaseAuthError: {
          message: error.message || null,
          status: error.status || null,
        },
      },
    );
  }

  const user = authResult?.data?.user;
  const error = authResult?.error;
  const supabaseAuthError = error
    ? {
        status: error.status || null,
      }
    : null;

  logAuthDebug(
    req,
    error || !user?.id ? "invalid_supabase_token" : "supabase_auth_validated",
    {
      supabaseAuthStatus: supabaseAuthError?.status || null,
      userId: user?.id || null,
    },
  );

  if (error || !user?.id) {
    throw createHttpError(
      error?.message || INVALID_SUPABASE_TOKEN_MESSAGE,
      401,
      "invalid_supabase_token",
      {
        supabaseAuthError,
      },
    );
  }

  return user;
}

function normalizeSessionId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSystemPrompt(value) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, 12000);
}

function normalizeModel(value) {
  if (typeof value !== "string") return DEFAULT_OPENROUTER_MODEL;

  const model = value.trim();
  return model ? model.slice(0, MAX_AI_MODEL_LENGTH) : DEFAULT_OPENROUTER_MODEL;
}

function normalizeClientHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_AI_HISTORY_ITEMS)
    .map((message) => normalizeChatHistoryRow(message))
    .filter(Boolean);
}

function validateAiChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError("Body request tidak valid.", 400, "invalid_body");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId =
    normalizeSessionId(
      body.sessionId ||
        body.session_id ||
        body.conversationId ||
        body.conversation_id,
    ) || "legacy-ai-chat";

  if (!message) {
    throw createHttpError("Message tidak boleh kosong.", 400, "empty_message");
  }

  if (message.length > MAX_AI_MESSAGE_LENGTH) {
    throw createHttpError("Message terlalu panjang.", 413, "message_too_large");
  }

  return {
    history: normalizeClientHistory(body.history),
    message,
    model: normalizeModel(body.model),
    sessionId,
    systemPrompt: normalizeSystemPrompt(
      body.systemPrompt || body.system_prompt,
    ),
  };
}

function hasSensitiveAiInput({ history, message, systemPrompt }) {
  const historyContent = (Array.isArray(history) ? history : []).map(
    (item) => item?.content,
  );

  return [message, systemPrompt, ...historyContent].some((value) =>
    containsSensitiveData(value),
  );
}

function normalizeChatHistoryRow(row) {
  const role = String(row?.role || "").trim();
  const content = String(row?.content || "").trim();

  if (!["user", "assistant"].includes(role) || !content) {
    return null;
  }

  return { role, content: content.slice(0, MAX_AI_MESSAGE_LENGTH) };
}

function removeCurrentMessageFromHistory(history, currentMessage) {
  const normalizedCurrentMessage = String(currentMessage || "").trim();

  if (!normalizedCurrentMessage || history.length === 0) {
    return history;
  }

  const nextHistory = [...history];
  const lastMessage = nextHistory[nextHistory.length - 1];

  if (
    lastMessage?.role === "user" &&
    String(lastMessage.content || "").trim() === normalizedCurrentMessage
  ) {
    nextHistory.pop();
  }

  return nextHistory;
}

async function getConversationHistory({
  currentMessage,
  fallbackHistory = [],
  sessionId,
  userEmail,
}) {
  const ownerEmail = normalizeEmail(userEmail);

  if (!sessionId || !ownerEmail || !supabaseDatabase || !isUuid(sessionId)) {
    return fallbackHistory;
  }

  const { data, error } = await supabaseDatabase
    .from("orbit_chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .eq("user_email", ownerEmail)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(CHAT_MEMORY_LIMIT);

  if (error) {
    console.warn("[AI Memory] gagal mengambil chat history", {
      code: error.code || null,
      message: error.message || null,
      sessionId,
    });
    return fallbackHistory;
  }

  const history = (data || [])
    .slice()
    .reverse()
    .map(normalizeChatHistoryRow)
    .filter(Boolean);

  return removeCurrentMessageFromHistory(history, currentMessage);
}

async function logAiAuditEvent({
  code = null,
  durationMs,
  model,
  provider = "openrouter",
  providerLatencyMs = null,
  providerReached = false,
  sessionId,
  stage = "unknown",
  status,
  user,
}) {
  try {
    const userId = user?.id || null;
    const message = `AI chat ${status}: user=${userId || "unknown"} session=${sessionId} model=${model} duration=${durationMs}ms`;

    console.info("[AI Audit]", {
      code,
      durationMs,
      model,
      provider,
      providerLatencyMs,
      providerReached,
      sessionId,
      stage,
      status,
      userId,
    });

    recordAiChatTelemetry({
      code,
      durationMs,
      model,
      provider,
      providerLatencyMs,
      providerReached,
      stage,
      status,
      user,
    });

    if (!supabaseDatabase) return;

    const { error } = await supabaseDatabase.from("orbit_activity").insert([
      {
        type: "ai_chat",
        message,
        time: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.warn("[AI Audit] gagal menyimpan audit log", {
        code: error.code || null,
        message: error.message || null,
      });
    }
  } catch (auditError) {
    console.warn("[AI Audit] gagal menulis audit log", {
      message: auditError.message || null,
    });
  }
}

async function buildOpenRouterMessages({
  currentMessage,
  fallbackHistory,
  sessionId,
  systemPrompt,
  userEmail,
}) {
  const history = await getConversationHistory({
    currentMessage,
    fallbackHistory,
    sessionId,
    userEmail,
  });
  const memoryContext = await buildOrbitMemoryContext({
    currentMessage,
    db: supabaseDatabase,
    history,
    userEmail,
  });
  const knowledgeContext = await buildOrbitKnowledgeContext({
    db: supabaseDatabase,
    query: currentMessage,
    userEmail,
  });
  const activeSystemPrompt = normalizeSystemPrompt(systemPrompt);
  const systemMessages = [];

  if (activeSystemPrompt) {
    systemMessages.push({
      role: "system",
      content: activeSystemPrompt,
    });
  }

  systemMessages.push({
    role: "system",
    content: ORBIT_SYSTEM_PROMPT,
  });

  if (memoryContext) {
    systemMessages.push({
      role: "system",
      content: memoryContext,
    });
  }

  if (knowledgeContext) {
    systemMessages.push({
      role: "system",
      content: knowledgeContext,
    });
  }

  systemMessages.push({
    role: "system",
    content: buildOrbitRuntimeContext(),
  });

  return [
    ...systemMessages,
    ...history,
    {
      role: "user",
      content: currentMessage,
    },
  ];
}

router.post("/chat", requireAiAuth, aiChatLimiter, async (req, res) => {
  const startedAt = Date.now();
  let stage = "received";
  let providerStartedAt = 0;
  let providerLatencyMs = null;
  let providerReached = false;
  let requestContext = {
    message: "",
    model: DEFAULT_OPENROUTER_MODEL,
    sessionId: "",
    systemPrompt: "",
    history: [],
  };

  try {
    const authenticatedUser = req.user;
    stage = "validation";
    requestContext = validateAiChatBody(req.body);
    const { history, message, model, sessionId, systemPrompt } = requestContext;

    stage = "safety";
    if (hasSensitiveAiInput(requestContext)) {
      throw createHttpError(
        "Prompt mengandung data sensitif dan tidak dikirim ke AI.",
        400,
        "ai_sensitive_input_rejected",
      );
    }

    stage = "orbit_command";
    const orbitCommandResponse = handleOrbitCommand(message);

    if (orbitCommandResponse) {
      await logAiAuditEvent({
        durationMs: Date.now() - startedAt,
        model: "orbit-command",
        provider: "orbit-command",
        providerReached: false,
        sessionId,
        stage,
        status: "success",
        user: authenticatedUser,
      });

      return res.status(200).json({
        success: true,
        response: orbitCommandResponse,
        model: "orbit-command",
      });
    }

    stage = "context";
    const openRouterMessages = await buildOpenRouterMessages({
      currentMessage: message,
      fallbackHistory: history,
      sessionId,
      systemPrompt,
      userEmail: authenticatedUser.email,
    });
    stage = "provider";
    providerStartedAt = Date.now();
    providerReached = true;
    const aiResult = await generateCompletion({
      maxTokens: 1200,
      messages: openRouterMessages,
      model,
      requestId: sessionId,
      temperature: 0.2,
      timeout: OPENROUTER_TIMEOUT_MS,
      useCase: AI_USE_CASES.GENERAL_CHAT,
    });
    providerLatencyMs = Date.now() - providerStartedAt;

    stage = "response";
    await logAiAuditEvent({
      durationMs: Date.now() - startedAt,
      model: aiResult.model,
      provider: aiResult.provider || "openrouter",
      providerLatencyMs,
      providerReached: true,
      sessionId,
      stage,
      status: "success",
      user: authenticatedUser,
    });

    return res.status(200).json({
      success: true,
      response: aiResult.content,
      model: aiResult.model,
    });
  } catch (error) {
    const status = error.statusCode || error.status || 502;
    const code = error.code || "ai_fetch_failed";
    const message =
      error.statusCode || error.status
        ? error.message
        : "Gagal terhubung ke OpenRouter.";
    if (providerStartedAt && providerLatencyMs === null) {
      providerLatencyMs = Date.now() - providerStartedAt;
    }

    console.error("[AI Route Error]", {
      code,
      status,
      model: requestContext.model,
      name: error.name,
      providerReached,
      sessionId: requestContext.sessionId,
      stage,
    });

    await logAiAuditEvent({
      code,
      durationMs: Date.now() - startedAt,
      model: requestContext.model,
      providerLatencyMs,
      providerReached,
      sessionId: requestContext.sessionId,
      stage,
      status: "failed",
      user: req.user,
    });

    return sendSafeError(
      res,
      createHttpError(message, status, code),
      "Request AI gagal.",
    );
  }
});

module.exports = router;
