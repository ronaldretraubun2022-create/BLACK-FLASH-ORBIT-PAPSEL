const { createClient } = require("@supabase/supabase-js");

let adminClient = null;
let adminClientKey = "";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const nextClientKey = `${supabaseUrl}:${serviceRoleKey}`;

  if (!adminClient || adminClientKey !== nextClientKey) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    adminClientKey = nextClientKey;
  }

  return adminClient;
}

function isSupabaseServiceConfigured() {
  return Boolean(String(process.env.SUPABASE_URL || "").trim()) && Boolean(
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  );
}

module.exports = {
  getSupabaseAdmin,
  isSupabaseServiceConfigured,
};
