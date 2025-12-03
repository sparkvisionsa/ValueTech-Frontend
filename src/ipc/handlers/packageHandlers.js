// main process - packageHandlers.js
const { ipcMain, session } = require('electron');
const axios = require('axios');
const process = require('process');

const parseSetCookieString = (cookieStr) => {
  const parts = cookieStr.split(';').map(p => p.trim());
  const [nameValue, ...attrs] = parts;
  const [name, ...valParts] = nameValue.split('=');
  const value = valParts.join('=');

  const parsed = { name, value };

  attrs.forEach(attr => {
    const [k, ...vParts] = attr.split('=');
    const key = k.trim().toLowerCase();
    const v = vParts.join('=').trim();
    if (key === 'httponly') parsed.httpOnly = true;
    else if (key === 'secure') parsed.secure = true;
    else if (key === 'samesite') parsed.sameSite = v.toLowerCase();
    else if (key === 'path') parsed.path = v;
    else if (key === 'domain') parsed.domain = v;
    else if (key === 'expires') parsed.expires = new Date(v).getTime() / 1000; // seconds
    else if (key === 'max-age') parsed.maxAge = Number(v);
  });

  return parsed;
};

const setElectronCookieForBaseUrl = async (baseUrl, cookieObj) => {
  // cookieObj: { name, value, domain?, path?, httpOnly?, secure?, sameSite?, expires?, maxAge? }
  let cookieUrl = baseUrl;
  if (!/^https?:\/\//i.test(cookieUrl)) {
    cookieUrl = `http://${cookieUrl}`;
  }

  const cookieToSet = {
    url: cookieUrl,
    name: cookieObj.name,
    value: cookieObj.value,
    path: cookieObj.path || '/',
    httpOnly: !!cookieObj.httpOnly,
    secure: !!cookieObj.secure,
    sameSite: (cookieObj.sameSite === 'strict' ? 'strict' : (cookieObj.sameSite === 'lax' ? 'lax' : 'no_restriction'))
  };

  // compute expirationDate (seconds since epoch) if possible
  if (cookieObj.expires) {
    cookieToSet.expirationDate = Number(cookieObj.expires);
  } else if (cookieObj.maxAge) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    cookieToSet.expirationDate = nowSeconds + Number(cookieObj.maxAge);
  }

  try {
    await session.defaultSession.cookies.set(cookieToSet);
    console.log('[Cookies] Set cookie:', cookieToSet.name, 'for', cookieToSet.url);
  } catch (err) {
    console.warn('[Cookies] Failed to set cookie', err);
  }
};

const packageHandlers = {
  async handleApiRequest(event, { method, url, data, headers = {} }) {
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
        const fullUrl = `${baseUrl}${url}`;
        const config = {
          method: method.toUpperCase(),
          url: fullUrl,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          data: data,
          timeout: 10000,
          validateStatus: () => true // handle non-2xx manually so we can inspect headers
        };

        console.log(`[API] Attempting ${config.method} ${config.url}`);
        const response = await axios(config);

        // If backend set Set-Cookie header(s), set them into Electron cookie store
        const setCookieHeader = response.headers && (response.headers['set-cookie'] || response.headers['Set-Cookie']);
        if (setCookieHeader) {
          const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
          for (const cookieStr of cookieStrings) {
            try {
              const parsed = parseSetCookieString(cookieStr);
              // Set cookie against the baseUrl so subsequent requests include it
              await setElectronCookieForBaseUrl(baseUrl, parsed);
            } catch (err) {
              console.warn('[Cookies] Could not parse/set Set-Cookie header:', cookieStr, err);
            }
          }
        } else if (response.data && response.data.refreshToken) {
          // fallback: server returned refreshToken in JSON payload — set it as HttpOnly cookie
          const refreshToken = response.data.refreshToken;
          const cookieObj = {
            name: 'refreshToken',
            value: refreshToken,
            httpOnly: true,
            secure: (process.env.NODE_ENV === 'production'),
            path: '/',
            maxAge: 7 * 24 * 60 * 60 // seconds
          };
          await setElectronCookieForBaseUrl(baseUrl, cookieObj);
        }

        // If status is 2xx return data, otherwise surface error to renderer
        if (response.status >= 200 && response.status < 300) {
          console.log(`[API] Success: ${config.method} ${config.url}`);
          return response.data;
        }

        // create error-like object to include status and body
        const msg = response.data?.message || `HTTP ${response.status}`;
        const err = new Error(msg);
        err.status = response.status;
        err.response = { data: response.data, headers: response.headers };
        throw err;
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