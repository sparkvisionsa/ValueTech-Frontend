const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers, unregisterIpcHandlers } = require('./ipc');
const pythonAPI = require('./services/python/PythonAPI');

let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        show: false
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        // Robust production loader: prefer an unpacked copy in resources/dist,
        // fallback to the app.asar copy under __dirname/../dist
        const unpackedIndex = path.join(process.resourcesPath, 'dist', 'index.html');
        const asarIndex = path.join(__dirname, '../dist/index.html');

        console.log('[MAIN] NODE_ENV=production. Checking for index files:');
        console.log('[MAIN] unpackedIndex =', unpackedIndex);
        console.log('[MAIN] asarIndex =', asarIndex);
        try {
            console.log('[MAIN] resourcesPath listing:', fs.readdirSync(process.resourcesPath));
        } catch (e) {
            console.warn('[MAIN] cannot read resourcesPath:', e && e.message);
        }

        if (fs.existsSync(unpackedIndex)) {
            console.log('[MAIN] Loading unpacked index from resources/dist');
            mainWindow.loadFile(unpackedIndex);
        } else if (fs.existsSync(asarIndex)) {
            console.log('[MAIN] Loading index from app.asar (fallback)');
            mainWindow.loadFile(asarIndex);
        } else {
            console.error('[MAIN] ERROR: index.html not found in either resources/dist or app.asar');
            // Show a minimal error page so user isn't left with a blank window
            const fallbackHtml = `data:text/html,
                <h2>Application startup error</h2>
                <p>index.html not found. Please reinstall the application.</p>`;
            mainWindow.loadURL(fallbackHtml);
        }
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Electron app event handlers
app.whenReady().then(() => {
    createWindow();
    registerIpcHandlers(); // Register all IPC handlers
});

app.on('window-all-closed', async () => {
    // Close Python worker gracefully when app is quitting
    try {
        await pythonAPI.closeWorker();
    } catch (error) {
        console.error('[MAIN] Error closing worker:', error);
    }

    // Unregister IPC handlers to prevent memory leaks
    unregisterIpcHandlers();

    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        registerIpcHandlers(); // Re-register handlers for new window
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
    });
});