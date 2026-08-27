const assert = require("node:assert");
const test = require("node:test");

const { loadModuleWithMocks } = require("../knowledge/testUtils");

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

function createAdminClient({ error = null, role = "admin" } = {}) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return {
            data: role ? { role } : null,
            error,
          };
        },
      };
    },
  };
}

function loadRequireAdmin(client) {
  return loadModuleWithMocks("../../server/middleware/requireAdmin", {
    "../services/supabaseAdmin": {
      getSupabaseAdmin: () => client,
    },
  });
}

test("requireAdmin allows admin profile role", async () => {
  const { requireAdmin } = loadRequireAdmin(createAdminClient());
  const req = { user: { id: "user-1" } };
  const res = createResponse();
  let nextCalled = false;

  await requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.userRole, "admin");
});

test("requireAdmin denies non-admin profile role", async () => {
  const { requireAdmin } = loadRequireAdmin(
    createAdminClient({ role: "user" }),
  );
  const res = createResponse();

  await requireAdmin({ user: { id: "user-1" } }, res, () => {});

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.code, "ADMIN_ROLE_REQUIRED");
});

test("requireAdmin fails safely when role provider is unavailable", async () => {
  const { requireAdmin } = loadRequireAdmin(
    createAdminClient({ error: new Error("unavailable"), role: null }),
  );
  const res = createResponse();

  await requireAdmin({ user: { id: "user-1" } }, res, () => {});

  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(res.body.code, "ROLE_PROVIDER_UNAVAILABLE");
});

test("requireAdmin requires authenticated user identity", async () => {
  const { requireAdmin } = loadRequireAdmin(createAdminClient());
  const res = createResponse();

  await requireAdmin({ user: null }, res, () => {});

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.code, "AUTHENTICATION_REQUIRED");
});
