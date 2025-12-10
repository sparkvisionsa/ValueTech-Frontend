const { ipcMain } = require('electron');
const { authHandlers, reportHandlers, workerHandlers, healthHandlers, packageHandlers } = require('./handlers');

function registerIpcHandlers() {
    // Auth handlers
    ipcMain.handle('login', authHandlers.handleLogin);
    ipcMain.handle('submit-otp', authHandlers.handleSubmitOtp);
    ipcMain.handle('check-status', authHandlers.handleCheckStatus);
    ipcMain.handle('get-companies', authHandlers.handleGetCompanies);
    ipcMain.handle('navigate-to-company', authHandlers.handleNavigateToCompany);
    ipcMain.handle('register', authHandlers.handleRegister);
    ipcMain.handle('auth-set-refresh-token', authHandlers.handleSetRefreshToken);
    ipcMain.handle('auth-clear-refresh-token', authHandlers.handleClearRefreshToken);
    ipcMain.handle('get-token', authHandlers.getRefreshToken)


    // Report handlers
    ipcMain.handle('validate-report', reportHandlers.handleValidateReport);
    ipcMain.handle('create-macros', reportHandlers.handleCreateMacros);
    ipcMain.handle('extract-asset-data', reportHandlers.handleExtractAssetData);
    ipcMain.handle('grab-macro-ids', reportHandlers.handleGrabMacroIds);
    ipcMain.handle('retry-macro-ids', reportHandlers.handleRetryMacroIds);
    ipcMain.handle('macro-fill', reportHandlers.handleMacroFill);
    ipcMain.handle('elrajhi-filler', reportHandlers.handleElRajhiUploadReport);
    ipcMain.handle('duplicate-report', reportHandlers.handleDuplicateReport);

    ipcMain.handle('pause-macro-fill', reportHandlers.handlePauseMacroFill);
    ipcMain.handle('resume-macro-fill', reportHandlers.handleResumeMacroFill);
    ipcMain.handle('stop-macro-fill', reportHandlers.handleStopMacroFill);

    ipcMain.handle('full-check', reportHandlers.handleFullCheck);
    ipcMain.handle('half-check', reportHandlers.handleHalfCheck);

    ipcMain.handle('delete-report', reportHandlers.deleteReport);
    ipcMain.handle('delete-incomplete-assets', reportHandlers.deleteIncompleteAssets);
    ipcMain.handle('handle-cancelled-report', reportHandlers.handleCancelledReport);

    // Worker handlers
    ipcMain.handle('ping-worker', workerHandlers.handlePing);
    ipcMain.handle('worker-status', workerHandlers.handleWorkerStatus);
    ipcMain.handle('show-open-dialog', workerHandlers.showOpenDialog);
    ipcMain.handle('show-open-dialog-pdfs', workerHandlers.showOpenDialogPdfs);
    ipcMain.handle('select-folder', workerHandlers.selectFolder);
    ipcMain.handle('read-folder', workerHandlers.readFolder);

    //Health handlers
    ipcMain.handle('check-server-health', healthHandlers.handleHealth);

    // Package handlers
    ipcMain.handle('api-request', packageHandlers.handleApiRequest);

    console.log('[IPC] All handlers registered');
}

function unregisterIpcHandlers() {
    ipcMain.removeAllListeners('login');
    ipcMain.removeAllListeners('submit-otp');
    ipcMain.removeAllListeners('check-status');
    ipcMain.removeAllListeners('get-companies');
    ipcMain.removeAllListeners('navigate-to-company');
    ipcMain.removeAllListeners('register');

    ipcMain.removeAllListeners('ping-worker');
    ipcMain.removeAllListeners('worker-status');
    ipcMain.removeAllListeners('show-open-dialog');
    ipcMain.removeAllListeners('show-open-dialog-pdfs');
    ipcMain.removeAllListeners('select-folder');
    ipcMain.removeAllListeners('read-folder');
    ipcMain.removeAllListeners('read-file');

    ipcMain.removeAllListeners('api-request');

    ipcMain.removeAllListeners('validate-report');
    ipcMain.removeAllListeners('create-macros');
    ipcMain.removeAllListeners('extract-asset-data');
    ipcMain.removeAllListeners('grab-macro-ids');
    ipcMain.removeAllListeners('retry-macro-ids');
    ipcMain.removeAllListeners('macro-fill');
    ipcMain.removeAllListeners('elrajhi-filler');
    ipcMain.removeAllListeners('duplicate-report');

    ipcMain.removeAllListeners('pause-macro-fill');
    ipcMain.removeAllListeners('resume-macro-fill');
    ipcMain.removeAllListeners('stop-macro-fill');

    ipcMain.removeAllListeners('full-check');
    ipcMain.removeAllListeners('half-check');

    ipcMain.removeAllListeners('delete-report');
    ipcMain.removeAllListeners('delete-incomplete-assets');
    ipcMain.removeAllListeners('handle-cancelled-report');

    ipcMain.removeAllListeners('check-server-health');

    console.log('[IPC] All handlers unregistered');
}

module.exports = {
    registerIpcHandlers,
    unregisterIpcHandlers
};
