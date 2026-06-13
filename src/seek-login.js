import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";
import { loadConfig } from "./automation/config.js";
import { needsHumanVerification, validateSeekSession } from "./automation/seek-session.js";

const config = loadConfig();
const checkOnly = process.argv.includes("--check-only");
const desktopLogin = process.env.SEEK_ASSISTANT_DESKTOP_LOGIN === "1";
const DESKTOP_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const slowMoMs = Math.max(Number(config.slowMoMs) || 0, 0);

const context = await chromium.launchPersistentContext(config.browserProfileDir, {
  headless: false,
  slowMo: slowMoMs
});

const page = context.pages()[0] || (await context.newPage());
let validation;

try {
  if (checkOnly) {
    console.log("Checking saved SEEK login session...");
    validation = await validateSeekSession(page, config);
  } else {
    const loginUrl = new URL("/oauth/login", config.seekBaseUrl || "https://www.seek.com.au").toString();
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    const verified = await waitForHumanVerification(page, context);

    if (!verified) {
      validation = {
        success: false,
        message: "SEEK login window was closed before the session was saved."
      };
    } else {
      console.log("Log in to SEEK in the browser window.");
      if (desktopLogin) {
        console.log("The app will continue automatically after SEEK confirms you are signed in.");
        validation = await waitForValidatedSession(page, context, config);
      } else {
        console.log("When you are finished, return here and press Enter.");

        const continued = await waitForContinueOrBrowserClose(page, context);
        if (!continued) {
          validation = {
            success: false,
            message: "SEEK login window was closed before the session was saved."
          };
        } else {
          validation = await validateSeekSession(page, config);
          if (validation.reason === "human_verification") {
            const humanVerified = await waitForHumanVerification(page, context);
            validation = humanVerified
              ? await validateSeekSession(page, config)
              : {
                  success: false,
                  message: "SEEK login window was closed before the session was saved."
                };
          }
        }
      }
    }
  }
} catch (error) {
  validation = {
    success: false,
    message: `SEEK login could not be validated: ${error.message}`
  };
}

await closeBrowserContext(context);

if (validation.success) {
  console.log("SEEK browser session validated and saved.");
} else {
  console.error(validation.message);
  process.exitCode = 1;
}

async function waitForHumanVerification(page, context) {
  if (!(await needsHumanVerification(page))) return true;

  console.log("SEEK is asking for human verification.");
  console.log(desktopLogin
    ? "Complete the check in the browser window. The app will continue automatically."
    : "Complete the check in the browser window, then press Enter here to continue.");
  await page.bringToFront().catch(() => {});

  if (desktopLogin) {
    while (await needsHumanVerification(page)) {
      const stillOpen = await waitForDelayOrBrowserClose(page, context, 2000);
      if (!stillOpen) return false;
    }
    return true;
  }

  return waitForContinueOrBrowserClose(page, context);
}

async function waitForValidatedSession(page, context, config) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < DESKTOP_LOGIN_TIMEOUT_MS) {
    if (typeof page.isClosed === "function" && page.isClosed()) {
      return validateSavedSessionAfterWindowClose(context, config);
    }

    const validation = await validateSeekSession(page, config, { navigate: false });
    if (validation.success) return validation;

    if (validation.reason === "human_verification") {
      const humanVerified = await waitForHumanVerification(page, context);
      if (!humanVerified) {
        return {
          success: false,
          message: "SEEK login window was closed before sign-in completed."
        };
      }
    }

    const stillOpen = await waitForDelayOrBrowserClose(page, context, 2000);
    if (!stillOpen) {
      return validateSavedSessionAfterWindowClose(context, config);
    }
  }

  return {
    success: false,
    message: "SEEK login timed out before sign-in completed. Reopen SEEK login and try again."
  };
}

async function validateSavedSessionAfterWindowClose(currentContext, config) {
  await closeBrowserContext(currentContext);

  const checkContext = await chromium.launchPersistentContext(config.browserProfileDir, {
    headless: true,
    slowMo: config.slowMoMs
  });

  try {
    const checkPage = checkContext.pages()[0] || (await checkContext.newPage());
    const validation = await validateSeekSession(checkPage, config);
    if (validation.success) return validation;

    return {
      success: false,
      message: "SEEK login window closed before the app could validate sign-in. Reopen SEEK Login and try again."
    };
  } finally {
    await closeBrowserContext(checkContext);
  }
}

async function closeBrowserContext(contextToClose) {
  const pages = contextToClose.pages?.() || [];
  await Promise.all(pages.map((openPage) => openPage.close().catch(() => {})));
  await contextToClose.close().catch(() => {});
}

async function waitForDelayOrBrowserClose(page, context, delayMs) {
  let timer;
  let done;

  const delay = new Promise((resolve) => {
    timer = setTimeout(() => resolve("delay"), delayMs);
  });
  const closed = new Promise((resolve) => {
    done = () => resolve("closed");
    page.once("close", done);
    context.once("close", done);
  });

  const result = await Promise.race([delay, closed]);
  clearTimeout(timer);
  page.off("close", done);
  context.off("close", done);
  return result !== "closed";
}

async function waitForContinueOrBrowserClose(page, context) {
  if (typeof page.isClosed === "function" && page.isClosed()) return false;

  const rl = readline.createInterface({ input, output });
  const answer = rl.question("").then(() => "continue").catch(() => "closed");
  const closed = new Promise((resolve) => {
    const done = () => resolve("closed");
    page.once("close", done);
    context.once("close", done);
  });

  const result = await Promise.race([answer, closed]);
  rl.close();
  return result === "continue";
}
