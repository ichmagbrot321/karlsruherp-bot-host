const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const BOTS_DIR = process.env.BOTS_DIR || path.join(__dirname, "../../bots");

router.post("/:name/install", (req, res) => {
  const { name } = req.params;
  const { pkg, manager = "pip" } = req.body;
  const botDir = path.join(BOTS_DIR, name);

  if (!fs.existsSync(botDir)) return res.status(404).json({ error: "Bot nicht gefunden" });
  if (!pkg) return res.status(400).json({ error: "Paketname fehlt" });

  const cmd = manager === "npm" ? "npm" : "pip3";
  const args = manager === "npm" ? ["install", pkg] : ["install", pkg, "--target", "./packages"];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const proc = spawn(cmd, args, { cwd: botDir });

  proc.stdout.on("data", (d) => res.write(`data: ${d.toString().trim()}\n\n`));
  proc.stderr.on("data", (d) => res.write(`data: ${d.toString().trim()}\n\n`));
  proc.on("close", (code) => {
    res.write(`data: __DONE__:${code}\n\n`);
    res.end();
  });
});

router.get("/:name/packages", (req, res) => {
  const botDir = path.join(BOTS_DIR, req.params.name);
  const reqFile = path.join(botDir, "requirements.txt");
  const pkgFile = path.join(botDir, "package.json");
  const result = { pip: [], npm: [] };

  if (fs.existsSync(reqFile)) {
    result.pip = fs.readFileSync(reqFile, "utf8").split("\n").map(l => l.trim()).filter(Boolean);
  }
  if (fs.existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile));
      result.npm = Object.keys(pkg.dependencies || {});
    } catch {}
  }

  res.json(result);
});

router.post("/:name/requirements", (req, res) => {
  const { packages } = req.body;
  const botDir = path.join(BOTS_DIR, req.params.name);
  fs.writeFileSync(path.join(botDir, "requirements.txt"), packages.join("\n") + "\n");
  res.json({ success: true });
});

module.exports = router;
