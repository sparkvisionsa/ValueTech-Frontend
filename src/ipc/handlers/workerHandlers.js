const pythonAPI = require('../../services/python/PythonAPI');
const { dialog } = require('electron');

const workerHandlers = {
    async handlePing() {
        try {
            const result = await pythonAPI.auth.ping();
            return { status: 'SUCCESS', result };
        } catch (error) {
            console.error('[MAIN] Ping error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },

    async handleWorkerStatus() {
        try {
            const isReady = pythonAPI.isReady();
            return { status: 'SUCCESS', isReady };
        } catch (error) {
            console.error('[MAIN] Worker status error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },

    async showOpenDialog() {
        try {
            const { cancelled, filePaths } = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
                ]
            });
            return { status: 'SUCCESS', filePaths, cancelled };
        } catch (error) {
            console.error('[MAIN] Open dialog error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },

    async showOpenDialogPdfs() {
        try {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                properties: ['openFile', 'multiSelections'], // ✅ Allow multiple files
                filters: [
                    { name: 'PDF Files', extensions: ['pdf'] }
                ]
            });
            return { status: 'SUCCESS', filePaths, canceled };
        } catch (error) {
            console.error('[MAIN] Open PDF dialog error:', error);
            return { status: 'ERROR', error: error.message };
        }
    }
};

module.exports = workerHandlers;