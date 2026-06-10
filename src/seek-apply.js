import path from "node:path";
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
import { createCoverLetter, saveCoverLetter } from "./cover-letter.js";
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
const dataDir = process.env.USER_DATA_DIR || "data";
const handledPath = path.join(dataDir, "handled-applications.json");
const handledApplications = readJsonFile(handledPath, []);
const handledUrls = new Set(handledApplications.map((item) => item.url));
let dailyApplicationsToday = countApplicationsForDate(handledApplications, getLocalDateKey());
const requestedRunLimit = normalizeApplicationLimit(config.maxApplications);
const availableToday = Math.max(DAILY_APPLICATION_LIMIT - dailyApplicationsToday, 0);
const runApplicationLimit = Math.min(requestedRunLimit, availableToday);

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
  slowMo: config.slowMoMs
});
logSuccess("Browser launched");

try {
  const page = context.pages()[0] || (await context.newPage());
  const searchUrls = buildSearchUrls(config);
  let totalHandled = 0;
  let totalApplicationsPrepared = 0;
  let blocked = false;

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

      if (handledUrls.has(url)) {
        logStep("Skipping already handled job", { url });
        continue;
      }

      searchAttempted += 1;
      let result;
      try {
        result = await handleJob({ context, config, dryRun, searchUrl, url });
      } catch (error) {
        logError("Job failed; continuing to next job", error);
        continue;
      }

      if (result.blocked) {
        blocked = true;
        break;
      }

      if (!result.handled) continue;

      handledApplications.push({
        url,
        searchUrl,
        title: result.job.title,
        company: result.job.company,
        coverLetterPath: result.coverLetterPath,
        status: result.status || "prepared",
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
  if (!dryRun && (config.reviewBeforeApply ?? config.pauseBeforeSubmit ?? true) && totalHandled > 0) {
    await waitForBatchReview(context, totalHandled);
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
      return { handled: true, job, coverLetterPath };
    }

    if (await isAlreadyAppliedPage(jobPage)) {
      logWarn("Job appears to be already applied on SEEK; marking handled without creating cover letter", {
        url
      });
      await jobPage.close().catch(() => {});
      return { handled: true, job, coverLetterPath: null, status: "already_applied" };
    }

    logStep("Opening apply flow", { url });
    const applyPage = await openApplyPage(jobPage, context);
    if (!applyPage) {
      if (await isAlreadyAppliedPage(jobPage)) {
        logWarn("No apply control because job appears already applied; marking handled", {
          url
        });
        await jobPage.close().catch(() => {});
        return { handled: true, job, coverLetterPath: null, status: "already_applied" };
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
      return { handled: true, job, coverLetterPath: null, status: "already_applied" };
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

    return { handled: true, job, coverLetterPath };
  } finally {
    if (dryRun) {
      await jobPage.close().catch(() => {});
      logSuccess("Dry-run job tab closed", { url });
    }
  }
}

async function collectJobUrls(page) {
  await page.waitForTimeout(1500);
  const urls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => anchor.href)
      .filter((href) => /\/job\/\d+/.test(href));
  });

  const normalized = urls
    .map((href) => {
      const url = new URL(href);
      return `${url.origin}${url.pathname}`;
    })
    .filter((href) => new URL(href).hostname.includes("seek.com"));

  return [...new Set(normalized)];
}

async function waitForHumanVerification(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const needsVerification = /just a moment|confirm you are human/i.test(`${title}\n${bodyText}`);

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
  const title = await getFirstText(page, [
    "h1",
    '[data-automation="job-detail-title"]',
    '[data-automation="job-title"]'
  ]);

  const company = await getFirstText(page, [
    '[data-automation="advertiser-name"]',
    '[data-automation="company-name"]',
    'a[href*="/companies/"]'
  ]);

  const description = await getFirstText(page, [
    '[data-automation="jobAdDetails"]',
    '[data-automation="jobDescription"]',
    "article",
    "main"
  ]);

  return { title, company, description };
}

async function openApplyPage(page, context) {
  const applyControl =
    (await firstVisibleLocator(page, [
      page.getByRole("link", { name: /^apply/i }),
      page.getByRole("button", { name: /^apply/i }),
      page.locator('a[href*="apply"]'),
      page.locator('button:has-text("Apply")')
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
  if (/login\.seek\.com|\/oauth\/login|#\/login/i.test(url)) return true;

  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /sign in to seek|sign in.*apply|email.*password/i.test(`${title}\n${bodyText}`);
}

async function isAlreadyAppliedPage(page) {
  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /\balready applied\b|\byou applied\b|\bapplication submitted\b|\byour application has been submitted\b/i.test(
    text
  );
}

async function attachResume(page, resumePath) {
  const fileInputs = await page.locator('input[type="file"]').all();
  for (const inputLocator of fileInputs) {
    try {
      await inputLocator.setInputFiles(resumePath);
      return true;
    } catch {
      // Some hidden upload controls are not wired until their button is clicked.
    }
  }

  const uploadButton = await firstVisibleLocator(page, [
    page.getByRole("button", { name: /resume|upload|attach/i }),
    page.getByRole("link", { name: /resume|upload|attach/i })
  ]);
  if (uploadButton) {
    await uploadButton.click().catch(() => {});
    await page.waitForTimeout(1000);
    const retryInputs = await page.locator('input[type="file"]').all();
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
  const selectors = [
    'textarea[name*="cover" i]',
    'textarea[id*="cover" i]',
    'textarea[aria-label*="cover" i]',
    'textarea[placeholder*="cover" i]',
    'textarea[name*="message" i]',
    'textarea[aria-label*="message" i]',
    "textarea"
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) && (await locator.isVisible().catch(() => false))) {
      return locator;
    }
  }

  const editable = page.locator('[contenteditable="true"]').first();
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
