import { createHostedProvider } from "./providers/hosted-provider.js";
import { createOpenRouterProvider } from "./providers/openrouter-provider.js";
import { createOpenAIProvider } from "./providers/openai-provider.js";
import { createGeminiProvider } from "./providers/gemini-provider.js";
import { createDeepSeekProvider } from "./providers/deepseek-provider.js";
import { createMiniMaxProvider } from "./providers/minimax-provider.js";

export function createAIClient(config) {
  if (config.ai.mode === "hosted") {
    return createHostedProvider(config);
  }

  const provider = config.ai.byokProvider;
  if (provider === "openrouter") return createOpenRouterProvider(config);
  if (provider === "openai") return createOpenAIProvider(config);
  if (provider === "gemini") return createGeminiProvider(config);
  if (provider === "deepseek") return createDeepSeekProvider(config);
  if (provider === "minimax") return createMiniMaxProvider(config);

  throw new Error(`Unsupported AI provider: ${provider}`);
}
