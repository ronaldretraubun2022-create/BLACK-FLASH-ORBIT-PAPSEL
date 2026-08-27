"use strict";

const { ipKeyGenerator, rateLimit } = require("express-rate-limit");

function getRequesterKey(req) {
  return req.userId || req.user?.id || ipKeyGenerator(req.ip);
}

function createCleanLimiter({ code, max, message, windowMs }) {
  return rateLimit({
    keyGenerator: getRequesterKey,
    legacyHeaders: false,
    max,
    message: {
      success: false,
      code,
      message,
    },
    standardHeaders: true,
    windowMs,
  });
}

function createRouteRateLimiters({ isProduction }) {
  return {
    ai: createCleanLimiter({
      code: "AI_RATE_LIMITED",
      max: isProduction ? 30 : 300,
      message: "Terlalu banyak request AI. Coba lagi sebentar.",
      windowMs: 60 * 1000,
    }),
    knowledge: createCleanLimiter({
      code: "KNOWLEDGE_RATE_LIMITED",
      max: isProduction ? 45 : 450,
      message: "Terlalu banyak request Knowledge. Coba lagi sebentar.",
      windowMs: 60 * 1000,
    }),
    newsroom: createCleanLimiter({
      code: "NEWSROOM_RATE_LIMITED",
      max: isProduction ? 20 : 240,
      message: "Terlalu banyak request Newsroom. Coba lagi sebentar.",
      windowMs: 60 * 1000,
    }),
    webBuilder: createCleanLimiter({
      code: "WEB_BUILDER_RATE_LIMITED",
      max: isProduction ? 60 : 600,
      message: "Terlalu banyak request Web Builder. Coba lagi sebentar.",
      windowMs: 60 * 1000,
    }),
  };
}

module.exports = {
  createCleanLimiter,
  createRouteRateLimiters,
};
