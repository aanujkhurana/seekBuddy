import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createTemplateCoverLetter,
  generateCoverLetter,
  generateScreeningAnswer,
  scoreJobMatch,
  detectRedFlags,
  summarizeJob,
} from "../src/ai/ai-service.js";

// ---------------------------------------------------------------------------
// createTemplateCoverLetter
// ---------------------------------------------------------------------------

describe("createTemplateCoverLetter", () => {
  const job = {
    title: "Senior Frontend Developer",
    company: "Atlassian",
    description:
      "We are looking for an experienced frontend developer with strong React and TypeScript skills. " +
      "Must have experience with design systems, component libraries, and mentoring junior developers. " +
      "Knowledge of GraphQL and CI/CD pipelines is a plus.",
  };

  it("uses matching skills in the opening paragraph", () => {
    const config = {
      resumeSummary: [
        "5 years React & TypeScript at two startups",
        "Built design systems from scratch",
        "Led a team of 3 frontend devs",
        "Strong GraphQL and API design experience",
        "Set up CI/CD pipelines with GitHub Actions",
        "Mentored 4 junior developers",
      ],
    };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("background in"));
    assert.ok(letter.includes("React"));
    assert.ok(letter.includes("TypeScript"));
    assert.ok(letter.includes("makes this a natural fit"));
    // All 6 points may match the job description keywords — that's fine
    // Non-matched points (if any) appear in a "Beyond that" paragraph
  });

  it("places non-matched points in a separate paragraph when they exist", () => {
    // Use a job description that only mentions React, not Python or AWS
    const narrowJob = {
      title: "React Developer",
      company: "Acme",
      description: "Looking for a developer with React experience. Must know hooks and state management.",
    };
    const config = {
      resumeSummary: [
        "3 years React development",
        "5 years Python & Django",
        "Managed AWS infrastructure",
      ],
    };
    const letter = createTemplateCoverLetter({ config, job: narrowJob });

    assert.ok(letter.includes("React"));
    assert.ok(letter.includes("Beyond that"));
    assert.ok(letter.includes("Python") || letter.includes("AWS"));
  });

  it("handles no matching skills gracefully", () => {
    const config = {
      resumeSummary: [
        "10 years COBOL mainframe banking",
        "Certified scuba instructor",
        "Professional translator Japanese-English",
      ],
    };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("background that includes"));
    assert.ok(letter.includes("COBOL"));
    assert.ok(letter.includes("I believe I can bring real value"));
    // Should NOT claim "natural fit" since nothing matches
    assert.ok(!letter.includes("natural fit"));
  });

  it("produces a clean generic letter when resume summary is empty", () => {
    const config = { resumeSummary: [] };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("Atlassian"));
    assert.ok(letter.includes("Senior Frontend Developer"));
    assert.ok(letter.includes("practical, hands-on approach"));
    assert.ok(!letter.includes("background in"));
  });

  it("handles undefined resumeSummary", () => {
    const config = {};
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("practical, hands-on approach"));
    assert.ok(letter.includes("Atlassian"));
    assert.ok(!letter.includes("background in"));
  });

  it("normalizes a string resumeSummary (backward compat)", () => {
    const config = { resumeSummary: "5 years React & TypeScript at two startups" };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("React"));
    assert.ok(letter.includes("natural fit"));
    // Must not crash with TypeError
  });

  it("handles a single matching point", () => {
    const config = { resumeSummary: ["3 years React development at a fintech startup"] };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("React"));
    assert.ok(letter.includes("natural fit"));
    // Single point in opening: joinSentence returns just the point, no "and" needed
    const openingLine = letter.split("\n").find((l) => l.includes("makes this a natural fit"));
    assert.ok(openingLine);
    assert.ok(!openingLine.includes(" and "));
  });

  it("handles a single non-matching point", () => {
    const config = { resumeSummary: ["5 years Python & Django at enterprise"] };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("Python"));
    assert.ok(letter.includes("I believe I can bring real value"));
  });

  it("includes work rights clause when configured", () => {
    const config = {
      resumeSummary: ["5 years React experience"],
      workRights: "I have full Australian working rights",
    };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.includes("full Australian working rights"));
  });

  it("omits work rights clause when not configured", () => {
    const config = { resumeSummary: ["5 years React experience"] };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(!letter.includes("working rights"));
  });

  it("falls back to jobTitle when job.title is empty", () => {
    const config = {
      jobTitle: "Backend Engineer",
      resumeSummary: ["5 years Node.js experience"],
    };
    const letter = createTemplateCoverLetter({
      config,
      job: { title: "", company: "Canva", description: "" },
    });

    assert.ok(letter.includes("Backend Engineer"));
  });

  it("falls back to 'your team' when company is empty", () => {
    const config = { resumeSummary: ["5 years React experience"] };
    const letter = createTemplateCoverLetter({
      config,
      job: { title: "Dev", company: "", description: "" },
    });

    assert.ok(letter.includes("your team"));
    assert.ok(!letter.includes("'s")); // no possessive on "your team"
  });

  it("includes the Dear hiring team salutation", () => {
    const config = { resumeSummary: ["5 years React experience"] };
    const letter = createTemplateCoverLetter({ config, job });

    assert.ok(letter.startsWith("Dear hiring team,"));
  });

  it("creates a letter for every scenario without throwing", () => {
    // Smoke test: various config shapes must not crash
    const scenarios = [
      { resumeSummary: ["React", "TypeScript", "GraphQL", "AWS", "Docker", "Kubernetes"] },
      { resumeSummary: ["React"] },
      { resumeSummary: [] },
      {},
      { resumeSummary: "Legacy string" },
      { resumeSummary: ["React"], workRights: "Full working rights" },
    ];

    for (const config of scenarios) {
      const letter = createTemplateCoverLetter({ config, job });
      assert.ok(typeof letter === "string");
      assert.ok(letter.length > 50);
      assert.ok(letter.startsWith("Dear hiring team,"));
    }
  });
});

// ---------------------------------------------------------------------------
// generateCoverLetter
// ---------------------------------------------------------------------------

describe("generateCoverLetter", () => {
  const job = {
    title: "Senior Frontend Developer",
    company: "Atlassian",
    description:
      "We are looking for an experienced frontend developer with strong React and TypeScript skills.",
  };

  it("returns null when no AI provider is configured (no API key)", async () => {
    // Without a real API key or hosted backend, createAIClient throws
    // and the catch block returns null
    const result = await generateCoverLetter({ config: {}, job });
    assert.equal(result, null);
  });

  it("returns null when job has empty fields", async () => {
    const config = { resumeSummary: ["React experience"] };
    const result = await generateCoverLetter({
      config,
      job: { title: "", company: "", description: "" },
    });
    // Should not crash; returns null because no AI provider available
    assert.equal(result, null);
  });

  it("does not throw on edge-case config shapes", async () => {
    // String resumeSummary (old config), missing ai config, tone set
    const result = await generateCoverLetter({
      config: {
        resumeSummary: "5 years React experience",
        coverLetter: { tone: "casual and friendly", wordLimit: 150 },
      },
      job,
    });
    // Returns null without crashing — exercises the try/catch and null-return paths
    assert.equal(result, null);
  });

  it("returns null when config has no ai or apiKey", async () => {
    const result = await generateCoverLetter({
      config: { resumeSummary: ["React"] },
      job: { title: "Dev", company: "Acme", description: "Need a dev." },
    });
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// generateScreeningAnswer
// ---------------------------------------------------------------------------

describe("generateScreeningAnswer", () => {
  const job = {
    title: "Senior Frontend Developer",
    company: "Atlassian",
    description: "Looking for React and TypeScript experience.",
  };
  const question = "How many years of React experience do you have?";

  it("returns null when no AI provider is configured", async () => {
    const result = await generateScreeningAnswer({
      config: { resumeSummary: ["5 years React"] },
      question,
      job,
    });
    assert.equal(result, null);
  });

  it("returns null with empty config", async () => {
    const result = await generateScreeningAnswer({
      config: {},
      question,
      job,
    });
    assert.equal(result, null);
  });

  it("handles missing job gracefully", async () => {
    const result = await generateScreeningAnswer({
      config: { resumeSummary: ["React"] },
      question,
      job: { title: "", company: "", description: "" },
    });
    assert.equal(result, null);
  });

  it("handles undefined job gracefully", async () => {
    const result = await generateScreeningAnswer({
      config: { resumeSummary: ["React"] },
      question,
      job: undefined,
    });
    assert.equal(result, null);
  });

  it("handles empty question without crashing", async () => {
    const result = await generateScreeningAnswer({
      config: { resumeSummary: ["React"] },
      question: "",
      job,
    });
    assert.equal(result, null);
  });

  it("does not throw on string resumeSummary (backward compat)", async () => {
    const result = await generateScreeningAnswer({
      config: { resumeSummary: "5 years React experience" },
      question,
      job,
    });
    assert.equal(result, null);
  });

  it("does not throw with long job descriptions", async () => {
    const result = await generateScreeningAnswer({
      config: { resumeSummary: ["React"] },
      question,
      job: {
        title: "Dev",
        company: "Acme",
        description: "A".repeat(8000),
      },
    });
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// scoreJobMatch
// ---------------------------------------------------------------------------

describe("scoreJobMatch", () => {
  const job = {
    title: "Senior Frontend Developer",
    company: "Atlassian",
    description: "Looking for React and TypeScript experience.",
  };

  it("returns fallback shape when no AI provider is configured", async () => {
    const result = await scoreJobMatch({
      config: { resumeSummary: ["5 years React"] },
      job,
    });

    assert.equal(typeof result, "object");
    assert.equal(result.score, 0);
    assert.ok(Array.isArray(result.matchingSkills));
    assert.ok(Array.isArray(result.missingSkills));
    assert.equal(result.overallAssessment, "Unable to score.");
  });

  it("handles undefined job without crashing", async () => {
    const result = await scoreJobMatch({
      config: { resumeSummary: ["React"] },
      job: undefined,
    });
    assert.equal(result.score, 0);
  });

  it("does not throw on string resumeSummary (backward compat)", async () => {
    const result = await scoreJobMatch({
      config: { resumeSummary: "5 years React and TypeScript" },
      job,
    });
    assert.equal(result.score, 0);
  });
});

// ---------------------------------------------------------------------------
// detectRedFlags
// ---------------------------------------------------------------------------

describe("detectRedFlags", () => {
  const job = {
    title: "Senior Frontend Developer",
    company: "Atlassian",
    description: "Looking for React and TypeScript experience.",
  };

  it("returns fallback shape when no AI provider is configured", async () => {
    const result = await detectRedFlags({ config: {}, job });

    assert.equal(typeof result, "object");
    assert.ok(Array.isArray(result.redFlags));
    assert.equal(result.redFlags.length, 0);
    assert.equal(result.riskLevel, "low");
    assert.equal(result.reason, "Unable to analyze.");
  });

  it("returns fallback shape with empty job", async () => {
    const result = await detectRedFlags({
      config: {},
      job: { title: "", company: "", description: "" },
    });
    assert.equal(result.riskLevel, "low");
    assert.equal(result.reason, "Unable to analyze.");
  });

  it("handles undefined job without crashing", async () => {
    const result = await detectRedFlags({
      config: {},
      job: undefined,
    });
    assert.equal(result.riskLevel, "low");
  });

  it("does not throw with resume summary present (unused but present)", async () => {
    const result = await detectRedFlags({
      config: { resumeSummary: ["React", "TypeScript"] },
      job,
    });
    assert.equal(result.riskLevel, "low");
  });
});

// ---------------------------------------------------------------------------
// summarizeJob
// ---------------------------------------------------------------------------

describe("summarizeJob", () => {
  const job = {
    title: "Senior Frontend Developer",
    company: "Atlassian",
    description: "Looking for React and TypeScript experience.",
  };

  it("returns null when no AI provider is configured", async () => {
    const result = await summarizeJob({ config: {}, job });
    assert.equal(result, null);
  });

  it("handles empty job without crashing", async () => {
    const result = await summarizeJob({
      config: {},
      job: { title: "", company: "", description: "" },
    });
    assert.equal(result, null);
  });

  it("handles undefined job without crashing", async () => {
    const result = await summarizeJob({
      config: {},
      job: undefined,
    });
    assert.equal(result, null);
  });

  it("handles job with no title gracefully", async () => {
    const result = await summarizeJob({
      config: {},
      job: { title: "", company: "Acme", description: "We need someone." },
    });
    assert.equal(result, null);
  });

  it("does not throw on string resumeSummary (backward compat)", async () => {
    const result = await summarizeJob({
      config: { resumeSummary: "5 years React" },
      job,
    });
    assert.equal(result, null);
  });

  it("does not throw with long job descriptions", async () => {
    const result = await summarizeJob({
      config: {},
      job: {
        title: "Dev",
        company: "Acme",
        description: "B".repeat(15000),
      },
    });
    assert.equal(result, null);
  });
});
