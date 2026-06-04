import fs from "node:fs";
import path from "node:path";
import { ensureDir, slugify } from "./config.js";
import { logStep, logSuccess, logWarn } from "./logger.js";

const COVER_LETTER_FOOTER = [
  "Cheers,",
  "Anuj Khurana",
  "aanujkhurana@gmail.com  |   0481250988",
  "[aanujkhurana.github.io](https://aanujkhurana.github.io)"
].join("\n");

export async function createCoverLetter({ config, job }) {
  logStep("Creating cover letter", {
    company: job.company || "Unknown",
    title: job.title || config.jobTitle,
    openaiEnabled: Boolean(config.openai?.enabled)
  });

  if (config.openai?.enabled) {
    if (!isUsableOpenAiKey(process.env.OPENAI_API_KEY)) {
      logWarn("OpenAI key unavailable; using template cover letter", {
        reason: "OPENAI_API_KEY is missing or still set to the placeholder"
      });
      const coverLetter = createTemplateCoverLetter({ config, job });
      logSuccess("Template cover letter created");
      return coverLetter;
    }

    try {
      const coverLetter = await createAiCoverLetter({ config, job });
      logSuccess("AI cover letter created", {
        model: config.openai.model,
        characters: coverLetter.length
      });
      return coverLetter;
    } catch (error) {
      logWarn("OpenAI cover letter failed; using template cover letter", {
        reason: error.message
      });
      const coverLetter = createTemplateCoverLetter({ config, job });
      logSuccess("Template cover letter created");
      return coverLetter;
    }
  }

  const coverLetter = createTemplateCoverLetter({ config, job });
  logSuccess("Template cover letter created");
  return coverLetter;
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

async function createAiCoverLetter({ config, job }) {
  const apiKey = process.env.OPENAI_API_KEY;
  logStep("Connecting to OpenAI", {
    model: config.openai.model,
    timeoutMs: config.openai.timeoutMs
  });

  const prompt = [
    "You are writing a tailored job application cover letter for the applicant.",
    "",
    "Inputs:",
    `Applicant: ${JSON.stringify(config.applicant || {}, null, 2)}`,
    `Resume summary: ${(config.resumeSummary || []).join(" ")}`,
    `Target role: ${job.title || config.jobTitle}`,
    `Company: ${job.company || "Unknown"}`,
    `Tone: ${config.coverLetter.tone}`,
    `Word limit: ${config.coverLetter.wordLimit}`,
    "",
    "Task:",
    "Write a concise cover letter that is strongly grounded in the job ad.",
    "Make the applicant sound like a strong, practical fit for this exact role.",
    "Explain the value the applicant can bring from day one.",
    "",
    "Before writing, infer the three to five most important needs from the job ad, then use them silently to decide what to emphasize.",
    "In the letter, connect the applicant's real experience to those needs with concrete, specific language.",
    "Prioritize likely impact: faster delivery, reliable execution, better user experience, automation, maintainable systems, stakeholder communication, or other value that is directly supported by the resume summary and job ad.",
    "Use confident, conversational language without sounding exaggerated.",
    "Make it feel humanized, friendly, fun, and professional.",
    "A touch of personality is good; cheesy jokes, slang, hype, and forced enthusiasm are not.",
    "",
    "Constraints:",
    "Do not invent employers, qualifications, metrics, certifications, or tools.",
    "Do not mention skills that are not present in either the resume summary or the job ad.",
    "Do not include placeholders.",
    "Do not include headings, bullet points, or analysis.",
    "Do not write a signoff, name, email, phone number, or website. The application will append the applicant footer automatically.",
    "Do not say you are the best fit unless the evidence in the inputs supports that claim; instead, show fit through specifics.",
    "Do not use em dashes, en dashes, hyphens, or hyphenated phrasing in the cover letter. Use commas, periods, parentheses, or plain spaces instead.",
    "",
    `Job ad text:\n${trimForPrompt(job.description || "", 12000)}`
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.openai.timeoutMs);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.openai.model,
        input: prompt
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`OpenAI request timed out after ${config.openai.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = await readOpenAiError(response);
    throw new Error(`OpenAI request failed: ${response.status} ${message}`);
  }

  logSuccess("OpenAI response received", {
    status: response.status
  });

  const json = await response.json();
  const text =
    json.output_text ||
    json.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n");

  if (!text) {
    throw new Error("OpenAI response did not include cover letter text.");
  }

  return cleanCoverLetterText(text);
}

function createTemplateCoverLetter({ config, job }) {
  const applicant = config.applicant || {};
  const summary = config.resumeSummary || [];
  const role = job.title || config.jobTitle;
  const company = job.company || "your team";
  const jobText = `${job.title || ""}\n${job.description || ""}`.toLowerCase();
  const matchedPoints = summary.filter((point) => {
    const keywords = point
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((word) => word.length > 3);
    return keywords.some((word) => jobText.includes(word));
  });
  const points = (matchedPoints.length ? matchedPoints : summary).slice(0, 3);

  return cleanCoverLetterText([
    `Dear hiring team,`,
    "",
    `I am excited to apply for the ${role} role at ${company}. The position stood out because it looks like a place where practical engineering, thoughtful product thinking, and a bit of momentum from day one would genuinely matter.`,
    "",
    points.length
      ? `My background includes ${joinSentence(points)}. I would bring that experience from day one by helping turn requirements into maintainable software, improving user facing workflows, and keeping the work moving with clear, friendly communication.`
      : "I would bring a practical engineering mindset, clear communication, and a friendly bias toward dependable delivery from day one.",
    "",
    `${applicant.workRights ? `${applicant.workRights}. ` : ""}I would welcome the opportunity to discuss how my experience can help ${company} deliver useful, reliable outcomes for its users and team.`
  ].join("\n"));
}

function joinSentence(items) {
  const cleanItems = items.map((item) => String(item).trim().replace(/[.!?]+$/, ""));
  if (cleanItems.length === 1) return cleanItems[0];
  if (cleanItems.length === 2) return `${cleanItems[0]} and ${cleanItems[1]}`;
  return `${cleanItems.slice(0, -1).join(", ")}, and ${cleanItems.at(-1)}`;
}

function isUsableOpenAiKey(apiKey) {
  if (!apiKey) return false;
  const value = apiKey.trim();
  return value && value !== "your_openai_api_key_here" && !value.startsWith("your_");
}

async function readOpenAiError(response) {
  const fallback = response.status === 401 ? "Invalid API key." : response.statusText;
  const body = await response.text().catch(() => "");
  try {
    const json = JSON.parse(body);
    return sanitizeOpenAiError(json.error?.message || fallback);
  } catch {
    return sanitizeOpenAiError(body || fallback);
  }
}

function sanitizeOpenAiError(message) {
  return String(message)
    .replace(/Incorrect API key provided:[^.]+[.]/i, "Incorrect API key provided.")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
}

function cleanCoverLetterText(text) {
  const cleanedBody = stripExistingFooter(String(text))
    .replace(/[—–]/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/-/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *, *, */g, ", ")
    .trim();

  return `${cleanedBody}\n\n${COVER_LETTER_FOOTER}`;
}

function stripExistingFooter(text) {
  return text
    .replace(
      /\n\s*(cheers|kind regards|regards|warm regards|sincerely|thanks|thank you),?\s*\n[\s\S]*$/i,
      ""
    )
    .trim();
}

function trimForPrompt(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Job ad text trimmed for length]`;
}
