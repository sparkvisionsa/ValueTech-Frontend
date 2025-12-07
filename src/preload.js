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
    getCompanies: () => safeInvoke('get-companies'),
    navigateToCompany: (url) => safeInvoke('navigate-to-company', url),
    register: (userData) => safeInvoke('register', userData),

    // Set refresh token (main process will store this as HttpOnly cookie)
    // opts: { baseUrl, name, path, maxAgeDays, sameSite, secure, httpOnly }
    setRefreshToken: (token, opts = {}) => {
        const payload = Object.assign({
            baseUrl: opts.baseUrl || 'http://localhost:3000',
            token,
            name: opts.name || 'refreshToken',
            path: opts.path || '/',
            maxAgeDays: opts.maxAgeDays || 7,
            sameSite: opts.sameSite || 'lax',
            secure: typeof opts.secure === 'boolean' ? opts.secure : (process.env.NODE_ENV === 'production'),
            httpOnly: typeof opts.httpOnly === 'boolean' ? opts.httpOnly : true
        }, opts);
        return safeInvoke('auth-set-refresh-token', payload);
    },

    // (optional) remove cookie helper
    clearRefreshToken: (opts = {}) => {
        const payload = {
            baseUrl: opts.baseUrl || 'http://localhost:3000',
            name: opts.name || 'refreshToken'
        };
        return safeInvoke('auth-clear-refresh-token', payload);
    },

    // Reports
    validateReport: (reportId) => safeInvoke('validate-report', reportId),
    createMacros: (reportId, macroCount, tabsNum, batchSize) => safeInvoke('create-macros', reportId, macroCount, tabsNum, batchSize),
    extractAssetData: (excelFilePath) => safeInvoke('extract-asset-data', excelFilePath),
    grabMacroIds: (reportId, tabsNum) => safeInvoke('grab-macro-ids', reportId, tabsNum),
    retryMacroIds: (reportId, tabsNum) => safeInvoke('retry-macro-ids', reportId, tabsNum),
    macroFill: (reportId, tabsNum) => safeInvoke('macro-fill', reportId, tabsNum),
    elrajhiUploadReport: (batchId, tabsNum) => safeInvoke('elrajhi-filler', batchId, tabsNum),

    // Pause/Resume/Stop controls
    pauseMacroFill: (reportId) => safeInvoke('pause-macro-fill', reportId),
    resumeMacroFill: (reportId) => safeInvoke('resume-macro-fill', reportId),
    stopMacroFill: (reportId) => safeInvoke('stop-macro-fill', reportId),

    fullCheck: (reportId, tabsNum) => safeInvoke('full-check', reportId, tabsNum),
    halfCheck: (reportId, tabsNum) => safeInvoke('half-check', reportId, tabsNum),

    deleteReport: (reportId, maxRounds) => safeInvoke('delete-report', reportId, maxRounds),
    deleteIncompleteAssets: (reportId, maxRounds) => safeInvoke('delete-incomplete-assets', reportId, maxRounds),
    handleCancelledReport: (reportId) => safeInvoke('handle-cancelled-report', reportId),


    getToken: () => safeInvoke('get-token'),
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
    showOpenDialogPdfs: () => safeInvoke('show-open-dialog-pdfs'),

    // Health
    checkHealth: () => safeInvoke('check-server-health'),

    // API requests (optionally include headers, e.g., Authorization)
    apiRequest: (method, url, data = {}, headers = {}) =>
        safeInvoke('api-request', { method, url, data, headers })
});
