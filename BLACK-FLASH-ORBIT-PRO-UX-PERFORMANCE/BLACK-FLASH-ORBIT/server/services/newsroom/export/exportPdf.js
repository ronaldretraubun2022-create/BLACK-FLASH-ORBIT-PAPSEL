const { modelToLines, safeText } = require("./reportModel");

function escapePdfText(value) {
  return safeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(line, maxLength = 92) {
  const text = safeText(line);
  const parts = [];
  let current = "";

  text.split(/\s+/).forEach((word) => {
    if (!word) return;
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) parts.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });

  if (current) parts.push(current);
  return parts.length ? parts : [""];
}

function buildContentStream(lines) {
  const commands = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL"];

  lines.forEach((line, index) => {
    if (index > 0) commands.push("T*");
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push("ET");

  return commands.join("\n");
}

function createObject(id, body) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function chunkLines(lines, size = 52) {
  const chunks = [];

  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }

  return chunks.length ? chunks : [[""]];
}

function exportPdf(model) {
  const lines = modelToLines(model)
    .flatMap((line) => wrapLine(line))
    .slice(0, 650);
  const pages = chunkLines(lines);
  const pageObjectStart = 4;
  const contentObjectStart = pageObjectStart + pages.length;
  const pageRefs = pages
    .map((_, index) => `${pageObjectStart + index} 0 R`)
    .join(" ");
  const objects = [
    createObject(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    createObject(
      2,
      `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`,
    ),
    createObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];

  pages.forEach((_, index) => {
    objects.push(
      createObject(
        pageObjectStart + index,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${
          contentObjectStart + index
        } 0 R >>`,
      ),
    );
  });

  pages.forEach((pageLines, index) => {
    const content = buildContentStream(pageLines);

    objects.push(
      createObject(
        contentObjectStart + index,
        `<< /Length ${Buffer.byteLength(
          content,
          "utf8",
        )} >>\nstream\n${content}\nendstream`,
      ),
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

module.exports = { exportPdf };
