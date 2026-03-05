const express = require("express");
const router = express.Router();

// Letzte Logs eines Bots (aus Memory)
router.get("/:name", (req, res) => {
  const { name } = req.params;
  const bot = global.botProcesses[name];
  if (!bot) return res.json([]);
  res.json(bot.logs.slice(-200)); // letzte 200 Zeilen
});

module.exports = router;
