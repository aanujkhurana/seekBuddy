import path from "node:path";
import { ensureDir, readJsonFile, writeJsonFile } from "./config.js";
import { logStep, logSuccess } from "./logger.js";

const dataDir = process.env.USER_DATA_DIR || "data";
const handledPath = path.join(dataDir, "handled-applications.json");
const existing = readJsonFile(handledPath, []);

logStep("Clearing handled application history", {
  file: handledPath,
  existingCount: Array.isArray(existing) ? existing.length : 0
});

ensureDir(dataDir);
writeJsonFile(handledPath, []);

logSuccess("Handled application history cleared", {
  file: handledPath
});
