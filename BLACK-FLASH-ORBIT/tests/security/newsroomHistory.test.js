const assert = require("node:assert");
const { randomUUID } = require("node:crypto");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createAuthHeader,
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");

const migrationPath = path.join(
  __dirname,
  "..",
  "..",
  "supabase",
  "migrations",
  "20260815010000_newsroom_generation_history.sql",
);

const newsroomFunctionPath = path.join(
  __dirname,
  "..",
  "..",
  "api",
  "ai",
  "newsroom.js",
);

function nowForTest() {
  return new Date().toISOString();
}

function createMemorySupabase({ onExecute } = {}) {
  const store = {
    newsroom_editorial_decisions: [],
    newsroom_generations: [],
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function now() {
    return new Date().toISOString();
  }

  function createQuery(table) {
    const query = {
      _action: "select",
      _filters: [],
      _insert: null,
      _limit: null,
      _order: null,
      _update: null,
      delete() {
        this._action = "delete";
        return this;
      },
      eq(field, value) {
        this._filters.push((row) => row[field] === value);
        return this;
      },
      insert(payload) {
        this._action = "insert";
        this._insert = payload;
        return this;
      },
      limit(value) {
        this._limit = Number(value);
        return this;
      },
      lt(field, value) {
        this._filters.push((row) => String(row[field]) < String(value));
        return this;
      },
      maybeSingle() {
        const result = execute(this);
        return Promise.resolve({
          data: Array.isArray(result.data)
            ? result.data[0] || null
            : result.data,
          error: result.error,
        });
      },
      or(value) {
        const filters = String(value || "")
          .split(",")
          .map((item) => item.match(/^([a-z_]+)\.ilike\.%(.+)%$/i))
          .filter(Boolean)
          .map((match) => ({
            field: match[1],
            search: match[2].toLowerCase(),
          }));

        if (filters.length) {
          this._filters.push((row) =>
            filters.some(({ field, search }) =>
              String(row[field] || "")
                .toLowerCase()
                .includes(search),
            ),
          );
        }

        return this;
      },
      order(field, options) {
        this._order = {
          ascending: Boolean(options?.ascending),
          field,
        };
        return this;
      },
      select() {
        return this;
      },
      single() {
        return this.maybeSingle();
      },
      then(resolve, reject) {
        return Promise.resolve(execute(this)).then(resolve, reject);
      },
      update(payload) {
        this._action = "update";
        this._update = payload;
        return this;
      },
    };

    function getRows() {
      return store[table].filter((row) =>
        query._filters.every((filter) => filter(row)),
      );
    }

    function execute() {
      if (typeof onExecute === "function") {
        onExecute({
          action: query._action,
          table,
        });
      }

      if (query._action === "insert") {
        const rows = (
          Array.isArray(query._insert) ? query._insert : [query._insert]
        ).map((row) => ({
          created_at: now(),
          id: row.id || randomUUID(),
          updated_at: now(),
          ...clone(row),
        }));

        store[table].push(...rows);
        return { data: clone(rows), error: null };
      }

      if (query._action === "update") {
        const rows = getRows();

        rows.forEach((row) => {
          Object.assign(row, clone(query._update), {
            updated_at: now(),
          });
        });

        return { data: clone(rows), error: null };
      }

      if (query._action === "delete") {
        const rows = getRows();
        const ids = new Set(rows.map((row) => row.id));

        store[table] = store[table].filter((row) => !ids.has(row.id));

        return { data: clone(rows), error: null };
      }

      let rows = getRows();

      if (query._order) {
        rows = rows.sort((first, second) => {
          const result = String(first[query._order.field]).localeCompare(
            String(second[query._order.field]),
          );

          return query._order.ascending ? result : -result;
        });
      }

      if (query._limit) rows = rows.slice(0, query._limit);

      return { data: clone(rows), error: null };
    }

    return query;
  }

  return {
    from: createQuery,
    store,
  };
}

function createAuthMiddleware(getUserId) {
  return function requireTestAuth(req, res, next) {
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: "Missing bearer token.",
      });
    }

    req.user = {
      email: `${getUserId()}@example.com`,
      id: getUserId(),
    };
    req.userId = getUserId();
    req.userEmail = `${getUserId()}@example.com`;

    return next();
  };
}

function createNewsroomApp({ getUserId, supabase }) {
  [
    "../../server/services/newsroom/historyRepository",
    "../../server/services/supabaseAdmin",
  ].forEach((modulePath) => {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // Ignore modules that are not loaded yet.
    }
  });

  const route = loadModuleWithMocks("../../server/routes/newsroom", {
    "../middleware/requireAuth": {
      requireAuth: createAuthMiddleware(getUserId),
    },
    "../services/openrouter": {
      generateNewsroomCompletion: async () => ({
        content: "Generated draft",
        metadata: {},
        model: "test-model",
        provider: "test-provider",
      }),
    },
    "../supabaseAdmin": {
      getSupabaseAdmin: () => supabase,
      isSupabaseServiceConfigured: () => Boolean(supabase),
    },
  });
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use("/api/ai/newsroom", route);

  return app;
}

function createGenerationPayload(overrides = {}) {
  return {
    audience: "EDITOR",
    channel: "ARTICLE",
    complexity: "Strategic",
    draft: "BLACK FLASH ORBIT draft without sentinel secrets.",
    editorial: {
      reviewStatus: "READY_FOR_EDITOR",
    },
    editorialReviewReport: {
      reportVersion: "editorial-review-v1",
      safeMetadata: {
        model: "safe-model",
        provider: "openrouter",
      },
      summary: {
        publicationReadiness: "READY_FOR_EDITOR",
      },
    },
    intelligenceSummary: {
      blockers: [],
      confidence: {
        score: 82,
      },
      editorialStatus: "READY_FOR_EDITOR",
      keyFindings: ["1 supported claim(s)."],
      publicationReadiness: "READY_FOR_EDITOR",
    },
    mode: "Editorial",
    topic: "Papua Selatan digital public service",
    verification: {
      publicationBlockers: [],
    },
    ...overrides,
  };
}

test("newsroom history migration enables owner scoped RLS", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    fs.readFileSync(newsroomFunctionPath, "utf8"),
    /server\/routes\/newsroom\.js/,
  );
  const generationColumns = [
    "id",
    "owner_id",
    "created_at",
    "updated_at",
    "topic",
    "source_input_summary",
    "audience",
    "mode",
    "complexity",
    "channel",
    "provider",
    "model",
    "prompt_version",
    "review_status",
    "publication_readiness",
    "approved_at",
    "approved_by",
    "rejected_at",
    "rejected_by",
    "editor_notes",
    "draft",
    "verification",
    "intelligence_summary",
    "editorial_review_report",
    "idempotency_key",
  ];

  generationColumns.forEach((column) => {
    assert.match(
      sql,
      new RegExp(`\\b${column}\\b`, "i"),
      `missing generation column: ${column}`,
    );
  });
  [
    "generation_id",
    "owner_id",
    "actor_id",
    "decision",
    "previous_status",
    "next_status",
    "notes",
    "override_blockers",
    "override_reason",
    "created_at",
  ].forEach((column) => {
    assert.match(
      sql,
      new RegExp(`\\b${column}\\b`, "i"),
      `missing decision column: ${column}`,
    );
  });

  assert.match(
    sql,
    /alter table public\.newsroom_generations enable row level security/i,
  );
  assert.match(
    sql,
    /alter table public\.newsroom_editorial_decisions enable row level security/i,
  );
  assert.match(sql, /owner_id = auth\.uid\(\)/i);
  assert.match(sql, /with check \(owner_id = auth\.uid\(\)\)/i);
  assert.match(sql, /using \(false\)/i);
});

test("newsroom history requires auth and returns empty history as HTTP 200", async () => {
  const app = createNewsroomApp({
    getUserId: () => "user-empty",
    supabase: createMemorySupabase(),
  });
  const server = await startServer(app);

  try {
    const unauthorized = await requestJson(
      server.baseUrl,
      "/api/ai/newsroom/history",
    );
    assert.strictEqual(unauthorized.status, 401);

    const empty = await requestJson(
      server.baseUrl,
      "/api/ai/newsroom/history",
      { headers: createAuthHeader() },
    );
    assert.strictEqual(empty.status, 200);
    assert.deepStrictEqual(empty.body, {
      success: true,
      data: {
        items: [],
        pagination: {
          hasMore: false,
          limit: 12,
          nextCursor: null,
        },
      },
      items: [],
      pagination: {
        hasMore: false,
        limit: 12,
        nextCursor: null,
      },
    });
  } finally {
    await server.close();
  }
});

test("parallel newsroom history list requests share one Supabase loader", async () => {
  let generationSelects = 0;
  const app = createNewsroomApp({
    getUserId: () => "user-coalesce",
    supabase: createMemorySupabase({
      onExecute({ action, table }) {
        if (table === "newsroom_generations" && action === "select") {
          generationSelects += 1;
        }
      },
    }),
  });
  const server = await startServer(app);

  try {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        requestJson(server.baseUrl, "/api/ai/newsroom/history?limit=12", {
          headers: createAuthHeader(),
        }),
      ),
    );

    assert.strictEqual(generationSelects, 1);
    responses.forEach((result) => {
      assert.strictEqual(result.status, 200);
      assert.deepStrictEqual(result.body.items, []);
    });
  } finally {
    await server.close();
  }
});

test("newsroom history list scopes rows to the authenticated owner", async () => {
  const supabase = createMemorySupabase();
  const app = createNewsroomApp({
    getUserId: () => "owner-a",
    supabase,
  });
  const server = await startServer(app);

  try {
    await requestJson(server.baseUrl, "/api/ai/newsroom/history", {
      body: JSON.stringify(createGenerationPayload()),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });
    supabase.store.newsroom_generations.push({
      id: randomUUID(),
      owner_id: "owner-b",
      created_at: nowForTest(),
      updated_at: nowForTest(),
      topic: "Other owner",
    });

    const result = await requestJson(
      server.baseUrl,
      "/api/ai/newsroom/history",
      { headers: createAuthHeader() },
    );
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.items.length, 1);
    assert(result.body.items.every((item) => item.ownerId === "owner-a"));
  } finally {
    await server.close();
  }
});

test("newsroom history service configuration and database failures stay controlled", async () => {
  const configApp = createNewsroomApp({
    getUserId: () => "owner-a",
    supabase: null,
  });
  const configServer = await startServer(configApp);

  try {
    const result = await requestJson(
      configServer.baseUrl,
      "/api/ai/newsroom/history",
      { headers: createAuthHeader() },
    );
    assert.strictEqual(result.status, 503);
    assert.strictEqual(result.body.code, "supabase_not_configured");
    assert.strictEqual(result.body.message, "Gagal membaca generation history.");
    assert(!JSON.stringify(result.body).includes("SUPABASE_SERVICE_ROLE_KEY"));
  } finally {
    await configServer.close();
  }

  const queryErrorSupabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: null,
            error: {
              code: "42P01",
              message: "relation newsroom_generations does not exist",
            },
          });
        },
      };
    },
  };
  const queryApp = createNewsroomApp({
    getUserId: () => "owner-a",
    supabase: queryErrorSupabase,
  });
  const queryServer = await startServer(queryApp);

  try {
    const result = await requestJson(
      queryServer.baseUrl,
      "/api/ai/newsroom/history",
      { headers: createAuthHeader() },
    );
    assert.strictEqual(result.status, 500);
    assert.strictEqual(result.body.code, "history_list_failed");
    assert.strictEqual(result.body.message, "Gagal membaca generation history.");
    assert(!JSON.stringify(result.body).includes("42P01"));
    assert(!JSON.stringify(result.body).includes("relation newsroom_generations"));
  } finally {
    await queryServer.close();
  }
});

test("newsroom history save ties owner to authenticated user and blocks AI approved status", async () => {
  const supabase = createMemorySupabase();
  let currentUserId = "user-a";
  const app = createNewsroomApp({
    getUserId: () => currentUserId,
    supabase,
  });
  const server = await startServer(app);

  try {
    const result = await requestJson(
      server.baseUrl,
      "/api/ai/newsroom/history",
      {
        body: JSON.stringify(
          createGenerationPayload({
            reviewStatus: "APPROVED",
          }),
        ),
        headers: {
          ...createAuthHeader(),
          "content-type": "application/json",
          "idempotency-key": "idem-1",
        },
        method: "POST",
      },
    );

    assert.strictEqual(result.status, 201);
    assert.strictEqual(result.body.generation.ownerId, "user-a");
    assert.strictEqual(result.body.generation.reviewStatus, "READY_FOR_EDITOR");

    const duplicate = await requestJson(
      server.baseUrl,
      "/api/ai/newsroom/history",
      {
        body: JSON.stringify(createGenerationPayload()),
        headers: {
          ...createAuthHeader(),
          "content-type": "application/json",
          "idempotency-key": "idem-1",
        },
        method: "POST",
      },
    );

    assert.strictEqual(duplicate.status, 200);
    assert.strictEqual(duplicate.body.generation.id, result.body.generation.id);

    currentUserId = "user-b";

    const blockedRead = await requestJson(
      server.baseUrl,
      `/api/ai/newsroom/history/${result.body.generation.id}`,
      {
        headers: createAuthHeader(),
      },
    );

    assert.strictEqual(blockedRead.status, 404);
  } finally {
    await server.close();
  }
});

test("newsroom human approval records actor and blocks critical blockers without override", async () => {
  const supabase = createMemorySupabase();
  const app = createNewsroomApp({
    getUserId: () => "editor-a",
    supabase,
  });
  const server = await startServer(app);

  try {
    const created = await requestJson(
      server.baseUrl,
      "/api/ai/newsroom/history",
      {
        body: JSON.stringify(
          createGenerationPayload({
            intelligenceSummary: {
              blockers: [
                {
                  message: "Critical quote missing.",
                  type: "UNSUPPORTED_DIRECT_QUOTE",
                },
              ],
              publicationReadiness: "BLOCKED",
            },
            publicationReadiness: "BLOCKED",
          }),
        ),
        headers: {
          ...createAuthHeader(),
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
    const id = created.body.generation.id;

    const blocked = await requestJson(
      server.baseUrl,
      `/api/ai/newsroom/history/${id}/decision`,
      {
        body: JSON.stringify({
          decision: "APPROVE",
          notes: "Reviewed.",
        }),
        headers: {
          ...createAuthHeader(),
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    assert.strictEqual(blocked.status, 409);

    const approved = await requestJson(
      server.baseUrl,
      `/api/ai/newsroom/history/${id}/decision`,
      {
        body: JSON.stringify({
          decision: "APPROVE",
          notes: "Editor accepts risk after source desk review.",
          overrideBlockers: true,
          overrideReason: "Manual source desk verification completed.",
        }),
        headers: {
          ...createAuthHeader(),
          "content-type": "application/json",
        },
        method: "POST",
      },
    );

    assert.strictEqual(approved.status, 200);
    assert.strictEqual(approved.body.generation.reviewStatus, "APPROVED");
    assert.strictEqual(approved.body.generation.approvedBy, "editor-a");
    assert.strictEqual(approved.body.decision.overrideBlockers, true);
  } finally {
    await server.close();
  }
});

test("newsroom export returns PDF and DOCX without sentinel secret strings", async () => {
  const supabase = createMemorySupabase();
  const app = createNewsroomApp({
    getUserId: () => "editor-a",
    supabase,
  });
  const server = await startServer(app);

  try {
    const created = await requestJson(
      server.baseUrl,
      "/api/ai/newsroom/history",
      {
        body: JSON.stringify(
          createGenerationPayload({
            editorialReviewReport: {
              rawPrompt: "sentinel-raw-prompt",
              reportVersion: "editorial-review-v1",
              safeMetadata: {
                model: "safe-model",
                provider: "openrouter",
                systemPrompt: "sentinel-system",
              },
            },
            systemPrompt: "sentinel-system-prompt",
          }),
        ),
        headers: {
          ...createAuthHeader(),
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
    const id = created.body.generation.id;

    const pdf = await fetch(
      `${server.baseUrl}/api/ai/newsroom/history/${id}/export?format=pdf&type=review`,
      {
        headers: createAuthHeader(),
      },
    );
    const pdfBuffer = Buffer.from(await pdf.arrayBuffer());

    assert.strictEqual(pdf.status, 200);
    assert.match(pdf.headers.get("content-type"), /application\/pdf/i);
    assert.match(
      pdf.headers.get("content-disposition"),
      /black-flash-orbit-editorial-review-\d{4}-\d{2}-\d{2}\.pdf/i,
    );
    assert(pdfBuffer.length > 200);
    assert(pdfBuffer.includes(Buffer.from("BLACK FLASH ORBIT")));
    assert(!pdfBuffer.includes(Buffer.from("sentinel-system")));

    const docx = await fetch(
      `${server.baseUrl}/api/ai/newsroom/history/${id}/export?format=docx&type=draft`,
      {
        headers: createAuthHeader(),
      },
    );
    const docxBuffer = Buffer.from(await docx.arrayBuffer());

    assert.strictEqual(docx.status, 200);
    assert.match(
      docx.headers.get("content-type"),
      /officedocument\.wordprocessingml\.document/i,
    );
    assert.match(
      docx.headers.get("content-disposition"),
      /black-flash-orbit-draft-\d{4}-\d{2}-\d{2}\.docx/i,
    );
    assert(docxBuffer.length > 500);
    assert(docxBuffer.includes(Buffer.from("word/document.xml")));
    assert(!docxBuffer.includes(Buffer.from("sentinel-system")));
  } finally {
    await server.close();
  }
});
