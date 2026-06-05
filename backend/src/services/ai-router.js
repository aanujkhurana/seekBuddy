import { callOpenRouter } from "../providers/openrouter.js";
import { callDeepSeek } from "../providers/deepseek.js";
import { callMiniMax } from "../providers/minimax.js";
import { callGemini } from "../providers/gemini.js";
import { callOpenAI } from "../providers/openai.js";

const PROVIDER_TIMEOUT_MS = 15000;

const TASK_CHAIN = {
  coverLetter: [
    ["deepseek", "deepseek-chat"],
    ["minimax", "minimax-01"],
    ["gemini", "gemini-2.0-flash-lite"]
  ],
  screeningAnswer: [
    ["deepseek", "deepseek-chat"],
    ["minimax", "minimax-01"],
    ["gemini", "gemini-2.0-flash-lite"]
  ],
  jobMatchScore: [
    ["deepseek", "deepseek-chat"],
    ["gemini", "gemini-2.0-flash-lite"]
  ],
  resumeRewrite: [
    ["minimax", "minimax-01"],
    ["deepseek", "deepseek-chat"],
    ["openai", "gpt-4o-mini"]
  ],
  redFlags: [
    ["deepseek", "deepseek-chat"],
    ["gemini", "gemini-2.0-flash-lite"]
  ],
  summarize: [
    ["deepseek", "deepseek-chat"],
    ["minimax", "minimax-01"],
    ["gemini", "gemini-2.0-flash-lite"]
  ],
  generate: [
    ["deepseek", "deepseek-chat"],
    ["minimax", "minimax-01"],
    ["gemini", "gemini-2.0-flash-lite"]
  ]
};

const PROVIDER_MAP = {
  deepseek: callDeepSeek,
  minimax: callMiniMax,
  gemini: callGemini,
  openai: callOpenAI,
  openrouter: callOpenRouter
};

function callWithTimeout(fn, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Provider timed out after ${timeoutMs}ms`)), timeoutMs);
    fn.then((result) => {
      clearTimeout(timer);
      resolve(result);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function getTaskModels(task) {
  const chain = TASK_CHAIN[task] || TASK_CHAIN.generate;
  return chain.map(([provider, model]) => {
    const fn = PROVIDER_MAP[provider];
    if (!fn) throw new Error(`Unknown provider: ${provider}`);
    return {
      provider,
      name: model,
      call: (system, prompt, maxTokens) => fn(model, system, prompt, maxTokens)
    };
  });
}

export async function generateWithFallback({ task, system, prompt, maxTokens }) {
  const models = getTaskModels(task);
  const errors = [];

  for (const model of models) {
    try {
      const result = await callWithTimeout(
        model.call(system, prompt, maxTokens),
        PROVIDER_TIMEOUT_MS
      );
      return {
        ...result,
        modelUsed: model.name
      };
    } catch (error) {
      const err = { provider: model.provider, model: model.name, message: error.message };
      errors.push(err);
      console.error(`[AI-ROUTER] ${model.provider}/${model.name} failed:`, error.message);
    }
  }

  const summary = errors.map((e) => `${e.provider}: ${e.message}`).join("; ");
  throw new Error(`All AI providers exhausted. Errors: ${summary}`);
}
