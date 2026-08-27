const path = require("node:path");

const mammoth = require("mammoth");

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_LENGTH = 240000;

const SUPPORTED_EXTENSIONS = new Set([".docx", ".md", ".pdf", ".txt"]);

const SUPPORTED_MIME_TYPES = {
  ".docx": new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  ".md": new Set(["application/octet-stream", "text/markdown", "text/plain"]),
  ".pdf": new Set(["application/pdf"]),
  ".txt": new Set(["application/octet-stream", "text/plain"]),
};

let pdfRuntime = null;

function getPdfRuntime() {
  if (!pdfRuntime) {
    // Penting untuk Node/Vercel:
    // worker harus dimuat sebelum pdf-parse.
    const { CanvasFactory } = require("pdf-parse/worker");
    const { PDFParse } = require("pdf-parse");

    pdfRuntime = {
      CanvasFactory,
      PDFParse,
    };
  }

  return pdfRuntime;
}

function setPdfRuntimeForTests(runtime) {
  pdfRuntime = runtime;
}

function createHttpError(
  message,
  statusCode = 400,
  code = "knowledge_file_invalid",
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getFileExtension(filename) {
  return path.extname(String(filename || "")).toLowerCase();
}

function getMimeType(file) {
  return String(file?.mimetype || "").toLowerCase();
}

function hasBytes(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) {
    return false;
  }

  return bytes.every((byte, index) => buffer[index] === byte);
}

function hasNullByte(buffer) {
  return buffer.subarray(0, 512).includes(0);
}

function looksLikeExecutableText(buffer) {
  const prefix = buffer
    .subarray(0, 512)
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart();

  return (
    /^mz\b/i.test(prefix) ||
    /^#!\s*(?:\/usr\/bin\/env\s+)?(?:sh|bash|zsh|dash|ksh|node|python|perl|ruby|php|pwsh|powershell)\b/i.test(
      prefix,
    ) ||
    /^@echo\s+off\b/i.test(prefix) ||
    /^(?:powershell(?:\.exe)?|pwsh(?:\.exe)?|cmd(?:\.exe)?|set-executionpolicy|start-process|invoke-expression|iex)\b/i.test(
      prefix,
    ) ||
    /^<script\b/i.test(prefix)
  );
}

function sanitizeExtractedText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function validateUploadedFile(file) {
  if (!file?.buffer?.length) {
    throw createHttpError(
      "File knowledge wajib tersedia.",
      400,
      "knowledge_upload_required",
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw createHttpError(
      "Ukuran file maksimal 10 MB.",
      400,
      "knowledge_upload_too_large",
    );
  }

  const extension = getFileExtension(file.originalname);
  const mimeType = getMimeType(file);

  if (
    !SUPPORTED_EXTENSIONS.has(extension) ||
    !SUPPORTED_MIME_TYPES[extension]?.has(mimeType)
  ) {
    throw createHttpError(
      "Format file harus PDF, TXT, MD, atau DOCX.",
      400,
      "knowledge_upload_type_unsupported",
    );
  }

  if (
    extension === ".pdf" &&
    !hasBytes(file.buffer, [0x25, 0x50, 0x44, 0x46])
  ) {
    throw createHttpError(
      "File PDF tidak valid.",
      400,
      "knowledge_upload_parse_failed",
    );
  }

  if (extension === ".docx" && !hasBytes(file.buffer, [0x50, 0x4b])) {
    throw createHttpError(
      "File DOCX tidak valid.",
      400,
      "knowledge_upload_parse_failed",
    );
  }

  if (
    (extension === ".txt" || extension === ".md") &&
    (hasBytes(file.buffer, [0x4d, 0x5a]) ||
      hasBytes(file.buffer, [0x7f, 0x45, 0x4c, 0x46]) ||
      hasNullByte(file.buffer) ||
      looksLikeExecutableText(file.buffer))
  ) {
    throw createHttpError(
      "Konten file knowledge tidak valid.",
      400,
      "knowledge_upload_content_rejected",
    );
  }

  return extension;
}

async function parseUploadedDocument(file) {
  const extension = validateUploadedFile(file);

  let extractedText = "";
  let pdfParser = null;

  try {
    if (extension === ".txt" || extension === ".md") {
      extractedText = file.buffer.toString("utf8");
    } else if (extension === ".pdf") {
      const { CanvasFactory, PDFParse } = getPdfRuntime();

      pdfParser = new PDFParse({
        data: file.buffer,
        CanvasFactory,
      });

      const parsed = await pdfParser.getText();
      extractedText = parsed.text;
    } else if (extension === ".docx") {
      const parsed = await mammoth.extractRawText({
        buffer: file.buffer,
      });

      extractedText = parsed.value;
    }
  } catch (error) {
    console.error("[Knowledge Parser] document parse failed", {
      extension,
      message: error?.message || "unknown_error",
    });

    throw createHttpError(
      "Gagal memproses dokumen upload.",
      400,
      "knowledge_upload_parse_failed",
    );
  } finally {
    if (pdfParser) {
      try {
        await pdfParser.destroy();
      } catch {
        // Abaikan cleanup error.
      }
    }
  }

  const text = sanitizeExtractedText(extractedText);

  if (!text || text.length < 20) {
    throw createHttpError(
      "Teks dokumen terlalu pendek untuk diindeks.",
      400,
      "knowledge_upload_text_too_short",
    );
  }

  return {
    extension,
    text,
  };
}

module.exports = {
  MAX_FILE_BYTES,
  SUPPORTED_EXTENSIONS,
  getFileExtension,
  parseUploadedDocument,
  sanitizeExtractedText,
  setPdfRuntimeForTests,
  validateUploadedFile,
};
