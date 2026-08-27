const CONTEXT_LIMIT = 4;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getQueryTokens(query) {
  return normalizeText(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function getDocumentSearchText(document) {
  return normalizeText(
    [
      document?.title,
      document?.source,
      document?.type,
      document?.status,
      document?.owner,
      document?.summary,
      document?.excerpt,
      ...(document?.tags || []),
      ...(document?.contextChunks || []),
      ...(document?.citations || []).flatMap((citation) => [
        citation.label,
        citation.locator,
        citation.quote,
        citation.reliability,
      ]),
    ].join(" "),
  );
}

function getFieldWeight(document, token) {
  const title = normalizeText(document?.title);
  const tags = normalizeText((document?.tags || []).join(" "));
  const source = normalizeText(document?.source);
  const summary = normalizeText(document?.summary);

  if (title.includes(token)) return 18;
  if (tags.includes(token)) return 14;
  if (source.includes(token)) return 12;
  if (summary.includes(token)) return 10;

  return 6;
}

function getDocumentScore(document, tokens, index) {
  if (!tokens.length) {
    return Math.max(72, Math.min(98, Number(document?.confidence || 82) - index));
  }

  const searchText = getDocumentSearchText(document);
  const matchedTerms = tokens.filter((token) => searchText.includes(token));

  if (!matchedTerms.length) return 0;

  const weightedScore = matchedTerms.reduce(
    (total, token) => total + getFieldWeight(document, token),
    0,
  );
  const coverage = matchedTerms.length / Math.max(tokens.length, 1);
  const confidenceBase = Math.round(Number(document?.confidence || 82) * 0.35);

  return Math.min(
    99,
    Math.round(confidenceBase + weightedScore + coverage * 32 - index * 2),
  );
}

function getMatchedTerms(document, tokens) {
  const searchText = getDocumentSearchText(document);
  return tokens.filter((token) => searchText.includes(token));
}

function getBestChunks(document, tokens) {
  const chunks = Array.isArray(document?.contextChunks)
    ? document.contextChunks
    : [];

  if (!chunks.length) return [];
  if (!tokens.length) return chunks.slice(0, 2);

  const matchedChunks = chunks.filter((chunk) => {
    const normalizedChunk = normalizeText(chunk);
    return tokens.some((token) => normalizedChunk.includes(token));
  });

  return (matchedChunks.length ? matchedChunks : chunks).slice(0, 3);
}

export function searchKnowledge(query, documents = []) {
  const tokens = getQueryTokens(query);

  return documents
    .map((document, index) => ({
      document,
      matchedTerms: getMatchedTerms(document, tokens),
      score: getDocumentScore(document, tokens, index),
    }))
    .filter((result) => !tokens.length || result.score > 0)
    .sort((first, second) => second.score - first.score)
    .map((result) => ({
      ...result,
      snippet:
        result.document?.summary ||
        result.document?.excerpt ||
        "No local summary available.",
    }));
}

export function retrieveContext(query, documents = []) {
  const tokens = getQueryTokens(query);

  return searchKnowledge(query, documents)
    .slice(0, CONTEXT_LIMIT)
    .map(({ document, matchedTerms, score }) => ({
      id: `${document.id}-context`,
      documentId: document.id,
      title: document.title,
      source: document.source,
      type: document.type,
      status: document.status,
      owner: document.owner,
      updatedAt: document.updatedAt,
      score,
      matchedTerms,
      summary: document.summary,
      excerpt: document.excerpt,
      chunks: getBestChunks(document, tokens),
      citations: Array.isArray(document.citations) ? document.citations : [],
      confidence: Number(document.confidence || 0),
    }));
}

export function calculateConfidence(context = []) {
  if (!context.length) return 0;

  const averageScore =
    context.reduce((total, item) => total + Number(item.score || 0), 0) /
    context.length;
  const averageDocumentConfidence =
    context.reduce((total, item) => total + Number(item.confidence || 0), 0) /
    context.length;
  const highReliabilityCitations = context.reduce(
    (total, item) =>
      total +
      item.citations.filter((citation) => citation.reliability === "High")
        .length,
    0,
  );
  const citationBonus = Math.min(10, highReliabilityCitations * 2);

  return Math.max(
    48,
    Math.min(
      98,
      Math.round(averageScore * 0.55 + averageDocumentConfidence * 0.35 + citationBonus),
    ),
  );
}

export function buildCitations(context = []) {
  return context.flatMap((item) =>
    item.citations.map((citation) => ({
      ...citation,
      id: `${item.documentId}-${citation.id}`,
      documentId: item.documentId,
      documentTitle: item.title,
      source: item.source,
      score: item.score,
    })),
  );
}

function formatContextList(context) {
  return context
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.title} (${item.score}%)`)
    .join("\n");
}

function formatChunkList(context) {
  const chunks = context.flatMap((item) =>
    item.chunks.map((chunk) => `${item.title}: ${chunk}`),
  );

  return chunks
    .slice(0, 3)
    .map((chunk, index) => `${index + 1}. ${chunk}`)
    .join("\n");
}

export function generateMockAnswer(query, context = []) {
  const normalizedQuery = normalizeText(query);

  if (!context.length) {
    return [
      "No matching documents were found in the local demo knowledge base.",
      "Refine the question with a source, topic, location, or document type before using this context for editorial work.",
    ].join("\n\n");
  }

  const primary = context[0];
  const sourceList = formatContextList(context);
  const chunkList = formatChunkList(context);

  if (normalizedQuery.includes("security risks")) {
    return [
      `Security and verification review based on ${primary.title}:`,
      "1. Check whether every sensitive claim has at least two supporting sources.",
      "2. Avoid publishing private identifiers, raw interview audio notes, or unsupported location metadata.",
      "3. Keep document context separate from final claims until an editor validates the citation cards.",
      "",
      `Retrieved sources:\n${sourceList}`,
    ].join("\n");
  }

  if (normalizedQuery.includes("action items")) {
    return [
      "Editor action items from local context:",
      "1. Confirm the strongest citation before drafting the lead.",
      "2. Mark weak audio or metadata segments for manual review.",
      "3. Prepare a short source note for the archive record.",
      "4. Route sensitive claims to fact check before publication.",
      "",
      `Context used:\n${sourceList}`,
    ].join("\n");
  }

  if (normalizedQuery.includes("compare sources")) {
    return [
      "Source comparison:",
      sourceList,
      "",
      `${primary.title} should lead because it has the strongest local match and the highest retrieved context score.`,
      "Use the remaining sources as supporting context, not as standalone proof.",
    ].join("\n");
  }

  if (normalizedQuery.includes("explain selected source")) {
    return [
      `${primary.title} matters because it connects the current newsroom question to verified local context.`,
      primary.summary,
      "",
      `Best supporting context:\n${chunkList}`,
    ].join("\n");
  }

  if (normalizedQuery.includes("summarize")) {
    return [
      `Summary of ${primary.title}:`,
      primary.summary,
      "",
      `Key context:\n${chunkList}`,
      "",
      "Use this as a drafting aid only; the final article still needs editor verification.",
    ].join("\n");
  }

  return [
    `Based on local demo context, the strongest answer comes from ${primary.title}.`,
    primary.summary,
    "",
    `Retrieved context:\n${chunkList}`,
    "",
    "Development fallback response based on local demo context.",
  ].join("\n");
}
