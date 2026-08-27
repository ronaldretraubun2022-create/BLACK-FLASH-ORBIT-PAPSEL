const SECRET_PATTERNS = [
  /authorization\s*[:=]\s*bearer\s+[a-z0-9._~+/=-]+/gi,
  /\bbearer\s+[a-z0-9._~+/=-]+/gi,
  /\b[a-z0-9_.-]*(?:api[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token|password|passwd|secret|credential)[a-z0-9_.-]*\s*[:=]\s*['"]?[^'",;\s)}\]]+/gi,
  /\bsk-[a-z0-9_-]{12,}\b/gi,
  /\bsk-proj-[a-z0-9_-]{12,}\b/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
];

const MAX_SAFE_TEXT = 12000;

function redactText(value, maxLength = MAX_SAFE_TEXT) {
  let text = String(value || "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/\s+$/gm, "")
    .slice(0, Math.max(0, maxLength));

  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[REDACTED]");
  }

  return text;
}

function redactObject(value, depth = 0) {
  if (depth > 8) return "[REDACTED_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactObject(item, depth + 1));
  if (typeof value !== "object") return redactText(String(value));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/(authorization|cookie|token|secret|password|api[_-]?key|service[_-]?role|credential|prompt|env)/i.test(key)) {
        return [key, "[REDACTED]"];
      }

      return [key, redactObject(item, depth + 1)];
    }),
  );
}

function summarizeOutput({ exitCode, stderr = "", stdout = "", timedOut = false }) {
  const safeStdout = redactText(stdout, 6000);
  const safeStderr = redactText(stderr, 3000);

  return redactText(
    [
      `exitCode=${exitCode === null || exitCode === undefined ? "null" : exitCode}`,
      timedOut ? "timedOut=true" : "",
      safeStdout ? `stdout:\n${safeStdout}` : "",
      safeStderr ? `stderr:\n${safeStderr}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    10000,
  );
}

module.exports = {
  redactObject,
  redactText,
  summarizeOutput,
};
