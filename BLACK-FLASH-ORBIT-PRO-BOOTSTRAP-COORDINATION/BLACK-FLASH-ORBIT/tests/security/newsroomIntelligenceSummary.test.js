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
  buildEditorialReviewReport,
} = require("../../server/services/newsroom/editorialReviewReport");
const {
  ACTION_TYPES,
  PUBLICATION_READINESS,
  buildIntelligenceSummary,
} = require("../../server/services/newsroom/intelligenceSummary");
const {
  verifyNewsroomDraft,
} = require("../../server/services/newsroom/verification");

function createEditorial(verification) {
  return {
    confidence: verification.review.editorialConfidence,
    requiresHumanApproval: verification.review.requiresHumanApproval,
    reviewReasons: verification.review.reviewReasons,
    reviewStatus: verification.review.reviewStatus,
  };
}

function createSummary({
  draft,
  legacyConfidenceScore = 90,
  sourceText,
  sources,
}) {
  const verification = verifyNewsroomDraft({
    draft,
    legacyConfidenceScore,
    sourceText,
    sources,
  });
  const editorial = createEditorial(verification);
  const metadata = {
    audience: "EDITOR",
    channel: "ARTICLE",
    complexity: "DEEP",
    durationMs: 25,
    fallbackUsed: false,
    mode: "ANALYSIS",
    model: "resolved/newsroom-model",
    promptVersion: "newsroom-v2",
    provider: "openrouter",
  };

  return {
    editorial,
    metadata,
    summary: buildIntelligenceSummary({
      editorial,
      metadata,
      verification,
    }),
    verification,
  };
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

test("Intelligence Summary marks clean supported draft ready for editor review", () => {
  const { summary } = createSummary({
    draft: "The event occurred on August 10, 2026.",
    sources: [
      {
        content: "The event occurred on August 10, 2026.",
        publisher: "Official Agency",
        title: "Primary official document",
        type: "official_document",
      },
    ],
  });

  assert.strictEqual(
    summary.publicationReadiness,
    PUBLICATION_READINESS.READY_FOR_EDITOR,
  );
  assert.deepStrictEqual(summary.blockers, []);
  assert(
    summary.editorActions.some(
      (action) => action.type === ACTION_TYPES.READY_FOR_EDITOR_REVIEW,
    ),
  );
});

test("Intelligence Summary surfaces unsupported quote blocker and action", () => {
  const { summary } = createSummary({
    draft: 'The official said, "This program will double public trust."',
    sourceText: "The official discussed the program but gave no direct quote.",
  });

  assert.strictEqual(
    summary.publicationReadiness,
    PUBLICATION_READINESS.BLOCKED,
  );
  assert(
    summary.blockers.some(
      (blocker) => blocker.type === "UNSUPPORTED_DIRECT_QUOTE",
    ),
  );
  assert(summary.unsupportedClaims.some((claim) => claim.type === "QUOTE"));
  assert(
    summary.editorActions.some(
      (action) => action.type === ACTION_TYPES.VERIFY_QUOTE,
    ),
  );
});

test("Intelligence Summary recommends primary source for weak statistical support", () => {
  const { summary } = createSummary({
    draft: "The budget increased by 47 miliar.",
    sources: [
      {
        content: "The budget increased by 47 miliar.",
        publisher: "Regional News Desk",
        title: "Regional secondary report",
        type: "reputable_reporting",
      },
    ],
  });

  assert(
    summary.sourceGaps.some((gap) => gap.type === "PRIMARY_NUMERIC_SOURCE_GAP"),
  );
  assert(
    summary.editorActions.some(
      (action) => action.type === ACTION_TYPES.ADD_PRIMARY_SOURCE,
    ),
  );
});

test("Intelligence Summary flags conflicting dates for human review", () => {
  const { summary } = createSummary({
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

  assert.notStrictEqual(
    summary.publicationReadiness,
    PUBLICATION_READINESS.READY_FOR_EDITOR,
  );
  assert(summary.conflictingEvidence.length > 0);
  assert(summary.sourceGaps.some((gap) => gap.type === "DATE_CONFLICT_GAP"));
  assert(
    summary.editorActions.some(
      (action) => action.type === ACTION_TYPES.RESOLVE_SOURCE_CONFLICT,
    ),
  );
});

test("Intelligence Summary preserves allegation caution without automated approval", () => {
  const { summary } = createSummary({
    draft: "Organization A alleged that Person B misused funds.",
    sourceText: "Organization A alleged that Person B misused funds.",
  });

  assert.notStrictEqual(
    summary.publicationReadiness,
    PUBLICATION_READINESS.READY_FOR_EDITOR,
  );
  assert(
    summary.sourceGaps.some(
      (gap) => gap.type === "ALLEGATION_CORROBORATION_GAP",
    ),
  );
  assert(
    summary.editorActions.some(
      (action) => action.type === ACTION_TYPES.CORROBORATE_ALLEGATION,
    ),
  );
  assert(!/approved/i.test(summary.publicationReadiness));
});

test("Editorial Review Report omits unsafe prompt, auth, and provider payload metadata", () => {
  const { metadata, summary, verification } = createSummary({
    draft: 'The official said, "Unsupported quote."',
    sourceText: "The official discussed the program.",
  });
  const report = buildEditorialReviewReport({
    configuration: {
      ...metadata,
      rawPrompt: "OPENROUTER_API_KEY=sentinel-raw-prompt",
      sourceText: "SUPABASE_SERVICE_ROLE_KEY=sentinel-source",
      systemPrompt: "Authorization: Bearer sentinel-system",
    },
    intelligenceSummary: summary,
    metadata: {
      ...metadata,
      Authorization: "Bearer sentinel-auth",
      OPENROUTER_API_KEY: "sentinel-openrouter",
      rawProviderPayload: {
        SUPABASE_SERVICE_ROLE_KEY: "sentinel-supabase",
      },
      systemPrompt: "sentinel-system-prompt",
    },
    verification,
  });
  const serialized = JSON.stringify(report);

  assert.strictEqual(report.reportVersion, "editorial-review-v1");
  assert(!serialized.includes("sentinel-openrouter"));
  assert(!serialized.includes("sentinel-supabase"));
  assert(!serialized.includes("sentinel-auth"));
  assert(!serialized.includes("sentinel-system-prompt"));
  assert(!serialized.includes("sentinel-raw-prompt"));
  assert(!serialized.includes("Authorization"));
  assert(!serialized.includes("OPENROUTER_API_KEY"));
  assert(!serialized.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert(!serialized.includes("rawProviderPayload"));
  assert(!serialized.includes("systemPrompt"));
});

test("POST /api/ai/newsroom returns Intelligence Summary and Editorial Review Report", async () => {
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
    assert(result.body.intelligenceSummary);
    assert(result.body.editorialReviewReport);
    assert.strictEqual(
      result.body.intelligenceSummary.publicationReadiness,
      PUBLICATION_READINESS.BLOCKED,
    );
    assert.strictEqual(
      result.body.editorialReviewReport.reportVersion,
      "editorial-review-v1",
    );
    assert.strictEqual(
      result.body.editorialReviewReport.safeMetadata.provider,
      "openrouter",
    );
  } finally {
    await server.close();
  }
});
