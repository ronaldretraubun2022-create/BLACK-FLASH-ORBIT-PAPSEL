const { getSupabaseAdmin } = require("../services/supabaseAdmin");

const ADMIN_ROLES = new Set(["admin", "owner", "super_admin"]);

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
}

async function requireAdmin(req, res, next) {
  const userId = String(req.user?.id || req.userId || "").trim();

  if (!userId) {
    return sendError(
      res,
      401,
      "AUTHENTICATION_REQUIRED",
      "Autentikasi diperlukan.",
    );
  }

  const client = getSupabaseAdmin();

  if (!client) {
    return sendError(
      res,
      503,
      "ROLE_PROVIDER_NOT_CONFIGURED",
      "Role provider belum dikonfigurasi.",
    );
  }

  try {
    const { data, error } = await client
      .from("orbit_profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return sendError(
        res,
        503,
        "ROLE_PROVIDER_UNAVAILABLE",
        "Role provider sementara tidak tersedia.",
      );
    }

    const trustedMetadataRole = normalizeRole(req.user?.app_metadata?.role);
    const role = normalizeRole(data?.role || trustedMetadataRole);

    if (!isAdminRole(role)) {
      return sendError(res, 403, "ADMIN_ROLE_REQUIRED", "Akses admin diperlukan.");
    }

    req.userRole = role;
    return next();
  } catch {
    return sendError(
      res,
      503,
      "ROLE_PROVIDER_UNAVAILABLE",
      "Role provider sementara tidak tersedia.",
    );
  }
}

module.exports = {
  isAdminRole,
  requireAdmin,
};
