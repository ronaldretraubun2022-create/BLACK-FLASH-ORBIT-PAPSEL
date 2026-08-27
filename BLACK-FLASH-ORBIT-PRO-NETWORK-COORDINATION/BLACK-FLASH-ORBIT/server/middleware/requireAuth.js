const { createClient } = require("@supabase/supabase-js");

let authClient = null;
let authClientKey = "";

function getRequestPath(req) {
  return req.originalUrl || req.url || "unknown";
}

function logAuthSecurityEvent(req, reason, metadata = {}) {
  console.warn("[ORBIT Auth]", {
    method: req.method,
    path: getRequestPath(req),
    reason,
    status: metadata.status || null,
    userId: metadata.userId || null,
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

  return values
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
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

function sendAuthProviderUnavailable(req, res) {
  logAuthSecurityEvent(req, "auth_provider_unavailable", { status: 503 });

  return res.status(503).json({
    success: false,
    code: "AUTH_PROVIDER_UNAVAILABLE",
    message: "Auth provider temporarily unavailable. Try again.",
  });
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

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      logAuthSecurityEvent(req, "missing_bearer_token", { status: 401 });

      return res.status(401).json({
        success: false,
        message: "Missing bearer token.",
      });
    }

    const supabase = getSupabaseAuthClient();

    if (!supabase) {
      logAuthSecurityEvent(req, "supabase_auth_not_configured", {
        status: 500,
      });

      return res.status(500).json({
        success: false,
        message: "Supabase auth belum dikonfigurasi.",
      });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error && isAuthProviderNetworkError(error)) {
      return sendAuthProviderUnavailable(req, res);
    }

    if (error || !data?.user) {
      logAuthSecurityEvent(req, "invalid_or_expired_token", { status: 401 });

      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    req.user = data.user;
    req.userId = data.user.id;
    req.userEmail = data.user.email || null;

    return next();
  } catch (error) {
    if (isAuthProviderNetworkError(error)) {
      return sendAuthProviderUnavailable(req, res);
    }

    logAuthSecurityEvent(req, "auth_middleware_error", { status: 500 });

    return res.status(500).json({
      success: false,
      message: "Auth middleware error.",
    });
  }
}

module.exports = { requireAuth };
