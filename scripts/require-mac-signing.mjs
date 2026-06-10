import { execFileSync } from "node:child_process";
import fs from "node:fs";

const allowUnsigned = process.env.ALLOW_UNSIGNED_MAC_BUILD === "1";

if (allowUnsigned) {
  console.warn("[WARN] Building unsigned macOS app. Use only for local testing, not sharing.");
  process.exit(0);
}

const missing = [];

if (!process.env.CSC_LINK && !process.env.CSC_NAME) {
  let identities = "";
  try {
    identities = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], {
      encoding: "utf8"
    });
  } catch {
    identities = "";
  }

  if (!/Developer ID Application:/i.test(identities)) {
    missing.push("CSC_LINK or a keychain Developer ID Application certificate");
  }
}

if (process.env.CSC_LINK && /^[/.~]/.test(process.env.CSC_LINK)) {
  const certPath = process.env.CSC_LINK.replace(/^~/, process.env.HOME || "");
  if (!fs.existsSync(certPath)) {
    missing.push(`CSC_LINK file does not exist: ${process.env.CSC_LINK}`);
  }
}

if (!process.env.CSC_KEY_PASSWORD && process.env.CSC_LINK) {
  missing.push("CSC_KEY_PASSWORD");
}

if (!process.env.APPLE_ID) missing.push("APPLE_ID");
if (!process.env.APPLE_APP_SPECIFIC_PASSWORD) missing.push("APPLE_APP_SPECIFIC_PASSWORD");
if (!process.env.APPLE_TEAM_ID) missing.push("APPLE_TEAM_ID");

if (missing.length) {
  console.error([
    "",
    "Cannot build a shareable macOS DMG without Developer ID signing and notarization.",
    "",
    "Unsigned or unnotarized DMGs may open on this Mac, but AirDrop/downloaded copies",
    "can show: \"App is damaged/corrupted and cannot be opened. Move to Bin.\"",
    "",
    "Missing:",
    ...missing.map((item) => `- ${item}`),
    "",
    "Fix:",
    "1. Create/export a Developer ID Application .p12 certificate.",
    "2. Create an Apple app-specific password.",
    "3. Export these env vars before building:",
    "   export CSC_LINK=\"/path/to/DeveloperIDApplication.p12\"",
    "   export CSC_KEY_PASSWORD=\"your-p12-password\"",
    "   export APPLE_ID=\"your-apple-id@email.com\"",
    "   export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\"",
    "   export APPLE_TEAM_ID=\"YOUR_TEAM_ID\"",
    "4. Run: npm run build:mac",
    "",
    "For local-only testing, run: npm run build:mac:unsigned",
    ""
  ].join("\n"));
  process.exit(1);
}
