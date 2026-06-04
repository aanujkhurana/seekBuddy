const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("seekMateAPI", {
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

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  onLog: (cb) => { ipcRenderer.on("automation-log", (_e, d) => cb(d)); },
  onAutomationStopped: (cb) => { ipcRenderer.on("automation-stopped", () => cb()); },
  onLoginStatus: (cb) => { ipcRenderer.on("login-status", (_e, d) => cb(d)); },
  onAppliedJobsUpdated: (cb) => { ipcRenderer.on("applied-jobs-updated", () => cb()); }
});
