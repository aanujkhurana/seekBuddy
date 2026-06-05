import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";
import { loadConfig } from "./automation/config.js";

const config = loadConfig();

const context = await chromium.launchPersistentContext(config.browserProfileDir, {
  headless: false,
  slowMo: config.slowMoMs
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(config.seekBaseUrl, { waitUntil: "domcontentloaded" });
await waitForHumanVerification(page);

console.log("Log in to SEEK in the browser window.");
console.log("When you are finished, return here and press Enter.");

const rl = readline.createInterface({ input, output });
await rl.question("");
rl.close();

await context.close();
console.log("SEEK browser session saved.");

async function waitForHumanVerification(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const needsVerification = /just a moment|confirm you are human/i.test(`${title}\n${bodyText}`);

  if (!needsVerification) return;

  console.log("SEEK is asking for human verification.");
  console.log("Complete the check in the browser window, then press Enter here to continue.");
  await page.bringToFront().catch(() => {});

  const rl = readline.createInterface({ input, output });
  await rl.question("");
  rl.close();
}
