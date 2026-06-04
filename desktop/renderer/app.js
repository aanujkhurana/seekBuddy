const api = window.seekMateAPI;
const MAX_LOG_LINES = 2000;
let logLineCount = 0;
let autoScroll = true;
let isRunning = false;
let isLoggingIn = false;

const $ = (id) => document.getElementById(id);

async function init() {
  $("version").textContent = `v${await api.getAppVersion()}`;

  const config = await api.loadConfig();
  if (config) populateForm(config);

  const jobs = await api.loadAppliedJobs();
  renderHistory(jobs);

  attachEventListeners();
  setupIPCListeners();
}

function populateForm(config) {
  $("email").value = config.applicant?.email || "";
  $("password").value = "";
  $("job-title").value = config.jobTitle || "";
  $("location").value = config.location || "";
  $("max-apps").value = config.maxApplications || 5;
  $("resume-path").value = config.resumePath || "";
  $("cover-tone").value = config.coverLetter?.tone || "";
  $("word-limit").value = config.coverLetter?.wordLimit || 280;
  $("openai-enabled").checked = config.openai?.enabled || false;
  if (config.openai?.model) {
    const opt = $("openai-model").querySelector(`option[value="${config.openai.model}"]`);
    if (opt) opt.selected = true;
  }
}

function readForm() {
  return {
    seekBaseUrl: "https://www.seek.com.au",
    jobTitle: $("job-title").value.trim(),
    location: $("location").value.trim(),
    resumePath: $("resume-path").value.trim(),
    maxApplications: parseInt($("max-apps").value, 10) || 5,
    pauseBeforeSubmit: true,
    slowMoMs: 80,
    browserProfileDir: ".playwright-seek-profile",
    applicant: {
      name: "",
      phone: "",
      email: $("email").value.trim(),
      city: "",
      workRights: ""
    },
    coverLetter: {
      tone: $("cover-tone").value.trim() || "friendly, direct, confident, human, and tailored",
      wordLimit: parseInt($("word-limit").value, 10) || 280
    },
    openai: {
      enabled: $("openai-enabled").checked,
      model: $("openai-model").value
    }
  };
}

async function saveSettings() {
  const config = readForm();
  const res = await api.saveConfig(config);
  if (res.success) {
    $("save-feedback").textContent = "Settings saved!";
    setTimeout(() => { $("save-feedback").textContent = ""; }, 2000);
  }
}

async function startAutomation() {
  if (isRunning) return;
  const res = await api.startAutomation();
  if (res.success) {
    isRunning = true;
    setControlsRunning(true);
    appendLog("[INFO] Starting automation...\n");
  } else {
    appendLog(`[WARN] ${res.message}\n`);
  }
}

async function stopAutomation() {
  if (!isRunning) return;
  const res = await api.stopAutomation();
  if (res.success) {
    appendLog("[INFO] Stopping automation...\n");
  }
}

async function startLogin() {
  if (isLoggingIn) return;
  const res = await api.startLogin();
  if (res.success) {
    isLoggingIn = true;
    $("login-status-badge").textContent = "Logging in...";
    $("login-status-badge").className = "badge badge-running";
    $("login-btn").disabled = true;
    $("send-enter-btn").disabled = false;
    appendLog("[INFO] Opening SEEK login in browser...\n");
  }
}

async function continueLogin() {
  const res = await api.continueLogin();
  if (res.success) {
    appendLog("[INFO] Sent Enter to login process.\n");
  }
}

function appendLog(text) {
  const output = $("log-output");
  const placeholder = output.querySelector(".log-placeholder");
  if (placeholder) placeholder.remove();

  output.append(document.createTextNode(text));
  logLineCount += text.split("\n").length - 1;

  if (logLineCount > MAX_LOG_LINES) {
    const lines = output.textContent.split("\n");
    const excess = logLineCount - MAX_LOG_LINES;
    if (excess > 0) {
      output.textContent = lines.slice(excess).join("\n");
      logLineCount = lines.length - excess;
    }
  }

  if (autoScroll) {
    output.scrollTop = output.scrollHeight;
  }
}

function setControlsRunning(running) {
  $("start-btn").disabled = running;
  $("stop-btn").disabled = !running;
  $("send-enter-btn").disabled = !(running || isLoggingIn);
  $("status-badge").textContent = running ? "Running" : "Stopped";
  $("status-badge").className = running ? "badge badge-running" : "badge badge-stopped";
}

function renderHistory(jobs) {
  const tbody = $("history-body");
  $("history-count").textContent = `Total: ${jobs.length} job${jobs.length !== 1 ? "s" : ""}`;

  if (jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No jobs applied yet.</td></tr>';
    return;
  }

  tbody.innerHTML = jobs.slice().reverse().map((job) => {
    const date = job.handledAt ? new Date(job.handledAt).toLocaleDateString() : "-";
    const status = job.status || "prepared";
    return `<tr>
      <td>${esc(job.title || "-")}</td>
      <td>${esc(job.company || "-")}</td>
      <td>${date}</td>
      <td>${esc(status)}</td>
    </tr>`;
  }).join("");
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

async function clearHistory() {
  if (!confirm("Clear all applied jobs history?")) return;
  const res = await api.clearApplied();
  if (res.success) {
    renderHistory([]);
    appendLog("[INFO] Applied jobs history cleared.\n");
  }
}

async function browseResume() {
  const p = await api.selectFile({
    filters: [
      { name: "Resume Files", extensions: ["pdf", "doc", "docx", "txt", "rtf"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (p) $("resume-path").value = p;
}

function attachEventListeners() {
  $("settings-toggle").addEventListener("click", () => {
    const body = $("settings-body");
    const icon = $("settings-icon");
    body.style.display = body.style.display === "none" ? "" : "none";
    icon.classList.toggle("collapsed");
  });
  $("save-settings-btn").addEventListener("click", saveSettings);
  $("start-btn").addEventListener("click", startAutomation);
  $("stop-btn").addEventListener("click", stopAutomation);
  $("login-btn").addEventListener("click", startLogin);
  $("send-enter-btn").addEventListener("click", () => api.sendStdin("\n"));
  $("clear-history-btn").addEventListener("click", clearHistory);
  $("browse-resume").addEventListener("click", browseResume);
  $("clear-log-btn").addEventListener("click", () => {
    $("log-output").textContent = "";
    logLineCount = 0;
  });
  $("auto-scroll").addEventListener("change", (e) => { autoScroll = e.target.checked; });
}

function setupIPCListeners() {
  api.onLog((data) => appendLog(data));

  api.onAutomationStopped(() => {
    isRunning = false;
    isLoggingIn = false;
    setControlsRunning(false);
    $("login-btn").disabled = false;
    $("login-status-badge").textContent = "";
    $("login-status-badge").className = "badge";
    $("status-badge").textContent = "Idle";
    $("status-badge").className = "badge badge-idle";
  });

  api.onLoginStatus((status) => {
    if (status === "started") {
      isLoggingIn = true;
      $("login-status-badge").textContent = "Logging in...";
      $("login-status-badge").className = "badge badge-running";
      $("login-btn").disabled = true;
      $("send-enter-btn").disabled = false;
    } else if (status === "completed") {
      isLoggingIn = false;
      $("login-status-badge").textContent = "Session saved";
      $("login-status-badge").className = "badge badge-idle";
      $("login-btn").disabled = false;
      $("send-enter-btn").disabled = !isRunning;
    }
  });

  api.onAppliedJobsUpdated(async () => {
    const jobs = await api.loadAppliedJobs();
    renderHistory(jobs);
  });
}

document.addEventListener("DOMContentLoaded", init);
