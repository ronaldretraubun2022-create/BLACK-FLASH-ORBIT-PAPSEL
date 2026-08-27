const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const {
  createPage,
  createProject,
  deletePage,
  deleteProject,
  exportProject,
  getPage,
  getProject,
  listPages,
  listProjects,
  updatePage,
  updateProject,
} = require("../services/webBuilderService");

const router = express.Router();

function getUserContext(req) {
  return {
    userEmail: req.user?.email || req.userEmail || null,
    userId: req.user?.id || req.userId || null,
  };
}

function sendError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || error.status || 500;
  const message =
    statusCode >= 500 ? fallbackMessage : error.message || fallbackMessage;

  return res.status(statusCode).json({
    success: false,
    code: error.code || "web_builder_request_failed",
    message,
  });
}

router.use(requireAuth);

router.get("/projects", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const projects = await listProjects({ userId });

    return res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil web builder projects.");
  }
});

router.post("/projects", async (req, res) => {
  try {
    const { userEmail, userId } = getUserContext(req);
    const project = await createProject({
      input: req.body,
      userEmail,
      userId,
    });

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    return sendError(res, error, "Gagal membuat web builder project.");
  }
});

router.get("/projects/:projectId", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const project = await getProject({
      projectId: req.params.projectId,
      userId,
    });

    return res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil web builder project.");
  }
});

router.patch("/projects/:projectId", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const project = await updateProject({
      input: req.body,
      projectId: req.params.projectId,
      userId,
    });

    return res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    return sendError(res, error, "Gagal update web builder project.");
  }
});

router.delete("/projects/:projectId", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const deleted = await deleteProject({
      projectId: req.params.projectId,
      userId,
    });

    return res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    return sendError(res, error, "Gagal menghapus web builder project.");
  }
});

router.get("/projects/:projectId/pages", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const pages = await listPages({
      projectId: req.params.projectId,
      userId,
    });

    return res.json({
      success: true,
      data: pages,
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil web builder pages.");
  }
});

router.post("/projects/:projectId/pages", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const page = await createPage({
      input: req.body,
      projectId: req.params.projectId,
      userId,
    });

    return res.status(201).json({
      success: true,
      data: page,
    });
  } catch (error) {
    return sendError(res, error, "Gagal membuat web builder page.");
  }
});

router.post("/projects/:projectId/export", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const exported = await exportProject({
      projectId: req.params.projectId,
      userId,
    });

    return res.json({
      success: true,
      data: exported,
    });
  } catch (error) {
    return sendError(res, error, "Gagal export web builder project.");
  }
});

router.get("/pages/:pageId", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const page = await getPage({
      pageId: req.params.pageId,
      userId,
    });

    return res.json({
      success: true,
      data: page,
    });
  } catch (error) {
    return sendError(res, error, "Gagal mengambil web builder page.");
  }
});

router.patch("/pages/:pageId", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const page = await updatePage({
      input: req.body,
      pageId: req.params.pageId,
      userId,
    });

    return res.json({
      success: true,
      data: page,
    });
  } catch (error) {
    return sendError(res, error, "Gagal update web builder page.");
  }
});

router.delete("/pages/:pageId", async (req, res) => {
  try {
    const { userId } = getUserContext(req);
    const deleted = await deletePage({
      pageId: req.params.pageId,
      userId,
    });

    return res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    return sendError(res, error, "Gagal menghapus web builder page.");
  }
});

module.exports = router;
