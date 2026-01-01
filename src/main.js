const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { registerIpcHandlers, unregisterIpcHandlers } = require('./ipc');
const pythonAPI = require('./services/python/PythonAPI');

let mainWindow;

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || '';
const SHOULD_OPEN_DEVTOOLS = process.env.ELECTRON_DEVTOOLS === '1' || process.argv.includes('--devtools');
const STARTUP_TIMEOUT_MS = 60000;
const LOADING_ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
const LOADING_ICON_DATA_URL = fs.existsSync(LOADING_ICON_PATH)
    ? `data:image/png;base64,${fs.readFileSync(LOADING_ICON_PATH, 'base64')}`
    : '';
const LOADING_ICON_HTML = LOADING_ICON_DATA_URL
    ? `<div class="icon-wrap"><img src="${LOADING_ICON_DATA_URL}" alt="App icon" /></div>`
    : '<div class="icon-wrap icon-fallback" aria-hidden="true">V</div>';
const LOADING_HTML = 'data:text/html,' + encodeURIComponent(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Loading</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0f1115; color: #f5f5f5; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .wrap { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .icon-wrap { width: 72px; height: 72px; border-radius: 16px; background: #1b1f2a; display: grid; place-items: center; box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
    .icon-wrap img { width: 70%; height: 70%; object-fit: contain; }
    .icon-fallback { font-size: 30px; font-weight: 700; letter-spacing: 1px; }
    .spinner { width: 24px; height: 24px; border: 3px solid rgba(245,245,245,0.2); border-top-color: #f5f5f5; border-radius: 50%; animation: spin 0.8s linear infinite; }
    .title { font-size: 14px; letter-spacing: 0.6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    ${LOADING_ICON_HTML}
    <div class="spinner"></div>
    <div class="title">Starting</div>
  </div>
</body>
</html>`);

function isDevelopment() {
    return process.env.NODE_ENV === 'development' || !app.isPackaged;
}

function buildErrorPage(message) {
    return 'data:text/html,' + encodeURIComponent(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Startup error</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #120f10; color: #f5f5f5; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .wrap { max-width: 520px; padding: 24px; text-align: center; }
    p { opacity: 0.85; }
    code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>Application startup error</h2>
    <p>${message}</p>
  </div>
</body>
</html>`);
}

function waitForFile(filePath, timeoutMs = STARTUP_TIMEOUT_MS, intervalMs = 250) {
    return new Promise((resolve) => {
        const start = Date.now();
        const timer = setInterval(() => {
            if (fs.existsSync(filePath)) {
                clearInterval(timer);
                resolve(true);
                return;
            }
            if (Date.now() - start > timeoutMs) {
                clearInterval(timer);
                resolve(false);
            }
        }, intervalMs);
    });
}

function isDevServerAvailable(url, timeoutMs = 300) {
    return new Promise((resolve) => {
        if (!url) {
            resolve(false);
            return;
        }

        let parsed;
        try {
            parsed = new URL(url);
        } catch (error) {
            resolve(false);
            return;
        }

        const client = parsed.protocol === 'https:' ? https : http;
        const request = client.request(
            {
                method: 'GET',
                host: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname || '/',
                timeout: timeoutMs
            },
            (response) => {
                response.resume();
                resolve(response.statusCode >= 200 && response.statusCode < 500);
            }
        );

        request.on('timeout', () => {
            request.destroy();
            resolve(false);
        });

        request.on('error', () => resolve(false));
        request.end();
    });
}

async function loadDevRenderer(window) {
    const distIndex = path.join(__dirname, '../dist/index.html');
    const devServerReady = await isDevServerAvailable(DEV_SERVER_URL);

    if (devServerReady) {
        await window.loadURL(DEV_SERVER_URL);
        if (SHOULD_OPEN_DEVTOOLS) {
            window.webContents.openDevTools();
        }
        return;
    }

    if (!fs.existsSync(distIndex)) {
        const found = await waitForFile(distIndex);
        if (!found) {
            await window.loadURL(buildErrorPage('Renderer build did not appear in time. Run the webpack watcher and try again.'));
            return;
        }
    }

    await window.loadFile(distIndex);
    if (SHOULD_OPEN_DEVTOOLS) {
        window.webContents.openDevTools();
    }
}

async function loadProdRenderer(window) {
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
        await window.loadFile(unpackedIndex);
        return;
    }

    if (fs.existsSync(asarIndex)) {
        console.log('[MAIN] Loading index from app.asar (fallback)');
        await window.loadFile(asarIndex);
        return;
    }

    console.error('[MAIN] ERROR: index.html not found in either resources/dist or app.asar');
    await window.loadURL(buildErrorPage('index.html not found. Please reinstall the application.'));
}

function createWindow() {
    const devMode = isDevelopment();
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
        show: devMode
    });

    if (devMode) {
        mainWindow.loadURL(LOADING_HTML);
        loadDevRenderer(mainWindow).catch((error) => {
            console.error('[MAIN] Dev renderer load failed:', error);
        });
    } else {
        loadProdRenderer(mainWindow).catch((error) => {
            console.error('[MAIN] Prod renderer load failed:', error);
        });
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Electron app event handlers
app.whenReady().then(() => {
    // Register IPC handlers BEFORE creating window to avoid race conditions
    registerIpcHandlers();
    createWindow();
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
        // Ensure handlers are registered before creating window
        registerIpcHandlers();
        createWindow();
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
    });
});
