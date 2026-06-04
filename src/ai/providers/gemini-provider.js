export function createGeminiProvider(config) {
  const model = config.ai.byokModel || "gemini-2.0-flash-lite";

  return {
    async generateText({ system, prompt, maxTokens }) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.ai.apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: `${system}\n\n${prompt}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: maxTokens || 1200
          }
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini error (${res.status}): ${text}`);
      }
      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error("Gemini returned no candidates");
      const parts = candidate.content?.parts || [];
      return parts.map((p) => p.text).join("");
    },

    async testConnection() {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.ai.apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Reply with only the word: OK" }]
            }
          ],
          generationConfig: { maxOutputTokens: 10 }
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini connection failed (${res.status}): ${text}`);
      }
      await res.json();
      return { success: true };
    }
  };
}
