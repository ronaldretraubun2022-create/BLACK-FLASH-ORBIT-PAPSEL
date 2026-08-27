const {
  error: logError,
  getRequestContext,
} = require("../services/observability/logger");

function errorHandler(error, req, res, next) {
  const errorStatus = Number(error?.statusCode || error?.status || 0);
  const statusCode =
    errorStatus >= 400 && errorStatus <= 599
      ? errorStatus
      : res.statusCode && res.statusCode !== 200
        ? res.statusCode
        : 500;
  const message =
    statusCode === 404
      ? "Route tidak ditemukan."
      : statusCode >= 500
        ? "Terjadi kesalahan server."
        : getSafeClientMessage(statusCode);

  const requestContext = getRequestContext(req);
  req.requestId = requestContext.requestId;

  logError("http_request_failed", {
    ...requestContext,
    code: error?.code || "REQUEST_FAILED",
    statusCode,
    error: {
      name: error?.name || "Error",
      message: error?.message || "Unhandled server error",
      stack:
        process.env.NODE_ENV === "production"
          ? undefined
          : error?.stack || null,
    },
  });

  res.status(statusCode).json({
    success: false,
    code: error?.code || "REQUEST_FAILED",
    message,
    requestId: requestContext.requestId,
  });
}

function getSafeClientMessage(statusCode) {
  if (statusCode === 400) return "Request tidak valid.";
  if (statusCode === 401) return "Autentikasi diperlukan.";
  if (statusCode === 403) return "Akses ditolak.";
  if (statusCode === 413) return "Payload terlalu besar.";
  if (statusCode === 429) return "Terlalu banyak request. Coba lagi nanti.";

  return "Request gagal diproses.";
}

module.exports = errorHandler;
