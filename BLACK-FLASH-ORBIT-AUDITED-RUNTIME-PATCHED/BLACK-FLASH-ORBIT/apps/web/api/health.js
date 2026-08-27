module.exports = function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    success: true,
    status: "online",
    service: "BLACK FLASH ORBIT API",
    runtime: "vercel",
    timestamp: new Date().toISOString()
  }));
};
