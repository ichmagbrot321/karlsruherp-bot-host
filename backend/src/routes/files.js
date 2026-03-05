const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const BOTS_DIR = process.env.BOTS_DIR || path.join(__dirname, "../../bots");

// Dateien eines Bots auflisten
router.get("/:name", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  if (!fs.existsSync(botDir)) return res.status(404).json({ error: "Bot nicht gefunden" });

  const files = fs.readdirSync(botDir).map((f) => {
    const stat = fs.statSync(path.join(botDir, f));
    return { name: f, size: stat.size, modified: stat.mtime };
  });
  res.json(files);
});

// Datei lesen
router.get("/:name/:file", (req, res) => {
  const filePath = path.join(BOTS_DIR, req.params.name, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Datei nicht gefunden" });
  res.json({ content: fs.readFileSync(filePath, "utf8") });
});

// Datei speichern
router.put("/:name/:file", (req, res) => {
  const { content } = req.body;
  const filePath = path.join(BOTS_DIR, req.params.name, req.params.file);
  fs.writeFileSync(filePath, content, "utf8");
  res.json({ success: true });
});

// Neue Datei erstellen
router.post("/:name", (req, res) => {
  const { filename, content = "" } = req.body;
  const filePath = path.join(BOTS_DIR, req.params.name, filename);
  if (fs.existsSync(filePath)) return res.status(409).json({ error: "Datei existiert bereits" });
  fs.writeFileSync(filePath, content, "utf8");
  res.json({ success: true });
});

// Datei löschen
router.delete("/:name/:file", (req, res) => {
  const filePath = path.join(BOTS_DIR, req.params.name, req.params.file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

module.exports = router;
