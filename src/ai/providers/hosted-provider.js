export function createHostedProvider(config) {
  const base = config.backendUrl || config.ai?.backendUrl || "http://localhost:3000";
  const token = config.authToken || config.ai?.authToken || "";

  async function call(endpoint, payload) {
    const res = await fetch(`${base}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ...payload,
        userId: config.userId
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hosted AI error (${res.status}): ${text}`);
    }
    return res.json();
  }

  return {
    generateCoverLetter(payload) {
      return call("/ai/cover-letter", payload);
    },
    answerScreeningQuestion(payload) {
      return call("/ai/screening-answer", payload);
    },
    generateText({ system, prompt, maxTokens }) {
      return call("/ai/generate", { system, prompt, maxTokens });
    },
    matchJob(payload) {
      return call("/ai/job-match", payload);
    },
    detectRedFlags(payload) {
      return call("/ai/red-flags", payload);
    },
    summarizeJob(payload) {
      return call("/ai/summarize", payload);
    },
    async testConnection() {
      const res = await call("/ai/test", {});
      return { success: res.success || false, message: res.message || "" };
    }
  };
}
