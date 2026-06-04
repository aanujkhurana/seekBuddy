const BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function callGemini(model, system, prompt, maxTokens = 1200) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = `${BASE}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${system}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: maxTokens
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini (${res.status}): ${text}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  const parts = candidate.content?.parts || [];
  const content = parts.map((p) => p.text).join("");

  const usage = data.usageMetadata || {};
  return {
    content,
    model: data.modelVersion || model,
    tokensInput: usage.promptTokenCount || 0,
    tokensOutput: usage.candidatesTokenCount || 0
  };
}
