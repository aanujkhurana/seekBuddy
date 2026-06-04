import { buildHeaders } from "../services/utils.js";

const BASE = "https://openrouter.ai/api/v1";

export async function callOpenRouter(model, system, prompt, maxTokens = 1200) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: buildHeaders(apiKey, {
      "HTTP-Referer": "https://github.com/aanujkhurana/seekBuddy",
      "X-Title": "Seek Apply Assistant"
    }),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      max_tokens: maxTokens
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter (${res.status}): ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("OpenRouter returned no choices");

  return {
    content: choice.message.content,
    model: data.model || model,
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0
  };
}
