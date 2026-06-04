export function createOpenRouterProvider(config) {
  const model = config.ai.byokModel || "deepseek/deepseek-chat";
  const baseUrl = "https://openrouter.ai/api/v1";

  return {
    async generateText({ system, prompt, maxTokens }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/aanujkhurana/seekBuddy",
          "X-Title": "Seek Apply Assistant"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
          ],
          temperature: 0.4,
          max_tokens: maxTokens || 1200
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter error (${res.status}): ${text}`);
      }
      const data = await res.json();
      return data.choices[0].message.content;
    },

    async testConnection() {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/aanujkhurana/seekBuddy",
          "X-Title": "Seek Apply Assistant"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "user", content: "Reply with only the word: OK" }
          ],
          max_tokens: 10
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter connection failed (${res.status}): ${text}`);
      }
      await res.json();
      return { success: true };
    }
  };
}
