const DEFAULT_MAX_CHARS = 1800;
const DEFAULT_OVERLAP_CHARS = 220;
const MAX_CHUNKS = 120;

function normalizeChunkInput(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function estimateTokenCount(value) {
  return Math.max(1, Math.ceil(String(value || "").length / 4));
}

function splitTextUnits(text) {
  const paragraphs = normalizeChunkInput(text)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) return paragraphs;

  return normalizeChunkInput(text)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getOverlapText(value, overlapChars) {
  const text = String(value || "");
  if (text.length <= overlapChars) return text;

  return text.slice(-overlapChars).replace(/^\S+\s+/, "").trim();
}

function pushChunk(chunks, content) {
  const cleanContent = normalizeChunkInput(content);

  if (!cleanContent) return;

  chunks.push({
    chunkIndex: chunks.length,
    content: cleanContent,
    tokenCount: estimateTokenCount(cleanContent),
  });
}

function chunkText(text, options = {}) {
  const maxChars = Number(options.maxChars || DEFAULT_MAX_CHARS);
  const overlapChars = Number(options.overlapChars || DEFAULT_OVERLAP_CHARS);
  const units = splitTextUnits(text);
  const chunks = [];
  let current = "";

  units.forEach((unit) => {
    if (chunks.length >= MAX_CHUNKS) return;

    if (unit.length > maxChars) {
      if (current) {
        pushChunk(chunks, current);
        current = getOverlapText(current, overlapChars);
      }

      for (let index = 0; index < unit.length && chunks.length < MAX_CHUNKS;) {
        const slice = unit.slice(index, index + maxChars).trim();
        pushChunk(chunks, slice);
        index += maxChars - overlapChars;
      }

      current = "";
      return;
    }

    const candidate = current ? `${current}\n\n${unit}` : unit;

    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }

    pushChunk(chunks, current);
    current = [getOverlapText(current, overlapChars), unit]
      .filter(Boolean)
      .join("\n\n");
  });

  if (current && chunks.length < MAX_CHUNKS) {
    pushChunk(chunks, current);
  }

  return chunks;
}

module.exports = {
  chunkText,
  estimateTokenCount,
};
