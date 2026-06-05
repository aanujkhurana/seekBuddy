const openLoginBtn = document.getElementById("openLogin");
const logoutLoginBtn = document.getElementById("logoutLogin");
const loginStatus = document.getElementById("loginStatus");
const keywordsInput = document.getElementById("keywords");
const locationInput = document.getElementById("location");
const maxApplicationsInput = document.getElementById("maxApplications");
const reviewBeforeApplyInput = document.getElementById("reviewBeforeApply");

const resumePathText = document.getElementById("resumePath");
const coverLetterPathText = document.getElementById("coverLetterPath");
const resumeSummaryInput = document.getElementById("resumeSummary");
const logs = document.getElementById("logs");

const aiModeSelect = document.getElementById("aiMode");
const hostedSettings = document.getElementById("hostedSettings");
const byokSettings = document.getElementById("byokSettings");
const hostedModelSelect = document.getElementById("hostedModel");
const backendUrlInput = document.getElementById("backendUrl");
const byokProviderSelect = document.getElementById("byokProvider");
const byokModelInput = document.getElementById("byokModel");
const apiKeyInput = document.getElementById("apiKeyInput");
const toggleKeyBtn = document.getElementById("toggleKeyVisibility");
const testConnectionBtn = document.getElementById("testConnection");
const saveAIBtn = document.getElementById("saveAISettings");
const aiStatus = document.getElementById("aiStatus");

const statusIndicator = document.getElementById("statusIndicator");
const statusLabel = document.getElementById("statusLabel");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const continueBtn = document.getElementById("continueBtn");
const appliedList = document.getElementById("appliedList");

let resumePath = "";
let coverLetterPath = "";
let keyVisible = false;
let automationRunning = false;
let hostedRegistered = false;
let loginValidated = false;
let loginInProgress = false;

function setLoginState({ validated, inProgress = false, failed = false, message }) {
  loginValidated = validated;
  loginInProgress = inProgress;
  document.body.classList.toggle("login-locked", !loginValidated);
  openLoginBtn.style.display = loginValidated ? "none" : "";
  logoutLoginBtn.style.display = loginValidated ? "" : "none";
  openLoginBtn.disabled = inProgress;
  openLoginBtn.textContent = failed ? "Reopen SEEK Login" : "Open SEEK Login";
  if (message) loginStatus.textContent = message;
}

function setStatus(state) {
  automationRunning = state === "running";
  statusIndicator.className = "status-dot " + state;
  statusLabel.textContent = state === "running" ? "Running" : state === "stopped" ? "Stopping" : "Idle";
  startBtn.disabled = automationRunning;
  stopBtn.disabled = !automationRunning;
  continueBtn.disabled = state === "idle";
}

function getConfig() {
  return {
    email: "",
    password: "",
    keywords: keywordsInput.value.trim(),
    location: locationInput.value.trim(),
    maxApplications: Number(maxApplicationsInput.value) || 10,
    reviewBeforeApply: reviewBeforeApplyInput.checked,
    resumePath,
    coverLetterPath,
    resumeSummary: (resumeSummaryInput?.value || "").trim().split("\n").map(s => s.trim()).filter(Boolean)
  };
}

function appendLog(message) {
  logs.textContent += `\n${message}`;
  logs.scrollTop = logs.scrollHeight;
}

async function loadConfig() {
  const config = await window.seekApp.loadConfig();
  if (!config) return;

  keywordsInput.value = config.keywords || "";
  locationInput.value = config.location || "";
  maxApplicationsInput.value = config.maxApplications || 10;
  reviewBeforeApplyInput.checked = Boolean(config.reviewBeforeApply);

  resumePath = config.resumePath || "";
  coverLetterPath = config.coverLetterPath || "";
  resumePathText.textContent = resumePath || "No resume selected";
  coverLetterPathText.textContent = coverLetterPath || "No cover letter selected";
  if (resumeSummaryInput) resumeSummaryInput.value = Array.isArray(config.resumeSummary) ? config.resumeSummary.join("\n") : (config.resumeSummary || "");
}

async function loadAIConfig() {
  const aiCfg = await window.seekApp.loadAIConfig();
  aiModeSelect.value = aiCfg.mode || "hosted";
  hostedModelSelect.value = aiCfg.hostedModel || "budget";
  backendUrlInput.value = aiCfg.backendUrl || "http://localhost:3000";
  byokProviderSelect.value = aiCfg.byokProvider || "openrouter";
  byokModelInput.value = aiCfg.byokModel || "deepseek/deepseek-chat";

  const stored = await window.seekApp.loadApiKey();
  if (stored && stored.key) {
    apiKeyInput.value = stored.key;
  }

  hostedRegistered = Boolean(aiCfg.authToken);
  toggleByokVisibility();
}

function toggleByokVisibility() {
  const isByok = aiModeSelect.value === "byok";
  hostedSettings.style.display = isByok ? "none" : "";
  byokSettings.style.display = isByok ? "" : "none";
}

function getAIConfig() {
  return {
    mode: aiModeSelect.value,
    hostedModel: hostedModelSelect.value,
    backendUrl: backendUrlInput.value.trim() || "http://localhost:3000",
    byokProvider: byokProviderSelect.value,
    byokModel: byokModelInput.value.trim()
  };
}

async function registerHostedIfNeeded() {
  if (hostedRegistered) return;
  if (aiModeSelect.value !== "hosted") return;

  aiStatus.textContent = "Registering with backend...";
  const backendUrl = backendUrlInput.value.trim() || "http://localhost:3000";
  const email = "user@seek-assistant.local";

  const result = await window.seekApp.registerHosted({ email, backendUrl });
  if (result.success) {
    hostedRegistered = true;
    // Persist the auth token immediately
    const aiCfg = getAIConfig();
    aiCfg.authToken = result.token;
    aiCfg.userId = result.userId;
    await window.seekApp.saveAIConfig(aiCfg);
    aiStatus.textContent = "Connected to backend.";
    appendLog(`[OK] Registered with ${backendUrl}`);
  } else {
    aiStatus.textContent = `Backend: ${result.message}`;
    appendLog(`[WARN] Hosted registration: ${result.message}`);
  }
}

async function saveAISettings() {
  const aiCfg = getAIConfig();

  if (aiCfg.mode === "hosted") {
    await registerHostedIfNeeded();
  }

  await window.seekApp.saveAIConfig(aiCfg);

  const key = apiKeyInput.value.trim();
  if (key && aiCfg.mode === "byok") {
    await window.seekApp.saveApiKey({ provider: aiCfg.byokProvider, key });
  } else if (aiCfg.mode === "hosted") {
    await window.seekApp.deleteApiKey();
  }

  aiStatus.textContent = "AI settings saved.";
  appendLog("AI settings saved.");
}

async function loadAppliedJobs() {
  const jobs = await window.seekApp.loadAppliedJobs();
  renderAppliedJobs(jobs);
}

function renderAppliedJobs(jobs) {
  appliedList.innerHTML = "";

  if (!jobs || !jobs.length) {
    appliedList.innerHTML = '<p class="hint">No jobs applied yet.</p>';
    return;
  }

  const recent = jobs.slice(-30).reverse();

  for (const job of recent) {
    const item = document.createElement("div");
    item.className = "applied-item";

    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "job-title";
    title.textContent = job.title || "Untitled";

    const meta = document.createElement("div");
    meta.className = "job-meta";

    const parts = [];
    if (job.company) parts.push(job.company);
    if (job.handledAt) {
      parts.push(new Date(job.handledAt).toISOString().slice(0, 10));
    }
    meta.textContent = parts.join(" · ") || "";

    info.appendChild(title);
    info.appendChild(meta);

    const status = document.createElement("span");
    const st = job.status || "prepared";
    status.className = "job-status " + st;
    status.textContent = st.replace("_", " ");

    item.appendChild(info);
    item.appendChild(status);
    appliedList.appendChild(item);
  }
}

// ---- Event listeners ----

document.getElementById("selectResume").addEventListener("click", async () => {
  const file = await window.seekApp.selectFile({
    filters: [
      { name: "Documents", extensions: ["pdf", "doc", "docx"] }
    ]
  });
  if (file) {
    resumePath = file;
    resumePathText.textContent = file;
  }
});

document.getElementById("selectCoverLetter").addEventListener("click", async () => {
  const file = await window.seekApp.selectFile({
    filters: [
      { name: "Documents", extensions: ["pdf", "doc", "docx"] }
    ]
  });
  if (file) {
    coverLetterPath = file;
    coverLetterPathText.textContent = file;
  }
});

document.getElementById("saveConfig").addEventListener("click", async () => {
  await window.seekApp.saveConfig(getConfig());
  appendLog("Config saved.");
});

openLoginBtn.addEventListener("click", async () => {
  await window.seekApp.saveConfig(getConfig());
  const result = await window.seekApp.startLogin();
  if (result.success) {
    setLoginState({
      validated: false,
      inProgress: true,
      message: "SEEK login window opened. Choose email login in SEEK and sign in manually. The app will unlock automatically."
    });
    appendLog("SEEK login window opened.");
  } else {
    loginStatus.textContent = result.message || "Could not open SEEK login.";
    appendLog(`[WARN] ${loginStatus.textContent}`);
  }
});

logoutLoginBtn.addEventListener("click", async () => {
  const result = await window.seekApp.logoutLoginSession();
  setLoginState({
    validated: false,
    inProgress: false,
    message: result.message || "Logged out. Open SEEK Login to sign in again."
  });
  appendLog(result.message || "Logged out of SEEK session.");
});

document.getElementById("start").addEventListener("click", async () => {
  await window.seekApp.saveConfig(getConfig());
  logs.textContent = "";
  appendLog("Starting automation...");
  const result = await window.seekApp.startAutomation();
  if (!result.success) appendLog(result.message);
});

document.getElementById("stop").addEventListener("click", async () => {
  const result = await window.seekApp.stopAutomation();
  if (result.success) {
    setStatus("stopped");
    appendLog("Stopping automation after current job...");
  } else {
    appendLog(result.message);
  }
});

document.getElementById("continueBtn").addEventListener("click", async () => {
  const result = await window.seekApp.sendStdin("\n");
  if (result.success) {
    appendLog("[OK] Continued.");
  } else {
    appendLog("[WARN] No running process to send input to.");
  }
});

document.getElementById("clearApplied").addEventListener("click", async () => {
  const result = await window.seekApp.clearApplied();
  appendLog(result.output || "Applied history cleared.");
  await loadAppliedJobs();
});

document.getElementById("exportJobs").addEventListener("click", async () => {
  const result = await window.seekApp.exportJobs();
  if (result.success) {
    appendLog(`Exported applied jobs to ${result.path}`);
  } else {
    appendLog(result.message || "Export failed.");
  }
});

aiModeSelect.addEventListener("change", toggleByokVisibility);

toggleKeyBtn.addEventListener("click", () => {
  keyVisible = !keyVisible;
  apiKeyInput.type = keyVisible ? "text" : "password";
  toggleKeyBtn.textContent = keyVisible ? "Hide" : "Show";
});

testConnectionBtn.addEventListener("click", async () => {
  await saveAISettings();
  aiStatus.textContent = "Testing connection...";
  testConnectionBtn.disabled = true;
  const result = await window.seekApp.testAIConnection();
  testConnectionBtn.disabled = false;
  if (result.success) {
    aiStatus.textContent = "Connection OK!";
    appendLog(`[OK] AI connection successful (model: ${result.model || "unknown"}).`);
  } else {
    aiStatus.textContent = `Failed: ${result.message}`;
    appendLog(`[WARN] AI connection failed: ${result.message}`);
  }
});

saveAIBtn.addEventListener("click", saveAISettings);

window.seekApp.onLog((message) => appendLog(message));

window.seekApp.onStopped(() => {
  appendLog("Automation has stopped.");
  setStatus("idle");
  loadAppliedJobs();
  loadUsageDashboard();
});

window.seekApp.onAppliedJobsUpdated(() => {
  loadAppliedJobs();
});

window.seekApp.onStatusChange((status) => {
  setStatus(status);
});

window.seekApp.onLoginStatus((status) => {
  const state = typeof status === "string" ? status : status.state;
  const message = typeof status === "string" ? "" : status.message;

  if (state === "started" || state === "checking") {
    setLoginState({ validated: false, inProgress: state === "started", message });
    return;
  }

  if (state === "validated" || state === "completed") {
    setLoginState({
      validated: true,
      inProgress: false,
      message: message || "Logged in to SEEK. Session saved locally."
    });
    return;
  }

  if (state === "failed") {
    setLoginState({
      validated: false,
      inProgress: false,
      failed: true,
      message: message || "SEEK login could not be validated. Reopen SEEK and sign in with email again."
    });
  }
});

// ---- Usage dashboard ----

const usageContent = document.getElementById("usageContent");

async function loadUsageDashboard() {
  const stats = await window.seekApp.getUsageStats();
  if (!stats) {
    usageContent.innerHTML = '<p class="hint">Connect to hosted AI to view usage stats.</p>';
    return;
  }

  const genPct = stats.daily?.generations
    ? Math.round((stats.daily.generations.used / stats.daily.generations.limit) * 100)
    : 0;
  const appPct = stats.daily?.applications
    ? Math.round((stats.daily.applications.used / stats.daily.applications.limit) * 100)
    : 0;

  const topTasks = stats.allTime?.tasks
    ? Object.entries(stats.allTime.tasks).sort((a, b) => b[1] - a[1]).slice(0, 3)
    : [];

  usageContent.innerHTML = [
    '<div class="usage-grid">',
    '  <div class="usage-stat">',
    `    <div class="usage-value">${stats.daily.generations.used}/${stats.daily.generations.limit}</div>`,
    '    <div class="usage-label">AI Generations Today</div>',
    `    <div class="usage-bar"><div class="usage-fill" style="width:${genPct}%"></div></div>`,
    '  </div>',
    '  <div class="usage-stat">',
    `    <div class="usage-value">${stats.daily.applications.used}/${stats.daily.applications.limit}</div>`,
    '    <div class="usage-label">Applications Today</div>',
    `    <div class="usage-bar"><div class="usage-fill" style="width:${appPct}%"></div></div>`,
    '  </div>',
    '  <div class="usage-stat">',
    `    <div class="usage-value">$${stats.allTime.totalCost.toFixed(4)}</div>`,
    '    <div class="usage-label">Total API Cost</div>',
    '  </div>',
    '  <div class="usage-stat">',
    `    <div class="usage-value">${stats.allTime.totalGenerations}</div>`,
    '    <div class="usage-label">Total Generations</div>',
    '  </div>',
    '</div>',
    topTasks.length
      ? `<div class="usage-tasks">${topTasks.map(([t, c]) => `<span class="usage-tag">${t}: ${c}</span>`).join(" ")}</div>`
      : ""
  ].join("\n");
}

// ---- Init ----

async function init() {
  const status = await window.seekApp.getAutomationStatus();
  setStatus(status);
  await Promise.all([loadConfig(), loadAIConfig(), loadAppliedJobs()]);
  const login = await window.seekApp.checkLoginSession();
  setLoginState({
    validated: Boolean(login.validated),
    inProgress: false,
    message: login.message || (login.validated ? "SEEK login saved for this app session." : "Sign in manually before configuring applications.")
  });
  await loadUsageDashboard();
}

init();
