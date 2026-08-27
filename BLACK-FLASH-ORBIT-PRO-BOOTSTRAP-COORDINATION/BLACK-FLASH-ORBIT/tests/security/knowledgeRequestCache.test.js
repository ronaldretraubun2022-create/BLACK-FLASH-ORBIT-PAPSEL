const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const knowledgeServicePath = path.join(
  __dirname,
  "../../apps/web/src/services/knowledgeService.js",
);

test("Knowledge document list uses shared request cache and invalidates mutations", () => {
  const source = fs.readFileSync(knowledgeServicePath, "utf8");

  assert.match(source, /new SharedRequestCache/);
  assert.match(source, /sharedKnowledgeDocuments\.resolve/);
  assert.match(source, /getAuthorizationCacheKey/);
  assert.match(source, /clearKnowledgeDocumentsCache\(\)/);
  assert.match(source, /deleteKnowledgeDocument[\s\S]*clearKnowledgeDocumentsCache\(\)/);
  assert.match(source, /uploadKnowledgeDocument[\s\S]*clearKnowledgeDocumentsCache\(\)/);
});
