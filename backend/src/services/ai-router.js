import { callOpenRouter } from "../providers/openrouter.js";
import { callDeepSeek } from "../providers/deepseek.js";
import { callMiniMax } from "../providers/minimax.js";
import { callGemini } from "../providers/gemini.js";
import { callOpenAI } from "../providers/openai.js";

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

function getTaskModels(task) {
  const chain = TASK_CHAIN[task] || TASK_CHAIN.generate;
  return chain.map(([provider, model]) => {
    const fn = PROVIDER_MAP[provider];
    if (!fn) throw new Error(`Unknown provider: ${provider}`);
    return {
      name: model,
      call: (system, prompt, maxTokens) => fn(model, system, prompt, maxTokens)
    };
  });
}

export async function generateWithFallback({ task, system, prompt, maxTokens }) {
  const models = getTaskModels(task);
  let lastError;

  for (const model of models) {
    try {
      const result = await model.call(system, prompt, maxTokens);
      return {
        ...result,
        modelUsed: model.name
      };
    } catch (error) {
      lastError = error;
      console.error(`[AI-ROUTER] Model ${model.name} failed:`, error.message);
    }
  }

  throw lastError || new Error("All models exhausted");
}
