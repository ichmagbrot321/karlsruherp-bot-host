const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const BOTS_DIR = process.env.BOTS_DIR || path.join(__dirname, "../../bots");
if (!fs.existsSync(BOTS_DIR)) fs.mkdirSync(BOTS_DIR, { recursive: true });

router.get("/", (req, res) => {
  try {
    const bots = fs.readdirSync(BOTS_DIR).filter(f => fs.statSync(path.join(BOTS_DIR, f)).isDirectory());
    const botList = bots.map(name => {
      const configPath = path.join(BOTS_DIR, name, "config.json");
      const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {};
      return { name, status: global.botProcesses[name] ? "online" : "offline", ...config };
    });
    res.json(botList);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post("/create", (req, res) => {
  const { name, token, mainFile = "main.py", lang = "python" } = req.body;
  if (!name || !token) return res.status(400).json({ error: "Name und Token erforderlich" });
  const botDir = path.join(BOTS_DIR, name);
  if (fs.existsSync(botDir)) return res.status(409).json({ error: "Bot existiert bereits" });
  fs.mkdirSync(botDir, { recursive: true });
  fs.writeFileSync(path.join(botDir, "config.json"), JSON.stringify({ name, token, mainFile, lang, createdAt: new Date().toISOString() }, null, 2));
  if (lang === "python") {
    fs.writeFileSync(path.join(botDir, "main.py"), `import discord\nimport os\n\nclient = discord.Client(intents=discord.Intents.default())\n\n@client.event\nasync def on_ready():\n    print(f'Bot {client.user} ist online!')\n\nclient.run(os.getenv('TOKEN', '${token}'))\n`);
    fs.writeFileSync(path.join(botDir, "requirements.txt"), "discord.py\n");
  } else {
    fs.writeFileSync(path.join(botDir, "index.js"), `const { Client, GatewayIntentBits } = require('discord.js');\nconst client = new Client({ intents: [GatewayIntentBits.Guilds] });\nclient.on('ready', () => console.log('Bot ' + client.user.tag + ' ist online!'));\nclient.login(process.env.TOKEN || '${token}');\n`);
    fs.writeFileSync(path.join(botDir, "package.json"), JSON.stringify({ name, version: "1.0.0", dependencies: { "discord.js": "^14.0.0" } }, null, 2));
  }
  res.json({ success: true, name });
});

router.post("/:name/start", (req, res) => {
  const { name } = req.params;
  const botDir = path.join(BOTS_DIR, name);
  if (!fs.existsSync(botDir)) return res.status(404).json({ error: "Bot nicht gefunden" });
  if (global.botProcesses[name]) return res.status(409).json({ error: "Läuft bereits" });

  const config = JSON.parse(fs.readFileSync(path.join(botDir, "config.json")));
  const lang = config.lang || "python";
  const cmd = lang === "python" ? "python3" : "node";
  const mainFile = config.mainFile || (lang === "python" ? "main.py" : "index.js");

  let proc;
  try {
    proc = spawn(cmd, [mainFile], {
      cwd: botDir,
      env: { ...process.env, TOKEN: config.token }
    });
  } catch(e) {
    return res.status(500).json({ error: "Konnte Bot nicht starten: " + e.message });
  }

  proc.on("error", (e) => {
    const l = { time: new Date().toISOString(), msg: "[system] Startfehler: " + e.message, bot: name };
    global.botProcesses[name]?.logs.push(l);
    global.io.to("bot-" + name).emit("log", l);
    delete global.botProcesses[name];
  });

  global.botProcesses[name] = { process: proc, logs: [] };

  proc.stdout.on("data", d => {
    const l = { time: new Date().toISOString(), msg: "[stdout] " + d.toString().trim(), bot: name };
    global.botProcesses[name]?.logs.push(l);
    global.io.to("bot-" + name).emit("log", l);
  });
  proc.stderr.on("data", d => {
    const l = { time: new Date().toISOString(), msg: "[stderr] " + d.toString().trim(), bot: name };
    global.botProcesses[name]?.logs.push(l);
    global.io.to("bot-" + name).emit("log", l);
  });
  proc.on("close", code => {
    global.io.to("bot-" + name).emit("log", { time: new Date().toISOString(), msg: "[system] Bot gestoppt (exit: " + code + ")", bot: name });
    delete global.botProcesses[name];
  });

  res.json({ success: true });
});

router.post("/:name/stop", (req, res) => {
  const { name } = req.params;
  if (!global.botProcesses[name]) return res.status(409).json({ error: "Läuft nicht" });
  global.botProcesses[name].process.kill("SIGTERM");
  delete global.botProcesses[name];
  res.json({ success: true });
});

router.delete("/:name", (req, res) => {
  const { name } = req.params;
  if (global.botProcesses[name]) { global.botProcesses[name].process.kill(); delete global.botProcesses[name]; }
  const botDir = path.join(BOTS_DIR, name);
  if (fs.existsSync(botDir)) fs.rmSync(botDir, { recursive: true, force: true });
  res.json({ success: true });
});

router.get("/:name/status", (req, res) => {
  res.json({ name: req.params.name, status: global.botProcesses[req.params.name] ? "online" : "offline" });
});

module.exports = router;
