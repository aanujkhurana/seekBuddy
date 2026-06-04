import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function buildSearchUrls(config) {
  const jobTitles = splitSearchValues(config.jobTitles || config.jobTitle || config.keywords);
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
  const url = new URL("/jobs", config.seekBaseUrl || "https://www.seek.com.au");
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
