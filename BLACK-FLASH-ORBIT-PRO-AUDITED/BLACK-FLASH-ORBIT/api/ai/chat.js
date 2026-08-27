const express = require("express");
const aiRoutes = require("../../server/routes/ai");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use("/api/ai", aiRoutes);

module.exports = function handler(req, res) {
  return app(req, res);
};
