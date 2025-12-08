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
    },

    async selectFolder() {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory', 'multiSelections']
        });

        if (!result.canceled) {
            return { folderPath: result.filePaths[0] };
        }
        return null;
    },

    async readFolder(event, folderPath) {
        try {
            const fs = require('fs').promises;
            const path = require('path');

            // Function to recursively read directory
            const readDirRecursive = async (dir) => {
                const items = await fs.readdir(dir);
                const files = [];

                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = await fs.stat(fullPath);

                    if (stat.isDirectory()) {
                        // Recursively read subdirectory
                        const subFiles = await readDirRecursive(fullPath);
                        files.push(...subFiles);
                    } else if (stat.isFile()) {
                        // Only include Excel and PDF files
                        const ext = path.extname(item).toLowerCase();
                        if (['.xlsx', '.xls', '.pdf'].includes(ext)) {
                            files.push({
                                name: item,
                                path: fullPath,
                                size: stat.size,
                                lastModified: stat.mtimeMs,
                                type: ext === '.pdf' ? 'application/pdf' :
                                    ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                                        'application/vnd.ms-excel'
                            });
                        }
                    }
                }

                return files;
            };

            // Read the folder recursively
            const files = await readDirRecursive(folderPath);

            return {
                files: files,
                folderPath: folderPath,
                count: files.length
            };

        } catch (error) {
            console.error('[MAIN] Read folder error:', error);
            return {
                files: [],
                folderPath: folderPath,
                error: error.message
            };
        }
    },

    async readFIle(event, filePath) {
        try {
            const fs = require('fs').promises;
            const buffer = await fs.readFile(filePath);
            return {
                success: true,
                data: buffer,
                // Convert to Array for IPC transmission
                arrayBuffer: Array.from(buffer)
            };
        } catch (error) {
            console.error('[MAIN] Read file error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

module.exports = workerHandlers;