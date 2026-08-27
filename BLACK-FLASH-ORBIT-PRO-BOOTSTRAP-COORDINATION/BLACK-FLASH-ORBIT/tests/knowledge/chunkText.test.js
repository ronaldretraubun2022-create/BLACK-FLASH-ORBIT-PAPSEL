const assert = require("node:assert");
const test = require("node:test");

const { chunkText, estimateTokenCount } = require("../../server/services/knowledge/chunkText");

test("chunkText keeps short text in one chunk", () => {
  const chunks = chunkText("This is a short newsroom note.");

  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0].chunkIndex, 0);
  assert.strictEqual(chunks[0].content, "This is a short newsroom note.");
  assert.strictEqual(chunks[0].tokenCount, estimateTokenCount(chunks[0].content));
});

test("chunkText splits long text and preserves overlap", () => {
  const text = [
    "Paragraph one about Papua Selatan and newsroom verification.",
    "Paragraph two with additional editorial context and source notes.",
    "Paragraph three with follow up details for the archive.",
    "Paragraph four to force chunk splitting across the configured size.",
  ].join("\n\n");

  const chunks = chunkText(text, { maxChars: 90, overlapChars: 20 });

  assert(chunks.length >= 2, "expected multiple chunks");
  assert.strictEqual(chunks[0].chunkIndex, 0);
  assert.strictEqual(chunks[1].chunkIndex, 1);
  assert(chunks.every((chunk) => chunk.content.length <= 90));
  assert(
    chunks[1].content.includes("Paragraph"),
    "later chunks should still carry meaningful text",
  );
});

