const assert = require("node:assert");
const test = require("node:test");

const errorHandler = require("../../server/middleware/errorHandler");

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

test("errorHandler preserves safe 403 status and machine-readable code", () => {
  const error = new Error("CORS origin denied.");
  error.code = "CORS_ORIGIN_DENIED";
  error.statusCode = 403;
  const res = createResponse();

  errorHandler(
    error,
    { method: "GET", originalUrl: "/api/v1/health" },
    res,
    () => {},
  );

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.code, "CORS_ORIGIN_DENIED");
  assert.strictEqual(res.body.message, "Akses ditolak.");
});
