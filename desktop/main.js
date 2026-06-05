import { app, BrowserWindow, ipcMain, dialog, safeStorage } from "electron";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
import { DEFAULTS, encryptKey as fallbackEncrypt, decryptKey as fallbackDecrypt } from "./config-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

let mainWindow;
let runningProcess = null;
let loginProcess = null;
let loginCheckProcess = null;
let cancelLoginCheck = null;
let loginSessionValidated = false;
const LOGIN_CHECK_TIMEOUT_MS = 30000;

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

function spawnScript(scriptRelPath, env, args = []) {
  return spawn(process.execPath, [path.join(ROOT, scriptRelPath), ...args], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, USER_DATA_DIR: getUserDataPath(), ...env }
  });
}

function getPlaywrightCacheDir() {
  const home = os.homedir();
  const cacheDir = process.platform === "darwin"
    ? path.join(home, "Library", "Caches", "ms-playwright")
    : process.platform === "win32"
      ? path.join(process.env.USERPROFILE || home, "AppData", "Local", "ms-playwright")
      : path.join(home, ".cache", "ms-playwright");
  return cacheDir;
}

function browsersInstalled() {
  const cacheDir = getPlaywrightCacheDir();
  if (!fs.existsSync(cacheDir)) return false;
  const entries = fs.readdirSync(cacheDir);
  return entries.some((e) => e.startsWith("chromium"));
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
    const proc = spawn("npx", ["playwright", "install", "chromium"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true
    });

    proc.stdout.on("data", (data) => send("automation-log", data.toString()));
    proc.stderr.on("data", (data) => send("automation-log", data.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        send("automation-log", "[OK] Playwright Chromium installed.\n");
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Installation Complete",
          message: "Chromium browser engine installed successfully."
        });
      } else {
        send("automation-log", `[ERROR] Installation failed (code ${code}).\n`);
        dialog.showErrorBox("Installation Failed", "Could not install Chromium. Try running `npm run install:browsers` in the project directory.");
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
  if (loginCheckProcess && !loginCheckProcess.killed) loginCheckProcess.kill();
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

ipcMain.handle("save-config", async (_, config) => {
  const filePath = path.join(getUserDataPath(), "config.json");
  let existing = {};
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  const merged = { ...DEFAULTS, ...existing, ...config };
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  return { success: true };
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

  const proc = spawnScript("src/seek-apply.js", extraEnv);
  runningProcess = proc;

  proc.stdout.on("data", (data) => send("automation-log", data.toString()));
  proc.stderr.on("data", (data) => send("automation-log", data.toString()));

  proc.on("close", (code) => {
    send("automation-log", `[INFO] Process exited with code ${code}\n`);
    send("automation-stopped");
    send("automation-status", "idle");
    runningProcess = null;
    send("applied-jobs-updated");
  });

  send("automation-status", "running");
  return { success: true };
});

ipcMain.handle("stop-automation", async () => {
  if (!runningProcess) {
    return { success: false, message: "No automation is running." };
  }
  runningProcess.kill("SIGTERM");
  setTimeout(() => {
    if (runningProcess && !runningProcess.killed) {
      runningProcess.kill("SIGKILL");
    }
  }, 3000);
  return { success: true };
});

ipcMain.handle("get-automation-status", async () => {
  if (runningProcess && !runningProcess.killed) return "running";
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

ipcMain.handle("start-login", async () => {
  if (loginProcess && !loginProcess.killed) {
    const staleLogin = loginProcess;
    loginProcess = null;
    staleLogin.kill();
  }

  if (loginCheckProcess && !loginCheckProcess.killed) {
    if (cancelLoginCheck) {
      cancelLoginCheck("Starting a fresh SEEK login.");
    } else {
      loginCheckProcess.kill();
      loginCheckProcess = null;
    }
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

  if (loginProcess || loginCheckProcess) {
    return { success: false, validated: false, message: "Login validation is already running." };
  }

  send("login-status", {
    state: "checking",
    message: "Checking saved SEEK login session..."
  });

  const proc = spawnScript("src/seek-login.js", {}, ["--check-only"]);
  loginCheckProcess = proc;

  proc.stdout.on("data", (data) => send("automation-log", data.toString()));
  proc.stderr.on("data", (data) => send("automation-log", data.toString()));

  return new Promise((resolve) => {
    let settled = false;
    const finish = ({ success, message }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (loginCheckProcess === proc) loginCheckProcess = null;
      cancelLoginCheck = null;
      updateLoginValidation(success);
      send("login-status", {
        state: success ? "validated" : "failed",
        message
      });
      resolve({ success: true, validated: success, message });
    };

    const timeout = setTimeout(() => {
      if (settled || loginCheckProcess !== proc) return;
      proc.kill();
      finish({
        success: false,
        message: "Saved SEEK login check timed out. Reopen SEEK and sign in with email again."
      });
    }, LOGIN_CHECK_TIMEOUT_MS);

    cancelLoginCheck = (message) => {
      if (settled) return;
      proc.kill();
      finish({
        success: false,
        message: message || "Saved SEEK login check was cancelled."
      });
    };

    proc.on("close", (code) => {
      if (settled || loginCheckProcess !== proc) return;
      const success = code === 0;
      const message = success
        ? "Saved SEEK login session validated."
        : "Saved SEEK login session has expired. Reopen SEEK and sign in with email again.";
      finish({
        success,
        message
      });
    });
  });
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

// ---- Browser check ----

ipcMain.handle("check-browsers", async () => {
  return { installed: browsersInstalled() };
});

ipcMain.handle("install-browsers", async () => {
  const prevLog = [];
  const proc = spawn("npx", ["playwright", "install", "chromium"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true
  });

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

  return new Promise((resolve) => {
    proc.on("close", (code) => {
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
