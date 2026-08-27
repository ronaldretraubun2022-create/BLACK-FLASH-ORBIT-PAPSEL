"use strict";

const { createRequestId } = require("../services/observability/logger");

function requestContext(req, res, next) {
  const requestId = createRequestId(req);

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
}

module.exports = requestContext;
