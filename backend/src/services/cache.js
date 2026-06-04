import crypto from "crypto";
import { cache } from "../db.js";

export function createCacheKey({ task, resumeText, jobDescription, question }) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        task,
        resumeText: resumeText || "",
        jobDescription: jobDescription || "",
        question: question || ""
      })
    )
    .digest("hex");
}

export function getCached(userId, task, inputHash) {
  const entries = cache.read();
  return entries.find(
    (e) => e.userId === userId && e.task === task && e.inputHash === inputHash
  ) || null;
}

export function setCache(userId, task, inputHash, output, modelUsed, tokensInput, tokensOutput, cost) {
  const entries = cache.read();
  const idx = entries.findIndex(
    (e) => e.userId === userId && e.task === task && e.inputHash === inputHash
  );
  const entry = { userId, task, inputHash, output, modelUsed, tokensInput, tokensOutput, cost, createdAt: new Date().toISOString() };

  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  cache.write(entries);
}
