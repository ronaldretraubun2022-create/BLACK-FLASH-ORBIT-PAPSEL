"use strict";

function isHttpsProduction() {
  return (
    process.env.NODE_ENV === "production" &&
    (process.env.VERCEL === "1" ||
      process.env.VERCEL === "true" ||
      process.env.ORBIT_ENABLE_HSTS === "true")
  );
}

function securityHeaders(_req, res, next) {
  res.setHeader(
    "Permissions-Policy",
    [
      "camera=()",
      "display-capture=()",
      "fullscreen=(self)",
      "geolocation=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  );
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (isHttpsProduction()) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  }

  next();
}

module.exports = {
  isHttpsProduction,
  securityHeaders,
};
