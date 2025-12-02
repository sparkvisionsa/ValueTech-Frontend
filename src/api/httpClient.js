const axios = require('axios');

const httpClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 50000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

// Request interceptor that always sends the refresh token returned by window.electronAPI.getToken()
httpClient.interceptors.request.use(async (config) => {
  const tokenObj = await window.electronAPI.getToken();
  const refreshToken = tokenObj?.refreshToken || tokenObj?.token;

  if (refreshToken) {
    // Attach as a cookie header because backend expects req.cookies.refreshToken
    config.headers['Cookie'] = `refreshToken=${refreshToken}`;
  }

  return config;
});


module.exports = httpClient;