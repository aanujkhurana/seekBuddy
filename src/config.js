import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import "dotenv/config";

export function loadConfig() {
  const configPath = getArgValue("--config") || "config.json";
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing ${configPath}. Create config.json with your SEEK search, resume, and applicant details first.`
    );
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const required = ["seekBaseUrl", "jobTitle", "resumePath"];
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`config.json is missing required field: ${key}`);
    }
  }

  const resumePath = path.resolve(expandHome(config.resumePath));
  if (!fs.existsSync(resumePath)) {
    throw new Error(`Resume file does not exist: ${resumePath}`);
  }

  config.resumePath = resumePath;
  config.seekBaseUrl = config.seekBaseUrl.replace(/\/$/, "");
  config.maxApplications = Number(config.maxApplications || 1);
  config.browserProfileDir =
    process.env.SEEK_BROWSER_PROFILE_DIR || config.browserProfileDir || ".playwright-seek-profile";
  config.slowMoMs = Number(config.slowMoMs || 0);
  config.pauseBeforeSubmit = config.pauseBeforeSubmit !== false;
  config.coverLetter = config.coverLetter || {};
  config.coverLetter.tone =
    config.coverLetter.tone || "humanized, friendly, fun, and professional";
  config.coverLetter.wordLimit = Number(config.coverLetter.wordLimit || 280);
  config.openai = config.openai || { enabled: false };
  config.openai.model = normalizeOpenAiModel(config.openai.model);
  config.openai.timeoutMs = Number(config.openai.timeoutMs || 60000);

  return config;
}

export function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function buildSearchUrl(config) {
  return buildSearchUrlFor(config, config.jobTitle, config.location);
}

export function buildSearchUrls(config) {
  const jobTitles = splitSearchValues(config.jobTitles || config.jobTitle);
  const locations = splitSearchValues(config.locations || config.location || "");
  const searchLocations = locations.length ? locations : [""];

  return [
    ...new Set(
      jobTitles.flatMap((jobTitle) =>
        searchLocations.map((location) => buildSearchUrlFor(config, jobTitle, location))
      )
    )
  ];
}

function buildSearchUrlFor(config, jobTitle, location) {
  const url = new URL("/jobs", config.seekBaseUrl);
  url.searchParams.set("keywords", jobTitle);
  if (location) {
    url.searchParams.set("where", location);
  }
  return url.toString();
}

function splitSearchValues(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeOpenAiModel(model) {
  const defaultModel = "gpt-5-mini";
  if (!model || model === "gpt-4.1-mini" || model === "gpt-5.2") return defaultModel;
  return model;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function expandHome(value) {
  if (!value.startsWith("~")) return value;
  return path.join(process.env.HOME || "", value.slice(1));
}
