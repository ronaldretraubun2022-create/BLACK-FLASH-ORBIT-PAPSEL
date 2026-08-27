const express = require("express");

const { requireAuth } = require("../middleware/requireAuth");
const {
  getEntityDetail,
  getOverview,
  listEntities,
  listSourceLinks,
  listSources,
  listTimeline,
  processExistingSource,
  processSourceInput,
  reprocessSource,
  searchClaims,
  searchIntelligence,
} = require("../services/intelligence/intelligenceRepository");

const router = express.Router();

function getOwnerId(req) {
  return req.userId || req.user?.id || null;
}

function sendError(res, error) {
  const status = Number(error?.statusCode || error?.status || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  return res.status(safeStatus).json({
    success: false,
    code: error?.code || "INTELLIGENCE_REQUEST_FAILED",
    message:
      safeStatus >= 500
        ? "Intelligence request gagal."
        : error?.message || "Intelligence request gagal.",
  });
}

function wrapAsync(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      return sendError(res, error);
    }
  };
}

function getFilters(req) {
  return {
    claimStatus: req.query.claimStatus || req.query.claim_status,
    dateFrom: req.query.dateFrom || req.query.date_from,
    dateTo: req.query.dateTo || req.query.date_to,
    entityType: req.query.entityType || req.query.entity_type,
    keyword: req.query.keyword || req.query.q || req.query.search,
    limit: req.query.limit,
    sourceId: req.query.sourceId || req.query.source_id,
    sourceType: req.query.sourceType || req.query.source_type,
  };
}

router.use(requireAuth);

router.get(
  "/overview",
  wrapAsync(async (req, res) => {
    const data = await getOverview({ ownerId: getOwnerId(req) });

    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  "/entities",
  wrapAsync(async (req, res) => {
    const data = await listEntities({
      filters: getFilters(req),
      ownerId: getOwnerId(req),
    });

    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  "/entities/:id",
  wrapAsync(async (req, res) => {
    const data = await getEntityDetail({
      entityId: req.params.id,
      ownerId: getOwnerId(req),
    });

    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  "/claims",
  wrapAsync(async (req, res) => {
    const data = await searchClaims({
      filters: getFilters(req),
      ownerId: getOwnerId(req),
    });

    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  "/timeline",
  wrapAsync(async (req, res) => {
    const data = await listTimeline({
      filters: getFilters(req),
      ownerId: getOwnerId(req),
    });

    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  "/search",
  wrapAsync(async (req, res) => {
    const data = await searchIntelligence({
      filters: getFilters(req),
      ownerId: getOwnerId(req),
    });

    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  "/source-links",
  wrapAsync(async (req, res) => {
    const data = await listSourceLinks({
      filters: getFilters(req),
      ownerId: getOwnerId(req),
    });

    res.json({
      success: true,
      data,
    });
  }),
);

router.get(
  "/sources",
  wrapAsync(async (req, res) => {
    const data = await listSources({
      filters: getFilters(req),
      ownerId: getOwnerId(req),
    });

    res.json({
      success: true,
      data,
    });
  }),
);

router.post(
  "/sources/:id/reprocess",
  wrapAsync(async (req, res) => {
    const data = await reprocessSource({
      ownerId: getOwnerId(req),
      sourceUuid: req.params.id,
    });

    res.json({
      success: true,
      data,
      message: "Intelligence source reprocessed.",
    });
  }),
);

router.post(
  "/process",
  wrapAsync(async (req, res) => {
    const ownerId = getOwnerId(req);
    const sourceType = req.body?.sourceType || req.body?.source_type;
    const sourceId = req.body?.sourceId || req.body?.source_id;
    const hasManualContent = typeof req.body?.content === "string" && req.body.content.trim();
    const data = hasManualContent
      ? await processSourceInput({
          input: {
            content: req.body.content,
            createdAt: req.body.createdAt || req.body.created_at,
            sourceId,
            sourceType,
            sourceUrl: req.body.sourceUrl || req.body.source_url,
            title: req.body.title,
          },
          ownerId,
        })
      : await processExistingSource({
          ownerId,
          sourceId,
          sourceType,
        });

    res.status(201).json({
      success: true,
      data,
      message: "Intelligence source processed.",
    });
  }),
);

module.exports = router;
