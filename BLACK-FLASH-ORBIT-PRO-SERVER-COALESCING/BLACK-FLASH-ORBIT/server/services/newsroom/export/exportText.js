const { modelToLines } = require("./reportModel");

function exportText(model) {
  return Buffer.from(`${modelToLines(model).join("\n")}\n`, "utf8");
}

module.exports = { exportText };
