module.exports = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Kein Token" });

  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    if (decoded.startsWith("admin:")) {
      next();
    } else {
      res.status(401).json({ error: "Ungültiger Token" });
    }
  } catch {
    res.status(401).json({ error: "Ungültiger Token" });
  }
};
