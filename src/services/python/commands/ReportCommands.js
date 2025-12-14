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

    async ElRajhiUploadReport(batchId, tabsNum, pdfOnly, finalizeSubmission = true) {
        return this._sendCommand({
            action: 'elrajhi-filler',
            batchId,
            tabsNum,
            pdfOnly,
            finalizeSubmission
        });
    }

    async checkElrajhiBatches(batchId, tabsNum) {
        return this._sendCommand({
            action: 'elrajhi-check-batches',
            batchId,
            tabsNum
        });
    }

    async reuploadElrajhiReport(reportId) {
        return this._sendCommand({
            action: 'elrajhi-reupload-report',
            reportId
        });
    }

    async grabMacroIds(reportId, tabsNum) {
        return this._sendCommand({
            action: 'grab-macro-ids',
            reportId,
            tabsNum
        });
    }

    async retryMacroIds(reportId, tabsNum) {
        return this._sendCommand({
            action: 'retry-macro-ids',
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

    async pauseMacroFill(reportId) {
        return this._sendCommand({
            action: 'pause-macro-edit',
            reportId
        });
    }

    async resumeMacroFill(reportId) {
        return this._sendCommand({
            action: 'resume-macro-edit',
            reportId
        });
    }

    async stopMacroFill(reportId) {
        return this._sendCommand({
            action: 'stop-macro-edit',
            reportId
        });
    }

    async createReportsByBatch(batchId, tabsNum) {
        return this._sendCommand({
            action: 'create-reports-by-batch',
            batchId,
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

    async deleteReport(reportId, maxRounds) {
        return this._sendCommand({
            action: 'delete-report',
            reportId,
            maxRounds
        });
    }

    async deleteIncompleteAssets(reportId, maxRounds) {
        return this._sendCommand({
            action: 'delete-incomplete-assets',
            reportId,
            maxRounds
        });
    }

    async handleCancelledReport(reportId) {
        return this._sendCommand({
            action: 'handle-cancelled-report',
            reportId
        });
    }

    async duplicateReport(recordId, company) {
        return this._sendCommand({
            action: 'duplicate-report',
            recordId,
            company
        });
    }
}

module.exports = ReportCommands;
