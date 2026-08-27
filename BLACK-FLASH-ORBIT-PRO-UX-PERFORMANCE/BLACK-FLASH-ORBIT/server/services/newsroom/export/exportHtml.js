const { modelToLines, safeText } = require("./reportModel");

function escapeHtml(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function exportHtml(model) {
  const body = modelToLines(model)
    .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    model.title,
  )}</title><style>body{font-family:Arial,sans-serif;background:#fff;color:#111;line-height:1.45;margin:40px}p{margin:0 0 8px}</style></head><body>${body}</body></html>`;

  return Buffer.from(html, "utf8");
}

module.exports = { exportHtml };
