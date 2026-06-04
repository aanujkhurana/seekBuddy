import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, "..", "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function store(name) {
  const filePath = path.join(DATA_DIR, `${name}.json`);

  function read() {
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return [];
    }
  }

  function write(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return { read, write, filePath };
}

export const users = store("users");
export const cache = store("ai_cache");
export const costLog = store("cost_log");
