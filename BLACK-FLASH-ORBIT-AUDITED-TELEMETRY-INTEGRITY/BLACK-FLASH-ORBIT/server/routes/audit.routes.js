const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { getSupabaseAdmin } = require("../services/supabaseAdmin");
const { runWorkspaceAudit } = require("../services/auditEngine");

const router = express.Router();

function logAuditRouteError(scope, error) {
  console.warn("[ORBIT Audit Route]", {
    code: error?.code || null,
    scope,
    status: error?.status || error?.statusCode || null,
  });
}

function requireAuditDatabase(res) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    res.status(500).json({
      ok: false,
      message: "Supabase admin belum dikonfigurasi.",
    });

    return null;
  }

  return supabaseAdmin;
}

router.post("/run", requireAuth, async (req, res) => {
  try {
    const db = requireAuditDatabase(res);
    if (!db) return;

    const audit = await runWorkspaceAudit();

    const payload = {
      user_id: req.user.id,
      report_code: audit.reportCode,
      type: audit.type,
      score: audit.score,
      status: audit.status,
      findings: audit.findings,
      summary: audit.summary,
    };

    const { data, error } = await db
      .from("orbit_audit_reports")
      .insert(payload)
      .select()
      .single();

    if (error) {
      logAuditRouteError("save_report", error);

      return res.status(500).json({
        ok: false,
        message: "Failed to save audit report.",
      });
    }

    return res.json({
      ok: true,
      report: data,
    });
  } catch (error) {
    logAuditRouteError("run_audit", error);

    return res.status(500).json({
      ok: false,
      message: "Audit engine failed.",
    });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  const db = requireAuditDatabase(res);
  if (!db) return;

  const { data, error } = await db
    .from("orbit_audit_reports")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logAuditRouteError("load_history", error);

    return res.status(500).json({
      ok: false,
      message: "Failed to load audit history.",
    });
  }

  return res.json({
    ok: true,
    reports: data,
  });
});

router.get("/:id", requireAuth, async (req, res) => {
  const db = requireAuditDatabase(res);
  if (!db) return;

  const { data, error } = await db
    .from("orbit_audit_reports")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) {
    return res.status(404).json({
      ok: false,
      message: "Audit report not found.",
    });
  }

  return res.json({
    ok: true,
    report: data,
  });
});

module.exports = router;
