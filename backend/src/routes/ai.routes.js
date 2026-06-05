import { Router } from "express";
import { generateWithFallback } from "../services/ai-router.js";
import { createCacheKey, getCached, setCache } from "../services/cache.js";
import { logCost } from "../services/cost-logger.js";
import { checkAIGenerationLimit, incrementAIGenerations } from "../middleware/rate-limit.js";

const router = Router();

router.post("/test", async (req, res) => {
  try {
    const result = await generateWithFallback({
      task: "generate",
      system: "Reply with only the word: OK",
      prompt: "OK",
      maxTokens: 10
    });
    res.json({
      success: true,
      model: result.modelUsed
    });
  } catch (err) {
    res.json({
      success: false,
      message: err.message
    });
  }
});

router.post("/generate", checkAIGenerationLimit, async (req, res) => {
  try {
    const { system, prompt, maxTokens, task } = req.body;
    if (!system || !prompt) {
      return res.status(400).json({ error: "system and prompt are required" });
    }

    const t = task || "generate";
    const cacheKey = createCacheKey({ task: t, resumeText: prompt, jobDescription: system });

    const cached = getCached(req.user.id, t, cacheKey);
    if (cached) {
      return res.json({
        output: cached.output,
        model: cached.model_used,
        cached: true,
        cost: cached.cost,
        tokens: { input: cached.tokens_input, output: cached.tokens_output }
      });
    }

    const result = await generateWithFallback({
      task: t,
      system,
      prompt,
      maxTokens: maxTokens || 1200
    });

    const cost = logCost(req.user.id, t, result.modelUsed, result.tokensInput, result.tokensOutput);
    setCache(req.user.id, t, cacheKey, result.content, result.modelUsed, result.tokensInput, result.tokensOutput, cost);
    incrementAIGenerations(req.user.id);

    res.json({
      output: result.content,
      model: result.modelUsed,
      cached: false,
      cost,
      tokens: { input: result.tokensInput, output: result.tokensOutput }
    });
  } catch (err) {
    console.error("[AI] generate error:", err);
    res.status(502).json({ error: err.message });
  }
});

router.post("/cover-letter", checkAIGenerationLimit, async (req, res) => {
  try {
    const { jobTitle, company, jobDescription, resumeText, tone, wordLimit } = req.body;
    if (!jobDescription || !resumeText) {
      return res.status(400).json({ error: "jobDescription and resumeText are required" });
    }

    const cacheKey = createCacheKey({
      task: "coverLetter",
      resumeText,
      jobDescription: JSON.stringify({ jobTitle, company, jobDescription, tone, wordLimit })
    });

    const cached = getCached(req.user.id, "coverLetter", cacheKey);
    if (cached) {
      return res.json({
        coverLetter: cached.output,
        model: cached.model_used,
        cached: true,
        cost: cached.cost
      });
    }

    const system = `You are a professional cover letter writer. Write a tailored cover letter for a job application.`;
    const prompt = [
      `Job Title: ${jobTitle || "Unknown"}`,
      `Company: ${company || "Unknown"}`,
      `Job Description: ${jobDescription}`,
      `Applicant Resume: ${resumeText}`,
      `Tone: ${tone || "professional, confident"}`,
      `Word Limit: ${wordLimit || 300} words`,
      "",
      "Write a cover letter that highlights relevant experience and skills from the resume."
    ].join("\n");

    const result = await generateWithFallback({
      task: "coverLetter",
      system,
      prompt,
      maxTokens: wordLimit ? Math.min(wordLimit * 2, 1200) : 1200
    });

    const cost = logCost(req.user.id, "coverLetter", result.modelUsed, result.tokensInput, result.tokensOutput);
    setCache(req.user.id, "coverLetter", cacheKey, result.content, result.modelUsed, result.tokensInput, result.tokensOutput, cost);
    incrementAIGenerations(req.user.id);

    res.json({
      coverLetter: result.content,
      model: result.modelUsed,
      cached: false,
      cost
    });
  } catch (err) {
    console.error("[AI] cover-letter error:", err);
    res.status(502).json({ error: err.message });
  }
});

router.post("/screening-answer", checkAIGenerationLimit, async (req, res) => {
  try {
    const { question, jobDescription, resumeText } = req.body;
    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const cacheKey = createCacheKey({
      task: "screeningAnswer",
      resumeText: resumeText || "",
      jobDescription: jobDescription || "",
      question
    });

    const cached = getCached(req.user.id, "screeningAnswer", cacheKey);
    if (cached) {
      return res.json({
        answer: cached.output,
        model: cached.model_used,
        cached: true,
        cost: cached.cost
      });
    }

    const system = `You are a job applicant answering screening questions. Provide concise, professional answers based on the provided resume and job context.`;
    const prompt = [
      `Question: ${question}`,
      jobDescription ? `Job Description: ${jobDescription}` : "",
      resumeText ? `Resume: ${resumeText}` : "",
      "",
      "Provide a clear, professional answer to the screening question."
    ].filter(Boolean).join("\n");

    const result = await generateWithFallback({
      task: "screeningAnswer",
      system,
      prompt,
      maxTokens: 600
    });

    const cost = logCost(req.user.id, "screeningAnswer", result.modelUsed, result.tokensInput, result.tokensOutput);
    setCache(req.user.id, "screeningAnswer", cacheKey, result.content, result.modelUsed, result.tokensInput, result.tokensOutput, cost);
    incrementAIGenerations(req.user.id);

    res.json({
      answer: result.content,
      model: result.modelUsed,
      cached: false,
      cost
    });
  } catch (err) {
    console.error("[AI] screening-answer error:", err);
    res.status(502).json({ error: err.message });
  }
});

router.post("/job-match", checkAIGenerationLimit, async (req, res) => {
  try {
    const { jobDescription, resumeText } = req.body;
    if (!jobDescription || !resumeText) {
      return res.status(400).json({ error: "jobDescription and resumeText are required" });
    }

    const cacheKey = createCacheKey({ task: "jobMatchScore", resumeText, jobDescription });

    const cached = getCached(req.user.id, "jobMatchScore", cacheKey);
    if (cached) {
      return res.json({
        score: parseInt(cached.output, 10),
        analysis: cached.output,
        model: cached.model_used,
        cached: true,
        cost: cached.cost
      });
    }

    const system = `You are a job matching assistant. Analyze how well a candidate's resume matches a job description. Return a JSON object with score (0-100), matchingSkills (array), missingSkills (array), and overallAssessment (string).`;
    const prompt = [
      `Job Description: ${jobDescription}`,
      `Resume: ${resumeText}`,
      "",
      "Return JSON only: { score: number, matchingSkills: string[], missingSkills: string[], overallAssessment: string }"
    ].join("\n");

    const result = await generateWithFallback({
      task: "jobMatchScore",
      system,
      prompt,
      maxTokens: 800
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { score: 0, matchingSkills: [], missingSkills: [], overallAssessment: result.content };
    }

    const cost = logCost(req.user.id, "jobMatchScore", result.modelUsed, result.tokensInput, result.tokensOutput);
    setCache(req.user.id, "jobMatchScore", cacheKey, result.content, result.modelUsed, result.tokensInput, result.tokensOutput, cost);
    incrementAIGenerations(req.user.id);

    res.json({
      ...parsed,
      model: result.modelUsed,
      cached: false,
      cost
    });
  } catch (err) {
    console.error("[AI] job-match error:", err);
    res.status(502).json({ error: err.message });
  }
});

router.post("/red-flags", checkAIGenerationLimit, async (req, res) => {
  try {
    const { jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: "jobDescription is required" });
    }

    const cacheKey = createCacheKey({ task: "redFlags", resumeText: "", jobDescription });

    const cached = getCached(req.user.id, "redFlags", cacheKey);
    if (cached) {
      let parsed;
      try { parsed = JSON.parse(cached.output); } catch { parsed = { redFlags: [], riskLevel: "low", reason: cached.output }; }
      return res.json({ ...parsed, model: cached.model_used, cached: true, cost: cached.cost });
    }

    const system = `You are a job ad analyst. Identify red flags in job postings. Return JSON only.`;
    const prompt = [
      `Job Description:\n${jobDescription}`,
      "",
      "Look for: unpaid trial, commission only, vague role, unrealistic requirements, no salary listed, suspicious contact details, unpaid internship, misleading junior role, visa/work-rights issues, excessive overtime expectations.",
      "",
      "Return JSON only: { redFlags: string[], riskLevel: 'low' | 'medium' | 'high', reason: string }"
    ].join("\n");

    const result = await generateWithFallback({
      task: "redFlags",
      system,
      prompt,
      maxTokens: 500
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { redFlags: [], riskLevel: "low", reason: result.content };
    }

    const cost = logCost(req.user.id, "redFlags", result.modelUsed, result.tokensInput, result.tokensOutput);
    setCache(req.user.id, "redFlags", cacheKey, result.content, result.modelUsed, result.tokensInput, result.tokensOutput, cost);
    incrementAIGenerations(req.user.id);

    res.json({
      ...parsed,
      model: result.modelUsed,
      cached: false,
      cost
    });
  } catch (err) {
    console.error("[AI] red-flags error:", err);
    res.status(502).json({ error: err.message });
  }
});

router.post("/summarize", checkAIGenerationLimit, async (req, res) => {
  try {
    const { jobDescription, jobTitle } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: "jobDescription is required" });
    }

    const cacheKey = createCacheKey({
      task: "summarize",
      resumeText: "",
      jobDescription: JSON.stringify({ jobTitle, jobDescription })
    });

    const cached = getCached(req.user.id, "summarize", cacheKey);
    if (cached) {
      return res.json({
        summary: cached.output,
        model: cached.model_used,
        cached: true,
        cost: cached.cost
      });
    }

    const system = `You are a job ad summarizer. Create a concise summary of the key points from a job description.`;
    const prompt = [
      jobTitle ? `Job Title: ${jobTitle}` : "",
      `Job Description:\n${jobDescription}`,
      "",
      "Provide a concise summary covering: role overview, key responsibilities, required skills, salary/benefits if mentioned, and any notable details. Keep it under 200 words."
    ].filter(Boolean).join("\n");

    const result = await generateWithFallback({
      task: "summarize",
      system,
      prompt,
      maxTokens: 500
    });

    const cost = logCost(req.user.id, "summarize", result.modelUsed, result.tokensInput, result.tokensOutput);
    setCache(req.user.id, "summarize", cacheKey, result.content, result.modelUsed, result.tokensInput, result.tokensOutput, cost);
    incrementAIGenerations(req.user.id);

    res.json({
      summary: result.content,
      model: result.modelUsed,
      cached: false,
      cost
    });
  } catch (err) {
    console.error("[AI] summarize error:", err);
    res.status(502).json({ error: err.message });
  }
});

export default router;
