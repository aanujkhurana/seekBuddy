const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const keywordsInput = document.getElementById("keywords");
const locationInput = document.getElementById("location");
const maxApplicationsInput = document.getElementById("maxApplications");
const reviewBeforeApplyInput = document.getElementById("reviewBeforeApply");

const resumePathText = document.getElementById("resumePath");
const coverLetterPathText = document.getElementById("coverLetterPath");
const logs = document.getElementById("logs");

let resumePath = "";
let coverLetterPath = "";

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

function getConfig() {
  return {
    email: emailInput.value.trim(),
    password: passwordInput.value,
    keywords: keywordsInput.value.trim(),
    location: locationInput.value.trim(),
    maxApplications: Number(maxApplicationsInput.value || 10),
    reviewBeforeApply: reviewBeforeApplyInput.checked,
    resumePath,
    coverLetterPath
  };
}

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

  if (!result.success) {
    appendLog(result.message);
  }
});

document.getElementById("stop").addEventListener("click", async () => {
  const result = await window.seekApp.stopAutomation();

  if (result.success) {
    appendLog("Automation stopped.");
  } else {
    appendLog(result.message);
  }
});

document.getElementById("clearApplied").addEventListener("click", async () => {
  const result = await window.seekApp.clearApplied();
  appendLog(result.output || "Applied history cleared.");
});

window.seekApp.onLog((message) => {
  appendLog(message);
});

window.seekApp.onStopped(() => {
  appendLog("Automation has stopped.");
});

loadConfig();
