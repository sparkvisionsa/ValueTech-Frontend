class AuthCommands {
    constructor(workerService) {
        if (!workerService) {
            throw new Error('WorkerService is required');
        }
        this.worker = workerService;
    }

    async _sendCommand(command) {
        return await this.worker.sendCommand(command);
    }

    async login(email, password, method, autoOtp = false) {
        return this._sendCommand({
            action: 'login',
            email,
            password,
            method,
            autoOtp
        });
    }

    async publicLogin(isAuth) {
        return this._sendCommand({
            action: 'public-login',
            isAuth
        });
    }

    async submitOtp(otp) {
        return this._sendCommand({
            action: 'otp',
            otp
        });
    }

    async checkStatus() {
        return this._sendCommand({
            action: 'check-status'
        });
    }

    async getCompanies() {
        return this._sendCommand({
            action: 'get-companies'
        });
    }

    async navigateToCompany(company) {
        return this._sendCommand({
            action: 'navigate-to-company',
            company
        });
    }

    async getReportsByBatch(batchId) {
        return this._sendCommand({
            action: 'get-reports-by-batch',
            batchId
        });
    }

    async ping() {
        return this._sendCommand({
            action: 'ping'
        });
    }

    async register(userData) {
        return this._sendCommand({
            action: 'register',
            ...userData
        });
    }
}

module.exports = AuthCommands;
