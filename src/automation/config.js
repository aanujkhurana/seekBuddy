import fs from "fs";
import path from "path";

export function loadConfig() {
  const userDataDir = process.env.USER_DATA_DIR;

  if (!userDataDir) {
    throw new Error("USER_DATA_DIR is missing.");
  }

  const configPath = path.join(userDataDir, "config.json");

  if (!fs.existsSync(configPath)) {
    throw new Error("Config file not found. Please save settings first.");
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}
