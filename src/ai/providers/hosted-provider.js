export function createHostedProvider(config) {
  const base = config.backendUrl || "http://localhost:3000";
  const token = config.authToken || "";

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
    }
  };
}
