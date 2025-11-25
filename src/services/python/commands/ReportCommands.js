class ReportCommands {
    constructor(workerService) {
        if (!workerService) {
            throw new Error('WorkerService is required');
        }
        this.worker = workerService;
    }

    async _sendCommand(command) {
        return await this.worker.sendCommand(command);
    }

    async validateReport(reportId) {
        return this._sendCommand({
            action: 'validate-report',
            reportId
        });
    }

    async createMacros(reportId, macroCount, tabsNum, batchSize) {
        return this._sendCommand({
            action: 'create-macros',
            reportId,
            macroCount,
            tabsNum,
            batchSize
        });
    }

    async grabMacroIds(reportId, tabsNum) {
        return this._sendCommand({
            action: 'grab-macro-ids',
            reportId,
            tabsNum
        });
    }

    async macroFill(reportId, tabsNum) {
        return this._sendCommand({
            action: 'macro-edit',
            reportId,
            tabsNum
        });
    }

    async fullCheck(reportId, tabsNum) {
        return this._sendCommand({
            action: 'full-check',
            reportId,
            tabsNum
        });
    }

    async halfCheck(reportId, tabsNum) {
        return this._sendCommand({
            action: 'half-check',
            reportId,
            tabsNum
        });
    }
}

module.exports = ReportCommands;