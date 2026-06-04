const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const keywordsInput = document.getElementById("keywords");
const locationInput = document.getElementById("location");
const maxApplicationsInput = document.getElementById("maxApplications");
const reviewBeforeApplyInput = document.getElementById("reviewBeforeApply");

const resumePathText = document.getElementById("resumePath");
const coverLetterPathText = document.getElementById("coverLetterPath");
const logs = document.getElementById("logs");

const aiModeSelect = document.getElementById("aiMode");
const hostedSettings = document.getElementById("hostedSettings");
const byokSettings = document.getElementById("byokSettings");
const hostedModelSelect = document.getElementById("hostedModel");
const byokProviderSelect = document.getElementById("byokProvider");
const byokModelInput = document.getElementById("byokModel");
const apiKeyInput = document.getElementById("apiKeyInput");
const toggleKeyBtn = document.getElementById("toggleKeyVisibility");
const testConnectionBtn = document.getElementById("testConnection");
const saveAIBtn = document.getElementById("saveAISettings");
const aiStatus = document.getElementById("aiStatus");

let resumePath = "";
let coverLetterPath = "";
let keyVisible = false;

function appendLog(message) {
  logs.textContent += `\n${message}`;
  logs.scrollTop = logs.scrollHeight;
}

async function loadConfig() {
  const config = await window.seekApp.loadConfig();
  if (!config) return;

  emailInput.value = config.email || "";
  passwordInput.value = config.password || "";
  keywordsInput.value = config.keywords || "";
  locationInput.value = config.location || "";
  maxApplicationsInput.value = config.maxApplications || 10;
  reviewBeforeApplyInput.checked = Boolean(config.reviewBeforeApply);

  resumePath = config.resumePath || "";
  coverLetterPath = config.coverLetterPath || "";
  resumePathText.textContent = resumePath || "No resume selected";
  coverLetterPathText.textContent = coverLetterPath || "No cover letter selected";
}

async function loadAIConfig() {
  const aiCfg = await window.seekApp.loadAIConfig();
  aiModeSelect.value = aiCfg.mode || "hosted";
  hostedModelSelect.value = aiCfg.hostedModel || "budget";
  byokProviderSelect.value = aiCfg.byokProvider || "openrouter";
  byokModelInput.value = aiCfg.byokModel || "deepseek/deepseek-chat";

  const stored = await window.seekApp.loadApiKey();
  if (stored && stored.key) {
    apiKeyInput.value = stored.key;
  }

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
    byokProvider: byokProviderSelect.value,
    byokModel: byokModelInput.value.trim()
  };
}

async function saveAISettings() {
  const aiCfg = getAIConfig();
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

document.getElementById("start").addEventListener("click", async () => {
  await window.seekApp.saveConfig(getConfig());
  logs.textContent = "";
  appendLog("Starting automation...");
  const result = await window.seekApp.startAutomation();
  if (!result.success) appendLog(result.message);
});

document.getElementById("stop").addEventListener("click", async () => {
  const result = await window.seekApp.stopAutomation();
  if (result.success) appendLog("Automation stopped.");
  else appendLog(result.message);
});

document.getElementById("clearApplied").addEventListener("click", async () => {
  const result = await window.seekApp.clearApplied();
  appendLog(result.output || "Applied history cleared.");
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
    appendLog("[OK] AI connection successful.");
  } else {
    aiStatus.textContent = `Failed: ${result.message}`;
    appendLog(`[WARN] AI connection failed: ${result.message}`);
  }
});

saveAIBtn.addEventListener("click", saveAISettings);

window.seekApp.onLog((message) => appendLog(message));
window.seekApp.onStopped(() => appendLog("Automation has stopped."));

loadConfig();
loadAIConfig();
