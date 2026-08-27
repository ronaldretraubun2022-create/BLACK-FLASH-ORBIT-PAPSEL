const assert = require("node:assert");
const test = require("node:test");

const { loadModuleWithMocks } = require("./testUtils");

const parserPath = "../../server/services/knowledge/documentParser";

function loadParser(mocks = {}) {
  return loadModuleWithMocks(parserPath, mocks);
}

test("sanitizeExtractedText strips scripts and control bytes", () => {
  const { sanitizeExtractedText } = loadParser();
  const text = sanitizeExtractedText("Hello\u0000<script>alert(1)</script>\n\nWorld");

  assert.strictEqual(text, "Hello\n\nWorld");
});

test("validateUploadedFile rejects files over 10 MB", () => {
  const { validateUploadedFile } = loadParser();
  const errorFile = {
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    mimetype: "text/plain",
    originalname: "big.txt",
    size: 10 * 1024 * 1024 + 1,
  };

  assert.throws(
    () => validateUploadedFile(errorFile),
    (error) => error.code === "knowledge_upload_too_large",
  );
});

test("validateUploadedFile rejects unsupported file types", () => {
  const { validateUploadedFile } = loadParser();
  const errorFile = {
    buffer: Buffer.from("data"),
    mimetype: "application/octet-stream",
    originalname: "malware.exe",
    size: 4,
  };

  assert.throws(
    () => validateUploadedFile(errorFile),
    (error) => error.code === "knowledge_upload_type_unsupported",
  );
});

test("parseUploadedDocument parses PDF and DOCX text with mocked readers", async () => {
  const parser = loadParser({
    mammoth: {
      extractRawText: async () => ({
        value: "DOCX newsroom text with enough length",
      }),
    },
  });

  class MockPdfParse {
    async destroy() {}

    async getText() {
      return {
        text: "PDF newsroom text with enough length",
      };
    }
  }

  class MockCanvasFactory {}

  parser.setPdfRuntimeForTests({
    CanvasFactory: MockCanvasFactory,
    PDFParse: MockPdfParse,
  });

  const pdfResult = await parser.parseUploadedDocument({
    buffer: Buffer.from("%PDF-1.4 content"),
    mimetype: "application/pdf",
    originalname: "article.pdf",
    size: 18,
  });

  assert.strictEqual(pdfResult.extension, ".pdf");
  assert(pdfResult.text.includes("PDF newsroom text"));

  const docxResult = await parser.parseUploadedDocument({
    buffer: Buffer.from("PK docx content"),
    mimetype:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    originalname: "article.docx",
    size: 16,
  });

  assert.strictEqual(docxResult.extension, ".docx");
  assert(docxResult.text.includes("DOCX newsroom text"));
});

test("parseUploadedDocument parses valid UTF-8 TXT", async () => {
  const { parseUploadedDocument } = loadParser();
  const result = await parseUploadedDocument({
    buffer: Buffer.from(
      "Dokumen TXT newsroom dengan fakta terverifikasi dan konteks yang cukup.",
      "utf8",
    ),
    mimetype: "text/plain",
    originalname: "newsroom.txt",
    size: 69,
  });

  assert.strictEqual(result.extension, ".txt");
  assert.match(result.text, /fakta terverifikasi/);
});

test("validateUploadedFile rejects MIME mismatch and unsafe text", () => {
  const { validateUploadedFile } = loadParser();

  assert.throws(
    () =>
      validateUploadedFile({
        buffer: Buffer.from("%PDF-1.4 valid header"),
        mimetype: "text/plain",
        originalname: "report.pdf",
        size: 21,
      }),
    (error) => error.code === "knowledge_upload_type_unsupported",
  );

  assert.throws(
    () =>
      validateUploadedFile({
        buffer: Buffer.from("#!/usr/bin/env node\nconsole.log('unsafe')"),
        mimetype: "text/plain",
        originalname: "unsafe.txt",
        size: 42,
      }),
    (error) => error.code === "knowledge_upload_content_rejected",
  );
});
