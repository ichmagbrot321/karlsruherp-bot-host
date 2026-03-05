const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] },
});

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const auth = require("./middleware/auth");
const botsRouter = require("./routes/bots");
const filesRouter = require("./routes/files");
const logsRouter = require("./routes/logs");
const packagesRouter = require("./routes/packages");
const backupRouter = require("./routes/backup");

app.use("/api/bots", auth, botsRouter);
app.use("/api/files", auth, filesRouter);
app.use("/api/logs", auth, logsRouter);
app.use("/api/packages", auth, packagesRouter);
app.use("/api/backup", auth, backupRouter);

app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.PANEL_PASSWORD) {
    const token = Buffer.from("admin:" + Date.now()).toString("base64");
    res.json({ token, success: true });
  } else {
    res.status(401).json({ error: "Falsches Passwort" });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

global.botProcesses = {};
global.io = io;

io.on("connection", (socket) => {
  socket.on("subscribe-logs", (botId) => socket.join("bot-" + botId));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log("✅ Backend läuft auf Port " + PORT));
