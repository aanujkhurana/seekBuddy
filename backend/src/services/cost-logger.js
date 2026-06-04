import { costLog } from "../db.js";

const COST_PER_TOKEN = {
  "deepseek/deepseek-chat": { input: 0.000000014, output: 0.000000028 },
  "deepseek-chat": { input: 0.000000014, output: 0.000000028 },
  "minimax/minimax-01": { input: 0.00000020, output: 0.00000110 },
  "minimax-01": { input: 0.00000020, output: 0.00000110 },
  "google/gemini-flash-lite": { input: 0.000000075, output: 0.00000030 },
  "gemini-2.0-flash-lite": { input: 0.000000075, output: 0.00000030 },
  "gpt-4o-mini": { input: 0.00000015, output: 0.00000060 }
};

function estimateCost(model, tokensInput, tokensOutput) {
  const rates = COST_PER_TOKEN[model];
  if (!rates) return 0;
  return tokensInput * rates.input + tokensOutput * rates.output;
}

export function logCost(userId, task, model, tokensInput, tokensOutput) {
  const cost = estimateCost(model, tokensInput, tokensOutput);
  const entries = costLog.read();
  entries.push({
    userId,
    task,
    model,
    tokensInput,
    tokensOutput,
    cost,
    createdAt: new Date().toISOString()
  });
  costLog.write(entries);
  return cost;
}
