import React, { useState, useEffect } from "react";
import { useRam } from "../context/RAMContext";
import {
    Upload, CheckCircle, RefreshCw,
    Database, Search, Clock, AlertCircle,
    Pause, Play, FileText, X
} from "lucide-react";

// Updated API functions with pause/resume for check operations
const submitMacro = async (reportId, tabsNum) => {
    return window.electronAPI ? await window.electronAPI.macroFill(reportId, tabsNum) : {
        status: "SUCCESS",
        result: { message: "Macro submitted successfully (demo)" }
    };
};

const retryMacro = async (reportId, tabsNum) => {
    if (window.electronAPI) {
        return await window.electronAPI.macroFillRetry(reportId, tabsNum);
    }
    return {
        status: "SUCCESS",
        result: { message: "Macro retry submitted successfully (demo)" }
    };
};

const checkMacroStatus = async (reportId, tabsNum) => {
    return await window.electronAPI.fullCheck(reportId, tabsNum);
};

const halfCheckMacroStatus = async (reportId, tabsNum) => {
    return await window.electronAPI.halfCheck(reportId, tabsNum);
};

// Pause/Resume/Stop functions for full check
const pauseFullCheck = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.pauseFullCheck(reportId);
    }
    return { status: "SUCCESS", result: { message: "Full check paused" } };
};

const resumeFullCheck = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.resumeFullCheck(reportId);
    }
    return { status: "SUCCESS", result: { message: "Full check resumed" } };
};

const stopFullCheck = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.stopFullCheck(reportId);
    }
    return { status: "SUCCESS", result: { message: "Full check stopped" } };
};

// Pause/Resume/Stop functions for half check
const pauseHalfCheck = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.pauseHalfCheck(reportId);
    }
    return { status: "SUCCESS", result: { message: "Half check paused" } };
};

const resumeHalfCheck = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.resumeHalfCheck(reportId);
    }
    return { status: "SUCCESS", result: { message: "Half check resumed" } };
};

const stopHalfCheck = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.stopHalfCheck(reportId);
    }
    return { status: "SUCCESS", result: { message: "Half check stopped" } };
};

// Enhanced progress context with pause/resume support (for macro fill)
const useProgress = () => {
    const [progressStates, setProgressStates] = useState({});

    // Set up progress listener when component mounts
    useEffect(() => {
        if (!window.electronAPI || !window.electronAPI.onMacroFillProgress) {
            console.warn('Electron API or progress listener not available');
            return;
        }

        // Set up the progress listener
        const cleanup = window.electronAPI.onMacroFillProgress((progressData) => {
            console.log('[RENDERER] Progress update received:', progressData);

            if (progressData.reportId) {
                setProgressStates(prev => ({
                    ...prev,
                    [progressData.reportId]: {
                        ...prev[progressData.reportId],
                        // Map the incoming progress data to our expected format
                        status: progressData.status || 'PROCESSING',
                        message: progressData.message || 'Processing macros...',
                        progress: progressData.percentage || 0,
                        paused: progressData.paused || false,
                        data: {
                            current: progressData.completed || 0,
                            total: progressData.total || 0,
                            failedRecords: progressData.failed || 0,
                            currentMacro: progressData.currentMacroId || '',
                            stage: progressData.stage || 'Processing'
                        }
                    }
                }));
            }
        });

        // Cleanup listener on unmount
        return cleanup;
    }, []);

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
                        paused: true,
                        status: 'PAUSED'
                    }
                }));
                break;
            case 'RESUME_PROGRESS':
                setProgressStates(prev => ({
                    ...prev,
                    [action.payload.reportId]: {
                        ...prev[action.payload.reportId],
                        paused: false,
                        status: 'PROCESSING'
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

// Progress Display Component for macro fill
const ProgressDisplay = ({ progress, message, paused, data = {} }) => {
    const {
        current = 0,
        total = 0,
        failedRecords = 0,
        currentMacro = '',
        stage = 'Processing'
    } = data;

    // Calculate success count (completed - failed)
    const successCount = Math.max(0, current - failedRecords);

    return (
        <div className="space-y-4">
            <div className="bg-gray-100 border border-gray-300 rounded p-6">
                <div className="text-center mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${paused ? 'bg-yellow-200' : 'bg-blue-200'
                        }`}>
                        {paused ? (
                            <Pause className="w-8 h-8 text-yellow-600" />
                        ) : (
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                        )}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        {paused ? 'Processing Paused' : 'Macro Processing'}
                    </h3>
                    <p className="text-gray-600 mb-4">{message}</p>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-300 rounded-full h-4 mb-2">
                        <div
                            className={`h-4 rounded-full transition-all duration-300 ${paused ? 'bg-yellow-500' : 'bg-blue-600'
                                }`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-sm text-gray-600">{progress}% Complete</p>
                </div>

                {/* Detailed progress information */}
                <div className="bg-white border border-gray-300 rounded p-4">
                    <h4 className="font-semibold text-gray-800 mb-3">Progress Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Completed:</span>
                                <span className="font-semibold">{current} / {total}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Successful:</span>
                                <span className="font-semibold text-green-600">
                                    {successCount}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Failed:</span>
                                <span className={`font-semibold ${failedRecords > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {failedRecords}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Stage:</span>
                                <span className={`font-semibold ${paused ? 'text-yellow-600' : 'text-blue-600'
                                    }`}>
                                    {paused ? 'Paused' : stage}
                                </span>
                            </div>
                            {currentMacro && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Current Macro:</span>
                                    <span className="font-mono text-xs truncate max-w-[120px]" title={currentMacro}>
                                        {currentMacro}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-600">Status:</span>
                                <span className={`font-semibold ${paused ? 'text-yellow-600' :
                                    progress === 100 ? 'text-green-600' : 'text-blue-600'
                                    }`}>
                                    {paused ? 'Paused' : progress === 100 ? 'Complete' : 'Processing'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Check Status Display Component for full/half checks
const CheckStatusDisplay = ({
    type,
    status,
    message,
    onPause,
    onResume,
    onStop,
    isPausing = false,
    isResuming = false,
    isStopping = false,
    paused = false
}) => {
    const isFullCheck = type === 'full';
    const bgColor = isFullCheck ? 'bg-gray-100' : 'bg-yellow-100';
    const borderColor = isFullCheck ? 'border-gray-300' : 'border-yellow-300';
    const textColor = isFullCheck ? 'text-gray-800' : 'text-yellow-800';
    const iconColor = isFullCheck ? 'text-gray-600' : 'text-yellow-600';
    const iconBgColor = isFullCheck ? 'bg-gray-200' : 'bg-yellow-200';

    return (
        <div className={`${bgColor} border ${borderColor} rounded p-6`}>
            <div className="text-center mb-6">
                <div className={`w-16 h-16 ${iconBgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    {paused ? (
                        <Pause className="w-8 h-8 text-yellow-600" />
                    ) : (
                        <RefreshCw className={`w-8 h-8 ${iconColor} animate-spin`} />
                    )}
                </div>
                <h3 className={`text-xl font-semibold ${textColor} mb-2`}>
                    {paused ? `${isFullCheck ? 'Full' : 'Half'} Check Paused` : `${isFullCheck ? 'Full' : 'Half'} Check In Progress`}
                </h3>
                <p className={isFullCheck ? 'text-gray-600' : 'text-yellow-600'}>{message}</p>
            </div>

            {/* Pause/Resume/Stop Controls */}
            <div className="flex justify-center gap-3 mt-6">
                {paused ? (
                    <button
                        onClick={onResume}
                        disabled={isResuming}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2"
                    >
                        {isResuming ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        {isResuming ? "Resuming..." : "Resume Check"}
                    </button>
                ) : (
                    <button
                        onClick={onPause}
                        disabled={isPausing}
                        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2"
                    >
                        {isPausing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Pause className="w-4 h-4" />
                        )}
                        {isPausing ? "Pausing..." : "Pause Check"}
                    </button>
                )}

                <button
                    onClick={onStop}
                    disabled={isStopping}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2"
                >
                    {isStopping ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <X className="w-4 h-4" />
                    )}
                    {isStopping ? "Stopping..." : "Stop Check"}
                </button>
            </div>

            {/* Status Message */}
            {paused && (
                <div className="bg-yellow-100 border border-yellow-300 rounded p-4 mt-4">
                    <div className="flex items-center gap-3">
                        <Pause className="w-5 h-5 text-yellow-600" />
                        <div>
                            <p className="font-semibold text-yellow-800">Check Paused</p>
                            <p className="text-sm text-yellow-700">
                                Click "Resume Check" to continue checking macros.
                                Click "Stop Check" to cancel the operation.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
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

// Pause/Resume functions for macro fill
const pauseProcessing = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.pauseMacroFill(reportId);
    }
    return { status: "SUCCESS", result: { message: "Processing paused" } };
};

const resumeProcessing = async (reportId) => {
    if (window.electronAPI) {
        return await window.electronAPI.resumeMacroFill(reportId);
    }
    return { status: "SUCCESS", result: { message: "Processing resumed" } };
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

    // Pause/resume state for checks
    const [isPausing, setIsPausing] = useState(false);
    const [isResuming, setIsResuming] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [checkPaused, setCheckPaused] = useState(false);
    const [halfCheckPaused, setHalfCheckPaused] = useState(false);
    const [initialTabSet, setInitialTabSet] = useState(false);
    const [activeCheckType, setActiveCheckType] = useState(null); // 'full' or 'half'

    // Pause/resume state for macro fill
    const [isPausingMacro, setIsPausingMacro] = useState(false);
    const [isResumingMacro, setIsResumingMacro] = useState(false);

    // Get progress state for current report
    const currentProgress = reportId ? progressStates[reportId] : null;

    const { ramInfo } = useRam();

    useEffect(() => {
        if (ramInfo?.recommendedTabs && !initialTabSet) {
            setTabsNum(ramInfo.recommendedTabs.toString());
            setInitialTabSet(true);
        }
    }, []);

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
                        total: 0,
                        failedRecords: 0,
                        currentMacro: '',
                        stage: 'Starting'
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

                // If we don't have progress data from events, use the final result
                if (!currentProgress || currentProgress.progress < 100) {
                    dispatch({
                        type: 'UPDATE_PROGRESS',
                        payload: {
                            reportId,
                            updates: {
                                status: 'COMPLETE',
                                message: result.result?.message || "Macro submitted successfully",
                                progress: 100,
                                data: {
                                    current: currentProgress?.data?.total || 100,
                                    total: currentProgress?.data?.total || 100,
                                    failedRecords: currentProgress?.data?.failedRecords || 0,
                                    numTabs: tabsNumValue,
                                    stage: 'Complete'
                                }
                            }
                        }
                    });
                }

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

    // Add this after the handleSubmitMacro function
    const handleRetryMacro = async () => {
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
                    message: "Initializing macro retry...",
                    progress: 0,
                    paused: false,
                    stopped: false,
                    data: {
                        current: 0,
                        total: 0,
                        failedRecords: 0,
                        currentMacro: '',
                        stage: 'Starting'
                    }
                }
            }
        });

        try {
            console.log(`Retrying macro for report: ${reportId} with tabs: ${tabsNumValue}`);

            const result = await retryMacro(reportId, tabsNumValue);
            console.log("Macro retry result:", result);

            // Check for success based on response.status
            if (result.status === "SUCCESS") {
                setSubmissionResult(result);

                // If we don't have progress data from events, use the final result
                if (!currentProgress || currentProgress.progress < 100) {
                    dispatch({
                        type: 'UPDATE_PROGRESS',
                        payload: {
                            reportId,
                            updates: {
                                status: 'COMPLETE',
                                message: result.result?.message || "Macro retry submitted successfully",
                                progress: 100,
                                data: {
                                    current: currentProgress?.data?.total || 100,
                                    total: currentProgress?.data?.total || 100,
                                    failedRecords: currentProgress?.data?.failedRecords || 0,
                                    numTabs: tabsNumValue,
                                    stage: 'Complete'
                                }
                            }
                        }
                    });
                }

                setCurrentStep('success');
            } else {
                // Handle failure
                const errorMessage = result.result?.message || result.error || 'Failed to retry macro';
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
            console.error("Error retrying macro:", err);
            const errorMessage = err.message || 'An unexpected error occurred while retrying macro';
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

    // Handle macro status check with pause/resume support
    const handleCheckMacro = async () => {
        if (!reportId.trim()) {
            setError("Please enter a report ID");
            return;
        }

        setError("");
        setIsSubmitting(true);
        setActiveCheckType('full');
        setCheckPaused(false);
        setCurrentStep('checking');

        try {
            console.log(`Checking macro status for report: ${reportId}`);

            const result = await checkMacroStatus(reportId, tabsNum);
            console.log("Macro check result:", result);

            // Check if the operation was successful
            if (result.status === "SUCCESS") {
                setCheckResult(result);
                setCurrentStep('check-result');
                setActiveCheckType(null);
            } else {
                const errorMessage = result.result?.message || result.error || 'Failed to check macro status';
                setError(errorMessage);
                setCurrentStep('error');
                setActiveCheckType(null);
            }

        } catch (err) {
            console.error("Error checking macro status:", err);
            setError(err.message || 'An unexpected error occurred while checking macro status');
            setCurrentStep('error');
            setActiveCheckType(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle half check macro status with pause/resume support
    const handleHalfCheckMacro = async () => {
        if (!reportId.trim()) {
            setError("Please enter a report ID");
            return;
        }

        setError("");
        setIsSubmitting(true);
        setActiveCheckType('half');
        setHalfCheckPaused(false);
        setCurrentStep('half-checking');

        try {
            console.log(`Half checking macro status for report: ${reportId}`);

            const result = await halfCheckMacroStatus(reportId, tabsNum);
            console.log("Half check macro result:", result);

            if (result.status === "SUCCESS") {
                setHalfCheckResult(result);
                setCurrentStep('half-check-result');
                setActiveCheckType(null);
            } else {
                const errorMessage = result.result?.message || result.error || 'Failed to check macro status';
                setError(errorMessage);
                setCurrentStep('error');
                setActiveCheckType(null);
            }

        } catch (err) {
            console.error("Error half checking macro status:", err);
            setError(err.message || 'An unexpected error occurred while checking macro status');
            setCurrentStep('error');
            setActiveCheckType(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle pause for active check
    const handlePauseCheck = async () => {
        if (!reportId || !activeCheckType) return;

        setIsPausing(true);
        setError("");

        try {
            console.log(`Pausing ${activeCheckType} check for report: ${reportId}`);

            const result = activeCheckType === 'full'
                ? await pauseFullCheck(reportId)
                : await pauseHalfCheck(reportId);

            console.log("Pause result:", result);

            if (result.status === "SUCCESS") {
                if (activeCheckType === 'full') {
                    setCheckPaused(true);
                } else {
                    setHalfCheckPaused(true);
                }
            } else {
                setError(result.result?.message || result.error || `Failed to pause ${activeCheckType} check`);
            }
        } catch (err) {
            console.error("Error pausing check:", err);
            setError(err.message || `Failed to pause ${activeCheckType} check`);
        } finally {
            setIsPausing(false);
        }
    };

    // Handle resume for active check
    const handleResumeCheck = async () => {
        if (!reportId || !activeCheckType) return;

        setIsResuming(true);
        setError("");

        try {
            console.log(`Resuming ${activeCheckType} check for report: ${reportId}`);

            const result = activeCheckType === 'full'
                ? await resumeFullCheck(reportId)
                : await resumeHalfCheck(reportId);

            console.log("Resume result:", result);

            if (result.status === "SUCCESS") {
                if (activeCheckType === 'full') {
                    setCheckPaused(false);
                } else {
                    setHalfCheckPaused(false);
                }
            } else {
                setError(result.result?.message || result.error || `Failed to resume ${activeCheckType} check`);
            }
        } catch (err) {
            console.error("Error resuming check:", err);
            setError(err.message || `Failed to resume ${activeCheckType} check`);
        } finally {
            setIsResuming(false);
        }
    };

    // Handle stop for active check
    const handleStopCheck = async () => {
        if (!reportId || !activeCheckType) return;

        setIsStopping(true);
        setError("");

        try {
            console.log(`Stopping ${activeCheckType} check for report: ${reportId}`);

            const result = activeCheckType === 'full'
                ? await stopFullCheck(reportId)
                : await stopHalfCheck(reportId);

            console.log("Stop result:", result);

            if (result.status === "SUCCESS") {
                // Reset to input step
                setActiveCheckType(null);
                setCheckPaused(false);
                setHalfCheckPaused(false);
                setCurrentStep('report-id-input');

                // Show success message for stop
                setError(`${activeCheckType === 'full' ? 'Full' : 'Half'} check stopped successfully`);
            } else {
                setError(result.result?.message || result.error || `Failed to stop ${activeCheckType} check`);
            }
        } catch (err) {
            console.error("Error stopping check:", err);
            setError(err.message || `Failed to stop ${activeCheckType} check`);
        } finally {
            setIsStopping(false);
        }
    };

    // Enhanced pause processing function for macro fill
    const handlePauseProcessing = async () => {
        if (!reportId) return;

        setIsPausingMacro(true);
        setError("");

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
        } finally {
            setIsPausingMacro(false);
        }
    };

    // Enhanced resume processing function for macro fill
    const handleResumeProcessing = async () => {
        if (!reportId) return;

        setIsResumingMacro(true);
        setError("");

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
        } finally {
            setIsResumingMacro(false);
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
        setIsPausing(false);
        setIsResuming(false);
        setIsStopping(false);
        setIsPausingMacro(false);
        setIsResumingMacro(false);
        setCheckPaused(false);
        setHalfCheckPaused(false);
        setActiveCheckType(null);

        // Clear progress state if exists
        if (reportId && progressStates[reportId]) {
            dispatch({
                type: 'CLEAR_PROGRESS',
                payload: { reportId }
            });
        }
    };

    // Update the check status display messages based on paused state
    const getCheckStatusMessage = () => {
        if (activeCheckType === 'full') {
            return checkPaused
                ? `Full check paused for report ${reportId}. Click Resume to continue.`
                : `Checking all macros for report ${reportId}...`;
        } else if (activeCheckType === 'half') {
            return halfCheckPaused
                ? `Half check paused for report ${reportId}. Click Resume to continue.`
                : `Checking only incomplete macros for report ${reportId}...`;
        }
        return "";
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
                                            max="200"
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
                                    <button
                                        onClick={handleRetryMacro}
                                        disabled={!reportId.trim() || !tabsNum.trim() || isSubmitting || !isLoggedIn}
                                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2 justify-center"
                                    >
                                        {isSubmitting ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-4 h-4" />
                                        )}
                                        {isSubmitting ? "Retrying..." : "Retry Macro"}
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
                                                <strong>Full Check:</strong> Checks all macros in the report (can be paused/resumed)<br />
                                                <strong>Half Check:</strong> Only checks previously incomplete macros (faster, can be paused/resumed)<br />
                                                <strong>Submit Macro:</strong> Submits macros for the report with pause/resume support
                                                <strong>Retry Macro:</strong> Retry failed macros for the report with pause/resume support
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Submission In Progress (Macro Fill) */}
                    {currentStep === 'submission-in-progress' && currentProgress && (
                        <div className="space-y-6">
                            <ProgressDisplay
                                progress={currentProgress.progress || 0}
                                message={currentProgress.message || "Processing macros..."}
                                paused={currentProgress.paused}
                                data={currentProgress.data || {}}
                            />

                            {/* Enhanced Pause/Resume Controls for Macro Fill */}
                            <div className="flex justify-center gap-3 mt-6">
                                {currentProgress.paused ? (
                                    <button
                                        onClick={handleResumeProcessing}
                                        disabled={isResumingMacro || currentProgress.stopped || currentProgress.status === 'COMPLETE'}
                                        className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2"
                                    >
                                        {isResumingMacro ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Play className="w-4 h-4" />
                                        )}
                                        {isResumingMacro ? "Resuming..." : "Resume Processing"}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handlePauseProcessing}
                                        disabled={isPausingMacro || currentProgress.stopped || currentProgress.status === 'COMPLETE'}
                                        className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white rounded font-semibold flex items-center gap-2"
                                    >
                                        {isPausingMacro ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Pause className="w-4 h-4" />
                                        )}
                                        {isPausingMacro ? "Pausing..." : "Pause Processing"}
                                    </button>
                                )}
                            </div>

                            {/* Enhanced Pause Status Message for Macro Fill */}
                            {currentProgress.paused && (
                                <div className="bg-yellow-100 border border-yellow-300 rounded p-4">
                                    <div className="flex items-center gap-3">
                                        <Pause className="w-5 h-5 text-yellow-600" />
                                        <div>
                                            <p className="font-semibold text-yellow-800">Processing Paused</p>
                                            <p className="text-sm text-yellow-700">
                                                Click "Resume Processing" to continue where you left off.
                                                Your progress is saved and will resume from the current state.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Processing Status Message for Macro Fill */}
                            {!currentProgress.paused && currentProgress.status === 'PROCESSING' && (
                                <div className="bg-blue-100 border border-blue-300 rounded p-4">
                                    <div className="flex items-center gap-3">
                                        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                                        <div>
                                            <p className="font-semibold text-blue-800">Processing in Progress</p>
                                            <p className="text-sm text-blue-700">
                                                You can pause the processing at any time and resume later.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Full Check In Progress */}
                    {currentStep === 'checking' && activeCheckType === 'full' && (
                        <div className="space-y-6">
                            <CheckStatusDisplay
                                type="full"
                                status="PROCESSING"
                                message={getCheckStatusMessage()}
                                onPause={handlePauseCheck}
                                onResume={handleResumeCheck}
                                onStop={handleStopCheck}
                                isPausing={isPausing}
                                isResuming={isResuming}
                                isStopping={isStopping}
                                paused={checkPaused}
                            />
                        </div>
                    )}

                    {/* Step 4: Half Check In Progress */}
                    {currentStep === 'half-checking' && activeCheckType === 'half' && (
                        <div className="space-y-6">
                            <CheckStatusDisplay
                                type="half"
                                status="PROCESSING"
                                message={getCheckStatusMessage()}
                                onPause={handlePauseCheck}
                                onResume={handleResumeCheck}
                                onStop={handleStopCheck}
                                isPausing={isPausing}
                                isResuming={isResuming}
                                isStopping={isStopping}
                                paused={halfCheckPaused}
                            />
                        </div>
                    )}

                    {/* Step 5: Success (Macro Fill Complete) */}
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
                                {submissionResult?.result && (
                                    <div className="bg-white border border-green-300 rounded p-4 mb-4">
                                        <h4 className="font-semibold text-green-800 mb-2">Submission Details:</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Report ID:</span>
                                                <span className="font-mono">{reportId}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Total Macros:</span>
                                                <span>{submissionResult.result.total || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Successfully Completed:</span>
                                                <span className="text-green-600">
                                                    {submissionResult.result.completed || 0}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Failed:</span>
                                                <span className={submissionResult.result.failed > 0 ? "text-red-600" : "text-green-600"}>
                                                    {submissionResult.result.failed || 0}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Status:</span>
                                                <span className="text-green-600 font-semibold">{submissionResult.result.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Fallback to progress data if result data is not available */}
                                {!submissionResult?.result && currentProgress && (
                                    <div className="bg-white border border-green-300 rounded p-4 mb-4">
                                        <h4 className="font-semibold text-green-800 mb-2">Submission Details:</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Report ID:</span>
                                                <span className="font-mono">{reportId}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Total Assets:</span>
                                                <span>{currentProgress.data?.total || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Successfully Processed:</span>
                                                <span className="text-green-600">
                                                    {Math.max(0, (currentProgress.data?.current || 0) - (currentProgress.data?.failedRecords || 0))}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Failed:</span>
                                                <span className={currentProgress.data?.failedRecords > 0 ? "text-red-600" : "text-green-600"}>
                                                    {currentProgress.data?.failedRecords || 0}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Final Status:</span>
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

                    {/* Step 6: Full Check Result */}
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
                                        Run Full Check Again
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 7: Half Check Result */}
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
                                <p className="text-red-600 mb-4">{error}</p>

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