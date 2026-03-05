const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const BOTS_DIR = process.env.BOTS_DIR || path.join(__dirname, "../../bots");

// Sicherstellen dass bots dir existiert
if (!fs.existsSync(BOTS_DIR)) fs.mkdirSync(BOTS_DIR, { recursive: true });

// Alle Bots auflisten
router.get("/", (req, res) => {
  try {
    const bots = fs.existsSync(BOTS_DIR)
      ? fs.readdirSync(BOTS_DIR).filter((f) =>
          fs.statSync(path.join(BOTS_DIR, f)).isDirectory()
        )
      : [];

    const botList = bots.map((name) => {
      const configPath = path.join(BOTS_DIR, name, "config.json");
      const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath))
        : {};
      const isRunning = !!global.botProcesses[name];
      return { name, status: isRunning ? "online" : "offline", ...config };
    });

    res.json(botList);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bot erstellen
router.post("/create", (req, res) => {
  const { name, token, mainFile = "index.js" } = req.body;
  if (!name || !token) return res.status(400).json({ error: "Name und Token erforderlich" });

  const botDir = path.join(BOTS_DIR, name);
  if (fs.existsSync(botDir)) return res.status(409).json({ error: "Bot existiert bereits" });

  fs.mkdirSync(botDir, { recursive: true });
  fs.writeFileSync(
    path.join(botDir, "config.json"),
    JSON.stringify({ name, token, mainFile, createdAt: new Date().toISOString() }, null, 2)
  );
  // Beispiel index.js
  fs.writeFileSync(
    path.join(botDir, "index.js"),
    `// Discord Bot: ${name}\nconst { Client, GatewayIntentBits } = require('discord.js');\nconst client = new Client({ intents: [GatewayIntentBits.Guilds] });\nclient.on('ready', () => console.log(\`✅ \${client.user.tag} ist online!\`));\nclient.login(process.env.TOKEN || '${token}');\n`
  );
  fs.writeFileSync(
    path.join(botDir, "package.json"),
    JSON.stringify({ name, version: "1.0.0", main: mainFile, dependencies: { "discord.js": "^14.0.0" } }, null, 2)
  );

  res.json({ success: true, name });
});

// Bot starten
router.post("/:name/start", (req, res) => {
  const { name } = req.params;
  const botDir = path.join(BOTS_DIR, name);

  if (!fs.existsSync(botDir)) return res.status(404).json({ error: "Bot nicht gefunden" });
  if (global.botProcesses[name]) return res.status(409).json({ error: "Bot läuft bereits" });

  const configPath = path.join(botDir, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath));

  const proc = spawn("node", [config.mainFile || "index.js"], {
    cwd: botDir,
    env: { ...process.env, TOKEN: config.token },
  });

  global.botProcesses[name] = { process: proc, logs: [] };

  proc.stdout.on("data", (data) => {
    const line = `[stdout] ${data.toString().trim()}`;
    global.botProcesses[name]?.logs.push({ time: new Date().toISOString(), msg: line });
    global.io.to(`bot-${name}`).emit("log", { time: new Date().toISOString(), msg: line });
  });

  proc.stderr.on("data", (data) => {
    const line = `[stderr] ${data.toString().trim()}`;
    global.botProcesses[name]?.logs.push({ time: new Date().toISOString(), msg: line });
    global.io.to(`bot-${name}`).emit("log", { time: new Date().toISOString(), msg: line });
  });

  proc.on("close", (code) => {
    global.io.to(`bot-${name}`).emit("log", { time: new Date().toISOString(), msg: `[system] Bot gestoppt (exit code: ${code})` });
    delete global.botProcesses[name];
  });

  res.json({ success: true, message: `${name} gestartet` });
});

// Bot stoppen
router.post("/:name/stop", (req, res) => {
  const { name } = req.params;
  if (!global.botProcesses[name]) return res.status(409).json({ error: "Bot läuft nicht" });

  global.botProcesses[name].process.kill("SIGTERM");
  delete global.botProcesses[name];
  res.json({ success: true, message: `${name} gestoppt` });
});

// Bot löschen
router.delete("/:name", (req, res) => {
  const { name } = req.params;
  const botDir = path.join(BOTS_DIR, name);

  if (global.botProcesses[name]) {
    global.botProcesses[name].process.kill("SIGTERM");
    delete global.botProcesses[name];
  }

  if (fs.existsSync(botDir)) {
    fs.rmSync(botDir, { recursive: true, force: true });
  }

  res.json({ success: true });
});

// Bot Status
router.get("/:name/status", (req, res) => {
  const { name } = req.params;
  res.json({ name, status: global.botProcesses[name] ? "online" : "offline" });
});

module.exports = router;
