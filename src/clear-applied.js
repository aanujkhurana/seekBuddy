import path from "node:path";
import { ensureDir, readJsonFile, writeJsonFile } from "./config.js";
import { logStep, logSuccess } from "./logger.js";

const handledPath = path.join("data", "handled-applications.json");
const existing = readJsonFile(handledPath, []);

logStep("Clearing handled application history", {
  file: handledPath,
  existingCount: Array.isArray(existing) ? existing.length : 0
});

ensureDir("data");
writeJsonFile(handledPath, []);

logSuccess("Handled application history cleared", {
  file: handledPath
});
