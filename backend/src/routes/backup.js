const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const os = require("os");

const BOTS_DIR = process.env.BOTS_DIR || path.join(__dirname, "../../bots");

// Download bot as ZIP
router.get("/:name/download", async (req, res) => {
  const { name } = req.params;
  const botDir = path.join(BOTS_DIR, name);

  if (!fs.existsSync(botDir)) return res.status(404).json({ error: "Bot nicht gefunden" });

  const tmpZip = path.join(os.tmpdir(), `${name}-backup-${Date.now()}.zip`);

  const zip = spawn("zip", ["-r", tmpZip, ".", "--exclude", "*/node_modules/*", "--exclude", "*/packages/*"], {
    cwd: botDir
  });

  zip.on("close", (code) => {
    if (code !== 0) return res.status(500).json({ error: "ZIP fehlgeschlagen" });
    res.download(tmpZip, `${name}-backup.zip`, () => {
      fs.unlinkSync(tmpZip);
    });
  });
});

// Upload ZIP to restore bot
router.post("/:name/restore", express.raw({ type: "application/zip", limit: "50mb" }), (req, res) => {
  const { name } = req.params;
  const botDir = path.join(BOTS_DIR, name);
  const tmpZip = path.join(os.tmpdir(), `restore-${Date.now()}.zip`);

  fs.writeFileSync(tmpZip, req.body);
  if (!fs.existsSync(botDir)) fs.mkdirSync(botDir, { recursive: true });

  const unzip = spawn("unzip", ["-o", tmpZip, "-d", botDir]);
  unzip.on("close", (code) => {
    fs.unlinkSync(tmpZip);
    if (code !== 0) return res.status(500).json({ error: "Restore fehlgeschlagen" });
    res.json({ success: true });
  });
});

module.exports = router;
