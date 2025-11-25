const { contextBridge, ipcRenderer } = require('electron');

function safeInvoke(channel, ...args) {
    return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: process.versions,

    // Auth
    login: (credentials) => safeInvoke('login', credentials),
    submitOtp: (otp) => safeInvoke('submit-otp', otp),
    checkStatus: () => safeInvoke('check-status'),

    // Reports
    validateReport: (reportId) => safeInvoke('validate-report', reportId),
    createMacros: (reportId, macroCount, tabsNum, batchSize) => safeInvoke('create-macros', reportId, macroCount, tabsNum, batchSize),
    extractAssetData: (excelFilePath) => safeInvoke('extract-asset-data', excelFilePath),
    grabMacroIds: (reportId, tabsNum) => safeInvoke('grab-macro-ids', reportId, tabsNum),
    macroFill: (reportId, tabsNum) => safeInvoke('macro-fill', reportId, tabsNum),
    fullCheck: (reportId, tabsNum) => safeInvoke('full-check', reportId, tabsNum),
    halfCheck: (reportId, tabsNum) => safeInvoke('half-check', reportId, tabsNum),

    // Worker
    showOpenDialog: () => safeInvoke('show-open-dialog'),

    // Health
    checkHealth: () => safeInvoke('check-server-health')
});
