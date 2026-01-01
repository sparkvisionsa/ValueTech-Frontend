const { ipcMain } = require('electron');

let authHandlers, reportHandlers, workerHandlers, healthHandlers, packageHandlers, systemHandlers, valuationHandlers, wordHandlers;

try {
    const handlers = require('./handlers');
    authHandlers = handlers.authHandlers;
    reportHandlers = handlers.reportHandlers;
    workerHandlers = handlers.workerHandlers;
    healthHandlers = handlers.healthHandlers;
    packageHandlers = handlers.packageHandlers;
    systemHandlers = handlers.systemHandlers;
    valuationHandlers = handlers.valuationHandlers;
    wordHandlers = handlers.wordHandlers;
    console.log('[IPC] All handler modules loaded successfully');
} catch (error) {
    console.error('[IPC] ERROR loading handlers:', error);
    throw error;
}

function registerIpcHandlers() {
    // Clear any existing handlers first to avoid duplicates
    try {
        ipcMain.removeHandler('api-request');
        ipcMain.removeHandler('read-ram');
        ipcMain.removeHandler('open-external');
        ipcMain.removeHandler('download-image');
        ipcMain.removeHandler('show-image-window');
        ipcMain.removeHandler('read-file');
    } catch (err) {
        // Ignore errors if handlers don't exist
    }

    // Helper function to safely register handlers
    const safeHandle = (channel, handler, handlerName) => {
        if (handler && typeof handler === 'function') {
            try {
                ipcMain.handle(channel, handler);
                return true;
            } catch (err) {
                console.error(`[IPC] ERROR registering handler '${handlerName}' for channel '${channel}':`, err);
                return false;
            }
        } else {
            console.error(`[IPC] ERROR: Handler '${handlerName}' for channel '${channel}' is not a function or is undefined`);
            return false;
        }
    };

    // Auth handlers
    if (authHandlers) {
        safeHandle('login', authHandlers.handleLogin, 'authHandlers.handleLogin');
        safeHandle('submit-otp', authHandlers.handleSubmitOtp, 'authHandlers.handleSubmitOtp');
        safeHandle('check-status', authHandlers.handleCheckStatus, 'authHandlers.handleCheckStatus');
        safeHandle('get-companies', authHandlers.handleGetCompanies, 'authHandlers.handleGetCompanies');
        safeHandle('navigate-to-company', authHandlers.handleNavigateToCompany, 'authHandlers.handleNavigateToCompany');
        safeHandle('register', authHandlers.handleRegister, 'authHandlers.handleRegister');
        safeHandle('auth-set-refresh-token', authHandlers.handleSetRefreshToken, 'authHandlers.handleSetRefreshToken');
        safeHandle('auth-clear-refresh-token', authHandlers.handleClearRefreshToken, 'authHandlers.handleClearRefreshToken');
        safeHandle('get-token', authHandlers.getRefreshToken, 'authHandlers.getRefreshToken');
        safeHandle('open-taqeem-login', authHandlers.handleOpenTaqeemLogin, 'authHandlers.handleOpenTaqeemLogin');
    }


    // Report handlers
    ipcMain.handle('validate-report', reportHandlers.handleValidateReport);
    ipcMain.handle('complete-flow', reportHandlers.handleCompleteFlow);
    ipcMain.handle('create-macros', reportHandlers.handleCreateMacros);
    ipcMain.handle('extract-asset-data', reportHandlers.handleExtractAssetData);

    ipcMain.handle('grab-macro-ids', reportHandlers.handleGrabMacroIds);
    ipcMain.handle('pause-grab-macro-ids', reportHandlers.handlePauseGrabMacroIds);
    ipcMain.handle('resume-grab-macro-ids', reportHandlers.handleResumeGrabMacroIds);
    ipcMain.handle('stop-grab-macro-ids', reportHandlers.handleStopGrabMacroIds);

    ipcMain.handle('retry-macro-ids', reportHandlers.handleRetryMacroIds);
    ipcMain.handle('pause-retry-macro-ids', reportHandlers.handlePauseRetryMacroIds);
    ipcMain.handle('resume-retry-macro-ids', reportHandlers.handleResumeRetryMacroIds);
    ipcMain.handle('stop-retry-macro-ids', reportHandlers.handleStopRetryMacroIds);


    ipcMain.handle('macro-fill', reportHandlers.handleMacroFill);
    ipcMain.handle('run-macro-edit-retry', reportHandlers.handleMacroFillRetry);

    ipcMain.handle('elrajhi-filler', reportHandlers.handleElRajhiUploadReport);
    ipcMain.handle('pause-elrajhi-batch', reportHandlers.handlePauseElRajhiBatch);
    ipcMain.handle('resume-elrajhi-batch', reportHandlers.handleResumeElRajhiBatch);
    ipcMain.handle('stop-elrajhi-batch', reportHandlers.handleStopElRajhiBatch);

    ipcMain.handle('elrajhi-check-batches', reportHandlers.handleCheckElRajhiBatches);
    ipcMain.handle('download-registration-certificates', reportHandlers.handleDownloadRegistrationCertificates);
    ipcMain.handle('elrajhi-reupload-report', reportHandlers.handleReuploadElRajhiReport);
    ipcMain.handle('duplicate-report', reportHandlers.handleDuplicateReport);
    ipcMain.handle('create-reports-by-batch', reportHandlers.handleCreateReportsByBatch);
    ipcMain.handle('create-report-by-id', reportHandlers.handleCreateReportById);
    ipcMain.handle('retry-ElRajhi-report', reportHandlers.handleRetryElRajhiReport);
    ipcMain.handle('retry-ElRajhi-report-by-report-ids', reportHandlers.handleRetryElRajhiReportByReportIds);
    ipcMain.handle('finalize-multiple-reports', reportHandlers.handleFinalizeMultipleReports);

    ipcMain.handle('pause-macro-fill', reportHandlers.handlePauseMacroFill);
    ipcMain.handle('resume-macro-fill', reportHandlers.handleResumeMacroFill);
    ipcMain.handle('stop-macro-fill', reportHandlers.handleStopMacroFill);

    ipcMain.handle('pause-create-macros', reportHandlers.handlePauseCreateMacros);
    ipcMain.handle('resume-create-macros', reportHandlers.handleResumeCreateMacros);
    ipcMain.handle('stop-create-macros', reportHandlers.handleStopCreateMacros);

    ipcMain.handle('full-check', reportHandlers.handleFullCheck);
    ipcMain.handle('pause-full-check', reportHandlers.handlePauseFullCheck);
    ipcMain.handle('resume-full-check', reportHandlers.handleResumeFullCheck);
    ipcMain.handle('stop-full-check', reportHandlers.handleStopFullCheck);

    ipcMain.handle('half-check', reportHandlers.handleHalfCheck);
    ipcMain.handle('pause-half-check', reportHandlers.handlePauseHalfCheck);
    ipcMain.handle('resume-half-check', reportHandlers.handleResumeHalfCheck);
    ipcMain.handle('stop-half-check', reportHandlers.handleStopHalfCheck);

    ipcMain.handle('delete-report', reportHandlers.deleteReport);
    ipcMain.handle('delete-multiple-reports', reportHandlers.deleteMultipleReports);
    ipcMain.handle('pause-delete-report', reportHandlers.pauseDeleteReport)
    ipcMain.handle('resume-delete-report', reportHandlers.resumeDeleteReport)
    ipcMain.handle('stop-delete-report', reportHandlers.stopDeleteReport)

    ipcMain.handle('delete-incomplete-assets', reportHandlers.deleteIncompleteAssets);
    ipcMain.handle('resume-delete-incomplete-assets', reportHandlers.resumeDeleteIncompleteAssets);
    ipcMain.handle('stop-delete-incomplete-assets', reportHandlers.stopDeleteIncompleteAssets);
    ipcMain.handle('pause-delete-incomplete-assets', reportHandlers.pauseDeleteIncompleteAssets);

    ipcMain.handle('handle-cancelled-report', reportHandlers.handleCancelledReport);


    // Worker handlers
    if (workerHandlers) {
        safeHandle('ping-worker', workerHandlers.handlePing, 'workerHandlers.handlePing');
        safeHandle('worker-status', workerHandlers.handleWorkerStatus, 'workerHandlers.handleWorkerStatus');
        safeHandle('show-open-dialog', workerHandlers.showOpenDialog, 'workerHandlers.showOpenDialog');
        safeHandle('show-open-dialog-pdfs', workerHandlers.showOpenDialogPdfs, 'workerHandlers.showOpenDialogPdfs');
        safeHandle('show-open-dialog-word', workerHandlers.showOpenDialogWord, 'workerHandlers.showOpenDialogWord');
        safeHandle('show-open-dialog-images', workerHandlers.showOpenDialogImages, 'workerHandlers.showOpenDialogImages');
        safeHandle('select-folder', workerHandlers.selectFolder, 'workerHandlers.selectFolder');
        safeHandle('read-folder', workerHandlers.readFolder, 'workerHandlers.readFolder');
        safeHandle('read-file', workerHandlers.readFile, 'workerHandlers.readFile');
        safeHandle('open-external', workerHandlers.openExternal, 'workerHandlers.openExternal');
        safeHandle('download-image', workerHandlers.downloadImage, 'workerHandlers.downloadImage');
        safeHandle('show-image-window', workerHandlers.showImageWindow, 'workerHandlers.showImageWindow');
    } else {
        console.error('[IPC] ERROR: workerHandlers not found!');
    }

    //Health handlers
    ipcMain.handle('check-server-health', healthHandlers.handleHealth);

    // Package handlers
    safeHandle('api-request', packageHandlers?.handleApiRequest, 'packageHandlers.handleApiRequest');

    // System info handlers
    safeHandle('read-ram', systemHandlers?.handleReadRam, 'systemHandlers.handleReadRam');

    // Valuation system
    ipcMain.handle('valuation-create-folders', valuationHandlers.handleCreateFolders);
    ipcMain.handle('valuation-update-calc', valuationHandlers.handleUpdateCalc);
    ipcMain.handle('valuation-create-docx', valuationHandlers.handleCreateDocx);
    ipcMain.handle('valuation-value-calcs', valuationHandlers.handleValueCalculations);
    ipcMain.handle('valuation-append-preview-images', valuationHandlers.handleAppendPreviewImages);
    ipcMain.handle('valuation-append-registration-certificates', valuationHandlers.handleAppendRegistrationCertificates);

    // Word utilities
    ipcMain.handle('word-copy-files', wordHandlers.handleCopyWordFile);

    console.log('[IPC] All handlers registered');
}

function unregisterIpcHandlers() {
    ipcMain.removeAllListeners('login');
    ipcMain.removeAllListeners('submit-otp');
    ipcMain.removeAllListeners('check-status');
    ipcMain.removeAllListeners('get-companies');
    ipcMain.removeAllListeners('navigate-to-company');
    ipcMain.removeAllListeners('register');
    ipcMain.removeAllListeners('open-taqeem-login');

    ipcMain.removeAllListeners('ping-worker');
    ipcMain.removeAllListeners('worker-status');
    ipcMain.removeAllListeners('show-open-dialog');
    ipcMain.removeAllListeners('show-open-dialog-pdfs');
    ipcMain.removeAllListeners('show-open-dialog-word');
    ipcMain.removeAllListeners('show-open-dialog-images');
    ipcMain.removeAllListeners('select-folder');
    ipcMain.removeAllListeners('read-folder');
    ipcMain.removeAllListeners('read-file');

    ipcMain.removeAllListeners('api-request');

    ipcMain.removeAllListeners('validate-report');
    ipcMain.removeAllListeners('create-macros');
    ipcMain.removeAllListeners('complete-flow');
    ipcMain.removeAllListeners('extract-asset-data');
    ipcMain.removeAllListeners('grab-macro-ids');
    ipcMain.removeAllListeners('retry-macro-ids');
    ipcMain.removeAllListeners('macro-fill');
    ipcMain.removeAllListeners('run-macro-edit-retry');

    ipcMain.removeAllListeners('elrajhi-filler');
    ipcMain.removeAllListeners('pause-elrajhi-batch');
    ipcMain.removeAllListeners('resume-elrajhi-batch');
    ipcMain.removeAllListeners('stop-elrajhi-batch');

    ipcMain.removeAllListeners('elrajhi-check-batches');
    ipcMain.removeAllListeners('download-registration-certificates');
    ipcMain.removeAllListeners('elrajhi-reupload-report');
    ipcMain.removeAllListeners('duplicate-report');
    ipcMain.removeAllListeners('create-reports-by-batch');
    ipcMain.removeAllListeners('create-report-by-id');
    ipcMain.removeAllListeners('retry-ElRajhi-report');
    ipcMain.removeAllListeners('retry-ElRajhi-report-by-report-ids');
    ipcMain.removeAllListeners('finalize-multiple-reports');

    ipcMain.removeAllListeners('pause-macro-fill');
    ipcMain.removeAllListeners('resume-macro-fill');
    ipcMain.removeAllListeners('stop-macro-fill');

    ipcMain.removeAllListeners('full-check');
    ipcMain.removeAllListeners('pause-full-check');
    ipcMain.removeAllListeners('resume-full-check');
    ipcMain.removeAllListeners('stop-full-check');

    ipcMain.removeAllListeners('half-check');
    ipcMain.removeAllListeners('pause-half-check');
    ipcMain.removeAllListeners('resume-half-check');
    ipcMain.removeAllListeners('stop-half-check');

    ipcMain.removeAllListeners('delete-report');
    ipcMain.removeAllListeners('delete-multiple-reports');
    ipcMain.removeAllListeners('pause-delete-report');
    ipcMain.removeAllListeners('resume-delete-report');
    ipcMain.removeAllListeners('stop-delete-report');

    ipcMain.removeAllListeners('delete-incomplete-assets');
    ipcMain.removeAllListeners('resume-delete-incomplete-assets');
    ipcMain.removeAllListeners('stop-delete-incomplete-assets');
    ipcMain.removeAllListeners('pause-delete-incomplete-assets');

    ipcMain.removeAllListeners('handle-cancelled-report');

    ipcMain.removeAllListeners('check-server-health');

    ipcMain.removeAllListeners('read-ram');

    ipcMain.removeAllListeners('valuation-create-folders');
    ipcMain.removeAllListeners('valuation-update-calc');
    ipcMain.removeAllListeners('valuation-create-docx');
    ipcMain.removeAllListeners('valuation-value-calcs');
    ipcMain.removeAllListeners('valuation-append-preview-images');
    ipcMain.removeAllListeners('valuation-append-registration-certificates');
    ipcMain.removeAllListeners('word-copy-files');

    console.log('[IPC] All handlers unregistered');
}

module.exports = {
    registerIpcHandlers,
    unregisterIpcHandlers
};
