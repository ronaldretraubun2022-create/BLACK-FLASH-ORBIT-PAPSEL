const { createClient } = require("@supabase/supabase-js");

let authClient = null;
let authClientKey = "";

function getRequestPath(req) {
  return req.originalUrl || req.url || "unknown";
}

function logAuthEvent(req, reason, metadata = {}) {
  console.warn("[ORBIT Auth]", {
    method: req.method,
    path: getRequestPath(req),
    reason,
    status: metadata.status || null,
    code: metadata.code || null,
  });
}

function getNestedErrorValues(error) {
  const values = [];
  let currentError = error;

  while (currentError && values.length < 8) {
    values.push(
      currentError.code,
      currentError.name,
      currentError.message,
      currentError.cause?.code,
      currentError.cause?.name,
      currentError.cause?.message,
    );
    currentError = currentError.cause;
  }

  return values.filter(Boolean).map((value) => String(value).toLowerCase());
}

function isAuthProviderNetworkError(error) {
  return getNestedErrorValues(error).some((value) =>
    [
      "aborterror",
      "aborted",
      "connect timeout",
      "connection timeout",
      "econnreset",
      "etimedout",
      "fetch failed",
      "networkerror",
      "timeout",
      "und_err_connect_timeout",
      "und_err_headers_timeout",
      "und_err_socket",
    ].some((pattern) => value.includes(pattern)),
  );
}

function getSupabaseAuthClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const nextClientKey = `${supabaseUrl}:${supabaseAnonKey}`;

  if (!authClient || authClientKey !== nextClientKey) {
    authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    authClientKey = nextClientKey;
  }

  return authClient;
}

async function getUserWithTimeout(client, token, timeoutMs = 5000) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error("Supabase auth timeout.");
      timeoutError.code = "auth_provider_unavailable";
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([client.auth.getUser(token), timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

function sendAuthUnavailable(req, res, error) {
  logAuthEvent(req, "auth_provider_unavailable", {
    status: 503,
    code: "auth_provider_unavailable",
  });

  if (process.env.NODE_ENV !== "production") {
    console.warn("[ORBIT Auth] auth provider cause:", error?.message || "unknown");
  }

  return res.status(503).json({
    success: false,
    code: "auth_provider_unavailable",
    message: "Auth provider temporarily unavailable.",
    details: process.env.NODE_ENV === "production" ? undefined : "Supabase auth unreachable or timed out.",
  });
}

async function requireSupabaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      logAuthEvent(req, "missing_bearer_token", { status: 401 });
      return res.status(401).json({
        success: false,
        code: "missing_bearer_token",
        message: "Missing bearer token.",
      });
    }

    const supabase = getSupabaseAuthClient();

    if (!supabase) {
      logAuthEvent(req, "supabase_auth_not_configured", { status: 503 });
      return res.status(503).json({
        success: false,
        code: "supabase_auth_not_configured",
        message: "Auth provider not configured.",
      });
    }

    const { data, error } = await getUserWithTimeout(supabase, token);

    if (error && isAuthProviderNetworkError(error)) {
      return sendAuthUnavailable(req, res, error);
    }

    if (error || !data?.user) {
      logAuthEvent(req, "invalid_or_expired_token", {
        status: 401,
        code: "invalid_or_expired_token",
      });
      return res.status(401).json({
        success: false,
        code: "invalid_or_expired_token",
        message: "Invalid or expired token.",
      });
    }

    req.user = data.user;
    req.userId = data.user.id;
    req.userEmail = data.user.email || null;
    return next();
  } catch (error) {
    if (error?.code === "auth_provider_unavailable" || isAuthProviderNetworkError(error)) {
      return sendAuthUnavailable(req, res, error);
    }

    logAuthEvent(req, "auth_middleware_error", {
      status: 500,
      code: "auth_middleware_error",
    });

    return res.status(500).json({
      success: false,
      code: "auth_middleware_error",
      message: "Auth middleware error.",
      details: process.env.NODE_ENV === "production" ? undefined : String(error?.message || "unknown"),
    });
  }
}

module.exports = { requireSupabaseAuth };
