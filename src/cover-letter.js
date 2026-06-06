import fs from "node:fs";
import path from "node:path";
import { ensureDir, slugify } from "./config.js";
import { logStep, logSuccess, logWarn } from "./logger.js";
import { generateCoverLetter, createTemplateCoverLetter } from "./ai/ai-service.js";

function buildCoverLetterFooter(config = {}) {
  const lines = ["Cheers,"];
  if (config.contactName) lines.push(config.contactName);

  const contactParts = [];
  if (config.contactEmail) contactParts.push(config.contactEmail);
  if (config.contactPhone) contactParts.push(config.contactPhone);
  if (contactParts.length) lines.push(contactParts.join("  |  "));

  if (config.contactWebsite) {
    const display = config.contactWebsite.replace(/^https?:\/\//, "");
    lines.push(`[${display}](${config.contactWebsite.startsWith("http") ? config.contactWebsite : `https://${config.contactWebsite}`})`);
  }

  return lines.join("\n");
}

export async function createCoverLetter({ config, job }) {
  logStep("Creating cover letter", {
    company: job.company || "Unknown",
    title: job.title || config.jobTitle || config.keywords || "Role",
    aiMode: config.ai?.mode || "none"
  });

  const aiEnabled = config.ai?.mode === "hosted" || config.ai?.mode === "byok" || config.openai?.enabled;

  if (aiEnabled) {
    try {
      const aiLetter = await generateCoverLetter({ config, job });
      if (aiLetter) {
        const cleaned = cleanCoverLetterText(aiLetter, config);
        logSuccess("AI cover letter created", {
          characters: cleaned.length
        });
        return cleaned;
      }
      logWarn("AI cover letter returned empty; using template cover letter");
    } catch (error) {
      logWarn("AI cover letter failed; using template cover letter", {
        reason: error.message
      });
    }
  }

  if (config.coverLetterText) {
    logSuccess("Using saved cover letter text");
    return cleanCoverLetterText(config.coverLetterText, config);
  }

  const templateLetter = createTemplateCoverLetter({ config, job });
  const cleaned = cleanCoverLetterText(templateLetter, config);
  logSuccess("Template cover letter created");
  return cleaned;
}

export function saveCoverLetter({ job, coverLetter }) {
  const dir = "out/cover-letters";
  ensureDir(dir);
  const fileName = `${new Date().toISOString().slice(0, 10)}-${slugify(
    `${job.company || "company"}-${job.title || "role"}`
  )}.txt`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, coverLetter);
  return filePath;
}

function cleanCoverLetterText(text, config) {
  const cleanedBody = stripExistingFooter(String(text))
    .replace(/[—–]/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/-/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *, *, */g, ", ")
    .trim();

  return `${cleanedBody}\n\n${buildCoverLetterFooter(config)}`;
}

function stripExistingFooter(text) {
  return text
    .replace(
      /\n\s*(cheers|kind regards|regards|warm regards|sincerely|thanks|thank you),?\s*\n[\s\S]*$/i,
      ""
    )
    .trim();
}
