const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("seekApp", {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  selectFile: (options) => ipcRenderer.invoke("select-file", options),

  startAutomation: () => ipcRenderer.invoke("start-automation"),
  stopAutomation: () => ipcRenderer.invoke("stop-automation"),

  startLogin: () => ipcRenderer.invoke("start-login"),
  continueLogin: () => ipcRenderer.invoke("continue-login"),
  sendStdin: (data) => ipcRenderer.invoke("send-stdin", data),

  loadAppliedJobs: () => ipcRenderer.invoke("load-applied-jobs"),
  clearApplied: () => ipcRenderer.invoke("clear-applied"),
  exportJobs: () => ipcRenderer.invoke("export-jobs"),

  checkBrowsers: () => ipcRenderer.invoke("check-browsers"),
  installBrowsers: () => ipcRenderer.invoke("install-browsers"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  saveAIConfig: (cfg) => ipcRenderer.invoke("save-ai-config", cfg),
  loadAIConfig: () => ipcRenderer.invoke("load-ai-config"),
  saveApiKey: (payload) => ipcRenderer.invoke("save-api-key", payload),
  loadApiKey: () => ipcRenderer.invoke("load-api-key"),
  deleteApiKey: () => ipcRenderer.invoke("delete-api-key"),
  testAIConnection: () => ipcRenderer.invoke("test-ai-connection"),
  registerHosted: (payload) => ipcRenderer.invoke("register-hosted", payload),

  onLog: (cb) => { ipcRenderer.on("automation-log", (_e, d) => cb(d)); },
  onStopped: (cb) => { ipcRenderer.on("automation-stopped", () => cb()); },
  onAutomationStopped: (cb) => { ipcRenderer.on("automation-stopped", () => cb()); },
  onLoginStatus: (cb) => { ipcRenderer.on("login-status", (_e, d) => cb(d)); },
  onAppliedJobsUpdated: (cb) => { ipcRenderer.on("applied-jobs-updated", () => cb()); },
  onStatusChange: (cb) => { ipcRenderer.on("automation-status", (_e, d) => cb(d)); },
  getAutomationStatus: () => ipcRenderer.invoke("get-automation-status"),
  getUsageStats: () => ipcRenderer.invoke("get-usage-stats"),
  getBillingPlans: () => ipcRenderer.invoke("get-billing-plans"),
});
