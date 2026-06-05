export async function validateSeekSession(page, config, options = {}) {
  const { navigate = true } = options;

  if (navigate) {
    const baseUrl = config.seekBaseUrl || "https://www.seek.com.au";
    const loginUrl = new URL("/oauth/login", baseUrl).toString();

    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);
  }

  if (await needsHumanVerification(page)) {
    return {
      success: false,
      reason: "human_verification",
      message: "SEEK is asking for human verification. Complete it in the browser to continue."
    };
  }

  if (await isSignInPage(page)) {
    return {
      success: false,
      reason: "signed_out",
      message: "SEEK still shows the sign-in page. Finish signing in to continue."
    };
  }

  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const accountSignal = /profile|saved jobs|applied jobs|my activity|recommended jobs|account settings|visibility|resume|resumé/i.test(bodyText);

  if (!accountSignal) {
    return {
      success: false,
      reason: "uncertain",
      message: "Could not confirm that SEEK is signed in. Open SEEK login and try again."
    };
  }

  return {
    success: true,
    reason: "validated",
    message: "SEEK login session validated."
  };
}

export async function needsHumanVerification(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /just a moment|confirm you are human/i.test(`${title}\n${bodyText}`);
}

export async function isSignInPage(page) {
  const url = page.url();
  if (/login\.seek\.com|\/oauth\/login|\/sign-in|#\/login/i.test(url)) return true;

  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /sign in to seek|sign in.*apply|email.*password|create an account/i.test(`${title}\n${bodyText}`);
}
