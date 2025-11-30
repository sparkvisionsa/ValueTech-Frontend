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

    async handleCheckStatus(event) {
        let result;
        try {
            console.log('[MAIN] Received check status request');

            result = await pythonAPI.auth.checkStatus();
            if (!result) return { status: 'ERROR', error: 'Browser status check failed' };

            console.log("Result at handler:", result);

            // Make sure all properties are passed through
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

            // Make sure all properties are passed through
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

    async handleNavigateToCompany(event, url) {
        try {
            console.log('[MAIN] Received navigate to company request:', url);

            const result = await pythonAPI.auth.navigateToCompany(url);

            if (!result) return { status: 'ERROR', error: 'Failed to navigate to company' };

            console.log("Result at handler:", result);

            // Make sure all properties are passed through
            return {
                status: result.status,
                data: result.data
            };

        } catch (error) {
            console.error('[MAIN] Navigate to company error:', error);
            return {
                status: 'ERROR',
                error: error.message
            };
        }
    }
};

module.exports = authHandlers;