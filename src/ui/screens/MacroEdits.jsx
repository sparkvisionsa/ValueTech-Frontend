import React, { useState } from "react";
import {
    Upload, CheckCircle, RefreshCw,
    Database, Search, Clock, AlertCircle,
    Pause, Play, FileText
} from "lucide-react";

// Updated API functions for Electron with proper response handling
const submitMacro = async (reportId, tabsNum) => {
    return window.electronAPI ? await window.electronAPI.macroFill(reportId, tabsNum) : {
        status: "SUCCESS",
        result: { message: "Macro submitted successfully (demo)" }
    };
};

const checkMacroStatus = async (reportId, tabsNum) => {
    return await window.electronAPI.fullCheck(reportId, tabsNum)
};

const halfCheckMacroStatus = async (reportId, tabsNum) => {
    return await window.electronAPI.halfCheck(reportId, tabsNum)
};

// Dummy pause/resume functions
const pauseProcessing = async (reportId) => {
    console.log(`Dummy pause for report: ${reportId}`);
    return { status: "SUCCESS", result: { message: "Processing paused (dummy function)" } };
};

const resumeProcessing = async (reportId) => {
    console.log(`Dummy resume for report: ${reportId}`);
    return { status: "SUCCESS", result: { message: "Processing resumed (dummy function)" } };
};

// Mock progress context
const useProgress = () => {
    const [progressStates, setProgressStates] = useState({});

    const dispatch = (action) => {
        switch (action.type) {
            case 'UPDATE_PROGRESS':
                setProgressStates(prev => ({
                    ...prev,
                    [action.payload.reportId]: {
                        ...prev[action.payload.reportId],
                        ...action.payload.updates
                    }
                }));
                break;
            case 'PAUSE_PROGRESS':
                setProgressStates(prev => ({
                    ...prev,
                    [action.payload.reportId]: {
                        ...prev[action.payload.reportId],
                        paused: true
                    }
                }));
                break;
            case 'RESUME_PROGRESS':
                setProgressStates(prev => ({
                    ...prev,
                    [action.payload.reportId]: {
                        ...prev[action.payload.reportId],
                        paused: false
                    }
                }));
                break;
            case 'CLEAR_PROGRESS':
                setProgressStates(prev => {
                    const newState = { ...prev };
                    delete newState[action.payload.reportId];
                    return newState;
                });
                break;
            default:
                break;
        }
    };

    return { progressStates, dispatch };
};

// Incomplete IDs Table Component
const IncompleteIDsTable = ({ incompleteIds, title }) => {
    if (!incompleteIds || incompleteIds.length === 0) {
        return (
            <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 font-medium">No incomplete macros found!</p>
                <p className="text-green-600 text-sm">All macros are completed successfully.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <h4 className="font-semibold text-gray-800">{title}</h4>
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full ml-auto">
                        {incompleteIds.length} incomplete
                    </span>
                </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
                <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                        {incompleteIds.map((id, index) => (
                            <span
                                key={id || index}
                                className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 text-sm font-mono rounded-full border border-red-200"
                            >
                                {id}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {incompleteIds.length > 20 && (
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-300 text-center">
                    <p className="text-xs text-gray-500">
                        Showing {incompleteIds.length} incomplete macro IDs
                    </p>
                </div>
            )}
        </div>
    );
};

const SubmitMacro = () => {
    const { progressStates, dispatch } = useProgress();
    const isLoggedIn = true; // Always logged in for Electron app

    // Step management
    const [currentStep, setCurrentStep] = useState('report-id-input');

    // Report ID state
    const [reportId, setReportId] = useState("");
    const [tabsNum, setTabsNum] = useState("1");

    // Error state
    const [error, setError] = useState("");

    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [checkResult, setCheckResult] = useState(null);
    const [halfCheckResult, setHalfCheckResult] = useState(null);

    // Get progress state for current report
    const currentProgress = reportId ? progressStates[reportId] : null;

    // Handle macro submission
    const handleSubmitMacro = async () => {
        if (!reportId.trim()) {
            setError("Please enter a report ID");
            return;
        }

        const tabsNumValue = parseInt(tabsNum);
        if (isNaN(tabsNumValue) || tabsNumValue < 1) {
            setError("Please enter a valid number of tabs (minimum 1)");
            return;
        }

        setError("");
        setIsSubmitting(true);
        setCurrentStep('submission-in-progress');

        // Initialize progress state
        dispatch({
            type: 'UPDATE_PROGRESS',
            payload: {
                reportId,
                updates: {
                    status: 'INITIALIZING',
                    message: "Initializing macro submission...",
                    progress: 0,
                    paused: false,
                    stopped: false,
                    data: {
                        current: 0,
                        total: 0
                    }
                }
            }
        });

        try {
            console.log(`Submitting macro for report: ${reportId} with tabs: ${tabsNumValue}`);

            const result = await submitMacro(reportId, tabsNumValue);
            console.log("Macro submission result:", result);

            // Check for success based on response.status
            if (result.status === "SUCCESS") {
                setSubmissionResult(result);

                // Update progress state with success
                dispatch({
                    type: 'UPDATE_PROGRESS',
                    payload: {
                        reportId,
                        updates: {
                            status: 'COMPLETE',
                            message: result.result?.message || "Macro submitted successfully",
                            progress: 100,
                            data: {
                                current: 100,
                                total: 100,
                                failedRecords: 0,
                                numTabs: tabsNumValue
                            }
                        }
                    }
                });

                setCurrentStep('success');
            } else {
                // Handle failure
                const errorMessage = result.result?.message || result.error || 'Failed to submit macro';
                setError(errorMessage);
                setCurrentStep('error');

                // Update progress state with error
                dispatch({
                    type: 'UPDATE_PROGRESS',
                    payload: {
                        reportId,
                        updates: {
                            status: 'FAILED',
                            message: `Error: ${errorMessage}`,
                            progress: 0
                        }
                    }
                });
            }
        } catch (err) {
            console.error("Error submitting macro:", err);
            const errorMessage = err.message || 'An unexpected error occurred while submitting macro';
            setError(errorMessage);
            setCurrentStep('error');

            // Update progress state with error
            dispatch({
                type: 'UPDATE_PROGRESS',
                payload: {
                    reportId,
                    updates: {
                        status: 'FAILED',
                        message: `Error: ${errorMessage}`,
                        progress: 0
                    }
                }
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle macro status check
    const handleCheckMacro = async () => {
        if (!reportId.trim()) {
            setError("Please enter a report ID");
            return;
        }

        setError("");
        setIsSubmitting(true);
        setCurrentStep('checking');

        try {
            console.log(`Checking macro status for report: ${reportId}`);

            const result = await checkMacroStatus(reportId, tabsNum);
            console.log("Macro check result:", result);

            if (result.status === "SUCCESS") {
                setCheckResult(result);
                setCurrentStep('check-result');
            } else {
                const errorMessage = result.result?.message || result.error || 'Failed to check macro status';
                setError(errorMessage);
                setCurrentStep('error');
            }

        } catch (err) {
            console.error("Error checking macro status:", err);
            setError(err.message || 'An unexpected error occurred while checking macro status');
            setCurrentStep('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle half check macro status
    const handleHalfCheckMacro = async () => {
        if (!reportId.trim()) {
            setError("Please enter a report ID");
            return;
        }

        setError("");
        setIsSubmitting(true);
        setCurrentStep('half-checking');

        try {
            console.log(`Half checking macro status for report: ${reportId}`);

            const result = await halfCheckMacroStatus(reportId, tabsNum);
            console.log("Half check macro result:", result);

            if (result.status === "SUCCESS") {
                setHalfCheckResult(result);
                setCurrentStep('half-check-result');
            } else {
                const errorMessage = result.result?.message || result.error || 'Failed to check macro status';
                setError(errorMessage);
                setCurrentStep('error');
            }

        } catch (err) {
            console.error("Error half checking macro status:", err);
            setError(err.message || 'An unexpected error occurred while checking macro status');
            setCurrentStep('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset process
    const resetProcess = () => {
        setCurrentStep('report-id-input');
        setReportId("");
        setTabsNum("1");
        setError("");
        setIsSubmitting(false);
        setSubmissionResult(null);
        setCheckResult(null);
        setHalfCheckResult(null);

        // Clear progress state if exists
        if (reportId && progressStates[reportId]) {
            dispatch({
                type: 'CLEAR_PROGRESS',
                payload: { reportId }
            });
        }
    };

    // Handle pause processing (dummy function)
    const handlePauseProcessing = async () => {
        if (!reportId) return;

        try {
            console.log(`Pausing processing for report: ${reportId}`);

            // Optimistically update UI
            dispatch({
                type: 'PAUSE_PROGRESS',
                payload: { reportId }
            });

            const result = await pauseProcessing(reportId);
            console.log("Pause result:", result);

            if (result.status !== "SUCCESS") {
                // Revert if failed
                dispatch({
                    type: 'RESUME_PROGRESS',
                    payload: { reportId }
                });
                setError(result.result?.message || result.error || 'Failed to pause processing');
            }
        } catch (err) {
            console.error("Error pausing processing:", err);
            setError(err.message || 'Failed to pause processing');

            // Revert on error
            dispatch({
                type: 'RESUME_PROGRESS',
                payload: { reportId }
            });
        }
    };

    // Handle resume processing (dummy function)
    const handleResumeProcessing = async () => {
        if (!reportId) return;

        try {
            console.log(`Resuming processing for report: ${reportId}`);

            // Optimistically update UI
            dispatch({
                type: 'RESUME_PROGRESS',
                payload: { reportId }
            });

            const result = await resumeProcessing(reportId);
            console.log("Resume result:", result);

            if (result.status !== "SUCCESS") {
                // Revert if failed
                dispatch({
                    type: 'PAUSE_PROGRESS',
                    payload: { reportId }
                });
                setError(result.result?.message || result.error || 'Failed to resume processing');
            }
        } catch (err) {
            console.error("Error resuming processing:", err);
            setError(err.message || 'Failed to resume processing');

            // Revert on error
            dispatch({
                type: 'PAUSE_PROGRESS',
                payload: { reportId }
            });
        }
    };

    // Simple progress display component
    const SimpleProgressDisplay = ({ progress, message, paused }) => {
        return (
            <div className="space-y-4">
                <div className="bg-gray-100 border border-gray-300 rounded p-6">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <RefreshCw className={`w-8 h-8 text-blue-600 ${paused ? '' : 'animate-spin'}`} />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                            {paused ? 'Processing Paused' : 'Processing Macros'}
                        </h3>
                        <p className="text-gray-600 mb-4">{message}</p>

                        {/* Simple progress bar */}
                        <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
                            <div
                                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-600">{progress}% Complete</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Submit Macro</h1>
                    <p className="text-gray-600">Submit or check macro for an existing report</p>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-lg shadow p-6">
                    {/* Step 1: Report ID Input */}
                    {currentStep === 'report-id-input' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Report ID Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Report ID *
                                        </label>
                                        <input
                                            type="text"
                                            value={reportId}
                                            onChange={(e) => {
                                                setReportId(e.target.value);
                                                setError("");
                                            }}
                                            className="w-full px-4 py-3 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter report ID"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            The ID of the report to submit macro for
                                        </p>
                                    </div>

                                    {/* Tabs Number Input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Number of Tabs *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={tabsNum}
                                            onChange={(e) => {
                                                setTabsNum(e.target.value);
                                                setError("");
                                            }}
                                            className="w-full px-4 py-3 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter number of tabs"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Number of parallel tabs (1-10, recommended: 3)
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                                    <button
                                        onClick={handleCheckMacro}
                                        disabled={!reportId.trim() || isSubmitting || !isLoggedIn}
                                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2 justify-center"
                                    >
                                        {isSubmitting ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Search className="w-4 h-4" />
                                        )}
                                        {isSubmitting ? "Checking..." : "Full Check"}
                                    </button>
                                    <button
                                        onClick={handleHalfCheckMacro}
                                        disabled={!reportId.trim() || isSubmitting || !isLoggedIn}
                                        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2 justify-center"
                                    >
                                        {isSubmitting ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Clock className="w-4 h-4" />
                                        )}
                                        {isSubmitting ? "Checking..." : "Half Check"}
                                    </button>
                                    <button
                                        onClick={handleSubmitMacro}
                                        disabled={!reportId.trim() || !tabsNum.trim() || isSubmitting || !isLoggedIn}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2 justify-center"
                                    >
                                        {isSubmitting ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4" />
                                        )}
                                        {isSubmitting ? "Submitting..." : "Submit Macro"}
                                    </button>
                                </div>

                                {error && (
                                    <div className="bg-red-100 border border-red-300 rounded p-4">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                            <span className="text-red-700">{error}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Information Box */}
                                <div className="bg-gray-100 border border-gray-300 rounded p-4">
                                    <div className="flex items-center gap-3">
                                        <Database className="w-5 h-5 text-gray-500" />
                                        <div>
                                            <p className="font-medium text-gray-800">What this does:</p>
                                            <p className="text-sm text-gray-600">
                                                <strong>Full Check:</strong> Checks all macros in the report<br />
                                                <strong>Half Check:</strong> Only checks previously incomplete macros (faster)<br />
                                                <strong>Submit Macro:</strong> Submits macros for the report
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Submission In Progress */}
                    {currentStep === 'submission-in-progress' && currentProgress && (
                        <div className="space-y-6">
                            <SimpleProgressDisplay
                                progress={currentProgress.progress}
                                message={currentProgress.message}
                                paused={currentProgress.paused}
                            />

                            {/* Pause/Resume Controls */}
                            <div className="flex justify-center gap-3 mt-6">
                                {currentProgress.paused ? (
                                    <button
                                        onClick={handleResumeProcessing}
                                        disabled={currentProgress.stopped}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2"
                                    >
                                        <Play className="w-4 h-4" />
                                        Resume Processing
                                    </button>
                                ) : (
                                    <button
                                        onClick={handlePauseProcessing}
                                        disabled={currentProgress.stopped || currentProgress.status === 'COMPLETED'}
                                        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2"
                                    >
                                        <Pause className="w-4 h-4" />
                                        Pause Processing
                                    </button>
                                )}
                            </div>

                            {/* Pause Status Message */}
                            {currentProgress.paused && (
                                <div className="bg-yellow-100 border border-yellow-300 rounded p-4">
                                    <div className="flex items-center gap-3">
                                        <Pause className="w-5 h-5 text-yellow-600" />
                                        <div>
                                            <p className="font-semibold text-yellow-800">Processing Paused</p>
                                            <p className="text-sm text-yellow-700">
                                                Click "Resume Processing" to continue where you left off
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {currentStep === 'success' && (
                        <div className="space-y-6">
                            <div className="bg-green-100 border border-green-300 rounded p-6">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-green-800 mb-2">Macro Submitted Successfully!</h3>
                                    <p className="text-green-600">
                                        {submissionResult?.result?.message || "Macro has been successfully submitted"}
                                    </p>
                                </div>

                                {/* Submission Details */}
                                {currentProgress && (
                                    <div className="bg-white border border-green-300 rounded p-4 mb-4">
                                        <h4 className="font-semibold text-green-800 mb-2">Submission Details:</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Report ID:</span>
                                                <span className="font-mono">{reportId}</span>
                                            </div>
                                            {currentProgress.data?.numTabs && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Tabs Used:</span>
                                                    <span>{currentProgress.data.numTabs}</span>
                                                </div>
                                            )}
                                            {currentProgress.data?.total && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Total Processed:</span>
                                                    <span>{currentProgress.data.total}</span>
                                                </div>
                                            )}
                                            {currentProgress.data?.failedRecords !== undefined && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Failed Records:</span>
                                                    <span className={currentProgress.data.failedRecords > 0 ? "text-red-600" : "text-green-600"}>
                                                        {currentProgress.data.failedRecords}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Status:</span>
                                                <span className="text-green-600 font-semibold">Completed</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                                    <button
                                        onClick={resetProcess}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                                    >
                                        View Reports
                                    </button>
                                    <button
                                        onClick={resetProcess}
                                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold"
                                    >
                                        Submit Another Macro
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Checking Status */}
                    {currentStep === 'checking' && (
                        <div className="space-y-6">
                            <div className="bg-gray-100 border border-gray-300 rounded p-8 text-center">
                                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <RefreshCw className="w-8 h-8 text-gray-600 animate-spin" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">Full Check In Progress</h3>
                                <p className="text-gray-600 mb-4">
                                    Checking all macros for report <strong>{reportId}</strong>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Half Checking Status */}
                    {currentStep === 'half-checking' && (
                        <div className="space-y-6">
                            <div className="bg-yellow-100 border border-yellow-300 rounded p-8 text-center">
                                <div className="w-16 h-16 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <RefreshCw className="w-8 h-8 text-yellow-600 animate-spin" />
                                </div>
                                <h3 className="text-xl font-semibold text-yellow-800 mb-2">Half Check In Progress</h3>
                                <p className="text-yellow-600 mb-4">
                                    Checking only incomplete macros for report <strong>{reportId}</strong>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Check Result */}
                    {currentStep === 'check-result' && (
                        <div className="space-y-6">
                            <div className="bg-gray-100 border border-gray-300 rounded p-6">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Search className="w-8 h-8 text-gray-600" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Full Check Complete</h3>
                                    <p className="text-gray-600">
                                        {checkResult?.message || "Full check completed successfully"}
                                    </p>
                                </div>

                                {/* Check Result Details */}
                                {checkResult && (
                                    <div className="space-y-4">
                                        <div className="bg-white border border-gray-300 rounded p-4">
                                            <h4 className="font-semibold text-gray-800 mb-2">Status Details:</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Report ID:</span>
                                                    <span className="font-mono">{reportId}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Check Type:</span>
                                                    <span className="text-blue-600 font-semibold">Full Check</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Status:</span>
                                                    <span className={`font-semibold ${checkResult.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {checkResult.status}
                                                    </span>
                                                </div>
                                                {checkResult?.macro_count !== undefined && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Incomplete Macros:</span>
                                                        <span className={`font-semibold ${checkResult.macro_count === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {checkResult.macro_count}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Incomplete IDs Table */}
                                        {checkResult?.incomplete_ids && (
                                            <IncompleteIDsTable
                                                incompleteIds={checkResult.incomplete_ids}
                                                title="Incomplete Macros (Full Check)"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                                    <button
                                        onClick={resetProcess}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                                    >
                                        Back to Main
                                    </button>
                                    <button
                                        onClick={handleSubmitMacro}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
                                    >
                                        Submit Macro Now
                                    </button>
                                    <button
                                        onClick={handleCheckMacro}
                                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold"
                                    >
                                        Run Full Check
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Half Check Result */}
                    {currentStep === 'half-check-result' && (
                        <div className="space-y-6">
                            <div className="bg-yellow-50 border border-yellow-300 rounded p-6">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Clock className="w-8 h-8 text-yellow-600" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-yellow-800 mb-2">Half Check Complete</h3>
                                    <p className="text-yellow-600">
                                        {halfCheckResult?.message || "Half check completed successfully"}
                                    </p>
                                </div>

                                {/* Half Check Result Details */}
                                {halfCheckResult && (
                                    <div className="space-y-4">
                                        <div className="bg-white border border-yellow-300 rounded p-4">
                                            <h4 className="font-semibold text-yellow-800 mb-2">Status Details:</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Report ID:</span>
                                                    <span className="font-mono">{reportId}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Check Type:</span>
                                                    <span className="text-yellow-600 font-semibold">Half Check</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Status:</span>
                                                    <span className={`font-semibold ${halfCheckResult.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {halfCheckResult.status}
                                                    </span>
                                                </div>
                                                {halfCheckResult.macro_count !== undefined && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Incomplete Macros:</span>
                                                        <span className={`font-semibold ${halfCheckResult.macro_count === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                                                            {halfCheckResult.macro_count}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Incomplete IDs Table */}
                                        {halfCheckResult.incomplete_ids && (
                                            <IncompleteIDsTable
                                                incompleteIds={halfCheckResult.incomplete_ids}
                                                title="Incomplete Macros (Half Check)"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                                    <button
                                        onClick={resetProcess}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                                    >
                                        Back to Main
                                    </button>
                                    <button
                                        onClick={handleSubmitMacro}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
                                    >
                                        Submit Macro Now
                                    </button>
                                    <button
                                        onClick={handleHalfCheckMacro}
                                        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-semibold"
                                    >
                                        Run Half Check Again
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {currentStep === 'error' && (
                        <div className="space-y-6">
                            <div className="bg-red-100 border border-red-300 rounded p-6 text-center">
                                <div className="w-16 h-16 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertCircle className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-red-800 mb-2">Operation Failed</h3>
                                <p className="text-red-600 mb-4">
                                    {currentProgress?.message || error}
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button
                                        onClick={() => setCurrentStep('report-id-input')}
                                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
                                    >
                                        Try Again
                                    </button>
                                    <button
                                        onClick={resetProcess}
                                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold"
                                    >
                                        Start Over
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubmitMacro;