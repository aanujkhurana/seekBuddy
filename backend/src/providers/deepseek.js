import { buildHeaders } from "../services/utils.js";

const BASE = "https://api.deepseek.com";

export async function callDeepSeek(model, system, prompt, maxTokens = 1200) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: buildHeaders(apiKey),
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
    throw new Error(`DeepSeek (${res.status}): ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("DeepSeek returned no choices");

  return {
    content: choice.message.content,
    model: data.model || model,
    tokensInput: data.usage?.prompt_tokens || 0,
    tokensOutput: data.usage?.completion_tokens || 0
  };
}
