import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, "..", "data");
const CRASH_LOG = path.join(DATA_DIR, "crash_reports.json");

const router = Router();

function readCrashes() {
  if (!fs.existsSync(CRASH_LOG)) return [];
  try { return JSON.parse(fs.readFileSync(CRASH_LOG, "utf8")); } catch { return []; }
}

function writeCrashes(data) {
  if (!fs.existsSync(path.dirname(CRASH_LOG))) {
    fs.mkdirSync(path.dirname(CRASH_LOG), { recursive: true });
  }
  fs.writeFileSync(CRASH_LOG, JSON.stringify(data, null, 2));
}

router.post("/report", (req, res) => {
  const { error, stack, platform, version } = req.body;
  if (!error) return res.status(400).json({ error: "Error message required" });

  const crashes = readCrashes();
  crashes.push({
    id: crashes.length + 1,
    userId: req.user.id,
    error,
    stack: stack || "",
    platform: platform || "unknown",
    version: version || "unknown",
    createdAt: new Date().toISOString()
  });

  if (crashes.length > 100) crashes.shift();
  writeCrashes(crashes);

  res.json({ success: true, id: crashes.length });
});

export default router;
