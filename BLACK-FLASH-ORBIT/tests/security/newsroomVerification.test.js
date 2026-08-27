const assert = require("node:assert");
const express = require("express");
const test = require("node:test");

const {
  createAuthHeader,
  loadModuleWithMocks,
  requestJson,
  startServer,
} = require("../knowledge/testUtils");
const {
  verifyNewsroomDraft,
} = require("../../server/services/newsroom/verification");

function getClaim(result, type) {
  return result.claims.find((claim) => claim.type === type);
}

function createAuthMiddleware() {
  return function requireTestAuth(req, res, next) {
    req.user = {
      email: "reporter@example.com",
      id: "user-1",
    };
    req.userId = "user-1";
    req.userEmail = "reporter@example.com";

    return next();
  };
}

function createNewsroomApp(generateNewsroomCompletion) {
  const route = loadModuleWithMocks("../../server/routes/newsroom", {
    "../middleware/requireAuth": {
      requireAuth: createAuthMiddleware(),
    },
    "../services/openrouter": {
      generateNewsroomCompletion,
    },
  });
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use("/api/ai/newsroom", route);

  return app;
}

test("Fact Guard flags fabricated quote absent from supplied evidence", () => {
  const result = verifyNewsroomDraft({
    draft: 'The official said, "This program will double public trust."',
    sourceText: "The official discussed the program but gave no direct quote.",
  });
  const quote = getClaim(result, "QUOTE");

  assert(quote, "quote claim should be extracted");
  assert.strictEqual(quote.status, "UNSUPPORTED");
  assert.strictEqual(result.publicationReady, false);
  assert.strictEqual(result.review.reviewStatus, "NEEDS_REVIEW");
  assert(
    result.factGuard.warnings.some((warning) =>
      /Unsupported direct quote/i.test(warning),
    ),
  );
});

test("Fact Guard does not support fabricated specific date from vague month evidence", () => {
  const result = verifyNewsroomDraft({
    draft: "The event occurred on August 14, 2026.",
    sourceText: "The event occurred in August 2026.",
  });
  const date = getClaim(result, "DATE");

  assert(date, "date claim should be extracted");
  assert.strictEqual(date.value, "August 14, 2026");
  assert.strictEqual(date.status, "UNSUPPORTED");
});

test("Fact Guard flags fabricated statistic from vague evidence", () => {
  const result = verifyNewsroomDraft({
    draft: "Participation increased by 47%.",
    sourceText: "Participation increased significantly.",
  });
  const number = getClaim(result, "NUMBER");

  assert(number, "number claim should be extracted");
  assert.strictEqual(number.value, "47%");
  assert.strictEqual(number.status, "UNSUPPORTED");
  assert.strictEqual(result.publicationReady, false);
});

test("Fact Guard preserves attributed allegation and flags attribution loss", () => {
  const sourceText = "Organization A alleged that Person B misused funds.";
  const safe = verifyNewsroomDraft({
    draft: "Organization A alleged that Person B misused funds.",
    sourceText,
  });
  const unsafe = verifyNewsroomDraft({
    draft: "Person B misused funds.",
    sourceText,
  });

  assert.strictEqual(getClaim(safe, "ALLEGATION").status, "SUPPORTED");
  assert.strictEqual(getClaim(unsafe, "ALLEGATION").status, "UNSUPPORTED");
  assert(
    unsafe.factGuard.highRiskClaims.some(
      (claim) => claim.type === "ALLEGATION",
    ),
  );
});

test("Fact Guard reports conflicting source dates without selecting truth", () => {
  const result = verifyNewsroomDraft({
    draft: "The event occurred on August 10, 2026.",
    sources: [
      {
        content: "The event occurred on August 10, 2026.",
        title: "Source A",
        type: "official_document",
      },
      {
        content: "The event occurred on August 11, 2026.",
        title: "Source B",
        type: "official_document",
      },
    ],
  });
  const date = getClaim(result, "DATE");

  assert.strictEqual(date.status, "CONFLICTING");
  assert.strictEqual(result.factGuard.conflictingCount, 1);
  assert.strictEqual(result.review.reviewStatus, "NEEDS_REVIEW");
  assert.strictEqual(result.publicationReady, false);
});

test("Source Confidence scores explainable source types and factors", () => {
  const official = verifyNewsroomDraft({
    draft: "The event occurred on August 10, 2026.",
    sources: [
      {
        content: "The event occurred on August 10, 2026.",
        publishedAt: "2026-08-10",
        publisher: "Official Agency",
        title: "Primary official document",
        type: "official_document",
      },
    ],
  });
  const interview = verifyNewsroomDraft({
    draft: 'Person A said, "Services improved this month."',
    sources: [
      {
        author: "Reporter One",
        content: 'Person A said, "Services improved this month."',
        title: "Named direct interview",
        type: "direct_interview",
      },
    ],
  });
  const secondary = verifyNewsroomDraft({
    draft: "Participation increased by 12%.",
    sources: [
      {
        content: "Participation increased by 12%.",
        publisher: "Regional News Desk",
        title: "Reputable secondary report",
        type: "reputable_reporting",
      },
    ],
  });
  const userPaste = verifyNewsroomDraft({
    draft: "Participation increased by 47%.",
    sourceText: "Participation increased significantly.",
  });
  const unknown = verifyNewsroomDraft({
    draft: "Participation increased by 47%.",
    sources: [{ content: "Participation increased significantly." }],
  });
  const stale = verifyNewsroomDraft({
    draft: "The event occurred on August 10, 2026.",
    sources: [
      {
        content: "The event occurred on August 10, 2026.",
        publishedAt: "2020-01-01",
        title: "Old official document",
        type: "official_document",
      },
    ],
  });
  const conflicting = verifyNewsroomDraft({
    draft: "The event occurred on August 10, 2026.",
    sources: [
      {
        content: "The event occurred on August 10, 2026.",
        type: "official_document",
      },
      {
        content: "The event occurred on August 11, 2026.",
        type: "official_document",
      },
    ],
  });

  assert.strictEqual(official.sourceConfidence.level, "HIGH");
  assert.strictEqual(interview.sourceConfidence.level, "HIGH");
  assert(["MEDIUM", "HIGH"].includes(secondary.sourceConfidence.level));
  assert(["LOW", "INSUFFICIENT"].includes(userPaste.sourceConfidence.level));
  assert(["LOW", "INSUFFICIENT"].includes(unknown.sourceConfidence.level));
  assert.strictEqual(stale.sourceConfidence.factors.staleSourceCount, 1);
  assert(
    conflicting.sourceConfidence.warnings.includes(
      "Conflicting source evidence detected.",
    ),
  );
});

test("POST /api/ai/newsroom returns verification and editorial schema", async () => {
  const app = createNewsroomApp(async () => ({
    content: 'Executive Summary\nThe official said, "Unsupported quote."',
    metadata: {
      durationMs: 20,
      fallbackUsed: false,
    },
    model: "resolved/newsroom-model",
    provider: "openrouter",
  }));
  const server = await startServer(app);

  try {
    const result = await requestJson(server.baseUrl, "/api/ai/newsroom", {
      body: JSON.stringify({
        audience: "EDITOR",
        channel: "EDITOR_BRIEF",
        complexity: "DEEP",
        layer: "Editorial Layer",
        mode: "Editorial",
        sourceText: "The official discussed the program.",
        topic: "The official discussed the program.",
      }),
      headers: {
        ...createAuthHeader(),
        "content-type": "application/json",
      },
      method: "POST",
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.success, true);
    assert(result.body.verification);
    assert(result.body.editorial);
    assert.strictEqual(result.body.verification.publicationReady, false);
    assert.strictEqual(result.body.editorial.reviewStatus, "NEEDS_REVIEW");
    assert.strictEqual(result.body.editorial.requiresHumanApproval, true);
    assert(Array.isArray(result.body.verification.publicationBlockers));
    assert.strictEqual(result.body.metadata.reviewStatus, "NEEDS_REVIEW");
  } finally {
    await server.close();
  }
});
