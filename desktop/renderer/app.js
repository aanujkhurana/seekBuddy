const settingsToggle = document.getElementById("settingsToggle");
const settingsBack = document.getElementById("settingsBack");
const themeToggle = document.getElementById("themeToggle");
const aiSettingsAlert = document.getElementById("aiSettingsAlert");
const aiSettingsState = document.getElementById("aiSettingsState");
const openLoginBtns = Array.from(document.querySelectorAll("[data-open-login]"));
const logoutLoginBtns = Array.from(document.querySelectorAll("[data-logout-login]"));
const loginStatuses = Array.from(document.querySelectorAll("[data-login-status]"));
const loginStateBadges = Array.from(document.querySelectorAll("[data-login-badge]"));
const loginHelp = Array.from(document.querySelectorAll(".login-help"));
const jobTitleInput = document.getElementById("jobTitleInput");
const addJobTitleBtn = document.getElementById("addJobTitle");
const jobTitleList = document.getElementById("jobTitleList");
const searchLocationInput = document.getElementById("searchLocationInput");
const addLocationBtn = document.getElementById("addLocation");
const locationList = document.getElementById("locationList");
const maxApplicationsInput = document.getElementById("maxApplications");
const reviewBeforeApplyInput = document.getElementById("reviewBeforeApply");

const resumePathText = document.getElementById("resumePath");
const coverLetterTextInput = document.getElementById("coverLetterText");
const resumeSummaryInput = document.getElementById("resumeSummary");
const generateCoverLetterFromResumeBtn = document.getElementById("generateCoverLetterFromResume");
const coverLetterGenerationStatus = document.getElementById("coverLetterGenerationStatus");
const generateSummaryFromResumeBtn = document.getElementById("generateSummaryFromResume");
const summaryGenerationStatus = document.getElementById("summaryGenerationStatus");
const contactNameInput = document.getElementById("contactNameInput");
const contactEmailInput = document.getElementById("contactEmailInput");
const contactPhoneInput = document.getElementById("contactPhoneInput");
const contactWebsiteInput = document.getElementById("contactWebsiteInput");
const logs = document.getElementById("logs");
const logsEmpty = document.getElementById("logsEmpty");

const aiModeSelect = document.getElementById("aiMode");
const hostedSettings = document.getElementById("hostedSettings");
const byokSettings = document.getElementById("byokSettings");
const hostedModelSelect = document.getElementById("hostedModel");
const backendUrlInput = document.getElementById("backendUrl");
const coverLetterWordLimitInput = document.getElementById("coverLetterWordLimit");
const coverLetterToneInput = document.getElementById("coverLetterToneInput");
const addCoverLetterToneBtn = document.getElementById("addCoverLetterTone");
const coverLetterToneList = document.getElementById("coverLetterToneList");
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
const aiNotReadyHint = document.getElementById("startHint");
const appliedList = document.getElementById("appliedList");
const clearAppliedBtn = document.getElementById("clearApplied");
const exportJobsBtn = document.getElementById("exportJobs");

let resumePath = "";
let coverLetterPath = "";
let coverLetterText = "";
let keyVisible = false;
let automationRunning = false;
let hostedRegistered = false;
let loginValidated = false;
let loginInProgress = false;
let jobTitles = [];
let searchLocations = [];
let coverLetterTones = ["professional", "direct", "confident", "tailored"];
let hasAppliedJobs = false;
let resumeGenerationTarget = "";

const THEME_STORAGE_KEY = "seekApplyAssistant.theme";

function getPreferredTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Keep the UI usable if storage is unavailable.
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;

  if (!themeToggle) return;
  const nextTheme = resolved === "dark" ? "light" : "dark";
  themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
  themeToggle.title = `Switch to ${nextTheme} theme`;
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Theme still applies for the current session.
  }
}

function setLoginState({ validated, inProgress = false, failed = false, message }) {
  loginValidated = validated;
  loginInProgress = inProgress;
  document.body.classList.toggle("login-locked", !loginValidated);
  document.body.classList.toggle("logged-in", loginValidated);
  if (!loginValidated) document.body.classList.remove("settings-open");
  updateSettingsToggleState();

  openLoginBtns.forEach((button) => {
    button.style.display = loginValidated ? "none" : "";
    button.disabled = inProgress;
    button.textContent = failed ? "Reopen SEEK login" : "Open SEEK login";
  });
  logoutLoginBtns.forEach((button) => {
    button.style.display = loginValidated ? "" : "none";
  });
  loginStateBadges.forEach((badge) => {
    badge.className = "session-badge " + (loginValidated ? "logged-in" : inProgress ? "checking" : "logged-out");
    badge.innerHTML = loginValidated
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:14px;height:14px;margin-right:5px"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>SEEK logged in'
      : (inProgress ? "Checking SEEK..." : "Not logged in");
  });
  loginHelp.forEach((element) => {
    element.style.display = loginValidated ? "none" : "";
  });
  if (message) {
    loginStatuses.forEach((status) => {
      status.textContent = message;
    });
  }
}

function openSettings() {
  if (!loginValidated) return;
  document.body.classList.add("settings-open");
  updateSettingsToggleState();
}

function closeSettings() {
  document.body.classList.remove("settings-open");
  updateSettingsToggleState();
}

function toggleSettings() {
  if (document.body.classList.contains("settings-open")) {
    closeSettings();
  } else {
    openSettings();
  }
}

function updateSettingsToggleState() {
  const isOpen = document.body.classList.contains("settings-open");
  settingsToggle.setAttribute("aria-label", isOpen ? "Close settings" : "Open settings");
  settingsToggle.title = isOpen ? "Close settings" : "Settings";
}

function splitSearchValues(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function addUniqueValue(list, value) {
  const normalized = value.trim();
  if (!normalized) return list;
  const exists = list.some((item) => item.toLowerCase() === normalized.toLowerCase());
  return exists ? list : [...list, normalized];
}

const MAX_TONES = 5;
const DAILY_APPLICATION_LIMIT = 50;

const PROVIDER_MODELS = {
  openrouter: [
    { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
    { value: "anthropic/claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
    { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { value: "deepseek/deepseek-r1", label: "DeepSeek R1" },
    { value: "mistral/mistral-large", label: "Mistral Large" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "o3-mini", label: "o3 Mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.5-pro-exp-03-25", label: "Gemini 2.5 Pro" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ],
  minimax: [
    { value: "minimax-text-01", label: "MiniMax Text-01" },
  ],
};

function enforceToneLimit(list) {
  if (list.length <= MAX_TONES) return list;
  return list.slice(list.length - MAX_TONES);
}

function populateModelSelect(provider) {
  const models = PROVIDER_MODELS[provider] || [];
  const current = byokModelInput.value;
  byokModelInput.innerHTML = '<option value="">Select a model</option>';
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    byokModelInput.appendChild(opt);
  });
  if ([...byokModelInput.options].some((o) => o.value === current)) {
    byokModelInput.value = current;
  }
  updateAIConfiguredState();
}

function renderChipList({ values, container, onRemove }) {
  container.innerHTML = "";
  values.forEach((value, index) => {
    const chip = document.createElement("span");
    chip.className = "chip";

    const text = document.createElement("span");
    text.textContent = value;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chip-remove";
    remove.setAttribute("aria-label", `Remove ${value}`);
    remove.textContent = "x";
    remove.addEventListener("click", () => onRemove(index));

    chip.appendChild(text);
    chip.appendChild(remove);
    container.appendChild(chip);
  });
}

function renderSearchLists() {
  renderChipList({
    values: jobTitles,
    container: jobTitleList,
    onRemove: (index) => {
      jobTitles = jobTitles.filter((_, itemIndex) => itemIndex !== index);
      renderSearchLists();
  updateStartButtonState();
    }
  });

  renderChipList({
    values: searchLocations,
    container: locationList,
    onRemove: (index) => {
      searchLocations = searchLocations.filter((_, itemIndex) => itemIndex !== index);
      renderSearchLists();
  updateStartButtonState();
    }
  });

  renderChipList({
    values: coverLetterTones,
    container: coverLetterToneList,
    onRemove: (index) => {
      coverLetterTones = coverLetterTones.filter((_, itemIndex) => itemIndex !== index);
      renderSearchLists();
  updateStartButtonState();
    }
  });
}

function addJobTitle() {
  jobTitles = addUniqueValue(jobTitles, jobTitleInput.value);
  jobTitleInput.value = "";
  renderSearchLists();
  updateStartButtonState();
  jobTitleInput.focus();
}

function addSearchLocation() {
  searchLocations = addUniqueValue(searchLocations, searchLocationInput.value);
  searchLocationInput.value = "";
  renderSearchLists();
  updateStartButtonState();
  searchLocationInput.focus();
}

function addCoverLetterTone() {
  coverLetterTones = enforceToneLimit(addUniqueValue(coverLetterTones, coverLetterToneInput.value));
  coverLetterToneInput.value = "";
  renderSearchLists();
  updateStartButtonState();
  coverLetterToneInput.focus();
}

function setStatus(state) {
  automationRunning = state === "running";
  statusIndicator.className = "status-dot " + state;
  statusLabel.textContent = state === "running" ? "Running" : state === "stopped" ? "Stopping" : "Idle";
  startBtn.style.display = automationRunning ? "none" : "";
  stopBtn.style.display = automationRunning ? "" : "none";
  continueBtn.style.display = automationRunning ? "" : "none";
  startBtn.disabled = automationRunning;
  stopBtn.disabled = !automationRunning;
  continueBtn.disabled = !automationRunning;

  if (automationRunning) {
    closeSettings();
    document.querySelectorAll("input, textarea, select, button").forEach(el => {
      if (el === startBtn || el === stopBtn || el === continueBtn || el === themeToggle) return;
      if (el.disabled) el.dataset.wasDisabled = "1";
      el.disabled = true;
    });
  } else {
    document.querySelectorAll("input, textarea, select, button").forEach(el => {
      if (el === startBtn || el === stopBtn || el === continueBtn || el === themeToggle) return;
      if (el.dataset.wasDisabled === "1") {
        delete el.dataset.wasDisabled;
      } else {
        el.disabled = false;
      }
    });
    updateResumeGenerationState();
  }
}

function updateLogsEmptyState() {
  logsEmpty.style.display = logs.textContent.trim() ? "none" : "";
}

function getConfig() {
  const titlesForConfig = addUniqueValue(jobTitles, jobTitleInput.value);
  const locationsForConfig = addUniqueValue(searchLocations, searchLocationInput.value);
  const tonesForConfig = enforceToneLimit(addUniqueValue(coverLetterTones, coverLetterToneInput.value));
  const coverLetterWordLimit = Math.min(Math.max(Number(coverLetterWordLimitInput.value) || 280, 120), 500);
  const maxApplications = clampApplicationLimit(maxApplicationsInput.value);

  return {
    email: "",
    password: "",
    keywords: titlesForConfig.join(", "),
    location: locationsForConfig.join(", "),
    maxApplications,
    reviewBeforeApply: reviewBeforeApplyInput.checked,
    slowMoMs: 0,
    resumePath,
    coverLetterPath: "",
    coverLetterText: (coverLetterTextInput?.value || "").trim(),
    resumeSummary: (resumeSummaryInput?.value || "").trim().split("\n").map(s => s.trim()).filter(Boolean),
    contactName: (contactNameInput?.value || "").trim(),
    contactEmail: (contactEmailInput?.value || "").trim(),
    contactPhone: (contactPhoneInput?.value || "").trim(),
    contactWebsite: (contactWebsiteInput?.value || "").trim(),
    coverLetter: {
      tone: tonesForConfig.length ? tonesForConfig.join(", ") : "professional",
      tones: tonesForConfig.length ? tonesForConfig : ["professional"],
      wordLimit: coverLetterWordLimit,
      maxWordLimit: 500
    }
  };
}

function appendLog(message) {
  logs.textContent = logs.textContent ? `${logs.textContent}\n${message}` : message;
  updateLogsEmptyState();
  logs.scrollTop = logs.scrollHeight;
}

async function loadConfig() {
  const config = await window.seekApp.loadConfig();
  if (!config) {
    renderSearchLists();
  updateStartButtonState();
    coverLetterWordLimitInput.value = 280;
    updateResumeGenerationState();
    return;
  }

  jobTitles = splitSearchValues(config.keywords);
  searchLocations = splitSearchValues(config.location);
  const savedCoverLetter = config.coverLetter || {};
  coverLetterTones = Array.isArray(savedCoverLetter.tones)
    ? savedCoverLetter.tones.filter(Boolean)
    : splitSearchValues(savedCoverLetter.tone);
  if (!coverLetterTones.length || (coverLetterTones.length === 1 && coverLetterTones[0] === "professional")) {
    coverLetterTones = ["professional", "direct", "confident", "tailored"];
  }
  coverLetterTones = enforceToneLimit(coverLetterTones);
  renderSearchLists();
  updateStartButtonState();
  maxApplicationsInput.value = clampApplicationLimit(config.maxApplications || 10);
  reviewBeforeApplyInput.checked = Boolean(config.reviewBeforeApply);
  coverLetterWordLimitInput.value = Math.min(Math.max(Number(savedCoverLetter.wordLimit) || 280, 120), 500);

  resumePath = config.resumePath || "";
  coverLetterPath = config.coverLetterPath || "";
  coverLetterText = config.coverLetterText || "";
  resumePathText.textContent = resumePath ? `Resume uploaded: ${resumePath}` : "No resume selected";
  coverLetterTextInput.value = coverLetterText;
  if (resumeSummaryInput) resumeSummaryInput.value = Array.isArray(config.resumeSummary) ? config.resumeSummary.join("\n") : (config.resumeSummary || "");
  if (contactNameInput) contactNameInput.value = config.contactName || "";
  if (contactEmailInput) contactEmailInput.value = config.contactEmail || "";
  if (contactPhoneInput) contactPhoneInput.value = config.contactPhone || "";
  if (contactWebsiteInput) contactWebsiteInput.value = config.contactWebsite || "";
  updateResumeGenerationState();
}

async function loadAIConfig() {
  const aiCfg = await window.seekApp.loadAIConfig();
  aiModeSelect.value = aiCfg.mode || "hosted";
  hostedModelSelect.value = aiCfg.hostedModel || "budget";
  backendUrlInput.value = aiCfg.backendUrl || "http://localhost:3000";
  byokProviderSelect.value = aiCfg.byokProvider || "openrouter";
  populateModelSelect(byokProviderSelect.value);
  byokModelInput.value = aiCfg.byokModel && [...byokModelInput.options].some(o => o.value === aiCfg.byokModel) ? aiCfg.byokModel : byokModelInput.value;

  const stored = await window.seekApp.loadApiKey();
  if (stored && stored.key) {
    apiKeyInput.value = stored.key;
  }

  hostedRegistered = Boolean(aiCfg.authToken);
  toggleByokVisibility();
  updateAIConfiguredState();
}

function toggleByokVisibility() {
  const isByok = aiModeSelect.value === "byok";
  hostedSettings.style.display = isByok ? "none" : "";
  byokSettings.style.display = isByok ? "" : "none";
  updateAIConfiguredState();
}

function isAIConfigured() {
  if (aiModeSelect.value === "hosted") {
    return hostedRegistered;
  }
  return Boolean(apiKeyInput.value.trim() && byokModelInput.value);
}

function updateAIConfiguredState() {
  const configured = isAIConfigured();
  document.body.classList.toggle("ai-not-configured", !configured);
  aiSettingsAlert.style.display = configured ? "none" : "";
  aiSettingsState.className = "settings-state " + (configured ? "ok" : "warn");
  aiSettingsState.textContent = configured ? "Configured" : "Needs setup";
  updateStartButtonState();
  updateResumeGenerationState();
}

function updateStartButtonState() {
  const missing = [];
  if (!jobTitles.length) missing.push("Add at least one <b>job title</b>");
  if (!searchLocations.length) missing.push("Add at least one <b>location</b>");
  if (!isAIConfigured()) missing.push('<button class="hint-link">Open Settings</button> and configure <b>AI credentials</b>');

  const ready = missing.length === 0;
  startBtn.disabled = !ready;
  aiNotReadyHint.style.display = ready ? "none" : "";
  aiNotReadyHint.innerHTML = missing.join(". ") + ".";
}

function getResumeGenerationMessage(kind) {
  const hasResume = Boolean(resumePath);
  const aiConfigured = isAIConfigured();

  if (!hasResume) {
    return kind === "coverLetter"
      ? "Upload a resume to generate a sample cover letter with AI."
      : "Upload a resume to generate a resume summary with AI.";
  }

  if (!aiConfigured) {
    return kind === "coverLetter"
      ? "Resume uploaded. AI is not configured yet, open Settings and configure AI before generating a cover letter from your resume."
      : "Resume uploaded. AI is not configured yet, open Settings and configure AI before generating a summary from your resume.";
  }

  return kind === "coverLetter"
    ? "Resume uploaded. Generate a sample cover letter from this resume using AI."
    : "Resume uploaded. Generate a resume summary from this resume using AI.";
}

function updateResumeGenerationState(messages = {}) {
  const hasResume = Boolean(resumePath);
  const aiConfigured = isAIConfigured();
  const isBusy = Boolean(resumeGenerationTarget);
  const hasCoverLetterText = Boolean((coverLetterTextInput?.value || "").trim());
  const hasResumeSummary = Boolean((resumeSummaryInput?.value || "").trim());

  generateCoverLetterFromResumeBtn.disabled = isBusy || !hasResume || !aiConfigured;
  generateSummaryFromResumeBtn.disabled = isBusy || !hasResume || !aiConfigured;
  generateCoverLetterFromResumeBtn.style.display = hasCoverLetterText ? "none" : "";
  generateSummaryFromResumeBtn.style.display = hasResumeSummary ? "none" : "";

  coverLetterGenerationStatus.textContent = hasCoverLetterText
    ? "Cover letter text is present. Clear it to generate a new one from your resume."
    : (messages.coverLetter || getResumeGenerationMessage("coverLetter"));
  summaryGenerationStatus.textContent = hasResumeSummary
    ? "Resume summary is present. Clear it to generate a new one from your resume."
    : (messages.summary || getResumeGenerationMessage("summary"));

  if (resumeGenerationTarget === "coverLetter") {
    coverLetterGenerationStatus.textContent = "Generating a sample cover letter from your uploaded resume...";
  }
  if (resumeGenerationTarget === "summary") {
    summaryGenerationStatus.textContent = "Generating a resume summary from your uploaded resume...";
  }
}

function getAIConfig() {
  return {
    mode: aiModeSelect.value,
    hostedModel: hostedModelSelect.value,
    backendUrl: backendUrlInput.value.trim() || "http://localhost:3000",
    byokProvider: byokProviderSelect.value,
    byokModel: byokModelInput.value
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
  updateAIConfiguredState();
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

  await window.seekApp.saveConfig(getConfig());
  aiStatus.textContent = "AI settings saved.";
  updateAIConfiguredState();
  appendLog("AI settings saved.");
}

async function loadAppliedJobs() {
  const jobs = await window.seekApp.loadAppliedJobs();
  renderAppliedJobs(jobs);
}

function renderAppliedJobs(jobs) {
  appliedList.innerHTML = "";
  hasAppliedJobs = Boolean(jobs && jobs.length);
  clearAppliedBtn.disabled = !hasAppliedJobs;
  exportJobsBtn.disabled = !hasAppliedJobs;

  if (!hasAppliedJobs) {
    appliedList.innerHTML = '<p class="hint">No jobs applied yet.</p>';
    return;
  }

  const grouped = groupJobsByDate(jobs);

  for (const group of grouped) {
    const groupSection = document.createElement("section");
    groupSection.className = "applied-date-group";

    const header = document.createElement("div");
    header.className = "applied-date-header";

    const heading = document.createElement("div");
    heading.className = "applied-date-heading";
    heading.textContent = formatAppliedDateHeading(group.dateKey);

    const count = document.createElement("span");
    count.className = "applied-date-count";
    count.textContent = group.dateKey === getLocalDateKey()
      ? `${group.jobs.length}/${DAILY_APPLICATION_LIMIT} today`
      : `${group.jobs.length} ${group.jobs.length === 1 ? "application" : "applications"}`;

    header.appendChild(heading);
    header.appendChild(count);
    groupSection.appendChild(header);

    for (const job of group.jobs) {
      groupSection.appendChild(createAppliedJobItem(job));
    }

    appliedList.appendChild(groupSection);
  }
}

function createAppliedJobItem(job) {
  const item = document.createElement("div");
  item.className = "applied-item";

  const info = document.createElement("div");
  info.className = "applied-info";

  const title = document.createElement("div");
  title.className = "job-title";
  title.textContent = job.title || "Untitled";

  const meta = document.createElement("div");
  meta.className = "job-meta";

  const parts = [];
  if (job.company) parts.push(job.company);
  if (job.handledAt) parts.push(formatAppliedTime(job.handledAt));
  meta.textContent = parts.join(" · ") || "";

  info.appendChild(title);
  info.appendChild(meta);

  const status = document.createElement("span");
  const st = job.status || "prepared";
  status.className = "job-status " + st;
  status.textContent = st.replace("_", " ");

  const right = document.createElement("div");
  right.className = "applied-actions";
  right.appendChild(status);

  if (job.url) {
    const openJob = document.createElement("button");
    openJob.type = "button";
    openJob.className = "applied-action";
    openJob.textContent = "Open job";
    openJob.addEventListener("click", () => openAppliedJobUrl(job.url));
    right.appendChild(openJob);
  }

  if (job.coverLetterPath) {
    const downloadCoverLetter = document.createElement("button");
    downloadCoverLetter.type = "button";
    downloadCoverLetter.className = "applied-action";
    downloadCoverLetter.textContent = "Download cover letter";
    downloadCoverLetter.addEventListener("click", () => downloadAppliedCoverLetter(job.coverLetterPath));
    right.appendChild(downloadCoverLetter);
  }

  item.appendChild(info);
  item.appendChild(right);
  return item;
}

function groupJobsByDate(jobs) {
  const sorted = [...jobs].sort((a, b) => getHandledTimestamp(b) - getHandledTimestamp(a));
  const groups = new Map();

  for (const job of sorted) {
    const dateKey = getLocalDateKey(job.handledAt) || "unknown";
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(job);
  }

  return Array.from(groups, ([dateKey, groupJobs]) => ({ dateKey, jobs: groupJobs }));
}

function getHandledTimestamp(job) {
  const timestamp = new Date(job?.handledAt || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAppliedDateHeading(dateKey) {
  if (!dateKey || dateKey === "unknown") return "Unknown date";

  const today = getLocalDateKey();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateKey(yesterdayDate);

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatAppliedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function clampApplicationLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 10;
  return Math.min(Math.max(Math.floor(number), 1), DAILY_APPLICATION_LIMIT);
}

async function openAppliedJobUrl(url) {
  const result = await window.seekApp.openJobUrl(url);
  if (!result.success) {
    appendLog(`[WARN] ${result.message || "Could not open job link."}`);
  }
}

async function downloadAppliedCoverLetter(coverLetterPath) {
  const result = await window.seekApp.downloadCoverLetter(coverLetterPath);
  if (result.success) {
    appendLog(`Downloaded cover letter to ${result.path}`);
  } else if (result.message !== "Download cancelled.") {
    appendLog(`[WARN] ${result.message || "Could not download cover letter."}`);
  }
}

// ---- Event listeners ----

document.getElementById("selectResume").addEventListener("click", async () => {
  const file = await window.seekApp.selectFile({
    filters: [
      { name: "Documents", extensions: ["pdf", "doc", "docx", "txt", "md", "rtf"] }
    ]
  });
  if (file) {
    resumePath = file;
    resumePathText.textContent = `Resume uploaded: ${file}`;
    updateResumeGenerationState();
  }
});

coverLetterTextInput.addEventListener("input", updateResumeGenerationState);
resumeSummaryInput.addEventListener("input", updateResumeGenerationState);

async function generateFromResume(kind) {
  if (!resumePath) {
    updateResumeGenerationState({
      [kind]: kind === "coverLetter"
        ? "Upload a resume before generating a cover letter."
        : "Upload a resume before generating a summary."
    });
    return;
  }
  if (!isAIConfigured()) {
    updateResumeGenerationState({
      [kind]: kind === "coverLetter"
        ? "AI is not configured. Open Settings and configure AI before generating a cover letter from your resume."
        : "AI is not configured. Open Settings and configure AI before generating a summary from your resume."
    });
    return;
  }

  resumeGenerationTarget = kind;
  updateResumeGenerationState();
  appendLog(kind === "coverLetter"
    ? "Generating sample cover letter from uploaded resume..."
    : "Generating resume summary from uploaded resume...");

  const finalMessages = {};
  try {
    await saveAISettings();
    await window.seekApp.saveConfig(getConfig());

    const result = await window.seekApp.generateResumeArtifacts({
      resumePath,
      target: kind
    });
    if (!result.success) {
      finalMessages[kind] = result.message || (kind === "coverLetter"
        ? "Could not generate a cover letter from this resume."
        : "Could not generate a summary from this resume.");
      updateResumeGenerationState(finalMessages);
      appendLog(`[WARN] ${result.message || "Resume generation failed."}`);
      return;
    }

    if (kind === "summary") {
      resumeSummaryInput.value = Array.isArray(result.resumeSummary) ? result.resumeSummary.join("\n") : "";
      finalMessages.summary = "Generated summary from resume. Review it before applying.";
    }

    if (kind === "coverLetter") {
      coverLetterTextInput.value = result.coverLetterPreview || "";
      coverLetterText = coverLetterTextInput.value;
      coverLetterPath = "";
      finalMessages.coverLetter = "Generated sample cover letter from resume. Review it before applying.";
    }

    await window.seekApp.saveConfig(getConfig());

    updateResumeGenerationState(finalMessages);
    appendLog(kind === "coverLetter"
      ? "[OK] Generated sample cover letter from uploaded resume."
      : "[OK] Generated resume summary from uploaded resume.");
  } catch (error) {
    finalMessages[kind] = error.message || (kind === "coverLetter"
      ? "Could not generate a cover letter from this resume."
      : "Could not generate a summary from this resume.");
    updateResumeGenerationState(finalMessages);
    appendLog(`[WARN] ${error.message || "Resume generation failed."}`);
  } finally {
    resumeGenerationTarget = "";
    updateResumeGenerationState(finalMessages);
  }
}

generateCoverLetterFromResumeBtn.addEventListener("click", () => {
  generateFromResume("coverLetter");
});

generateSummaryFromResumeBtn.addEventListener("click", () => {
  generateFromResume("summary");
});

addJobTitleBtn.addEventListener("click", addJobTitle);
jobTitleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addJobTitle();
  }
});

addLocationBtn.addEventListener("click", addSearchLocation);
searchLocationInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addSearchLocation();
  }
});

addCoverLetterToneBtn.addEventListener("click", addCoverLetterTone);
coverLetterToneInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addCoverLetterTone();
  }
});
coverLetterWordLimitInput.addEventListener("blur", () => {
  coverLetterWordLimitInput.value = Math.min(Math.max(Number(coverLetterWordLimitInput.value) || 280, 120), 500);
});
maxApplicationsInput.addEventListener("blur", () => {
  maxApplicationsInput.value = clampApplicationLimit(maxApplicationsInput.value);
});

settingsToggle.addEventListener("click", toggleSettings);
settingsBack.addEventListener("click", closeSettings);
themeToggle.addEventListener("click", toggleTheme);

document.querySelectorAll("#helpSection a[href]").forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    const result = await window.seekApp.openExternalLink(link.href);
    if (!result.success) appendLog(`[WARN] ${result.message || "Could not open help link."}`);
  });
});

async function openSeekLogin() {
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
    const message = result.message || "Could not open SEEK login.";
    loginStatuses.forEach((status) => {
      status.textContent = message;
    });
    appendLog(`[WARN] ${message}`);
  }
}

openLoginBtns.forEach((button) => {
  button.addEventListener("click", openSeekLogin);
});

async function logoutSeekLogin() {
  const result = await window.seekApp.logoutLoginSession();
  setLoginState({
    validated: false,
    inProgress: false,
    message: result.message || "Logged out. Open SEEK login to sign in again."
  });
  appendLog(result.message || "Logged out of SEEK session.");
}

logoutLoginBtns.forEach((button) => {
  button.addEventListener("click", logoutSeekLogin);
});

document.getElementById("start").addEventListener("click", async () => {
  await window.seekApp.saveConfig(getConfig());
  logs.textContent = "";
  updateLogsEmptyState();
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
    appendLog("[OK] Completed.");
  } else {
    appendLog("[WARN] No running process to send input to.");
  }
});

clearAppliedBtn.addEventListener("click", async () => {
  if (!hasAppliedJobs) return;
  const confirmed = window.confirm(
    "Clear applied job history?\n\nJobs in this history may reopen or be processed again if the history is cleared."
  );
  if (!confirmed) return;

  const result = await window.seekApp.clearApplied();
  appendLog(result.output || "Applied history cleared.");
  await loadAppliedJobs();
});

exportJobsBtn.addEventListener("click", async () => {
  const result = await window.seekApp.exportJobs();
  if (result.success) {
    appendLog(`Exported applied jobs to ${result.path}`);
  } else {
    appendLog(result.message || "Export failed.");
  }
});

aiModeSelect.addEventListener("change", toggleByokVisibility);
backendUrlInput.addEventListener("input", updateAIConfiguredState);
byokModelInput.addEventListener("change", updateAIConfiguredState);
byokProviderSelect.addEventListener("change", () => {
  populateModelSelect(byokProviderSelect.value);
});
apiKeyInput.addEventListener("input", updateAIConfiguredState);

aiNotReadyHint.addEventListener("click", (e) => {
  if (e.target.classList.contains("hint-link")) openSettings();
});

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

window.addEventListener("beforeunload", () => {
  window.seekApp.saveConfigOnClose(getConfig());
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

  if (state === "logged_out") {
    setLoginState({
      validated: false,
      inProgress: false,
      message: message || "Logged out. Open SEEK login to sign in again."
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
  applyTheme(getPreferredTheme());
  updateLogsEmptyState();
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
