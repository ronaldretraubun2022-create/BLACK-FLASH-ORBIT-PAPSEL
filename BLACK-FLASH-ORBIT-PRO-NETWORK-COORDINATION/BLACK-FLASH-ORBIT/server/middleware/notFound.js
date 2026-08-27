function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: "Route tidak ditemukan.",
  });
}

module.exports = notFound;
