const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const os = require("os");

const BOTS_DIR = process.env.BOTS_DIR || path.join(__dirname, "../../bots");
const upload = multer({ dest: os.tmpdir() });

function safePath(botDir, filePath) {
  const full = path.resolve(botDir, filePath);
  if (!full.startsWith(path.resolve(botDir))) throw new Error("Path traversal blocked");
  return full;
}

// List all files/folders recursively
router.get("/:name", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  if (!fs.existsSync(botDir)) return res.status(404).json({ error: "Bot nicht gefunden" });
  function walk(dir, base = "") {
    return fs.readdirSync(dir).map(f => {
      const full = path.join(dir, f);
      const rel = base ? `${base}/${f}` : f;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) return { name: f, path: rel, type: "dir", children: walk(full, rel) };
      return { name: f, path: rel, type: "file", size: stat.size, modified: stat.mtime };
    });
  }
  res.json(walk(botDir));
});

router.get("/:name/file/*", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  try {
    const full = safePath(botDir, req.params[0]);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "Nicht gefunden" });
    res.json({ content: fs.readFileSync(full, "utf8"), path: req.params[0] });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put("/:name/file/*", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  try {
    const full = safePath(botDir, req.params[0]);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, req.body.content, "utf8");
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/:name/file", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  const { filePath, content = "" } = req.body;
  try {
    const full = safePath(botDir, filePath);
    if (fs.existsSync(full)) return res.status(409).json({ error: "Existiert bereits" });
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/:name/folder", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  try {
    fs.mkdirSync(safePath(botDir, req.body.folderPath), { recursive: true });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete("/:name/file/*", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  try {
    const full = safePath(botDir, req.params[0]);
    if (!fs.existsSync(full)) return res.status(404).json({ error: "Nicht gefunden" });
    fs.rmSync(full, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/:name/rename", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  try {
    fs.renameSync(safePath(botDir, req.body.oldPath), safePath(botDir, req.body.newPath));
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/:name/upload", upload.array("files"), (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  const uploadDir = req.body.uploadPath || "";
  try {
    req.files.forEach(f => {
      const dest = safePath(botDir, path.join(uploadDir, f.originalname));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(f.path, dest);
    });
    res.json({ success: true, count: req.files.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
