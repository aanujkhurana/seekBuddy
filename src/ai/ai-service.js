import { createAIClient } from "./ai-client.js";

const SYSTEM_PROMPT = [
  "You are a job application assistant. Use only the information provided by the user, resume, and job description.",
  "Do not invent experience, qualifications, education, work rights, visa status, certifications, achievements, or references.",
  "Write naturally and concisely. Prefer Australian English.",
  "If information is missing, write around it honestly."
].join(" ");

function trimForPrompt(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Text trimmed for length]`;
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(String(text).replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

function unwrapTextOutput(output) {
  if (typeof output === "string") return output;
  if (output && typeof output.output === "string") return output.output;
  if (output && typeof output.text === "string") return output.text;
  return "";
}

function normalizeResumeSummary(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function createClient(config) {
  return createAIClient({
    ai: config.ai || {
      mode: config.mode || "hosted",
      hostedModel: config.hostedModel || "budget",
      byokProvider: config.byokProvider || "openrouter",
      byokModel: config.byokModel || "deepseek/deepseek-chat",
      apiKey: config.apiKey || process.env.BYOK_API_KEY || "",
      authToken: config.authToken || "",
      userId: config.userId || "",
      backendUrl: config.backendUrl || "http://localhost:3000"
    }
  });
}

// ---- Cover Letter ----

export async function generateCoverLetter({ config, job }) {
  const client = createClient(config);
  const resumeText = normalizeResumeSummary(config.resumeSummary).join(" ");
  const jobDescription = trimForPrompt(job.description || "", 12000);
  const coverLetterTone = config.coverLetter?.tone || "professional";
  const coverLetterWordLimit = Math.min(Math.max(Number(config.coverLetter?.wordLimit) || 280, 120), 500);

  try {
    const system = [
      SYSTEM_PROMPT,
      "You are writing a tailored cover letter. Do not include headings, bullet points, signoff, name, email, phone, or website — the application will append the footer automatically.",
      `Keep it under ${coverLetterWordLimit} words. Use this tone guidance: ${coverLetterTone}.`
    ].join(" ");

    const prompt = [
      `Job Title: ${job.title || config.jobTitle || config.keywords || "Role"}`,
      `Company: ${job.company || "Unknown"}`,
      resumeText ? `Resume Summary: ${resumeText}` : "",
      `Tone: ${coverLetterTone}`,
      `Word limit: ${coverLetterWordLimit}`,
      "",
      `Job Description:\n${jobDescription}`,
      "",
      "Write a concise, tailored cover letter."
    ].filter(Boolean).join("\n");

    if (client.generateCoverLetter) {
      const res = await client.generateCoverLetter({
        jobTitle: job.title,
        company: job.company,
        jobDescription,
        resumeText,
        tone: coverLetterTone,
        wordLimit: coverLetterWordLimit
      });
      if (res.coverLetter) return res.coverLetter;
    }

    if (client.generateText) {
      return await client.generateText({ system, prompt, maxTokens: Math.max(500, Math.ceil(coverLetterWordLimit * 2.5)) });
    }

    throw new Error("Provider does not support text generation.");
  } catch {
    return null; // Caller should fall back to template
  }
}

export function createTemplateCoverLetter({ config, job }) {
  const workRights = config.workRights || config.applicant?.workRights || "";
  const summary = normalizeResumeSummary(config.resumeSummary);
  const role = job.title || config.jobTitle || config.keywords || "Role";
  const company = job.company || "your team";
  const jobText = `${job.title || ""}\n${job.description || ""}`.toLowerCase();

  // Match resume points to job keywords
  const matched = summary.filter((point) => {
    const keywords = point.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 3);
    return keywords.some((word) => jobText.includes(word));
  });
  const remaining = summary.filter((p) => !matched.includes(p));

  // No resume summary at all — fully generic
  if (!summary.length) {
    return [
      `Dear hiring team,`,
      "",
      `I am excited to apply for the ${role} role at ${company} and would love to bring my experience to the team.`,
      "",
      "I take a practical, hands-on approach to engineering — I enjoy turning complex requirements into clean, maintainable solutions, collaborating closely with product and design, and keeping momentum high on every project I touch.",
      "",
      `${workRights ? `${workRights}. ` : ""}I would welcome the chance to discuss how I can contribute to ${company} and help the team deliver great outcomes.`
    ].join("\n");
  }

  const topMatched = matched.slice(0, 3);
  const topRemaining = remaining.slice(0, 2);
  const paragraphs = [];

  // Opening
  paragraphs.push(`Dear hiring team,`, "");

  if (topMatched.length) {
    // Role-specific skills paragraph
    paragraphs.push(
      `I am excited to apply for the ${role} role at ${company} — my background in ${joinSentence(topMatched)} makes this a natural fit.`
    );
    paragraphs.push("");
    paragraphs.push(
      `I would bring that experience from day one, contributing to ${company}'s projects with a focus on practical delivery, clear communication, and well-structured work that the team can build on.`
    );
  } else {
    // No direct keyword matches — use first 2 summary points for context
    paragraphs.push(
      `I am excited to apply for the ${role} role at ${company}. With a background that includes ${joinSentence(summary.slice(0, 2))}, I believe I can bring real value to the team.`
    );
    paragraphs.push("");
    paragraphs.push(
      "I approach engineering with a practical, collaborative mindset — turning requirements into maintainable solutions, learning quickly, and keeping projects moving forward."
    );
  }

  // Additional experience (non-matched points)
  if (topRemaining.length) {
    paragraphs.push("");
    paragraphs.push(
      `Beyond that, I have experience in ${joinSentence(topRemaining)}, which rounds out my ability to contribute across different areas as needed.`
    );
  }

  // Closing
  paragraphs.push("");
  paragraphs.push(
    `${workRights ? `${workRights}. ` : ""}I would welcome the opportunity to discuss how my experience can help ${company} deliver useful, reliable outcomes for its users and team.`
  );

  return paragraphs.join("\n");
}

// ---- Resume Artifacts ----

export async function generateResumeArtifacts({ config, resumeText }) {
  const client = createClient(config);
  const trimmedResume = trimForPrompt(resumeText || "", 18000);

  if (!trimmedResume.trim()) {
    throw new Error("Resume text is empty.");
  }

  const system = [
    SYSTEM_PROMPT,
    "Create reusable application materials from the resume only.",
    "Do not invent employers, years, credentials, tools, education, work rights, achievements, names, phone numbers, links, or certifications.",
    "Return JSON only with this schema: { \"resumeSummary\": string[], \"sampleCoverLetter\": string }.",
    "resumeSummary must contain 5 to 8 concise first-person-safe bullet points without bullet characters.",
    "sampleCoverLetter must be a generic cover letter reference, 170 to 240 words, no recipient address, no fake company, no signature block, no placeholders."
  ].join(" ");

  const prompt = [
    "Resume text:",
    trimmedResume,
    "",
    "Generate the JSON now."
  ].join("\n");

  const output = unwrapTextOutput(await client.generateText({
    system,
    prompt,
    maxTokens: 1000
  }));
  const parsed = parseJsonSafely(output);

  if (!parsed || !Array.isArray(parsed.resumeSummary) || typeof parsed.sampleCoverLetter !== "string") {
    throw new Error("AI returned an unexpected format. Try again after checking AI settings.");
  }

  return {
    resumeSummary: parsed.resumeSummary
      .map((item) => String(item).replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 8),
    sampleCoverLetter: parsed.sampleCoverLetter.trim()
  };
}

// ---- Screening Answer ----

export async function generateScreeningAnswer({ config, question, job }) {
  const client = createClient(config);
  const resumeText = normalizeResumeSummary(config.resumeSummary).join(" ");
  const jobDescription = trimForPrompt(job?.description || "", 6000);

  try {
    if (client.answerScreeningQuestion) {
      const res = await client.answerScreeningQuestion({
        question,
        jobDescription,
        resumeText
      });
      if (res.answer) return res.answer;
    }

    const system = [
      SYSTEM_PROMPT,
      "Draft an answer to a job application screening question. Answer the exact question using only real experience from the resume. Do not invent tools, employers, years of experience, work rights, or achievements."
    ].join(" ");

    const prompt = [
      `Question: ${question}`,
      resumeText ? `Resume: ${resumeText}` : "",
      jobDescription ? `Job Description: ${jobDescription}` : "",
      "",
      "Draft a direct, practical answer."
    ].filter(Boolean).join("\n");

    return await client.generateText({ system, prompt, maxTokens: 500 });
  } catch {
    return null;
  }
}

// ---- Job Match Score ----

export async function scoreJobMatch({ config, job }) {
  const client = createClient(config);
  const resumeText = normalizeResumeSummary(config.resumeSummary).join(" ");
  const jobDescription = trimForPrompt(job?.description || "", 8000);

  try {
    if (client.matchJob) {
      const res = await client.matchJob({ jobDescription, resumeText });
      if (res.score !== undefined) {
        return {
          score: res.score,
          matchingSkills: res.matchingSkills || [],
          missingSkills: res.missingSkills || [],
          overallAssessment: res.overallAssessment || "",
          model: res.model
        };
      }
    }

    const system = [
      SYSTEM_PROMPT,
      "Score how well a job matches the candidate. Return JSON only.",
      "Schema: { score: number 0-100, matchingSkills: string[], missingSkills: string[], overallAssessment: string }",
      "Be strict. Do not overrate weak matches. Consider skills, location, salary, seniority, and requirements."
    ].join(" ");

    const prompt = [
      resumeText ? `Resume: ${resumeText}` : "",
      `Job Description:\n${jobDescription}`,
      "",
      "Return JSON only."
    ].filter(Boolean).join("\n");

    const output = await client.generateText({ system, prompt, maxTokens: 600 });
    const parsed = parseJsonSafely(output);
    if (parsed) return parsed;
    return { score: 0, matchingSkills: [], missingSkills: [], overallAssessment: output };
  } catch {
    return { score: 0, matchingSkills: [], missingSkills: [], overallAssessment: "Unable to score." };
  }
}

// ---- Red Flag Detection ----

export async function detectRedFlags({ config, job }) {
  const client = createClient(config);
  const jobDescription = trimForPrompt(job?.description || "", 8000);

  try {
    if (client.detectRedFlags) {
      const res = await client.detectRedFlags({ jobDescription });
      if (res.redFlags) {
        return {
          redFlags: res.redFlags,
          riskLevel: res.riskLevel || "low",
          reason: res.reason || ""
        };
      }
    }

    const system = [
      SYSTEM_PROMPT,
      "Identify red flags in this job ad. Return JSON only.",
      "Schema: { redFlags: string[], riskLevel: 'low' | 'medium' | 'high', reason: string }",
      "Look for: unpaid trial, commission only, vague role, unrealistic requirements, no salary, suspicious contact details, unpaid internship, misleading junior role, visa issues, excessive overtime."
    ].join(" ");

    const prompt = [
      `Job Description:\n${jobDescription}`,
      "",
      "Return JSON only."
    ].join("\n");

    const output = await client.generateText({ system, prompt, maxTokens: 400 });
    const parsed = parseJsonSafely(output);
    if (parsed) return parsed;
    return { redFlags: [], riskLevel: "low", reason: output };
  } catch {
    return { redFlags: [], riskLevel: "low", reason: "Unable to analyze." };
  }
}

// ---- Job Summarization ----

export async function summarizeJob({ config, job }) {
  const client = createClient(config);
  const jobDescription = trimForPrompt(job?.description || "", 10000);

  try {
    if (client.summarizeJob) {
      const res = await client.summarizeJob({
        jobTitle: job?.title || "",
        jobDescription
      });
      if (res.summary) return res.summary;
    }

    const system = [
      SYSTEM_PROMPT,
      "Create a concise summary of a job description. Cover: role overview, key responsibilities, required skills, salary/benefits if mentioned, and notable details. Keep under 200 words."
    ].join(" ");

    const prompt = [
      job?.title ? `Job Title: ${job.title}` : "",
      `Job Description:\n${jobDescription}`,
      "",
      "Provide a concise summary."
    ].filter(Boolean).join("\n");

    return await client.generateText({ system, prompt, maxTokens: 400 });
  } catch {
    return null;
  }
}

// ---- Helpers ----

function joinSentence(items) {
  const cleanItems = items.map((item) => String(item).trim().replace(/[.!?]+$/, ""));
  if (cleanItems.length === 1) return cleanItems[0];
  if (cleanItems.length === 2) return `${cleanItems[0]} and ${cleanItems[1]}`;
  return `${cleanItems.slice(0, -1).join(", ")}, and ${cleanItems.at(-1)}`;
}
