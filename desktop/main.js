import { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } from "electron";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
import zlib from "zlib";
import { DEFAULTS, encryptKey as fallbackEncrypt, decryptKey as fallbackDecrypt } from "./config-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

let mainWindow;
let runningProcess = null;
let loginProcess = null;
let loginSessionValidated = false;
let runningStopTimer = null;
let runningStopFallbackTimer = null;
let runningStopRequested = false;

function getUserDataPath() {
  const dir = path.join(app.getPath("userData"), "seek-apply-assistant");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    title: "Seek Apply Assistant",
    icon: path.join(ROOT, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function sendAutomationProgress(stage, message, details = {}) {
  send("automation-progress", {
    stage,
    message,
    at: new Date().toISOString(),
    ...details
  });
}

function inspectAutomationOutput(text) {
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.includes("[ERROR]") || line.includes("[CRASH]")) {
      sendAutomationProgress("error", "Automation hit an error. Check logs for details.");
      continue;
    }
    if (/Browser launched/i.test(line)) {
      sendAutomationProgress("browser_ready", "Browser ready.");
    } else if (/Opening SEEK search/i.test(line)) {
      sendAutomationProgress("search_opened", "SEEK search opened.");
    } else if (/Search complete/i.test(line)) {
      sendAutomationProgress("jobs_found", "Jobs found for this search.");
    } else if (/Opening job page|Opening apply flow|Filling application|Application prepared|Prepared application tabs/i.test(line)) {
      sendAutomationProgress("reviewing", "Preparing an application for review.");
    } else if (/Apply run complete/i.test(line)) {
      sendAutomationProgress("completed", "Run completed.");
    } else if (/Automation stopped by user|Stopping safely/i.test(line)) {
      sendAutomationProgress("stopped", "Stopping after the current safe point.");
    }
  }
}

function spawnScript(scriptRelPath, env, args = []) {
  const scriptPath = path.join(ROOT, scriptRelPath);
  return spawn(process.execPath, [scriptPath, ...args], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      USER_DATA_DIR: getUserDataPath(),
      PLAYWRIGHT_BROWSERS_PATH: getPlaywrightCacheDir(),
      ...env
    }
  });
}

function getPlaywrightBrowsersPath() {
  return path.join(getUserDataPath(), "playwright-browsers");
}

function getBundledBrowsersPath() {
  // In packaged app, extraResources copies build/bundled-browsers → Resources/bundled-browsers
  // In dev mode, look in the project's build/ directory
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bundled-browsers");
  }
  return path.join(ROOT, "build", "bundled-browsers");
}

function getPlaywrightCacheDir() {
  // Priority order: bundled with app → app-managed user data → system cache → default to app path
  const bundledPath = getBundledBrowsersPath();
  if (fs.existsSync(bundledPath)) return bundledPath;

  const appPath = getPlaywrightBrowsersPath();
  if (fs.existsSync(appPath)) return appPath;

  const home = os.homedir();
  const defaultCache = process.platform === "darwin"
    ? path.join(home, "Library", "Caches", "ms-playwright")
    : process.platform === "win32"
      ? path.join(process.env.USERPROFILE || home, "AppData", "Local", "ms-playwright")
      : path.join(home, ".cache", "ms-playwright");
  if (fs.existsSync(defaultCache)) return defaultCache;

  return appPath; // default to app path for installation
}

function browsersInstalled() {
  const cacheDir = getPlaywrightCacheDir();
  if (!fs.existsSync(cacheDir)) return false;
  try {
    const entries = fs.readdirSync(cacheDir);
    return entries.some((e) => e.startsWith("chromium"));
  } catch {
    return false;
  }
}

async function promptInstallBrowsers() {
  if (browsersInstalled()) return;

  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Playwright Browser Required",
    message: "This app needs the Chromium browser engine to automate SEEK.",
    detail: "Would you like to download and install it now? (Requires internet. ~150 MB.)",
    buttons: ["Install Chromium", "Later"],
    defaultId: 0,
    cancelId: 1
  });

  if (result.response !== 0) return;

  send("automation-log", "[INFO] Installing Playwright Chromium...\n");

  return new Promise((resolve) => {
    const playwrightCli = path.join(ROOT, "node_modules", "playwright", "cli.js");
    const proc = spawn(process.execPath, [playwrightCli, "install", "chromium"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PLAYWRIGHT_BROWSERS_PATH: getPlaywrightBrowsersPath()
      }
    });

    // Timeout after 5 minutes (browser download can be large)
    const timeout = setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        send("automation-log", "[ERROR] Browser installation timed out after 5 minutes.\n");
        dialog.showErrorBox("Installation Timed Out", "Browser download took too long. Check your internet connection and try again from Settings.");
        resolve();
      }
    }, 300000);

    proc.stdout.on("data", (data) => send("automation-log", data.toString()));
    proc.stderr.on("data", (data) => send("automation-log", data.toString()));

    proc.on("error", (err) => {
      clearTimeout(timeout);
      send("automation-log", `[ERROR] Failed to start browser installation: ${err.message}\n`);
      dialog.showErrorBox("Installation Failed", "Could not start the browser installer. Please re-install the app.");
      resolve();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        send("automation-log", "[OK] Playwright Chromium installed.\n");
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Installation Complete",
          message: "Chromium browser engine installed successfully."
        });
      } else {
        send("automation-log", `[ERROR] Installation failed (code ${code}).\n`);
        dialog.showErrorBox("Installation Failed", "Could not install Chromium. Check your internet connection and try again from Settings.");
      }
      resolve();
    });
  });
}

app.whenReady().then(async () => {
  createWindow();
  if (!browsersInstalled()) {
    await promptInstallBrowsers();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  if (runningProcess && !runningProcess.killed) runningProcess.kill();
  if (loginProcess && !loginProcess.killed) loginProcess.kill();
});

// ---- Crash logging ----

function logCrashToFile(error, type) {
  try {
    const crashDir = getUserDataPath();
    const crashPath = path.join(crashDir, "crash-log.json");
    let crashes = [];
    if (fs.existsSync(crashPath)) {
      crashes = JSON.parse(fs.readFileSync(crashPath, "utf8"));
    }
    crashes.push({
      type,
      error: error?.message || String(error),
      stack: error?.stack || "",
      platform: process.platform,
      version: "1.0.0",
      createdAt: new Date().toISOString()
    });
    if (crashes.length > 20) crashes = crashes.slice(-20);
    fs.writeFileSync(crashPath, JSON.stringify(crashes, null, 2));
  } catch { /* crash during crash logging — ignore */ }
}

async function flushCrashesToBackend() {
  try {
    const crashDir = getUserDataPath();
    const crashPath = path.join(crashDir, "crash-log.json");
    if (!fs.existsSync(crashPath)) return;

    const configPath = path.join(crashDir, "config.json");
    if (!fs.existsSync(configPath)) return;
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const ai = config.ai || {};
    if (!ai.authToken) return;

    const backendUrl = ai.backendUrl || "http://localhost:3000";
    const crashes = JSON.parse(fs.readFileSync(crashPath, "utf8"));
    if (!crashes.length) return;

    const unsent = crashes.filter((c) => !c.sent);
    for (const entry of unsent) {
      try {
        const res = await fetch(`${backendUrl}/crash/report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ai.authToken}`
          },
          body: JSON.stringify({
            error: entry.error,
            stack: entry.stack,
            platform: entry.platform,
            version: entry.version
          })
        });
        if (res.ok) entry.sent = true;
      } catch { /* backend unreachable, skip */ }
    }
    fs.writeFileSync(crashPath, JSON.stringify(crashes, null, 2));
  } catch { /* silent */ }
}

process.on("uncaughtException", (error) => {
  logCrashToFile(error, "uncaughtException");
  console.error("[CRASH] Uncaught exception:", error);
  if (mainWindow && !mainWindow.isDestroyed()) {
    send("automation-log", `\n[CRASH] ${error.message}\n`);
  }
  flushCrashesToBackend().catch(() => {});
});

process.on("unhandledRejection", (reason) => {
  logCrashToFile(reason, "unhandledRejection");
  console.error("[CRASH] Unhandled rejection:", reason);
});

// ---- Config ----

function saveConfig(config) {
  const filePath = path.join(getUserDataPath(), "config.json");
  let existing = {};
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  const merged = { ...DEFAULTS, ...existing, ...config };
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
}

ipcMain.handle("save-config", async (_, config) => {
  saveConfig(config);
  return { success: true };
});

ipcMain.on("save-config-on-close", (_, config) => {
  saveConfig(config);
});

ipcMain.handle("load-config", async () => {
  const filePath = path.join(getUserDataPath(), "config.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (raw.email || raw.password) {
    raw.email = "";
    raw.password = "";
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2));
  }
  return { ...DEFAULTS, ...raw };
});

// ---- File Picker ----

ipcMain.handle("select-file", async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: options?.filters || []
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// ---- Automation ----

ipcMain.handle("start-automation", async () => {
  if (runningProcess) {
    return { success: false, message: "Automation is already running." };
  }

  // Inject BYOK API key if configured
  const extraEnv = {};
  const configPath = path.join(getUserDataPath(), "config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const ai = config.ai || {};
    if (ai.mode === "byok") {
      const ksPath = getKeyStorePath();
      if (fs.existsSync(ksPath)) {
        const encrypted = fs.readFileSync(ksPath, "utf8");
        const decrypted = decryptKey(encrypted);
        if (decrypted) {
          try {
            const store = JSON.parse(decrypted);
            extraEnv.BYOK_API_KEY = store.key || "";
          } catch { /* key corrupted, skip */ }
        }
      }
    }
  }

  send("automation-log", "[INFO] Starting automation engine...\n");
  sendAutomationProgress("starting", "Starting automation engine.");
  const proc = spawnScript("src/seek-apply.js", extraEnv);
  runningProcess = proc;
  runningStopRequested = false;
  let sawAutomationOutput = false;

  const forwardOutput = (data) => {
    sawAutomationOutput = true;
    const text = data.toString();
    inspectAutomationOutput(text);
    send("automation-log", text);
  };

  proc.on("spawn", () => {
    send("automation-log", "[INFO] Automation process launched.\n");
    sendAutomationProgress("starting", "Automation process launched.");
  });

  proc.on("error", (error) => {
    clearTimeout(startupWatchdog);
    send("automation-log", `[ERROR] Could not launch automation: ${error.message}\n`);
    sendAutomationProgress("error", "Could not launch automation.");
    send("automation-stopped");
    send("automation-status", "idle");
    if (runningProcess === proc) runningProcess = null;
  });

  const startupWatchdog = setTimeout(() => {
    if (runningProcess === proc && !sawAutomationOutput) {
      send("automation-log", "[WARN] Automation has started but has not produced logs yet. If this stays here, stop and restart the app.\n");
    }
  }, 7000);

  proc.stdout.on("data", forwardOutput);
  proc.stderr.on("data", forwardOutput);

  proc.on("close", (code) => {
    clearTimeout(startupWatchdog);
    if (runningStopTimer) clearTimeout(runningStopTimer);
    if (runningStopFallbackTimer) clearTimeout(runningStopFallbackTimer);
    runningStopTimer = null;
    runningStopFallbackTimer = null;
    send("automation-log", `[INFO] Process exited with code ${code}\n`);
    if (runningStopRequested) {
      sendAutomationProgress("stopped", "Automation stopped.");
    } else if (code === 0) {
      sendAutomationProgress("completed", "Run completed.");
    } else {
      sendAutomationProgress("error", "Automation exited before completing.");
    }
    runningStopRequested = false;
    send("automation-stopped");
    send("automation-status", "idle");
    if (runningProcess === proc) runningProcess = null;
    send("applied-jobs-updated");
  });

  send("automation-status", "running");
  return { success: true };
});

ipcMain.handle("stop-automation", async () => {
  if (!runningProcess) {
    return { success: false, message: "No automation is running." };
  }

  const proc = runningProcess;
  send("automation-status", "stopped");
  runningStopRequested = true;
  sendAutomationProgress("stopped", "Stopping automation after the current job.");
  proc.kill("SIGTERM");

  if (runningStopTimer) clearTimeout(runningStopTimer);
  if (runningStopFallbackTimer) clearTimeout(runningStopFallbackTimer);

  runningStopTimer = setTimeout(() => {
    if (runningProcess === proc) {
      send("automation-log", "[WARN] Stop is taking too long; forcing automation to close.\n");
      proc.kill("SIGKILL");
    }
  }, 3000);

  runningStopFallbackTimer = setTimeout(() => {
    if (runningProcess === proc) {
      send("automation-log", "[WARN] Automation did not confirm exit; returning app controls to idle.\n");
      runningProcess = null;
      send("automation-stopped");
      send("automation-status", "idle");
      send("applied-jobs-updated");
    }
  }, 6000);

  return { success: true };
});

ipcMain.handle("get-automation-status", async () => {
  if (runningProcess) return "running";
  return "idle";
});

// ---- Login ----

function getLoginSessionPath() {
  return path.join(getUserDataPath(), "login-session.json");
}

function hasLoginSessionMarker() {
  return fs.existsSync(getLoginSessionPath());
}

function saveLoginSessionMarker() {
  fs.writeFileSync(getLoginSessionPath(), JSON.stringify({
    validatedAt: new Date().toISOString()
  }, null, 2));
}

function clearLoginSessionMarker() {
  const sessionPath = getLoginSessionPath();
  if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
}

function updateLoginValidation(success) {
  loginSessionValidated = success;
  if (success) saveLoginSessionMarker();
  else clearLoginSessionMarker();
}

function getConfigPath() {
  return path.join(getUserDataPath(), "config.json");
}

function loadSavedConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return { ...DEFAULTS };
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath, "utf8")) };
}

function readDocxEntry(buffer, targetName) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return "";

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  for (let offset = centralDirectoryOffset; offset < centralDirectoryEnd;) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (fileName === targetName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return data.toString("utf8");
      if (compressionMethod === 8) return zlib.inflateRawSync(data).toString("utf8");
      return "";
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return "";
}

function decodeXmlText(value) {
  return String(value)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractDocxText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const documentXml = readDocxEntry(buffer, "word/document.xml");
  return decodeXmlText(documentXml);
}

function decodePdfLiteral(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractPdfText(filePath) {
  const raw = fs.readFileSync(filePath).toString("latin1");
  const textParts = [];
  const literalPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  for (const match of raw.matchAll(literalPattern)) {
    textParts.push(decodePdfLiteral(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }

  if (textParts.join(" ").trim().length < 80) {
    const readable = raw
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
      .split(/\s{2,}/)
      .map((part) => part.trim())
      .filter((part) => part.length > 3 && !/^(obj|endobj|stream|endstream|xref|trailer)$/i.test(part));
    textParts.push(...readable);
  }

  return textParts.join("\n").replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractReadableBinaryText(filePath) {
  return fs.readFileSync(filePath)
    .toString("latin1")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .split(/\s{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 3)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractResumeText(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Upload a resume before generating sample content.");
  }

  const ext = path.extname(filePath).toLowerCase();
  if ([".txt", ".md"].includes(ext)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  if (ext === ".rtf") {
    return fs.readFileSync(filePath, "utf8")
      .replace(/\\'[0-9a-f]{2}/gi, " ")
      .replace(/\\[a-z]+\d* ?/gi, " ")
      .replace(/[{}]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  if (ext === ".docx") return extractDocxText(filePath);
  if (ext === ".pdf") return extractPdfText(filePath);
  if (ext === ".doc") return extractReadableBinaryText(filePath);

  throw new Error("This resume format cannot be read yet. Upload a PDF, DOC, DOCX, TXT, or MD resume.");
}

function resolveBrowserProfileDir() {
  const config = loadSavedConfig();
  const profileDir = config.browserProfileDir || DEFAULTS.browserProfileDir;
  return path.resolve(ROOT, profileDir);
}

function clearSavedBrowserProfile() {
  const profileDir = resolveBrowserProfileDir();
  const allowedRoots = [
    path.resolve(ROOT),
    path.resolve(getUserDataPath())
  ];
  const isAllowed = allowedRoots.some((root) =>
    profileDir.startsWith(`${root}${path.sep}`)
  );

  if (!isAllowed) {
    return {
      cleared: false,
      message: "Logged out in the app, but the browser profile path is outside the app folder and was not removed."
    };
  }

  fs.rmSync(profileDir, { recursive: true, force: true });
  return { cleared: true, message: "Logged out of SEEK and cleared the saved browser session." };
}

ipcMain.handle("start-login", async () => {
  if (loginProcess && !loginProcess.killed) {
    const staleLogin = loginProcess;
    loginProcess = null;
    staleLogin.kill();
  }

  const proc = spawnScript("src/seek-login.js", { SEEK_ASSISTANT_DESKTOP_LOGIN: "1" });
  loginProcess = proc;

  proc.stdout.on("data", (data) => send("automation-log", data.toString()));
  proc.stderr.on("data", (data) => send("automation-log", data.toString()));

  proc.on("close", (code) => {
    if (loginProcess !== proc) return;
    loginProcess = null;
    const success = code === 0;
    updateLoginValidation(success);
    send("automation-log", success
      ? "[INFO] Login session validated.\n"
      : "[WARN] Login session could not be validated.\n");
    send("login-status", {
      state: success ? "validated" : "failed",
      message: success
        ? "SEEK login saved for this app session."
        : "SEEK login could not be validated. Reopen SEEK and sign in with email again."
    });
  });

  send("login-status", {
    state: "started",
    message: "SEEK login window opened. Choose email login in SEEK and sign in manually. The app will unlock automatically."
  });
  return { success: true };
});

ipcMain.handle("continue-login", async () => {
  if (loginProcess && !loginProcess.killed) {
    loginProcess.stdin.write("\n");
    return { success: true };
  }
  return { success: false, message: "No login process running." };
});

ipcMain.handle("check-login-session", async () => {
  if (loginSessionValidated) {
    return { success: true, validated: true, message: "SEEK login already validated for this app session." };
  }

  if (!hasLoginSessionMarker()) {
    return {
      success: true,
      validated: false,
      message: "No saved SEEK login session found. Open SEEK, choose email login, and sign in manually."
    };
  }

  loginSessionValidated = true;
  return {
    success: true,
    validated: true,
    message: "Logged in to SEEK. Session saved locally."
  };
});

ipcMain.handle("logout-login-session", async () => {
  if (loginProcess && !loginProcess.killed) {
    const staleLogin = loginProcess;
    loginProcess = null;
    staleLogin.kill();
  }

  loginSessionValidated = false;
  clearLoginSessionMarker();
  const result = clearSavedBrowserProfile();
  send("login-status", {
    state: "logged_out",
    message: result.message
  });
  return { success: true, message: result.message };
});

// ---- Stdin passthrough ----

ipcMain.handle("send-stdin", async (_, data) => {
  const proc = loginProcess || runningProcess;
  if (proc && !proc.killed) {
    proc.stdin.write(data);
    return { success: true };
  }
  return { success: false };
});

// ---- Applied jobs ----

ipcMain.handle("load-applied-jobs", async () => {
  const filePath = path.join(getUserDataPath(), "handled-applications.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
});

ipcMain.handle("clear-applied", async () => {
  const filePath = path.join(getUserDataPath(), "handled-applications.json");
  fs.writeFileSync(filePath, "[]");
  return { success: true, output: "Applied history cleared." };
});

ipcMain.handle("open-job-url", async (_, url) => {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { success: false, message: "Job link is not a valid web URL." };
    }
    await shell.openExternal(parsed.toString());
    return { success: true };
  } catch {
    return { success: false, message: "Could not open the original job link." };
  }
});

ipcMain.handle("open-external-link", async (_, url) => {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return { success: false, message: "This link type is not supported." };
    }
    await shell.openExternal(parsed.toString());
    return { success: true };
  } catch {
    return { success: false, message: "Could not open this link." };
  }
});

ipcMain.handle("download-cover-letter", async (_, coverLetterPath) => {
  const sourcePath = path.isAbsolute(coverLetterPath || "")
    ? coverLetterPath
    : path.resolve(ROOT, coverLetterPath || "");
  const allowedRoots = [
    path.resolve(ROOT),
    path.resolve(getUserDataPath())
  ];
  const isAllowed = allowedRoots.some((root) =>
    sourcePath === root || sourcePath.startsWith(`${root}${path.sep}`)
  );

  if (!coverLetterPath || !isAllowed || !fs.existsSync(sourcePath)) {
    return { success: false, message: "Cover letter file is not available for this job." };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Download Cover Letter",
    defaultPath: path.basename(sourcePath),
    filters: [
      { name: "Text", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, message: "Download cancelled." };
  }

  fs.copyFileSync(sourcePath, result.filePath);
  return { success: true, path: result.filePath };
});

// ---- Browser check ----

ipcMain.handle("check-browsers", async () => {
  return { installed: browsersInstalled() };
});

ipcMain.handle("install-browsers", async () => {
  // If browsers are already bundled or installed, skip the download
  if (browsersInstalled()) {
    send("automation-log", "[OK] Playwright Chromium is already installed.\n");
    return { success: true };
  }

  const prevLog = [];
  const playwrightCli = path.join(ROOT, "node_modules", "playwright", "cli.js");
  const proc = spawn(process.execPath, [playwrightCli, "install", "chromium"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PLAYWRIGHT_BROWSERS_PATH: getPlaywrightBrowsersPath()
    }
  });

  // Timeout after 5 minutes
  const timeout = setTimeout(() => {
    if (!proc.killed) {
      proc.kill();
      send("automation-log", "[ERROR] Browser installation timed out after 5 minutes.\n");
    }
  }, 300000);

  proc.stdout.on("data", (data) => {
    const msg = data.toString();
    prevLog.push(msg);
    send("automation-log", msg);
  });
  proc.stderr.on("data", (data) => {
    const msg = data.toString();
    prevLog.push(msg);
    send("automation-log", msg);
  });

  proc.on("error", (err) => {
    clearTimeout(timeout);
    send("automation-log", `[ERROR] Failed to start browser installation: ${err.message}\n`);
  });

  return new Promise((resolve) => {
    proc.on("close", (code) => {
      clearTimeout(timeout);
      const ok = code === 0;
      if (ok) send("automation-log", "[OK] Playwright Chromium installed.\n");
      else send("automation-log", `[ERROR] Installation failed (code ${code}).\n`);
      resolve({ success: ok });
    });
  });
});

// ---- Export ----

ipcMain.handle("export-jobs", async () => {
  const srcPath = path.join(getUserDataPath(), "handled-applications.json");
  if (!fs.existsSync(srcPath)) {
    return { success: false, message: "No applied jobs to export." };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Applied Jobs",
    defaultPath: `applied-jobs-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [
      { name: "CSV", extensions: ["csv"] },
      { name: "JSON", extensions: ["json"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, message: "Export cancelled." };
  }

  const jobs = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  const ext = path.extname(result.filePath).toLowerCase();

  if (ext === ".json") {
    fs.writeFileSync(result.filePath, JSON.stringify(jobs, null, 2));
  } else {
    const headers = ["Title", "Company", "Date", "Status", "URL", "CoverLetter"];
    const rows = jobs.map((j) => [
      csvEscape(j.title || ""),
      csvEscape(j.company || ""),
      j.handledAt ? new Date(j.handledAt).toISOString().slice(0, 10) : "",
      j.status || "prepared",
      csvEscape(j.url || ""),
      csvEscape(j.coverLetterPath || "")
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    fs.writeFileSync(result.filePath, csv);
  }

  return { success: true, path: result.filePath };
});

function csvEscape(val) {
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---- AI ----

function getKeyStorePath() {
  return path.join(getUserDataPath(), ".api-key.enc");
}

function encryptKey(plaintext) {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plaintext).toString("base64");
  }
  return fallbackEncrypt(plaintext);
}

function decryptKey(encoded) {
  const buf = Buffer.from(encoded, "base64");
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf);
    } catch {
    }
  }
  return fallbackDecrypt(encoded);
}

function readStoredApiKey() {
  const ksPath = getKeyStorePath();
  if (!fs.existsSync(ksPath)) return "";
  const encrypted = fs.readFileSync(ksPath, "utf8");
  const decrypted = decryptKey(encrypted);
  if (!decrypted) return "";
  try {
    return JSON.parse(decrypted).key || "";
  } catch {
    return "";
  }
}

function getConfigWithAIKey() {
  const config = loadSavedConfig();
  config.ai = { ...DEFAULTS.ai, ...(config.ai || {}) };
  if (config.ai.mode === "byok") {
    config.ai.apiKey = readStoredApiKey();
  }
  return config;
}

function getAIConfigurationMessage(config) {
  const ai = config.ai || {};
  if (ai.mode === "hosted") {
    return ai.authToken ? "" : "AI is not configured. Open Settings and connect built-in AI first.";
  }
  if (ai.mode === "byok") {
    if (!ai.apiKey) return "AI is not configured. Open Settings and save your API key first.";
    if (!ai.byokModel) return "AI is not configured. Open Settings and enter an AI model first.";
    return "";
  }
  return "AI is not configured. Open Settings and choose an AI mode first.";
}

ipcMain.handle("generate-resume-artifacts", async (_, { resumePath, target }) => {
  try {
    const config = getConfigWithAIKey();
    const aiMessage = getAIConfigurationMessage(config);
    if (aiMessage) return { success: false, message: aiMessage };

    const extractedResume = extractResumeText(resumePath);
    if (extractedResume.trim().length < 80) {
      return {
        success: false,
        message: "Could not read enough text from this resume. Try uploading a DOCX or text-based PDF resume."
      };
    }

    const { generateResumeArtifacts } = await import("../src/ai/ai-service.js");
    const generated = await generateResumeArtifacts({
      config,
      resumeText: extractedResume
    });

    return {
      success: true,
      resumeSummary: target === "summary" ? generated.resumeSummary : [],
      coverLetterPath: "",
      coverLetterPreview: target === "coverLetter" ? generated.sampleCoverLetter : ""
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || (target === "coverLetter"
        ? "Could not generate a cover letter from the resume."
        : "Could not generate a summary from the resume.")
    };
  }
});

ipcMain.handle("save-ai-config", async (_, aiConfig) => {
  const filePath = path.join(getUserDataPath(), "config.json");
  let config = {};
  if (fs.existsSync(filePath)) {
    config = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  config.ai = { ...config.ai, ...aiConfig };
  delete config.ai.apiKey;
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  return { success: true };
});

ipcMain.handle("load-ai-config", async () => {
  const filePath = path.join(getUserDataPath(), "config.json");
  if (!fs.existsSync(filePath)) {
    return { mode: "hosted", hostedModel: "budget", backendUrl: "http://localhost:3000", byokProvider: "openrouter", byokModel: "deepseek/deepseek-chat" };
  }
  const config = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const ai = config.ai || {};
  return {
    mode: ai.mode || "hosted",
    hostedModel: ai.hostedModel || "budget",
    backendUrl: ai.backendUrl || "http://localhost:3000",
    authToken: ai.authToken || "",
    userId: ai.userId || "",
    byokProvider: ai.byokProvider || "openrouter",
    byokModel: ai.byokModel || "deepseek/deepseek-chat"
  };
});

ipcMain.handle("save-api-key", async (_, { provider, key }) => {
  const store = { provider, key };
  const encrypted = encryptKey(JSON.stringify(store));
  fs.writeFileSync(getKeyStorePath(), encrypted);
  return { success: true };
});

ipcMain.handle("load-api-key", async () => {
  const ksPath = getKeyStorePath();
  if (!fs.existsSync(ksPath)) return { provider: "", key: "" };
  const encrypted = fs.readFileSync(ksPath, "utf8");
  const decrypted = decryptKey(encrypted);
  if (!decrypted) return { provider: "", key: "" };
  try {
    return JSON.parse(decrypted);
  } catch {
    return { provider: "", key: "" };
  }
});

ipcMain.handle("delete-api-key", async () => {
  const ksPath = getKeyStorePath();
  if (fs.existsSync(ksPath)) fs.unlinkSync(ksPath);
  return { success: true };
});  ipcMain.handle("register-hosted", async (_, { email, backendUrl }) => {
    try {
      const res = await fetch(`${backendUrl || "http://localhost:3000"}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || "user@seek-assistant.local" })
      });
      if (!res.ok) {
        const text = await res.text();
        return { success: false, message: `Backend registration failed (${res.status}): ${text}` };
      }
      const data = await res.json();
      return { success: true, userId: data.userId, token: data.token };
    } catch (err) {
      return { success: false, message: `Cannot reach backend: ${err.message}` };
    }
  });

  ipcMain.handle("test-ai-connection", async () => {
  const configPath = path.join(getUserDataPath(), "config.json");
  if (!fs.existsSync(configPath)) {
    return { success: false, message: "No config found. Please save settings first." };
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const ai = config.ai || {};

  if (ai.mode === "hosted") {
    const fullConfig = { ai };
    try {
      const { createAIClient } = await import("../src/ai/ai-client.js");
      const client = createAIClient(fullConfig);
      if (typeof client.testConnection === "function") {
        return await client.testConnection();
      }
      return { success: false, message: "This provider does not support connection testing." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // BYOK mode — read encrypted key from keystore
  const ksPath = getKeyStorePath();
  if (!fs.existsSync(ksPath)) {
    return { success: false, message: "No API key saved. Please save AI settings with a key first." };
  }
  const encrypted = fs.readFileSync(ksPath, "utf8");
  const decrypted = decryptKey(encrypted);
  if (!decrypted) return { success: false, message: "Could not decrypt API key." };
  let store;
  try { store = JSON.parse(decrypted); } catch { store = { provider: "", key: "" }; }

  const fullConfig = { ai: { ...ai, apiKey: store.key } };
  try {
    const { createAIClient } = await import("../src/ai/ai-client.js");
    const client = createAIClient(fullConfig);
    if (typeof client.testConnection === "function") {
      return await client.testConnection();
    }
    return { success: false, message: "This provider does not support connection testing." };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// ---- Misc ----

ipcMain.handle("get-usage-stats", async () => {
  const configPath = path.join(getUserDataPath(), "config.json");
  if (!fs.existsSync(configPath)) return null;
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const ai = config.ai || {};
  if (ai.mode !== "hosted" || !ai.authToken) return null;

  try {
    const backendUrl = ai.backendUrl || "http://localhost:3000";
    const res = await fetch(`${backendUrl}/usage/me`, {
      headers: { Authorization: `Bearer ${ai.authToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
});

ipcMain.handle("get-billing-plans", async () => {
  const configPath = path.join(getUserDataPath(), "config.json");
  if (!fs.existsSync(configPath)) return [];
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const ai = config.ai || {};
  const backendUrl = ai.backendUrl || "http://localhost:3000";

  try {
    const res = await fetch(`${backendUrl}/billing/plans`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.plans || [];
  } catch {
    return [];
  }
});

ipcMain.handle("get-app-version", async () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    return pkg.version;
  } catch {
    return "1.0.0";
  }
});
