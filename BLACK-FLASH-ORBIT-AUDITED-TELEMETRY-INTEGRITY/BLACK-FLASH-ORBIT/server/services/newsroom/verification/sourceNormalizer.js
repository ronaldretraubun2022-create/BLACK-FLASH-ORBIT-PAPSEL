const SOURCE_TYPES = {
  DIRECT_INTERVIEW: "direct_interview",
  OFFICIAL_DOCUMENT: "official_document",
  OFFICIAL_STATEMENT: "official_statement",
  PRIMARY_RECORD: "primary_record",
  REPUTABLE_REPORTING: "reputable_reporting",
  SECONDARY_REPORT: "secondary_report",
  UNKNOWN: "unknown",
  USER_PROVIDED: "user_provided",
};

function sanitize(value, maxLength = 12000) {
  return String(value || "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSourceType(type, title = "") {
  const value = sanitize(type, 80)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const sourceTitle = sanitize(title, 240).toLowerCase();

  if (
    ["primary_official_document", "official_document", "primary"].includes(
      value,
    )
  ) {
    return SOURCE_TYPES.OFFICIAL_DOCUMENT;
  }
  if (["direct_interview", "interview", "wawancara"].includes(value)) {
    return SOURCE_TYPES.DIRECT_INTERVIEW;
  }
  if (["public_record", "primary_record", "record"].includes(value)) {
    return SOURCE_TYPES.PRIMARY_RECORD;
  }
  if (["official_statement", "press_release", "siaran_pers"].includes(value)) {
    return SOURCE_TYPES.OFFICIAL_STATEMENT;
  }
  if (["reputable_reporting", "news_report", "media"].includes(value)) {
    return SOURCE_TYPES.REPUTABLE_REPORTING;
  }
  if (["secondary_report", "report"].includes(value)) {
    return SOURCE_TYPES.SECONDARY_REPORT;
  }
  if (["user_provided", "user_paste", "paste"].includes(value)) {
    return SOURCE_TYPES.USER_PROVIDED;
  }
  if (/official|pemerintah|bps|kementerian|dokumen/.test(sourceTitle)) {
    return SOURCE_TYPES.OFFICIAL_DOCUMENT;
  }
  if (/interview|wawancara/.test(sourceTitle)) {
    return SOURCE_TYPES.DIRECT_INTERVIEW;
  }

  return SOURCE_TYPES.UNKNOWN;
}

function normalizeSource(source, index) {
  if (typeof source === "string") {
    const content = sanitize(source);

    return {
      author: "",
      content,
      id: `source-${index + 1}`,
      publishedAt: "",
      publisher: "",
      retrievedAt: "",
      title: `User Source ${index + 1}`,
      type: SOURCE_TYPES.USER_PROVIDED,
      url: "",
    };
  }

  const title = sanitize(
    source?.title || source?.label || source?.name || `Source ${index + 1}`,
    240,
  );
  const content = sanitize(
    source?.content || source?.text || source?.body || source?.quote || "",
  );

  return {
    author: sanitize(source?.author, 160),
    content,
    id: sanitize(source?.id, 80) || `source-${index + 1}`,
    publishedAt: sanitize(source?.publishedAt || source?.date, 80),
    publisher: sanitize(source?.publisher || source?.source || "", 160),
    retrievedAt: sanitize(source?.retrievedAt, 80),
    title,
    type: normalizeSourceType(source?.type || source?.sourceType, title),
    url: sanitize(source?.url, 500),
  };
}

function normalizeSources({ sourceText, sources } = {}) {
  const normalized = Array.isArray(sources)
    ? sources
        .map(normalizeSource)
        .filter((source) => source.content || source.title)
    : [];

  const pastedText = sanitize(sourceText);

  if (pastedText) {
    normalized.push({
      author: "",
      content: pastedText,
      id: "source-text",
      publishedAt: "",
      publisher: "",
      retrievedAt: "",
      title: "User-provided source text",
      type: SOURCE_TYPES.USER_PROVIDED,
      url: "",
    });
  }

  return normalized.slice(0, 20);
}

module.exports = {
  SOURCE_TYPES,
  normalizeSourceType,
  normalizeSources,
};
