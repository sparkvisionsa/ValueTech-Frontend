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

    // Pause/Resume/Stop controls
    pauseMacroFill: (reportId) => safeInvoke('pause-macro-fill', reportId),
    resumeMacroFill: (reportId) => safeInvoke('resume-macro-fill', reportId),
    stopMacroFill: (reportId) => safeInvoke('stop-macro-fill', reportId),

    fullCheck: (reportId, tabsNum) => safeInvoke('full-check', reportId, tabsNum),
    halfCheck: (reportId, tabsNum) => safeInvoke('half-check', reportId, tabsNum),

    deleteReport: (reportId, maxRounds) => safeInvoke('delete-report', reportId, maxRounds),
    deleteIncompleteAssets: (reportId, maxRounds) => safeInvoke('delete-incomplete-assets', reportId, maxRounds),
    handleCancelledReport: (reportId) => safeInvoke('handle-cancelled-report', reportId),

    // Progress listener for macro fill
    onMacroFillProgress: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('macro-fill-progress', subscription);

        // Return cleanup function
        return () => {
            ipcRenderer.removeListener('macro-fill-progress', subscription);
        };
    },

    // Worker
    showOpenDialog: () => safeInvoke('show-open-dialog'),

    // Health
    checkHealth: () => safeInvoke('check-server-health')
});