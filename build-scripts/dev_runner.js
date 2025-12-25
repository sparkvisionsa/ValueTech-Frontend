const { spawn } = require('child_process');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const npmExecPath = process.env.npm_execpath;
const hasNpmCli = npmExecPath && fs.existsSync(npmExecPath);

const spawnNpm = (args) => {
    if (hasNpmCli) {
        return spawn(process.execPath, [npmExecPath, ...args], { stdio: 'inherit' });
    }

    return spawn('npm', args, { stdio: 'inherit', shell: isWindows });
};

const renderer = spawnNpm(['run', 'dev:renderer']);
const electron = spawnNpm(['run', 'dev:electron']);

const shutdown = (signal) => {
    if (renderer && !renderer.killed) {
        renderer.kill(signal);
    }
    if (electron && !electron.killed) {
        electron.kill(signal);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

renderer.on('exit', (code) => {
    if (electron && !electron.killed) {
        electron.kill('SIGTERM');
    }
    if (code && code !== 0) {
        process.exit(code);
    }
});

electron.on('exit', (code, signal) => {
    if (renderer && !renderer.killed) {
        renderer.kill(signal || 'SIGTERM');
    }
    process.exit(code === null ? 0 : code);
});
