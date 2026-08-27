const { getSupabaseAdmin } = require("../supabaseAdmin");
const { redactObject } = require("./redaction");

function createAuditError(message, statusCode = 500, code = "AGENT_AUDIT_FAILED") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function recordAgentAudit({ eventType, jobId = null, metadata = {}, ownerId }) {
  const client = getSupabaseAdmin();

  if (!client) {
    throw createAuditError("Agent persistence belum dikonfigurasi.", 503, "AGENT_PERSISTENCE_NOT_CONFIGURED");
  }

  const { error } = await client.from("orbit_agent_audit").insert({
    event_type: String(eventType || "agent_event").slice(0, 80),
    job_id: jobId,
    owner_id: ownerId,
    safe_metadata: redactObject(metadata || {}),
  });

  if (error) throw createAuditError("Agent audit gagal.");
}

module.exports = {
  recordAgentAudit,
};
