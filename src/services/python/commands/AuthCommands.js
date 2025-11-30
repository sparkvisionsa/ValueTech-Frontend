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

    async login(email, password, method) {
        return this._sendCommand({
            action: 'login',
            email,
            password,
            method
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

    async navigateToCompany(url) {
        return this._sendCommand({
            action: 'navigate-to-company',
            url
        });
    }

    async ping() {
        return this._sendCommand({
            action: 'ping'
        });
    }
}

module.exports = AuthCommands;