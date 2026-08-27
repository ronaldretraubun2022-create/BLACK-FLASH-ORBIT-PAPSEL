const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "..");

function readProjectFile(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

test("Knowledge page and copilot do not statically import mock RAG/data", () => {
  const files = [
    "apps/web/src/pages/KnowledgeBase.jsx",
    "apps/web/src/hooks/useKnowledgeCopilot.js",
  ];

  files.forEach((filePath) => {
    const source = readProjectFile(filePath);

    assert(!/from\s+["'][^"']*knowledgeMock\.js["']/.test(source), filePath);
    assert(!/from\s+["'][^"']*mockRagEngine\.js["']/.test(source), filePath);
  });
});

test("Knowledge mock fallback requires development and explicit true flag", () => {
  const source = readProjectFile("apps/web/src/services/knowledgeService.js");

  assert(source.includes("import.meta.env.DEV === true"));
  assert(
    source.includes(
      'import.meta.env.VITE_ENABLE_KNOWLEDGE_MOCK_FALLBACK === "true"',
    ),
  );
});

test("Newsroom local fallback requires development and explicit true flag", () => {
  const source = readProjectFile("apps/web/src/services/newsroomAI.js");

  assert(source.includes("import.meta.env.DEV === true"));
  assert(
    source.includes(
      'import.meta.env.VITE_ENABLE_NEWSROOM_LOCAL_FALLBACK === "true"',
    ),
  );
});
