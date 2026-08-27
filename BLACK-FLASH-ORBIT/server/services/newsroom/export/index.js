const { exportDocx } = require("./exportDocx");
const { exportHtml } = require("./exportHtml");
const { exportJson } = require("./exportJson");
const { exportPdf } = require("./exportPdf");
const { exportText } = require("./exportText");
const {
  buildDraftReportModel,
  buildReviewReportModel,
} = require("./reportModel");

const EXPORT_FORMATS = {
  docx: {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
    render: exportDocx,
  },
  html: {
    contentType: "text/html; charset=utf-8",
    extension: "html",
    render: exportHtml,
  },
  json: {
    contentType: "application/json; charset=utf-8",
    extension: "json",
    render: exportJson,
  },
  md: {
    contentType: "text/markdown; charset=utf-8",
    extension: "md",
    render: exportText,
  },
  pdf: {
    contentType: "application/pdf",
    extension: "pdf",
    render: exportPdf,
  },
  txt: {
    contentType: "text/plain; charset=utf-8",
    extension: "txt",
    render: exportText,
  },
};
const EXPORT_TYPES = new Set(["draft", "review"]);

function normalizeExportFormat(value) {
  const format = String(value || "pdf")
    .trim()
    .toLowerCase();

  if (!EXPORT_FORMATS[format]) {
    const error = new Error("Format export tidak valid.");
    error.statusCode = 400;
    error.code = "invalid_export_format";
    throw error;
  }

  return format;
}

function normalizeExportType(value) {
  const type = String(value || "review")
    .trim()
    .toLowerCase();

  if (!EXPORT_TYPES.has(type)) {
    const error = new Error("Tipe export tidak valid.");
    error.statusCode = 400;
    error.code = "invalid_export_type";
    throw error;
  }

  return type;
}

function createSafeExportFilename({ exportedAt, format, type }) {
  const date = String(exportedAt || new Date().toISOString()).slice(0, 10);
  const artifact = type === "draft" ? "draft" : "editorial-review";

  return `black-flash-orbit-${artifact}-${date}.${EXPORT_FORMATS[format].extension}`;
}

function createExportArtifact(generation, options = {}) {
  const format = normalizeExportFormat(options.format);
  const type = normalizeExportType(options.type);
  const exportedAt = new Date().toISOString();
  const model =
    type === "draft"
      ? buildDraftReportModel(generation, { exportedAt })
      : buildReviewReportModel(generation, { exportedAt });
  const definition = EXPORT_FORMATS[format];

  return {
    buffer: definition.render(model),
    contentType: definition.contentType,
    filename: createSafeExportFilename({ exportedAt, format, type }),
    format,
    type,
  };
}

module.exports = {
  EXPORT_FORMATS,
  createExportArtifact,
  createSafeExportFilename,
  normalizeExportFormat,
  normalizeExportType,
};
