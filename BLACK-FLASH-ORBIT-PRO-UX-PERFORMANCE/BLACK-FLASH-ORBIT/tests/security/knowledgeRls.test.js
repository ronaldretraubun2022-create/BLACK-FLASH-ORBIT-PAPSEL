const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  __dirname,
  "..",
  "..",
  "supabase",
  "migrations",
  "20260706010000_knowledge_rag_v1.sql",
);

test("knowledge migration enables RLS and owner-scoped policies", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(
    sql,
    /alter table public\.knowledge_documents enable row level security/i,
  );
  assert.match(
    sql,
    /alter table public\.knowledge_chunks enable row level security/i,
  );
  assert.match(sql, /owner_id = auth\.uid\(\)/i);
  assert.match(
    sql,
    /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i,
  );
  assert.match(sql, /kc\.owner_id = owner_filter/i);
  assert.match(sql, /kd\.owner_id = owner_filter/i);
});
