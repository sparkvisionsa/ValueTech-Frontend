const { session } = require('electron');
const pythonAPI = require('../../services/python/PythonAPI');

const authHandlers = {
    async handleLogin(event, credentials) {
        try {
            console.log('[MAIN] Received login request:', credentials.email);
            const result = await pythonAPI.auth.login(credentials.email, credentials.password, credentials.method);

            if (result.status === 'OTP_REQUIRED') {
                return { status: 'OTP_REQUIRED', message: 'Please enter OTP' };
            } else if (result.status === 'SUCCESS') {
                return { status: 'SUCCESS', message: 'Login successful' };
            } else {
                return { status: 'ERROR', error: result.error || 'Login failed' };
            }
        } catch (error) {
            console.error('[MAIN] Login error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },

    async handleSubmitOtp(event, otp) {
        try {
            console.log('[MAIN] Received OTP:', otp);
            const result = await pythonAPI.auth.submitOtp(otp);

            if (result.status === 'SUCCESS') {
                return { status: 'SUCCESS', message: 'Authentication complete' };
            } else {
                return { status: 'ERROR', error: result.error || 'OTP verification failed' };
            }
        } catch (error) {
            console.error('[MAIN] OTP error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },

    async getRefreshToken(event, opts = {}) {
        const COOKIE_NAME = opts.name || 'refreshToken';

        try {
            const cookies = await session.defaultSession.cookies.get({ name: COOKIE_NAME });
            if (cookies.length > 0) {
                // Return the first matching cookie's value
                return { status: 'SUCCESS', token: cookies[0].value };
            } else {
                return { status: 'NOT_FOUND' };
            }
        } catch (error) {
            console.error('[MAIN] getRefreshToken error:', error);
            return { status: 'ERROR', error: error.message || String(error) };
        }
    },


    async handleCheckStatus(event) {
        let result;
        try {
            console.log('[MAIN] Received check status request');
            result = await pythonAPI.auth.checkStatus();
            if (!result) return { status: 'ERROR', error: 'Browser status check failed' };

            console.log("Result at handler:", result);

            return {
                status: result.status,
                browserOpen: result.browserOpen,
                message: result.message,
                error: result.error
            };

        } catch (error) {
            console.error('[MAIN] Check status error:', error);
            return {
                status: 'ERROR',
                error: error.message,
                browserOpen: result?.browserOpen || false,
                message: result?.message || 'Status check failed'
            };
        }
    },

    async handleGetCompanies(event) {
        try {
            console.log('[MAIN] Received get companies request');
            const result = await pythonAPI.auth.getCompanies();
            if (!result) return { status: 'ERROR', error: 'Failed to get companies' };

            console.log("Result at handler:", result);

            return {
                status: result.status,
                data: result.data
            };

        } catch (error) {
            console.error('[MAIN] Get companies error:', error);
            return {
                status: 'ERROR',
                error: error.message
            };
        }
    },

    async handleNavigateToCompany(event, company) {
        try {
            console.log('[MAIN] Received navigate to company request:', company);
            const result = await pythonAPI.auth.navigateToCompany(company);
            if (!result) return { status: 'ERROR', error: 'Failed to navigate to company' };

            console.log("Result at handler:", result);

            return {
                status: result.status,
                message: result.message,
                url: result.url,
                selectedCompany: result.selectedCompany,
                error: result.error
            };

        } catch (error) {
            console.error('[MAIN] Navigate to company error:', error);
            return {
                status: 'ERROR',
                error: error.message
            };
        }
    },

    async handleRegister(event, userData) {
        try {
            console.log('[MAIN] Received registration request');
            const result = await pythonAPI.auth.register(userData);

            if (result.status === 'SUCCESS') {
                return { status: 'SUCCESS', message: 'Registration successful' };
            } else {
                return { status: 'ERROR', error: result.error || 'Registration failed' };
            }
        } catch (error) {
            console.error('[MAIN] Registration error:', error);
            return { status: 'ERROR', error: error.message };
        }
    },


    async handleSetRefreshToken(event, opts = {}) {
        const {
            baseUrl,
            token,
            name = 'refreshToken',
            path = '/',
            maxAgeDays = 7,
            sameSite = 'lax',
            secure = (process.env.NODE_ENV === 'production'),
            httpOnly = true
        } = opts;

        if (!baseUrl || !token) {
            return { status: 'ERROR', error: 'baseUrl and token are required' };
        }

        try {
            // Ensure url includes protocol
            let cookieUrl = baseUrl;
            if (!/^https?:\/\//i.test(cookieUrl)) cookieUrl = `http://${cookieUrl}`;

            const nowSeconds = Math.floor(Date.now() / 1000);
            const expirationDate = nowSeconds + (Number(maxAgeDays) * 24 * 60 * 60);

            const cookieData = {
                url: cookieUrl,
                name,
                value: token,
                path,
                httpOnly: !!httpOnly,
                secure: !!secure,
                sameSite: (sameSite === 'strict' ? 'strict' : (sameSite === 'no_restriction' ? 'no_restriction' : 'lax')),
                expirationDate
            };

            await session.defaultSession.cookies.set(cookieData);
            console.log('[MAIN] Set cookie:', name, 'for', cookieUrl);

            return { status: 'SUCCESS' };
        } catch (error) {
            console.error('[MAIN] Failed to set cookie:', error);
            return { status: 'ERROR', error: error.message || String(error) };
        }
    },

    /**
     * Clears cookie (by name) for the given baseUrl.
     * opts: { baseUrl (required), name (optional, default 'refreshToken') }
     */
    async handleClearRefreshToken(event, opts = {}) {
        const { baseUrl, name = 'refreshToken' } = opts;
        if (!baseUrl) {
            return { status: 'ERROR', error: 'baseUrl is required' };
        }
        try {
            let cookieUrl = baseUrl;
            if (!/^https?:\/\//i.test(cookieUrl)) cookieUrl = `http://${cookieUrl}`;

            // Electron cookies.remove expects (url, name)
            await session.defaultSession.cookies.remove(cookieUrl, name);
            console.log('[MAIN] Cleared cookie:', name, 'for', cookieUrl);
            return { status: 'SUCCESS' };
        } catch (error) {
            console.error('[MAIN] Failed to clear cookie:', error);
            return { status: 'ERROR', error: error.message || String(error) };
        }
    }
};

module.exports = authHandlers;
