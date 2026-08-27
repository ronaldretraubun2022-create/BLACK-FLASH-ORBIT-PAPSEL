function exportJson(model) {
  return Buffer.from(`${JSON.stringify(model, null, 2)}\n`, "utf8");
}

module.exports = { exportJson };
