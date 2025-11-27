import React, { useState } from "react";
import {
    CheckCircle,
    FileText,
    Trash2,
    Search,
    PlayCircle,
    Package
} from "lucide-react";

const DeleteReport = () => {
    // Report ID state
    const [reportId, setReportId] = useState("");

    // Error state
    const [error, setError] = useState("");

    // Operation states
    const [isCheckingReport, setIsCheckingReport] = useState(false);
    const [reportExists, setReportExists] = useState(null);
    const [deleteRequested, setDeleteRequested] = useState(false);
    const [deleteAssetsRequested, setDeleteAssetsRequested] = useState(false);

    // New states for status change
    const [statusChangeResult, setStatusChangeResult] = useState(null);

    // Handle report validation in Taqeem
    const handleCheckReportInTaqeem = async () => {
        if (!reportId.trim()) {
            setError("Please enter a report ID");
            return;
        }

        setIsCheckingReport(true);
        setError("");
        setReportExists(null);
        setStatusChangeResult(null);

        try {
            const result = await window.electronAPI.validateReport(reportId);
            console.log("Full API response:", result);

            // Check the status from the Python backend response
            if (result?.status === 'NOT_FOUND') {
                setReportExists(false);
                setError("Report with this ID does not exist. Please check the ID and try again.");
            } else if (result?.status === 'SUCCESS') {
                setReportExists(true);
                setError("");
            } else if (result?.status === 'MACROS_EXIST') {
                setReportExists(false);
                setError(`Report exists with ${result?.assetsExact || result?.microsCount || 'unknown'} macros. Please use a different report ID.`);
            } else if (result?.status === 'FAILED') {
                setReportExists(false);
                setError(result?.error || "Failed to check report ID");
            } else {
                // Handle unexpected status values
                setReportExists(false);
                setError("Unexpected response from server. Please try again.");
            }
        } catch (err) {
            console.error("Error checking report:", err);

            // Handle different error scenarios
            if (err?.response?.status === 400) {
                setReportExists(false);
                setError("Invalid request. Please check the report ID and try again.");
            } else if (err?.response?.status === 401) {
                setReportExists(false);
                setError("Please log in to check report ID.");
            } else if (err?.response?.status === 504) {
                setReportExists(false);
                setError("Request timeout. Please try again.");
            } else {
                setReportExists(false);
                setError(err.message || "Error checking report ID. Please try again.");
            }
        } finally {
            setIsCheckingReport(false);
        }
    };

    // Handle report deletion - fire and forget
    const handleDeleteReport = async () => {
        if (!reportId.trim()) {
            setError("Report ID is required");
            return;
        }

        setError("");
        setDeleteRequested(true);
        setStatusChangeResult(null);

        try {
            console.log(`Sending delete request for report: ${reportId}`);

            // Fire the delete request but don't wait for response
            window.electronAPI.deleteReport(reportId, 10).then(result => {
                console.log("Report deletion completed:", result);
            }).catch(err => {
                console.error("Report deletion encountered error:", err);
            });

        } catch (err) {
            console.error("Error initiating report deletion:", err);
        }
    };

    // Handle delete only assets - fire and forget
    const handleDeleteReportAssets = async () => {
        if (!reportId.trim()) {
            setError("Report ID is required");
            return;
        }

        setError("");
        setDeleteAssetsRequested(true);
        setStatusChangeResult(null);

        try {
            console.log(`Sending delete assets request for report: ${reportId}`);

            // Fire the delete assets request but don't wait for response
            window.electronAPI.deleteIncompleteAssets(reportId, 10).then(result => {
                console.log("Report assets deletion completed:", result);
            }).catch(err => {
                console.error("Report assets deletion encountered error:", err);
            });

        } catch (err) {
            console.error("Error initiating report assets deletion:", err);
        }
    };

    // Handle changing report status - fire and forget
    const handleChangeReportStatus = async () => {
        if (!reportId.trim()) {
            setError("Report ID is required");
            return;
        }

        setError("");
        setStatusChangeResult({
            status: 'REQUEST_SENT',
            message: 'Status change request sent'
        });

        try {
            console.log(`Changing status for report: ${reportId}`);

            // Fire the status change request but don't wait for response
            window.electronAPI.handleCancelledReport(reportId)
                .then(result => {
                    console.log("Status change result:", result);
                })
                .catch(err => {
                    console.error("Status change encountered error:", err);
                });

        } catch (err) {
            console.error("Error initiating status change:", err);
        }
    };

    // Render status change result
    const renderStatusChangeResult = () => {
        if (!statusChangeResult) return null;

        const { status, message } = statusChangeResult;

        if (status === 'REQUEST_SENT') {
            return (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                        <div>
                            <p className="font-medium text-blue-800">Status Change Request Sent</p>
                            <p className="text-sm text-blue-600">{message}</p>
                            <p className="text-xs text-blue-500 mt-1">
                                Request sent for Report ID: <strong>{reportId}</strong>
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 py-8">
            <div className="max-w-2xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">🗑️ Delete Report</h1>
                    <p className="text-gray-600">Permanently delete a report and all its associated data</p>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    {/* Main Form */}
                    <div className="space-y-6">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Delete Report</h2>
                            <p className="text-gray-600">Enter the report ID to delete it permanently</p>
                        </div>

                        <div className="space-y-6">
                            {/* Report ID Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Report ID *
                                </label>
                                <div className="flex gap-3 mb-3">
                                    <input
                                        type="text"
                                        value={reportId}
                                        onChange={(e) => {
                                            setReportId(e.target.value);
                                            setError("");
                                            setReportExists(null);
                                            setDeleteRequested(false);
                                            setDeleteAssetsRequested(false);
                                            setStatusChangeResult(null);
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                                        placeholder="Enter report ID to delete"
                                    />
                                    <button
                                        onClick={handleCheckReportInTaqeem}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                                    >
                                        <Search className="w-4 h-4" />
                                        Check Report
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Enter the report ID you want to permanently delete
                                </p>

                                {/* Report Validation Status */}
                                {reportExists === true && (
                                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-green-700 text-sm font-medium">
                                                Report verified successfully
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {reportExists === false && (
                                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-red-500" />
                                            <span className="text-red-700 text-sm">
                                                Report not found or invalid
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status Change Section - ALWAYS VISIBLE */}
                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <PlayCircle className="w-5 h-5 text-blue-500" />
                                    Change Report Status
                                </h3>
                                <p className="text-sm text-gray-600 mb-3">
                                    Change the report status before deletion if needed.
                                </p>

                                <button
                                    onClick={handleChangeReportStatus}
                                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <PlayCircle className="w-4 h-4" />
                                    Change Report Status
                                </button>

                                {/* Status Change Result */}
                                {renderStatusChangeResult()}
                            </div>

                            {/* Delete Request Sent Confirmation */}
                            {deleteRequested && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-blue-500" />
                                        <div>
                                            <p className="font-medium text-blue-800">Delete Request Sent</p>
                                            <p className="text-sm text-blue-600">
                                                Delete request sent for Report ID: <strong>{reportId}</strong>
                                            </p>
                                            <p className="text-xs text-blue-500 mt-1">
                                                You can send multiple delete requests if needed.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Delete Assets Request Sent Confirmation */}
                            {deleteAssetsRequested && (
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
                            {!deleteRequested && !deleteAssetsRequested && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-yellow-500" />
                                        <div>
                                            <p className="font-medium text-yellow-800">Warning: Irreversible Action</p>
                                            <p className="text-sm text-yellow-600">
                                                This action will permanently delete the report and all associated data. This cannot be undone.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <button
                                    onClick={handleDeleteReportAssets}
                                    className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Package className="w-4 h-4" />
                                    Delete Only Assets
                                </button>
                                <button
                                    onClick={handleDeleteReport}
                                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteReport;