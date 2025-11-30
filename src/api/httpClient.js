const axios = require('axios');

const httpClient = axios.create({
  baseURL: 'https://future-electron-backend.onrender.com/api',
  timeout: 50000,
  headers: {
    'Content-Type': 'application/json'
  }
});

module.exports = httpClient;
