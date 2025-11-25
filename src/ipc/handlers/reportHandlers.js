const pythonAPI = require('../../services/python/PythonAPI');
const { extractAssetDataFromExcel } = require('../../services/excel/extractAssetDataFromExcel');
const path = require('path');
const fs = require('fs');

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

            // Normalize if the renderer accidentally passed the whole dialog result
            if (!excelFilePathOrDialogResult) {
                throw new Error('No file path provided to extract-asset-data');
            }

            if (typeof excelFilePathOrDialogResult === 'string') {
                excelFilePath = excelFilePathOrDialogResult;
            } else if (Array.isArray(excelFilePathOrDialogResult) && excelFilePathOrDialogResult.length > 0) {
                excelFilePath = excelFilePathOrDialogResult[0];
            } else if (typeof excelFilePathOrDialogResult === 'object') {
                // Accept shapes like { status: 'SUCCESS', filePaths: [...], cancelled: false }
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

            // Optional: ensure file exists
            if (!fs.existsSync(excelFilePath)) {
                throw new Error(`Excel file not found: ${excelFilePath}`);
            }

            // Call your extractor. Ensure the extractor is exported correctly.
            // Pass options (e.g. { cleanup: false } for preview so original file isn't deleted).
            const result = await extractAssetDataFromExcel(excelFilePath, options);

            // Return the extractor's result object (normalized).
            return result; // e.g. { status: "SUCCESS", data: [...], info: {...} }
        } catch (err) {
            console.error('[MAIN] Extract asset data error:', err && err.stack ? err.stack : err);
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

    async handleMacroFill(event, reportId, tabsNum) {
        try {
            return await pythonAPI.report.macroFill(reportId, tabsNum);
        } catch (err) {
            console.error('[MAIN] Macro fill error:', err && err.stack ? err.stack : err);
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
};

module.exports = reportHandlers;