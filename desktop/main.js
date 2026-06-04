import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const DEFAULTS = {
  seekBaseUrl: "https://www.seek.com.au",
  email: "",
  password: "",
  resumePath: "",
  coverLetterPath: "",
  keywords: "",
  location: "",
  maxApplications: 5,
  reviewBeforeApply: true,
  slowMoMs: 80,
  browserProfileDir: ".playwright-seek-profile"
};

let mainWindow;
let runningProcess = null;
let loginProcess = null;

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

function spawnScript(scriptRelPath, env) {
  return spawn(process.execPath, [path.join(ROOT, scriptRelPath)], {
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
});

// ---- Config ----

ipcMain.handle("save-config", async (_, config) => {
  const merged = { ...DEFAULTS, ...config };
  const filePath = path.join(getUserDataPath(), "config.json");
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  return { success: true };
});

ipcMain.handle("load-config", async () => {
  const filePath = path.join(getUserDataPath(), "config.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
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

  const proc = spawnScript("src/seek-apply.js");
  runningProcess = proc;

  proc.stdout.on("data", (data) => send("automation-log", data.toString()));
  proc.stderr.on("data", (data) => send("automation-log", data.toString()));

  proc.on("close", (code) => {
    send("automation-log", `[INFO] Process exited with code ${code}\n`);
    send("automation-stopped");
    runningProcess = null;
    send("applied-jobs-updated");
  });

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

// ---- Login ----

ipcMain.handle("start-login", async () => {
  if (loginProcess) {
    return { success: false, message: "Login already in progress." };
  }

  const proc = spawnScript("src/seek-login.js");
  loginProcess = proc;

  proc.stdout.on("data", (data) => send("automation-log", data.toString()));
  proc.stderr.on("data", (data) => send("automation-log", data.toString()));

  proc.on("close", () => {
    loginProcess = null;
    send("automation-log", "[INFO] Login process completed.\n");
    send("login-status", "completed");
  });

  send("login-status", "started");
  return { success: true };
});

ipcMain.handle("continue-login", async () => {
  if (loginProcess && !loginProcess.killed) {
    loginProcess.stdin.write("\n");
    return { success: true };
  }
  return { success: false, message: "No login process running." };
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

// ---- Misc ----

ipcMain.handle("get-app-version", async () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    return pkg.version;
  } catch {
    return "1.0.0";
  }
});
