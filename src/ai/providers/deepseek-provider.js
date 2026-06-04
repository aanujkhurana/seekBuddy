export function createDeepSeekProvider(config) {
  const model = config.ai.byokModel || "deepseek-chat";
  const baseUrl = "https://api.deepseek.com";

  return {
    async generateText({ system, prompt, maxTokens }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          "Content-Type": "application/json"
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
        throw new Error(`DeepSeek error (${res.status}): ${text}`);
      }
      const data = await res.json();
      return data.choices[0].message.content;
    },

    async testConnection() {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.ai.apiKey}`,
          "Content-Type": "application/json"
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
        throw new Error(`DeepSeek connection failed (${res.status}): ${text}`);
      }
      await res.json();
      return { success: true };
    }
  };
}
