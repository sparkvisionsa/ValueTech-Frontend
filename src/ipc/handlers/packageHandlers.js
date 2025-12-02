const { ipcMain } = require('electron');
const axios = require('axios');
const process = require('process');

const packageHandlers = {
    async handleApiRequest(event, { method, url, data }) {
        // Try multiple backend candidates: env var first, then local, then deployed
        const candidates = [];
        
        const envUrl = process.env.BACKEND_URL;
        if (envUrl) {
            candidates.push(envUrl.replace(/\/$/, ''));
        }
        
        // Common local dev addresses
        candidates.push(
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://future-electron-backend.onrender.com'
        );
        
        let lastError = null;
        
        for (const baseUrl of candidates) {
            try {
                const config = {
                    method: method.toUpperCase(),
                    url: `${baseUrl}${url}`,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    data: data,
                    timeout: 10000
                };

                console.log(`[API] Attempting ${method.toUpperCase()} ${config.url}`);
                const response = await axios(config);
                console.log(`[API] Success: ${method.toUpperCase()} ${config.url}`);
                return response.data;
            } catch (error) {
                lastError = error;
                const status = error.response?.status;
                const message = error.response?.data?.message || error.message;
                console.log(`[API] Failed (${status || 'error'}): ${baseUrl}${url} - ${message}`);
                
                // If 404, try next candidate
                if (status === 404) {
                    continue;
                }
                
                // For other errors, throw immediately so UI gets response details
                throw error;
            }
        }
        
        // All candidates exhausted
        const error = new Error(`No reachable backend. Last error: ${lastError?.message}`);
        error.isNetworkError = true;
        throw error;
    }
};

module.exports = packageHandlers;
