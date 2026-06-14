import path from "node:path";
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";
import {
  buildSearchUrls,
  ensureDir,
  hasFlag,
  readJsonFile,
  writeJsonFile
} from "./config.js";
import { loadConfig } from "./automation/config.js";
import { SEEK_SELECTORS, SEEK_TEXT } from "./automation/seek-selectors.js";
import { createCoverLetter, saveCoverLetter } from "./cover-letter.js";
import { detectRedFlags, scoreJobMatch } from "./ai/ai-service.js";
import { logError, logStep, logSuccess, logWarn } from "./logger.js";

let shouldStop = false;
const DAILY_APPLICATION_LIMIT = 50;

process.on("SIGTERM", () => {
  if (shouldStop) return;
  shouldStop = true;
  logWarn("Stopping safely after current job...");
});

process.on("SIGINT", () => {
  if (shouldStop) return;
  shouldStop = true;
  logWarn("Stopping safely after current job...");
});

const config = loadConfig();
const dryRun = hasFlag("--dry-run");
const queueOnly = hasFlag("--queue-only");
const queuedApplyId = getArgValue("--apply-queued");
const dataDir = process.env.USER_DATA_DIR || "data";
const handledPath = path.join(dataDir, "handled-applications.json");
const queuePath = path.join(dataDir, "application-review-queue.json");
const handledApplications = readJsonFile(handledPath, []);
const handledUrls = new Set(handledApplications.map((item) => item.url));
const reviewQueue = readJsonFile(queuePath, []);
const queuedUrls = new Set(reviewQueue.filter((item) => item.status !== "skipped").map((item) => item.url));
let dailyApplicationsToday = countApplicationsForDate(handledApplications, getLocalDateKey());
const requestedRunLimit = normalizeApplicationLimit(config.maxApplications);
const availableToday = Math.max(DAILY_APPLICATION_LIMIT - dailyApplicationsToday, 0);
const runApplicationLimit = Math.min(requestedRunLimit, availableToday);
const slowMoMs = Math.max(Number(config.slowMoMs) || 0, 0);

ensureDir(dataDir);
ensureDir("out/cover-letters");

logStep("Daily application limit", {
  dailyLimit: DAILY_APPLICATION_LIMIT,
  alreadyCountedToday: dailyApplicationsToday,
  availableToday,
  requestedRunLimit,
  runApplicationLimit
});

if (runApplicationLimit <= 0) {
  logWarn("Daily application limit reached; no more applications will be prepared today", {
    dailyLimit: DAILY_APPLICATION_LIMIT
  });
  process.exit(0);
}

logStep("Launching browser", {
  profileDir: config.browserProfileDir,
  dryRun
});
const context = await chromium.launchPersistentContext(config.browserProfileDir, {
  headless: false,
  slowMo: slowMoMs
});
logSuccess("Browser launched");

try {
  const page = context.pages()[0] || (await context.newPage());
  const searchUrls = buildSearchUrls(config);
  let totalHandled = 0;
  let totalApplicationsPrepared = 0;
  let blocked = false;

  if (queuedApplyId) {
    await applyQueuedJob({
      context,
      config,
      queuePath,
      queueId: queuedApplyId,
      handledPath,
      handledApplications,
      handledUrls
    });
  } else {
    for (const searchUrl of searchUrls) {
    if (shouldStop) break;
    const remainingRunLimit = runApplicationLimit - totalApplicationsPrepared;
    if (remainingRunLimit <= 0) {
      logWarn("Run application limit reached; stopping before the next search", {
        runApplicationLimit,
        dailyLimit: DAILY_APPLICATION_LIMIT
      });
      break;
    }

    logStep("Opening SEEK search", { searchUrl });
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await waitForHumanVerification(page);
    await page.waitForLoadState("networkidle").catch(() => {});

    const jobUrls = await collectJobUrls(page);
    logSuccess("Search complete", {
      searchUrl,
      jobCount: jobUrls.length
    });

    const candidateUrls = jobUrls.slice(0, remainingRunLimit);
    logStep("Selected job candidates for this search", {
      searchUrl,
      selectedCount: candidateUrls.length,
      remainingRunLimit,
      dailyLimit: DAILY_APPLICATION_LIMIT
    });

    let searchHandled = 0;
    let searchAttempted = 0;
    for (const url of candidateUrls) {
      if (shouldStop) break;
      if (totalApplicationsPrepared >= runApplicationLimit || dailyApplicationsToday >= DAILY_APPLICATION_LIMIT) {
        logWarn("Daily application limit reached; stopping after current search candidate", {
          dailyLimit: DAILY_APPLICATION_LIMIT,
          dailyApplicationsToday
        });
        break;
      }

      if (handledUrls.has(url) || (queueOnly && queuedUrls.has(url))) {
        logStep(queueOnly ? "Skipping already queued or handled job" : "Skipping already handled job", { url });
        continue;
      }

      searchAttempted += 1;
      let result;
      try {
        result = queueOnly
          ? await queueJobForReview({ context, config, searchUrl, url, queuePath, reviewQueue, queuedUrls })
          : await handleJob({ context, config, dryRun, searchUrl, url });
      } catch (error) {
        logError("Job failed; continuing to next job", error);
        continue;
      }

      if (result.blocked) {
        blocked = true;
        break;
      }

      if (!result.handled) continue;

      if (result.queued) {
        searchHandled += 1;
        totalHandled += 1;
        totalApplicationsPrepared += 1;
        logSuccess("Job added to review queue", {
          url,
          searchHandled,
          totalQueued: totalHandled
        });
        continue;
      }

      handledApplications.push({
        url,
        searchUrl,
        title: result.job.title,
        company: result.job.company,
        location: result.job.location || "",
        coverLetterPath: result.coverLetterPath,
        status: result.status || "prepared",
        jobSummary: summarizeJobForReview(result.job),
        fitScore: result.fitScore ?? null,
        redFlags: result.redFlags || [],
        screeningAnswers: result.screeningAnswers || [],
        evidencePoints: getResumeEvidencePoints(config),
        aiEvidence: createAIEvidence(config),
        handledAt: new Date().toISOString(),
        dryRun
      });
      handledUrls.add(url);
      writeJsonFile(handledPath, handledApplications);
      searchHandled += 1;
      totalHandled += 1;
      if (countsTowardDailyLimit({ result, dryRun })) {
        dailyApplicationsToday += 1;
        totalApplicationsPrepared += 1;
      }
      logSuccess("Job marked handled", {
        url,
        searchHandled,
        totalHandled,
        applicationsPreparedToday: dailyApplicationsToday,
        dailyLimit: DAILY_APPLICATION_LIMIT
      });
    }

    logSuccess("Search handling complete", {
      searchUrl,
      selectedCount: candidateUrls.length,
      attemptedCount: searchAttempted,
      handledCount: searchHandled
    });
    if (blocked || shouldStop) break;
    }

    if (shouldStop) {
      logWarn("Automation stopped by user.", { totalHandled });
    }

    logSuccess("Apply run complete", {
      totalHandled,
      totalApplicationsPrepared,
      dailyLimit: DAILY_APPLICATION_LIMIT
    });
    if (!queueOnly && !dryRun && (config.reviewBeforeApply ?? config.pauseBeforeSubmit ?? true) && totalHandled > 0) {
      await waitForBatchReview(context, totalHandled);
    }
  }
} finally {
  logStep("Closing browser context");
  await context.close();
  logSuccess("Browser context closed");
}

function normalizeApplicationLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 10;
  return Math.min(Math.floor(number), DAILY_APPLICATION_LIMIT);
}

function getResumeEvidencePoints(config) {
  const points = Array.isArray(config.resumeSummary)
    ? config.resumeSummary
    : String(config.resumeSummary || "").split("\n");
  return points.map((point) => point.trim()).filter(Boolean).slice(0, 8);
}

function createAIEvidence(config) {
  return {
    resumePoints: getResumeEvidencePoints(config),
    note: "AI-generated drafts should stay within these resume-backed points."
  };
}

function summarizeJobForReview(job) {
  const description = String(job?.description || "").replace(/\s+/g, " ").trim();
  if (!description) return "";
  return description.length > 360 ? `${description.slice(0, 360).trim()}...` : description;
}

async function getJobReviewSignals({ config, job, url }) {
  const signals = {
    fitScore: null,
    redFlags: []
  };

  try {
    logStep("Scoring job match", { url });
    const match = await scoreJobMatch({ config, job });
    signals.fitScore = normalizeScore(match?.score);
    logSuccess("Job match scored", { score: signals.fitScore });
  } catch (error) {
    logWarn("Could not score job match; continuing without fit score", {
      url,
      message: error.message
    });
  }

  try {
    logStep("Checking job red flags", { url });
    const redFlags = await detectRedFlags({ config, job });
    signals.redFlags = Array.isArray(redFlags?.redFlags)
      ? redFlags.redFlags.filter(Boolean)
      : [];
    logSuccess("Red flag check complete", {
      redFlagCount: signals.redFlags.length
    });
  } catch (error) {
    logWarn("Could not check red flags; continuing without red flag notes", {
      url,
      message: error.message
    });
  }

  return signals;
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function countsTowardDailyLimit({ result, dryRun }) {
  if (dryRun) return false;
  return (result.status || "prepared") !== "already_applied";
}

function countApplicationsForDate(applications, dateKey) {
  return applications.filter((item) => {
    if (!item?.handledAt) return false;
    if (item.dryRun) return false;
    if ((item.status || "prepared") === "already_applied") return false;
    return getLocalDateKey(new Date(item.handledAt)) === dateKey;
  }).length;
}

function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function handleJob({ context, config, dryRun, searchUrl, url }) {
  const jobPage = await context.newPage();
  logStep("Opening job page", {
    searchUrl,
    url
  });
  await jobPage.goto(url, { waitUntil: "domcontentloaded" });
  await jobPage.waitForLoadState("networkidle").catch(() => {});
  logSuccess("Job page loaded", { url });

  logStep("Extracting job details", { url });
  const job = await extractJob(jobPage);
  job.url = url;
  logSuccess("Job details extracted", {
    title: job.title || "Unknown title",
    company: job.company || "Unknown company",
    descriptionCharacters: job.description?.length || 0
  });
  const reviewSignals = await getJobReviewSignals({ config, job, url });

  let coverLetterPath = null;
  try {
    if (dryRun) {
      const coverLetter = await createCoverLetter({ config, job });
      logStep("Saving cover letter", {
        title: job.title || "Unknown title",
        company: job.company || "Unknown company"
      });
      coverLetterPath = saveCoverLetter({ job, coverLetter });
      logSuccess("Cover letter saved", {
        path: coverLetterPath
      });
      logSuccess("Dry run complete for job", { url });
      return { handled: true, job, coverLetterPath, ...reviewSignals };
    }

    if (await isAlreadyAppliedPage(jobPage)) {
      logWarn("Job appears to be already applied on SEEK; marking handled without creating cover letter", {
        url
      });
      await jobPage.close().catch(() => {});
      return { handled: true, job, coverLetterPath: null, status: "already_applied", ...reviewSignals };
    }

    logStep("Opening apply flow", { url });
    const applyPage = await openApplyPage(jobPage, context);
    if (!applyPage) {
      if (await isAlreadyAppliedPage(jobPage)) {
        logWarn("No apply control because job appears already applied; marking handled", {
          url
        });
        await jobPage.close().catch(() => {});
        return { handled: true, job, coverLetterPath: null, status: "already_applied", ...reviewSignals };
      }

      logWarn("Could not find apply button/link; leaving job page open", { url });
      return { handled: false, job, coverLetterPath };
    }
    logSuccess("Apply flow opened", {
      url: applyPage.url()
    });

    const signedIn = await waitForSignInIfNeeded(applyPage);
    if (!signedIn) {
      logWarn("Still on sign-in page; job not marked handled", { url });
      await applyPage.close().catch(() => {});
      return { blocked: true, handled: false, job, coverLetterPath };
    }

    if (await isAlreadyAppliedPage(applyPage)) {
      logWarn("Apply page indicates this job was already applied; marking handled without creating cover letter", {
        url: applyPage.url()
      });
      await applyPage.close().catch(() => {});
      await jobPage.close().catch(() => {});
      return { handled: true, job, coverLetterPath: null, status: "already_applied", ...reviewSignals };
    }

    logStep("Filling application", {
      url: applyPage.url()
    });
    await fillApplicationBasics(applyPage, config);

    logStep("Checking for cover letter field");
    const coverLetterField = await findCoverLetterField(applyPage);
    if (coverLetterField) {
      logSuccess("Cover letter field found; creating cover letter");
      const coverLetter = await createCoverLetter({ config, job });
      logStep("Saving cover letter", {
        title: job.title || "Unknown title",
        company: job.company || "Unknown company"
      });
      coverLetterPath = saveCoverLetter({ job, coverLetter });
      logSuccess("Cover letter saved", {
        path: coverLetterPath
      });

      logStep("Filling cover letter field");
      await coverLetterField.fill(coverLetter);
      logSuccess("Cover letter field filled");
    } else {
      logWarn("No cover-letter field found; skipping cover letter creation for this job");
    }

    logSuccess("Application prepared and left open", {
      url: applyPage.url()
    });

    return { handled: true, job, coverLetterPath, ...reviewSignals };
  } finally {
    if (dryRun) {
      await jobPage.close().catch(() => {});
      logSuccess("Dry-run job tab closed", { url });
    }
  }
}

async function queueJobForReview({ context, config, searchUrl, url, queuePath, reviewQueue, queuedUrls }) {
  const jobPage = await context.newPage();
  try {
    logStep("Opening job page for review queue", { searchUrl, url });
    await jobPage.goto(url, { waitUntil: "domcontentloaded" });
    await jobPage.waitForLoadState("networkidle").catch(() => {});
    await waitForHumanVerification(jobPage);

    logStep("Extracting job details", { url });
    const job = await extractJob(jobPage);
    job.url = url;
    logSuccess("Job details extracted", {
      title: job.title || "Unknown title",
      company: job.company || "Unknown company",
      location: job.location || "Unknown location"
    });

    logStep("Scoring job match", { url });
    const match = await scoreJobMatch({ config, job });
    logSuccess("Job match scored", {
      score: normalizeScore(match.score)
    });

    logStep("Checking job red flags", { url });
    const redFlags = await detectRedFlags({ config, job });
    logSuccess("Red flag check complete", {
      riskLevel: redFlags.riskLevel || "low",
      redFlagCount: Array.isArray(redFlags.redFlags) ? redFlags.redFlags.length : 0
    });

    const coverLetter = await createCoverLetter({ config, job });
    const coverLetterPath = saveCoverLetter({ job, coverLetter });
    const item = {
      id: createQueueId(job, url),
      status: "ready",
      url,
      searchUrl,
      title: job.title || "Untitled",
      company: job.company || "",
      location: job.location || "",
      description: job.description || "",
      jobSummary: summarizeJobForReview(job),
      matchScore: normalizeScore(match.score),
      match,
      redFlags,
      coverLetterPath,
      coverLetterText: coverLetter,
      evidencePoints: getResumeEvidencePoints(config),
      aiEvidence: createAIEvidence(config),
      screeningAnswers: [],
      createdAt: new Date().toISOString()
    };

    reviewQueue.push(item);
    queuedUrls.add(url);
    writeJsonFile(queuePath, reviewQueue);
    logSuccess("Job queued for review", {
      title: item.title,
      company: item.company,
      score: item.matchScore
    });
    return { handled: true, queued: true, job, coverLetterPath };
  } finally {
    await jobPage.close().catch(() => {});
  }
}

async function applyQueuedJob({ context, config, queuePath, queueId, handledPath, handledApplications, handledUrls }) {
  const queue = readJsonFile(queuePath, []);
  const item = queue.find((entry) => entry.id === queueId);
  if (!item) {
    logWarn("Queued job not found", { queueId });
    return;
  }
  if (item.status === "skipped") {
    logWarn("Queued job was skipped; not applying", { queueId });
    return;
  }
  if (handledUrls.has(item.url)) {
    logWarn("Queued job was already handled", { url: item.url });
    updateQueuedItem(queuePath, queueId, { status: "already_handled", updatedAt: new Date().toISOString() });
    return;
  }

  updateQueuedItem(queuePath, queueId, { status: "applying", updatedAt: new Date().toISOString() });

  const job = {
    title: item.title,
    company: item.company,
    location: item.location,
    description: item.description || "",
    url: item.url
  };

  const jobPage = await context.newPage();
  let coverLetterPath = item.coverLetterPath || null;
  try {
    logStep("Opening queued job", { url: item.url });
    await jobPage.goto(item.url, { waitUntil: "domcontentloaded" });
    await jobPage.waitForLoadState("networkidle").catch(() => {});
    await waitForHumanVerification(jobPage);

    if (await isAlreadyAppliedPage(jobPage)) {
      logWarn("Queued job already appears applied", { url: item.url });
      handledApplications.push(createHandledApplication(item, "already_applied"));
      writeJsonFile(handledPath, handledApplications);
      updateQueuedItem(queuePath, queueId, { status: "already_applied", handledAt: new Date().toISOString() });
      return;
    }

    logStep("Opening apply flow for queued job", { url: item.url });
    const applyPage = await openApplyPage(jobPage, context);
    if (!applyPage) {
      logWarn("Could not find apply button/link for queued job", { url: item.url });
      updateQueuedItem(queuePath, queueId, { status: "needs_review", updatedAt: new Date().toISOString() });
      return;
    }

    const signedIn = await waitForSignInIfNeeded(applyPage);
    if (!signedIn) {
      logWarn("Still on sign-in page; queued job not marked handled", { url: item.url });
      updateQueuedItem(queuePath, queueId, { status: "needs_login", updatedAt: new Date().toISOString() });
      return;
    }

    await fillApplicationBasics(applyPage, config);

    const coverLetterField = await findCoverLetterField(applyPage);
    if (coverLetterField) {
      const coverLetter = readQueuedCoverLetter(item) || await createCoverLetter({ config, job });
      if (!coverLetterPath) coverLetterPath = saveCoverLetter({ job, coverLetter });
      await coverLetterField.fill(coverLetter);
      logSuccess("Queued cover letter filled", { path: coverLetterPath });
    } else {
      logWarn("No cover-letter field found for queued job");
    }

    handledApplications.push(createHandledApplication({ ...item, coverLetterPath }, "prepared"));
    writeJsonFile(handledPath, handledApplications);
    updateQueuedItem(queuePath, queueId, {
      status: "prepared",
      coverLetterPath,
      handledAt: new Date().toISOString()
    });
    logSuccess("Queued application prepared and left open", { url: applyPage.url() });

    if (config.reviewBeforeApply ?? config.pauseBeforeSubmit ?? true) {
      await waitForBatchReview(context, 1);
    }
  } finally {
    await jobPage.close().catch(() => {});
  }
}

function updateQueuedItem(queuePath, queueId, updates) {
  const queue = readJsonFile(queuePath, []);
  const index = queue.findIndex((entry) => entry.id === queueId);
  if (index === -1) return null;
  queue[index] = { ...queue[index], ...updates };
  writeJsonFile(queuePath, queue);
  return queue[index];
}

function createHandledApplication(item, status) {
  return {
    url: item.url,
    searchUrl: item.searchUrl || "",
    title: item.title || "Untitled",
    company: item.company || "",
    location: item.location || "",
    coverLetterPath: item.coverLetterPath || null,
    status,
    jobSummary: item.jobSummary || summarizeJobForReview(item),
    fitScore: item.matchScore ?? null,
    redFlags: item.redFlags?.redFlags || item.redFlags || [],
    screeningAnswers: item.screeningAnswers || [],
    evidencePoints: item.evidencePoints || item.aiEvidence?.resumePoints || [],
    aiEvidence: item.aiEvidence || { resumePoints: item.evidencePoints || [] },
    handledAt: new Date().toISOString(),
    dryRun: false
  };
}

function readQueuedCoverLetter(item) {
  if (item.coverLetterText) return item.coverLetterText;
  if (!item.coverLetterPath) return "";
  const sourcePath = path.isAbsolute(item.coverLetterPath)
    ? item.coverLetterPath
    : path.resolve(process.cwd(), item.coverLetterPath);
  if (!fs.existsSync(sourcePath)) return "";
  return fs.readFileSync(sourcePath, "utf8");
}

function createQueueId(job, url) {
  const raw = `${Date.now()}-${job.company || "company"}-${job.title || "role"}-${url}`;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
}

function normalizeScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(Math.round(number), 0), 100);
}

async function collectJobUrls(page) {
  await page.waitForTimeout(1500);
  const urls = await page.evaluate(({ linkSelector, jobPathSource }) => {
    const jobPath = new RegExp(jobPathSource);
    return Array.from(document.querySelectorAll(linkSelector))
      .map((anchor) => anchor.href)
      .filter((href) => jobPath.test(href));
  }, {
    linkSelector: SEEK_SELECTORS.jobLinks,
    jobPathSource: SEEK_TEXT.jobPath.source
  });

  const normalized = urls
    .map((href) => {
      const url = new URL(href);
      return `${url.origin}${url.pathname}`;
    })
    .filter((href) => SEEK_TEXT.seekHost.test(new URL(href).hostname));

  return [...new Set(normalized)];
}

async function waitForHumanVerification(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const needsVerification = SEEK_TEXT.humanVerification.test(`${title}\n${bodyText}`);

  if (!needsVerification) return;

  logWarn("SEEK is asking for human verification");
  logStep("Complete the check in the browser window, then press Enter here to continue");
  await page.bringToFront().catch(() => {});

  const rl = readline.createInterface({ input, output });
  await rl.question("");
  rl.close();

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  logSuccess("Human verification complete");
}

async function extractJob(page) {
  const title = await getFirstText(page, SEEK_SELECTORS.jobDetail.title);
  const company = await getFirstText(page, SEEK_SELECTORS.jobDetail.company);
  const description = await getFirstText(page, SEEK_SELECTORS.jobDetail.description);
  const location = await getFirstText(page, SEEK_SELECTORS.jobDetail.location);

  return { title, company, location, description };
}

async function openApplyPage(page, context) {
  const applyControl =
    (await firstVisibleLocator(page, [
      page.getByRole("link", { name: SEEK_TEXT.applyControlName }),
      page.getByRole("button", { name: SEEK_TEXT.applyControlName }),
      ...SEEK_SELECTORS.applyControls.map((selector) => page.locator(selector))
    ])) || null;

  if (!applyControl) return null;

  const beforeUrl = page.url();
  const newPagePromise = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
  const navigationPromise = page
    .waitForURL((url) => url.toString() !== beforeUrl, { timeout: 10000 })
    .catch(() => null);

  await applyControl.click();

  const newPage = await newPagePromise;
  await navigationPromise;
  const applyPage = newPage || page;
  await applyPage.waitForLoadState("domcontentloaded").catch(() => {});
  await applyPage.waitForLoadState("networkidle").catch(() => {});
  return applyPage;
}

async function fillApplicationBasics(page, config) {
  logStep("Reading apply page", {
    url: page.url()
  });

  await fillApplicantField(page, "first name", ["first name", "given name"], firstName(config.name || config.applicant?.name));
  await fillApplicantField(page, "last name", ["last name", "family name", "surname"], lastName(config.name || config.applicant?.name));
  await fillApplicantField(page, "email", ["email"], config.email || config.applicant?.email);
  await fillApplicantField(page, "phone", ["phone", "mobile"], config.phone || config.applicant?.phone);

  logStep("Attaching resume", {
    resumePath: config.resumePath
  });
  const uploaded = await attachResume(page, config.resumePath);
  if (uploaded) {
    logSuccess("Resume attached");
  } else {
    logWarn("No resume upload field found");
  }
}

async function waitForSignInIfNeeded(page) {
  logStep("Checking SEEK sign-in state", {
    url: page.url()
  });
  if (!(await isSignInPage(page))) {
    logSuccess("Already signed in");
    return true;
  }

  logWarn("SEEK requires sign-in before applying");
  logStep("Sign in in the browser window, then press Enter here to continue filling the application");
  await page.bringToFront().catch(() => {});

  const rl = readline.createInterface({ input, output });
  await rl.question("");
  rl.close();

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await waitForHumanVerification(page);

  const signedIn = !(await isSignInPage(page));
  if (signedIn) {
    logSuccess("SEEK sign-in complete");
  } else {
    logWarn("SEEK sign-in still required");
  }
  return signedIn;
}

async function isSignInPage(page) {
  const url = page.url();
  if (SEEK_TEXT.signInUrl.test(url)) return true;

  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return SEEK_TEXT.signInPage.test(`${title}\n${bodyText}`);
}

async function isAlreadyAppliedPage(page) {
  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return SEEK_TEXT.alreadyApplied.test(text);
}

async function attachResume(page, resumePath) {
  const fileInputs = await page.locator(SEEK_SELECTORS.resumeUploadInput).all();
  for (const inputLocator of fileInputs) {
    try {
      await inputLocator.setInputFiles(resumePath);
      return true;
    } catch {
      // Some hidden upload controls are not wired until their button is clicked.
    }
  }

  const uploadButton = await firstVisibleLocator(page, [
    page.getByRole("button", { name: SEEK_TEXT.resumeUploadControlName }),
    page.getByRole("link", { name: SEEK_TEXT.resumeUploadControlName })
  ]);
  if (uploadButton) {
    await uploadButton.click().catch(() => {});
    await page.waitForTimeout(1000);
    const retryInputs = await page.locator(SEEK_SELECTORS.resumeUploadInput).all();
    for (const inputLocator of retryInputs) {
      try {
        await inputLocator.setInputFiles(resumePath);
        return true;
      } catch {
        // Continue trying any remaining upload fields.
      }
    }
  }

  return false;
}

async function findCoverLetterField(page) {
  for (const selector of SEEK_SELECTORS.coverLetterFields) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) && (await locator.isVisible().catch(() => false))) {
      return locator;
    }
  }

  const editable = page.locator(SEEK_SELECTORS.editableField).first();
  if ((await editable.count()) && (await editable.isVisible().catch(() => false))) {
    return editable;
  }

  return null;
}

async function fillInputByLabels(page, labels, value) {
  if (!value) return false;
  for (const label of labels) {
    const locator = page.getByLabel(new RegExp(label, "i")).first();
    if ((await locator.count()) && (await locator.isVisible().catch(() => false))) {
      await locator.fill(value);
      return true;
    }
  }
  return false;
}

async function fillApplicantField(page, fieldName, labels, value) {
  if (!value) {
    logWarn("Skipping applicant field; no value configured", {
      field: fieldName
    });
    return false;
  }

  logStep("Filling applicant field", {
    field: fieldName
  });
  const filled = await fillInputByLabels(page, labels, value);
  if (filled) {
    logSuccess("Applicant field filled", {
      field: fieldName
    });
  } else {
    logWarn("Applicant field not found", {
      field: fieldName
    });
  }
  return filled;
}

async function getFirstText(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) && (await locator.isVisible().catch(() => false))) {
      const text = await locator.innerText().catch(() => "");
      if (text.trim()) return text.trim();
    }
  }
  return "";
}

async function firstVisibleLocator(page, locators) {
  for (const locator of locators) {
    if ((await locator.count().catch(() => 0)) > 0) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }
  }
  return null;
}

async function waitForBatchReview(context, totalHandled) {
  logSuccess("Prepared application tabs", {
    count: totalHandled
  });
  logStep("The script will not click the final submit/apply button");
  logStep("Review and submit the open tabs in the browser");
  logStep("Press Enter here when you are finished to close the browser");
  const pages = context.pages();
  await pages.at(-1)?.bringToFront().catch(() => {});
  const rl = readline.createInterface({ input, output });
  await rl.question("");
  rl.close();
}

function firstName(name = "") {
  return name.trim().split(/\s+/).slice(0, -1).join(" ") || name.trim();
}

function lastName(name = "") {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.at(-1) : "";
}
