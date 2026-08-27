const assert = require("node:assert");
const test = require("node:test");

const {
  normalizeAiResponseContent,
} = require("../../server/services/ai/responseValidator");

function assertInvalidResponse(name, response, reason) {
  test(`AI response validator rejects ${name}`, () => {
    assert.throws(
      () => normalizeAiResponseContent(response),
      (error) =>
        error.code === "AI_PROVIDER_INVALID_RESPONSE" &&
        error.statusCode === 502 &&
        error.reason === reason,
    );
  });
}

assertInvalidResponse("null", null, "null_response");
assertInvalidResponse("undefined", undefined, "undefined_response");
assertInvalidResponse(
  "empty content",
  { choices: [{ message: { content: "" } }] },
  "empty_content",
);
assertInvalidResponse(
  "whitespace-only content",
  { choices: [{ message: { content: "   " } }] },
  "empty_content",
);
assertInvalidResponse(
  "newline and tab content",
  { choices: [{ message: { content: "\n\t" } }] },
  "empty_content",
);
assertInvalidResponse("missing choices", {}, "missing_choices");
assertInvalidResponse("malformed choices", { choices: [] }, "missing_choices");
assertInvalidResponse("missing message", { choices: [{}] }, "missing_message");
assertInvalidResponse(
  "missing content",
  { choices: [{ message: {} }] },
  "missing_content",
);

test("AI response validator returns valid content unchanged except trimming", () => {
  assert.strictEqual(
    normalizeAiResponseContent({
      choices: [{ message: { content: "Valid newsroom answer." } }],
    }),
    "Valid newsroom answer.",
  );
});

test("AI response validator trims surrounding whitespace", () => {
  assert.strictEqual(
    normalizeAiResponseContent({
      choices: [{ message: { content: "  Valid answer. \n" } }],
    }),
    "Valid answer.",
  );
});
