import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

let mainWindow = null;
let automationProcess = null;
let loginProcess = null;
let logBuffer = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 760,
    minHeight: 540,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'SeekMate Apply Assistant',
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function getConfigPath() {
  return path.join(ROOT, 'config.json');
}

function getAppliedJobsPath() {
  return path.join(ROOT, 'data', 'handled-applications.json');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      seekBaseUrl: 'https://www.seek.com.au',
      jobTitle: '',
      location: '',
      resumePath: '',
      maxApplications: 5,
      pauseBeforeSubmit: true,
      slowMoMs: 80,
      browserProfileDir: '.playwright-seek-profile',
      applicant: {
        name: '',
        phone: '',
        email: '',
        city: '',
        workRights: ''
      },
      coverLetter: {
        tone: 'friendly, direct, confident, human, and tailored',
        wordLimit: 280
      },
      openai: {
        enabled: false,
        model: 'gpt-4.1-mini'
      }
    };
  }
}

function writeConfig(config) {
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function readAppliedJobs() {
  try {
    const raw = fs.readFileSync(getAppliedJobsPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function clearAppliedJobs() {
  const dir = path.dirname(getAppliedJobsPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getAppliedJobsPath(), '[]');
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupIPC() {
  ipcMain.handle('get-config', () => readConfig());

  ipcMain.handle('save-config', (_event, config) => {
    writeConfig(config);
    return true;
  });

  ipcMain.handle('get-applied-jobs', () => readAppliedJobs());

  ipcMain.handle('clear-applied-jobs', () => {
    clearAppliedJobs();
    return true;
  });

  ipcMain.handle('pick-file', async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  function spawnScript(scriptPath, onStart, onExit) {
    const proc = spawn('node', [scriptPath], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const onData = (data) => {
      const msg = data.toString();
      logBuffer.push(msg);
      if (logBuffer.length > 5000) logBuffer.splice(0, 1000);
      sendToRenderer('log', msg);
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', (data) => {
      const msg = `[STDERR] ${data.toString()}`;
      logBuffer.push(msg);
      if (logBuffer.length > 5000) logBuffer.splice(0, 1000);
      sendToRenderer('log', msg);
    });

    proc.on('exit', (code, signal) => {
      if (onExit) onExit(code, signal);
    });

    if (onStart) onStart(proc);

    return proc;
  }

  ipcMain.handle('start-automation', () => {
    if (automationProcess && !automationProcess.killed) return false;

    automationProcess = spawnScript(
      'src/seek-apply.js',
      () => {
        sendToRenderer('process-status', 'running');
        sendToRenderer('log', '[INFO] Automation started.\n');
      },
      (code) => {
        automationProcess = null;
        sendToRenderer('process-status', 'stopped');
        sendToRenderer('log', `[INFO] Automation exited (code ${code}).\n`);
        sendToRenderer('applied-jobs-updated');
      }
    );

    return true;
  });

  ipcMain.handle('stop-automation', () => {
    if (!automationProcess || automationProcess.killed) return false;
    automationProcess.kill('SIGTERM');
    setTimeout(() => {
      if (automationProcess && !automationProcess.killed) {
        automationProcess.kill('SIGKILL');
      }
    }, 3000);
    return true;
  });

  ipcMain.handle('start-login', () => {
    if (loginProcess && !loginProcess.killed) return false;

    loginProcess = spawnScript(
      'src/seek-login.js',
      () => {
        sendToRenderer('login-status', 'started');
        sendToRenderer('log', '[INFO] Login process started.\n');
      },
      () => {
        loginProcess = null;
        sendToRenderer('login-status', 'completed');
        sendToRenderer('log', '[INFO] Login process completed.\n');
      }
    );

    return true;
  });

  ipcMain.handle('continue-login', () => {
    if (loginProcess && !loginProcess.killed) {
      loginProcess.stdin.write('\n');
      return true;
    }
    return false;
  });

  ipcMain.handle('send-stdin', (_event, data) => {
    const proc = loginProcess || automationProcess;
    if (proc && !proc.killed) {
      proc.stdin.write(data);
      return true;
    }
    return false;
  });

  ipcMain.handle('get-app-version', () => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
      return pkg.version;
    } catch {
      return '1.0.0';
    }
  });

  ipcMain.handle('get-logs', () => {
    return logBuffer.join('');
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (automationProcess && !automationProcess.killed) automationProcess.kill();
  if (loginProcess && !loginProcess.killed) loginProcess.kill();
});
