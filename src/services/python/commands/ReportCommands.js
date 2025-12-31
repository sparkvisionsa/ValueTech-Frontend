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

    async completeFlow(reportId, tabsNum) {
        return this._sendCommand({
            action: 'complete-flow',
            reportId,
            tabsNum
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

    // NEW: Pause/Resume/Stop for create-macros
    async pauseCreateMacros(reportId) {
        return this._sendCommand({
            action: 'pause-create-macros',
            reportId
        });
    }

    async resumeCreateMacros(reportId) {
        return this._sendCommand({
            action: 'resume-create-macros',
            reportId
        });
    }

    async stopCreateMacros(reportId) {
        return this._sendCommand({
            action: 'stop-create-macros',
            reportId
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

    async pauseElRajhiBatch(batchId) {
        return this._sendCommand({
            action: 'pause-elrajhi-batch',
            batchId
        });
    }

    async resumeElRajhiBatch(batchId) {
        return this._sendCommand({
            action: 'resume-elrajhi-batch',
            batchId
        });
    }

    async stopElRajhiBatch(batchId) {
        return this._sendCommand({
            action: 'stop-elrajhi-batch',
            batchId
        });
    }

    async checkElrajhiBatches(batchId, tabsNum) {
        return this._sendCommand({
            action: 'elrajhi-check-batches',
            batchId,
            tabsNum
        });
    }

    async downloadRegistrationCertificates(reports, downloadPath, tabsNum) {
        return this._sendCommand({
            action: 'download-registration-certificates',
            reports,
            downloadPath,
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

    async pauseGrabMacroIds(reportId) {
        return this._sendCommand({
            action: 'pause-grab-macro-ids',
            reportId
        });
    }

    async resumeGrabMacroIds(reportId) {
        return this._sendCommand({
            action: 'resume-grab-macro-ids',
            reportId
        });
    }

    async stopGrabMacroIds(reportId) {
        return this._sendCommand({
            action: 'stop-grab-macro-ids',
            reportId
        });
    }

    async retryMacroIds(reportId, tabsNum) {
        return this._sendCommand({
            action: 'retry-macro-ids',
            reportId,
            tabsNum
        });
    }

    async pauseRetryMacroIds(reportId) {
        return this._sendCommand({
            action: 'pause-retry-macro-ids',
            reportId
        });
    }

    async resumeRetryMacroIds(reportId) {
        return this._sendCommand({
            action: 'resume-retry-macro-ids',
            reportId
        });
    }

    async stopRetryMacroIds(reportId) {
        return this._sendCommand({
            action: 'stop-retry-macro-ids',
            reportId
        });
    }

    async macroFill(reportId, tabsNum) {
        return this._sendCommand({
            action: 'macro-edit',
            reportId,
            tabsNum
        });
    }

    async macroFillRetry(reportId, tabsNum) {
        return this._sendCommand({
            action: 'run-macro-edit-retry',
            reportId,
            tabsNum
        });
    }

    async retryAlRahjiReport(batchId, tabsNum) {
        return this._sendCommand({
            action: 'retry-ElRajhi-report',
            batchId,
            tabsNum
        });
    }

    async finalizeMultipleReports(reportIds) {
        return this._sendCommand({
            action: 'finalize-multiple-reports',
            reportIds
        });
    }

    async retryElRajhiReportByReportIds(reportIds, tabsNum) {
        return this._sendCommand({
            action: 'elrajhi-retry-by-report-ids',
            reportIds,
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

    async createReportById(recordId, tabsNum) {
        return this._sendCommand({
            action: 'create-report-by-id',
            recordId,
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

    async pauseFullCheck(reportId) {
        return this._sendCommand({
            action: 'pause-full-check',
            reportId
        });
    }

    async resumeFullCheck(reportId) {
        return this._sendCommand({
            action: 'resume-full-check',
            reportId
        });
    }

    async stopFullCheck(reportId) {
        return this._sendCommand({
            action: 'stop-full-check',
            reportId
        });
    }

    async halfCheck(reportId, tabsNum) {
        return this._sendCommand({
            action: 'half-check',
            reportId,
            tabsNum
        });
    }

    async pauseHalfCheck(reportId) {
        return this._sendCommand({
            action: 'pause-half-check',
            reportId
        });
    }

    async resumeHalfCheck(reportId) {
        return this._sendCommand({
            action: 'resume-half-check',
            reportId
        });
    }

    async stopHalfCheck(reportId) {
        return this._sendCommand({
            action: 'stop-half-check',
            reportId
        });
    }

    async deleteReport(reportId, maxRounds) {
        return this._sendCommand({
            action: 'delete-report',
            reportId,
            maxRounds
        });
    }

    async deleteMultipleReports(reportIds, maxRounds) {
        return this._sendCommand({
            action: 'delete-multiple-reports',
            reportIds,
            maxRounds
        });
    }

    async pauseDeleteReport(reportId) {
        return this._sendCommand({
            action: 'pause-delete-report',
            reportId
        });
    }

    async resumeDeleteReport(reportId) {
        return this._sendCommand({
            action: 'resume-delete-report',
            reportId
        });
    }

    async stopDeleteReport(reportId) {
        return this._sendCommand({
            action: 'stop-delete-report',
            reportId
        });
    }

    async deleteIncompleteAssets(reportId, maxRounds) {
        return this._sendCommand({
            action: 'delete-incomplete-assets',
            reportId,
            maxRounds
        });
    }

    async pauseDeleteIncompleteAssets(reportId) {
        return this._sendCommand({
            action: 'pause-delete-incomplete-assets',
            reportId
        });
    }

    async resumeDeleteIncompleteAssets(reportId) {
        return this._sendCommand({
            action: 'resume-delete-incomplete-assets',
            reportId
        });
    }

    async stopDeleteIncompleteAssets(reportId) {
        return this._sendCommand({
            action: 'stop-delete-incomplete-assets',
            reportId
        });
    }

    async handleCancelledReport(reportId) {
        return this._sendCommand({
            action: 'handle-cancelled-report',
            reportId
        });
    }

    async duplicateReport(recordId, company, tabsNum) {
        return this._sendCommand({
            action: 'duplicate-report',
            recordId,
            company,
            tabsNum
        });
    }
}

module.exports = ReportCommands;
