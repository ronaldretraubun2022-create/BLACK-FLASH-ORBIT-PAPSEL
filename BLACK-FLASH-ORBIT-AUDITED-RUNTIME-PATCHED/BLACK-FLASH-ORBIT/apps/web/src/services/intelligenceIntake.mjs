const SAFE_MANUAL_SOURCE_TYPES = new Set(["manual_note"]);
const SENSITIVE_TEXT_PATTERN =
  /(authorization\s*[:=]\s*bearer\s+[a-z0-9._~+/=-]+|bearer\s+[a-z0-9._~+/=-]+|[a-z0-9_.-]*(api[_-]?key|service[_-]?role|access[_-]?token|refresh[_-]?token|password|passwd|secret)[a-z0-9_.-]*\s*[:=]\s*['"]?[^'",;\s)}\]]+)/gi;

export const DEFAULT_MANUAL_NOTE = {
  content: "",
  sourceType: "manual_note",
  title: "",
};

export function isValidManualSourceType(sourceType) {
  return SAFE_MANUAL_SOURCE_TYPES.has(String(sourceType || "").trim());
}

export function canSubmitManualNote({ content, isProcessing, sourceType }) {
  return (
    isValidManualSourceType(sourceType) &&
    String(content || "").trim().length > 0 &&
    !isProcessing
  );
}

export function buildManualNotePayload({
  content,
  now = new Date(),
  sourceType,
  title,
}) {
  const cleanContent = String(content || "").trim();

  if (!isValidManualSourceType(sourceType) || !cleanContent) {
    return null;
  }

  return {
    content: cleanContent,
    createdAt: now.toISOString(),
    sourceId: `manual-${now.getTime()}`,
    sourceType,
    title: String(title || "").trim() || "Manual Intelligence Note",
  };
}

export function getSafeIntelligenceIntakeError(error) {
  const message = String(error?.message || "Gagal memproses intelligence source.")
    .replace(SENSITIVE_TEXT_PATTERN, "[REDACTED]")
    .replace(/[\u0000-\u001f\u007f-\u009f<>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  if (!message) return "Gagal memproses intelligence source.";
  if (/stack trace|syntaxerror|postgres|supabase_service_role|service_role/i.test(message)) {
    return "Gagal memproses intelligence source.";
  }

  return message;
}
