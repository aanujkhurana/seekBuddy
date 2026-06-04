const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('seekMateAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getAppliedJobs: () => ipcRenderer.invoke('get-applied-jobs'),
  clearAppliedJobs: () => ipcRenderer.invoke('clear-applied-jobs'),

  pickFile: (options) => ipcRenderer.invoke('pick-file', options),

  startAutomation: () => ipcRenderer.invoke('start-automation'),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),

  startLogin: () => ipcRenderer.invoke('start-login'),
  continueLogin: () => ipcRenderer.invoke('continue-login'),

  sendStdin: (data) => ipcRenderer.invoke('send-stdin', data),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  onLog: (callback) => {
    ipcRenderer.on('log', (_event, data) => callback(data));
  },
  onProcessStatus: (callback) => {
    ipcRenderer.on('process-status', (_event, data) => callback(data));
  },
  onLoginStatus: (callback) => {
    ipcRenderer.on('login-status', (_event, data) => callback(data));
  },
  onAppliedJobsUpdated: (callback) => {
    ipcRenderer.on('applied-jobs-updated', () => callback());
  },
});
