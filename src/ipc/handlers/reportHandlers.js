const pythonAPI = require('../../services/python/PythonAPI');
const { extractAssetDataFromExcel } = require('../../services/excel/extractAssetDataFromExcel');
const path = require('path');
const fs = require('fs');
const { BrowserWindow } = require('electron');

const reportHandlers = {
    async handleValidateReport(event, reportId) {
        try {
            console.log('[MAIN] Received validate report request:', reportId);

            const result = await pythonAPI.report.validateReport(reportId);
            console.log("Result at handler:", result);

            if (result.status === 'SUCCESS') {
                return { status: 'SUCCESS', message: 'Report is valid' };

            } else if (result.status === 'NOT_FOUND') {
                return { status: 'NOT_FOUND', message: 'Report not found' };

            } else if (result.status === 'MACROS_EXIST') {
                return { status: 'MACROS_EXIST', message: 'Report has macros' };

            }
            else {
                return { status: 'ERROR', error: result.error || 'Report validation failed' };
            }

        } catch (error) {
            console.error('[MAIN] Validate report error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },

    async handleCreateMacros(event, reportId, macroCount, tabsNum, batchSize) {
        try {
            console.log('[MAIN] Received create macros request:', reportId, macroCount, tabsNum, batchSize);

            const result = await pythonAPI.report.createMacros(reportId, macroCount, tabsNum, batchSize);
            console.log("Result at handler:", result);

            if (result.status === 'SUCCESS') {
                return { status: 'SUCCESS', message: 'Macros created' };

            } else if (result.status === 'FAILED') {
                return { status: 'FAILED', error: result.error || 'Macro creation failed' };

            }
            else {
                return { status: 'ERROR', error: result.error || 'Macro creation failed' };
            }

        } catch (error) {
            console.error('[MAIN] Create macros error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },

    async handleExtractAssetData(event, excelFilePathOrDialogResult, options = {}) {
        try {
            console.log('[MAIN] handleExtractAssetData called with:', { excelFilePathOrDialogResult, options });

            let excelFilePath = null;

            if (!excelFilePathOrDialogResult) {
                throw new Error('No file path provided to extract-asset-data');
            }

            if (typeof excelFilePathOrDialogResult === 'string') {
                excelFilePath = excelFilePathOrDialogResult;
            } else if (Array.isArray(excelFilePathOrDialogResult) && excelFilePathOrDialogResult.length > 0) {
                excelFilePath = excelFilePathOrDialogResult[0];
            } else if (typeof excelFilePathOrDialogResult === 'object') {
                if (Array.isArray(excelFilePathOrDialogResult.filePaths) && excelFilePathOrDialogResult.filePaths.length > 0) {
                    excelFilePath = excelFilePathOrDialogResult.filePaths[0];
                } else if (typeof excelFilePathOrDialogResult.path === 'string') {
                    excelFilePath = excelFilePathOrDialogResult.path;
                } else if (typeof excelFilePathOrDialogResult.filePath === 'string') {
                    excelFilePath = excelFilePathOrDialogResult.filePath;
                }
            }

            if (!excelFilePath) {
                throw new Error('Could not determine excel file path from the provided argument.');
            }

            if (!fs.existsSync(excelFilePath)) {
                throw new Error(`Excel file not found: ${excelFilePath}`);
            }

            const result = await extractAssetDataFromExcel(excelFilePath, options);

            return result;
        } catch (err) {
            console.error('[MAIN] Extract asset data error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleCreateReportsByBatch(event, batchId, tabsNum) {
        try {
            return await pythonAPI.report.createReportsByBatch(batchId, tabsNum);
        } catch (err) {
            console.error('[MAIN] Create reports by batch error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleGrabMacroIds(event, reportId, tabsNum) {
        try {
            return await pythonAPI.report.grabMacroIds(reportId, tabsNum);
        } catch (err) {
            console.error('[MAIN] Grab macro IDs error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleElRajhiUploadReport(event, batchId, tabsNum, pdfOnly, finalizeSubmission = true) {
        try {
            return await pythonAPI.report.ElRajhiUploadReport(batchId, tabsNum, pdfOnly, finalizeSubmission);
        } catch (err) {
            console.error('[MAIN] ElRajhiUploadReport error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleCheckElRajhiBatches(event, batchId, tabsNum) {
        try {
            return await pythonAPI.report.checkElrajhiBatches(batchId, tabsNum);
        } catch (err) {
            console.error('[MAIN] Check ElRajhi batches error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleReuploadElRajhiReport(event, reportId) {
        try {
            return await pythonAPI.report.reuploadElrajhiReport(reportId);
        } catch (err) {
            console.error('[MAIN] Reupload ElRajhi report error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleRetryMacroIds(event, reportId, tabsNum) {
        try {
            return await pythonAPI.report.retryMacroIds(reportId, tabsNum);
        } catch (err) {
            console.error('[MAIN] Retry macro IDs error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleMacroFill(event, reportId, tabsNum) {
        try {
            // Get the window that sent the event
            const senderWindow = BrowserWindow.fromWebContents(event.sender);

            // Register progress callback
            pythonAPI.workerService.registerProgressCallback(reportId, (progressData) => {
                console.log('[MAIN] Progress update:', progressData);
                // Send progress to renderer
                if (senderWindow && !senderWindow.isDestroyed()) {
                    senderWindow.webContents.send('macro-fill-progress', progressData);
                }
            });

            // Execute macro fill
            const result = await pythonAPI.report.macroFill(reportId, tabsNum);

            // Unregister progress callback
            pythonAPI.workerService.unregisterProgressCallback(reportId);

            return result;
        } catch (err) {
            console.error('[MAIN] Macro fill error:', err && err.stack ? err.stack : err);
            // Unregister on error
            pythonAPI.workerService.unregisterProgressCallback(reportId);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handlePauseMacroFill(event, reportId) {
        try {
            console.log('[MAIN] Received pause macro fill request:', reportId);
            const result = await pythonAPI.report.pauseMacroFill(reportId);
            console.log('[MAIN] Pause result:', result);
            return result;
        } catch (err) {
            console.error('[MAIN] Pause macro fill error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleResumeMacroFill(event, reportId) {
        try {
            console.log('[MAIN] Received resume macro fill request:', reportId);
            const result = await pythonAPI.report.resumeMacroFill(reportId);
            console.log('[MAIN] Resume result:', result);
            return result;
        } catch (err) {
            console.error('[MAIN] Resume macro fill error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleStopMacroFill(event, reportId) {
        try {
            console.log('[MAIN] Received stop macro fill request:', reportId);
            const result = await pythonAPI.report.stopMacroFill(reportId);
            console.log('[MAIN] Stop result:', result);
            return result;
        } catch (err) {
            console.error('[MAIN] Stop macro fill error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleFullCheck(event, reportId, tabsNum) {
        try {
            return await pythonAPI.report.fullCheck(reportId, tabsNum);
        } catch (err) {
            console.error('[MAIN] Full check error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleHalfCheck(event, reportId, tabsNum) {
        try {
            return await pythonAPI.report.halfCheck(reportId, tabsNum);
        } catch (err) {
            console.error('[MAIN] Half check error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async deleteReport(event, reportId, maxRounds) {
        try {
            return await pythonAPI.report.deleteReport(reportId, maxRounds);
        } catch (err) {
            console.error('[MAIN] Delete report error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async deleteIncompleteAssets(event, reportId, maxRounds) {
        try {
            return await pythonAPI.report.deleteIncompleteAssets(reportId, maxRounds);
        } catch (err) {
            console.error('[MAIN] Delete incomplete assets error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleCancelledReport(event, reportId) {
        try {
            return await pythonAPI.report.handleCancelledReport(reportId);
        } catch (err) {
            console.error('[MAIN] Handle cancelled report error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },

    async handleDuplicateReport(event, recordId, company) {
        try {
            return await pythonAPI.report.duplicateReport(recordId, company);
        } catch (err) {
            console.error('[MAIN] Duplicate report navigation error:', err && err.stack ? err.stack : err);
            return { status: 'FAILED', error: err.message || String(err) };
        }
    },
};

module.exports = reportHandlers;
