import React, { useState, useEffect } from "react";
import {
    CheckCircle,
    FileText,
    Trash2,
    Search,
    PlayCircle,
    Package,
    PauseCircle,
    Play,
    StopCircle,
    AlertCircle
} from "lucide-react";

const DeleteAssets = () => {
    // Report ID state
    const [reportId, setReportId] = useState("");

    const [reportSummaryRow, setReportSummaryRow] = useState([]);

    // Deletion results state
    const [deletionResults, setDeletionResults] = useState([]);

    // Error state
    const [error, setError] = useState("");

    // Operation states
    const [isCheckingReport, setIsCheckingReport] = useState(false);
    const [reportExists, setReportExists] = useState(null);
    const [deleteAssetsRequested, setDeleteAssetsRequested] = useState(false);

    // New states for pause/resume/stop operations
    const [deleteAssetsStatus, setDeleteAssetsStatus] = useState(null); // 'running', 'paused', 'stopped', 'completed'
    const [operationResult, setOperationResult] = useState(null);

    const parseReportIds = (input) => {
        return [...new Set(
            (input || "")
                .split(" ")
                .map(s => s.trim())
                .filter(Boolean)
        )];
    };

    const runWithConcurrency = async (items, limit, worker) => {
        const results = new Array(items.length);
        let idx = 0;

        const runners = Array.from({ length: Math.max(1, limit) }, async () => {
            while (true) {
                const current = idx++;
                if (current >= items.length) break;

                try {
                    results[current] = await worker(items[current], current);
                } catch (e) {
                    results[current] = { ok: false, error: String(e) };
                }
            }
        });

        await Promise.all(runners);
        return results;
    };

    // Handle check report in Taqeem
    const handleCheckReportInTaqeem = async () => {
        const ids = parseReportIds(reportId);
        if (!ids.length) {
            setError("At least one Report ID is required");
            return;
        }

        setIsCheckingReport(true);
        setError("");
        setReportExists(null);
        setOperationResult(null);
        setReportSummaryRow([]);

        const concurrency = 3;

        try {
            const results = await runWithConcurrency(ids, concurrency, async (id) => {
                try {
                    const result = await window.electronAPI.validateReport(id);
                    console.log(`Full API response for ${id}:`, result);

                    const totalAssets = Number(result?.assetsExact ?? result?.microsCount ?? 0) || 0;

                    return {
                        reportId: result?.reportId || id,
                        totalAssets,
                        reportStatus: result?.reportStatus ?? "Unknown",
                        presentOrNot: totalAssets > 0 ? "Present" : "Not Present",
                        exists: result?.status !== "NOT_FOUND" && result?.status !== "FAILED"
                    };
                } catch (err) {
                    console.error(`Error checking report ${id}:`, err);
                    return {
                        reportId: id,
                        totalAssets: 0,
                        reportStatus: "Error",
                        presentOrNot: "Error",
                        exists: false
                    };
                }
            });

            setReportSummaryRow(results);

            const allExist = results.every(r => r.exists);
            setReportExists(allExist);

            if (!allExist) {
                setError("Some reports do not exist or failed to check.");
            } else {
                setError("");
            }
        } catch (err) {
            console.error("Error checking reports:", err);
            setReportExists(false);
            setError(err.message || "Error checking reports. Please try again.");
        } finally {
            setIsCheckingReport(false);
        }
    };

    // Handle delete only assets
    const handleDeleteReportAssets = async () => {
        const ids = parseReportIds(reportId);
        if (!ids.length) {
            setError("At least one Report ID is required");
            return;
        }

        setError("");
        setDeleteAssetsRequested(true);
        setDeleteAssetsStatus("running");
        setOperationResult(null);
        setDeletionResults([]);

        const maxRounds = 10;
        const concurrency = 5;

        setOperationResult({
            mode: "batch",
            items: Object.fromEntries(ids.map(id => [id, { status: "queued" }]))
        });

        try {
            const results = await runWithConcurrency(ids, concurrency, async (id) => {
                setOperationResult(prev => ({
                    ...prev,
                    items: { ...prev.items, [id]: { status: "running" } }
                }));

                try {
                    const res = await window.electronAPI.deleteIncompleteAssets(id, maxRounds);
                    setOperationResult(prev => ({
                        ...prev,
                        items: { ...prev.items, [id]: { status: "success", result: res } }
                    }));
                    return { id, ok: true, result: res };
                } catch (err) {
                    setOperationResult(prev => ({
                        ...prev,
                        items: { ...prev.items, [id]: { status: "failed", error: String(err) } }
                    }));
                    return { id, ok: false, error: String(err) };
                }
            });

            const failed = results.filter(r => !r?.ok).length;

            setDeleteAssetsStatus(failed ? "partial" : "success");
        } catch (err) {
            console.error("Error initiating batch asset deletion:", err);
            setDeleteAssetsStatus("stopped");
        }
    };

    // Handle pause delete incomplete assets
    const handlePauseDeleteIncompleteAssets = async () => {
        if (!reportId.trim()) {
            setError("Report ID is required");
            return;
        }

        try {
            const result = await window.electronAPI.pauseDeleteIncompleteAssets(reportId);
            console.log("Pause delete incomplete assets result:", result);

            if (result.status === "SUCCESS") {
                setDeleteAssetsStatus('paused');
            } else {
                setOperationResult({
                    type: 'pause',
                    operation: 'delete-incomplete-assets',
                    status: result.status,
                    message: result.message || "Failed to pause delete assets"
                });
            }
        } catch (err) {
            console.error("Error pausing delete incomplete assets:", err);
            setOperationResult({
                type: 'pause',
                operation: 'delete-incomplete-assets',
                status: 'FAILED',
                message: err.message || "Error pausing delete assets"
            });
        }
    };

    // Handle resume delete incomplete assets
    const handleResumeDeleteIncompleteAssets = async () => {
        if (!reportId.trim()) {
            setError("Report ID is required");
            return;
        }

        try {
            const result = await window.electronAPI.resumeDeleteIncompleteAssets(reportId);
            console.log("Resume delete incomplete assets result:", result);

            if (result.status === "SUCCESS") {
                setDeleteAssetsStatus('running');
            } else {
                setOperationResult({
                    type: 'resume',
                    operation: 'delete-incomplete-assets',
                    status: result.status,
                    message: result.message || "Failed to resume delete assets"
                });
            }
        } catch (err) {
            console.error("Error resuming delete incomplete assets:", err);
            setOperationResult({
                type: 'resume',
                operation: 'delete-incomplete-assets',
                status: 'FAILED',
                message: err.message || "Error resuming delete assets"
            });
        }
    };

    // Handle stop delete incomplete assets
    const handleStopDeleteIncompleteAssets = async () => {
        if (!reportId.trim()) {
            setError("Report ID is required");
            return;
        }

        try {
            const result = await window.electronAPI.stopDeleteIncompleteAssets(reportId);
            console.log("Stop delete incomplete assets result:", result);

            if (result.status === "SUCCESS") {
                setDeleteAssetsStatus('stopped');
            } else {
                setOperationResult({
                    type: 'stop',
                    operation: 'delete-incomplete-assets',
                    status: result.status,
                    message: result.message || "Failed to stop delete assets"
                });
            }
        } catch (err) {
            console.error("Error stopping delete incomplete assets:", err);
            setOperationResult({
                type: 'stop',
                operation: 'delete-incomplete-assets',
                status: 'FAILED',
                message: err.message || "Error stopping delete assets"
            });
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'text-green-500';
            case 'paused': return 'text-yellow-500';
            case 'stopped': return 'text-red-500';
            case 'completed': return 'text-blue-500';
            default: return 'text-gray-500';
        }
    };

    // Get status text
    const getStatusText = (status) => {
        switch (status) {
            case 'running': return 'Running';
            case 'paused': return 'Paused';
            case 'stopped': return 'Stopped';
            case 'completed': return 'Completed';
            default: return 'Not Started';
        }
    };

    // Render operation status
    const renderOperationStatus = () => {
        if (!deleteAssetsStatus && !operationResult) return null;

        return (
            <div className="space-y-4">
                {/* Delete Assets Status */}
                {deleteAssetsStatus && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-purple-500" />
                                <span className="font-medium text-gray-800">Delete Assets</span>
                            </div>
                            <div className={`flex items-center gap-2 ${getStatusColor(deleteAssetsStatus)}`}>
                                <div className={`w-2 h-2 rounded-full ${deleteAssetsStatus === 'running' ? 'bg-green-500 animate-pulse' :
                                    deleteAssetsStatus === 'paused' ? 'bg-yellow-500' :
                                        deleteAssetsStatus === 'stopped' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                <span className="text-sm font-medium">{getStatusText(deleteAssetsStatus)}</span>
                            </div>
                        </div>

                        {deleteAssetsStatus === 'running' && (
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handlePauseDeleteIncompleteAssets}
                                    className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                >
                                    <PauseCircle className="w-4 h-4" />
                                    Pause
                                </button>
                                <button
                                    onClick={handleStopDeleteIncompleteAssets}
                                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                >
                                    <StopCircle className="w-4 h-4" />
                                    Stop
                                </button>
                            </div>
                        )}

                        {deleteAssetsStatus === 'paused' && (
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleResumeDeleteIncompleteAssets}
                                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Play className="w-4 h-4" />
                                    Resume
                                </button>
                                <button
                                    onClick={handleStopDeleteIncompleteAssets}
                                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                >
                                    <StopCircle className="w-4 h-4" />
                                    Stop
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Operation Result */}
                {operationResult && (
                    <div className={`border rounded-xl p-4 ${operationResult.status === 'SUCCESS'
                        ? 'bg-green-50 border-green-200'
                        : operationResult.status === 'STOPPED'
                            ? 'bg-yellow-50 border-yellow-200'
                            : operationResult.status === 'FAILED'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-blue-50 border-blue-200'
                        }`}>
                        <div className="flex items-center gap-3">
                            {operationResult.status === 'SUCCESS' && <CheckCircle className="w-5 h-5 text-green-500" />}
                            {operationResult.status === 'STOPPED' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                            {operationResult.status === 'FAILED' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            {!['SUCCESS', 'STOPPED', 'FAILED'].includes(operationResult.status) && <AlertCircle className="w-5 h-5 text-blue-500" />}

                            <div>
                                <p className="font-medium">
                                    {operationResult.type === 'delete-incomplete-assets' && 'Delete Assets'}
                                    {operationResult.type === 'pause' && `Pause ${operationResult.operation.replace('-', ' ')}`}
                                    {operationResult.type === 'resume' && `Resume ${operationResult.operation.replace('-', ' ')}`}
                                    {operationResult.type === 'stop' && `Stop ${operationResult.operation.replace('-', ' ')}`}
                                </p>
                                <p className="text-sm mt-1">{operationResult.message}</p>
                                {operationResult.data?.reportId && (
                                    <p className="text-xs mt-1">
                                        Report ID: <strong>{operationResult.data.reportId}</strong>
                                    </p>
                                )}
                                {operationResult.data?.rounds && (
                                    <p className="text-xs mt-1">
                                        Rounds: <strong>{operationResult.data.rounds}</strong>
                                    </p>
                                )}
                                {operationResult.data?.deletedAssets && (
                                    <p className="text-xs mt-1">
                                        Assets Deleted: <strong>{operationResult.data.deletedAssets}</strong>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-h-screen bg-gradient-to-br from-purple-50 to-pink-100 py-8">
            <div className="max-w-full mx-auto px-4">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="space-y-6">
                        <div className="space-y-6">
                            {/* Report ID Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Report IDs *
                                </label>
                                <div className="flex gap-3 mb-3">
                                    <textarea
                                        type="text"
                                        value={reportId}
                                        onChange={(e) => {
                                            setReportId(e.target.value);
                                            setError("");
                                            setReportExists(null);
                                            setDeleteAssetsRequested(false);
                                            setDeleteAssetsStatus(null);
                                            setOperationResult(null);
                                            setReportSummaryRow([]);
                                            setDeletionResults([]);
                                        }}
                                        className="flex-1 w-56 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                                        placeholder="Enter Report IDs (space separated)"
                                    />

                                    <button
                                        onClick={handleCheckReportInTaqeem}
                                        disabled={isCheckingReport}
                                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-normal flex items-center gap-2 transition-colors whitespace-nowrap"
                                    >
                                        <Search className="w-3 h-3" />
                                        {isCheckingReport ? 'Checking...' : 'Check Report'}
                                    </button>

                                    <button
                                        onClick={handleDeleteReportAssets}
                                        disabled={deleteAssetsStatus === 'running' || !reportId.trim()}
                                        className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-normal flex items-center gap-2 transition-colors whitespace-nowrap"
                                    >
                                        <Package className="w-3 h-3" />
                                        Delete  Assets
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Enter the report IDs you wish to check. Separate multiple IDs with spaces.
                                </p>

                                {/* Report Validation Status */}
                                {reportSummaryRow.length > 0 && (
                                    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                                            Report Summary
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-white border-b">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Report ID</th>
                                                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Total Assets</th>
                                                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Report Status</th>
                                                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Present / Not</th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {reportSummaryRow.map((row, index) => (
                                                        <tr key={index} className="border-b">
                                                            <td className="px-4 py-2 text-gray-800">{row.reportId}</td>
                                                            <td className="px-4 py-2 text-gray-800">{row.totalAssets}</td>
                                                            <td className="px-4 py-2 text-gray-800">{row.reportStatus}</td>
                                                            <td className="px-4 py-2">
                                                                <span
                                                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                                        row.presentOrNot === "Present"
                                                                            ? "bg-green-100 text-green-700"
                                                                            : "bg-red-100 text-red-700"
                                                                    }`}
                                                                >
                                                                    {row.presentOrNot}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div
                                            className={`px-4 py-2 text-xs ${
                                                reportExists === true ? "text-green-700" : "text-red-700"
                                            }`}
                                        >
                                            {reportExists === true
                                                ? "All reports verified successfully."
                                                : reportExists === false
                                                ? "Some reports not found or invalid."
                                                : ""}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Operation Status Section */}
                            {renderOperationStatus()}

                            {/* Deletion Results Table */}
                            {deletionResults.length > 0 && (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                                        Deletion Results
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-white border-b">
                                                <tr>
                                                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Report ID</th>
                                                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Status</th>
                                                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Assets Deleted</th>
                                                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Error</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {deletionResults.map((result, index) => (
                                                    <tr key={index} className="border-b">
                                                        <td className="px-4 py-2 text-gray-800">{result.reportId}</td>
                                                        <td className="px-4 py-2">
                                                            <span
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                                    result.status === "Success"
                                                                        ? "bg-green-100 text-green-700"
                                                                        : "bg-red-100 text-red-700"
                                                                }`}
                                                            >
                                                                {result.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-gray-800">{result.assetsDeleted}</td>
                                                        <td className="px-4 py-2 text-gray-800">{result.error || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Delete Assets Request Sent Confirmation */}
                            {deleteAssetsRequested && !deleteAssetsStatus && (
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-purple-500" />
                                        <div>
                                            <p className="font-medium text-purple-800">Delete Assets Request Sent</p>
                                            <p className="text-sm text-purple-600">
                                                Delete assets request sent for Report ID: <strong>{reportId}</strong>
                                            </p>
                                            <p className="text-xs text-purple-500 mt-1">
                                                You can send multiple delete assets requests if needed.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error Display */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-red-500" />
                                        <span className="text-red-700">{error}</span>
                                    </div>
                                </div>
                            )}

                            {/* Warning Box */}
                            {!deleteAssetsRequested && !deleteAssetsStatus && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-yellow-500" />
                                        <div>
                                            <p className="font-medium text-yellow-800">Warning: Irreversible Action</p>
                                            <p className="text-sm text-yellow-600">
                                                This action will permanently delete incomplete assets. This cannot be undone.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteAssets;