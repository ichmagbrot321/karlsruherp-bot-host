const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] },
});

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Auth Middleware
const auth = require("./middleware/auth");
const botsRouter = require("./routes/bots");
const filesRouter = require("./routes/files");
const logsRouter = require("./routes/logs");

app.use("/api/bots", auth, botsRouter);
app.use("/api/files", auth, filesRouter);
app.use("/api/logs", auth, logsRouter);

// Login Route
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.PANEL_PASSWORD) {
    const token = Buffer.from(`admin:${Date.now()}`).toString("base64");
    res.json({ token, success: true });
  } else {
    res.status(401).json({ error: "Falsches Passwort" });
  }
});

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Socket.IO für Live-Logs
const botProcesses = {}; // { botId: { process, logs } }

io.on("connection", (socket) => {
  socket.on("subscribe-logs", (botId) => {
    socket.join(`bot-${botId}`);
  });

  socket.on("disconnect", () => {});
});

// Bot Process Manager (global, damit routes drauf zugreifen können)
global.botProcesses = botProcesses;
global.io = io;

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`✅ Backend läuft auf Port ${PORT}`);
});
