import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { AlertTriangle, Bell, Download, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { useSystemControl } from '../context/SystemControlContext';

const Layout = ({ children, currentView, onViewChange }) => {
    const { isAuthenticated, user } = useSession();
    const {
        systemState,
        latestUpdate,
        userUpdateState,
        loadingState,
        loadingUpdate,
        fetchSystemState,
        fetchUpdateNotice,
        markDownloaded,
        applyUpdate,
        isFeatureBlocked,
        blockReason,
        updateBlocked,
        updateSystemState
    } = useSystemControl();

    const isAdmin = user?.phone === '011111';
    const blocked = isAuthenticated && (isFeatureBlocked(currentView) || updateBlocked());
    const blockMessage = blockReason(currentView);
    const mode = systemState?.mode || 'active';
    const [downtimeParts, setDowntimeParts] = useState(null);
    const [hideUpdateNotice, setHideUpdateNotice] = useState(false);

    useEffect(() => {
        // Reset notice dismissal whenever a new update arrives
        setHideUpdateNotice(false);
    }, [latestUpdate]);

    useEffect(() => {
        if (!systemState || (!systemState.downtimeDays && !systemState.expectedReturn && !systemState.downtimeHours)) {
            setDowntimeParts(null);
            return;
        }

        const msFromDays = Number(systemState.downtimeDays || 0) * 24 * 60 * 60 * 1000;
        const msFromHours = Number(systemState.downtimeHours || 0) * 60 * 60 * 1000;

        // Prefer explicit hours if provided, otherwise fall back to days
        const durationMs = msFromHours > 0 ? msFromHours : msFromDays;

        const target = systemState.expectedReturn
            ? new Date(systemState.expectedReturn).getTime()
            : durationMs > 0
                ? new Date(systemState.updatedAt || Date.now()).getTime() + durationMs
                : null;

        if (!target || Number.isNaN(target)) {
            setDowntimeParts(null);
            return;
        }

        if (Number.isNaN(target)) {
            setDowntimeParts(null);
            return;
        }

        const formatRemaining = (ms) => {
            if (ms <= 0) {
                return {
                    label: '00:00:00',
                    days: '00',
                    hours: '00',
                    minutes: '00',
                    seconds: '00'
                };
            }
            const totalSeconds = Math.floor(ms / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const pad = (v) => String(v).padStart(2, '0');
            return {
                label: `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
                days: pad(days),
                hours: pad(hours),
                minutes: pad(minutes),
                seconds: pad(seconds)
            };
        };

        const updateCountdown = () => {
            const now = Date.now();
            const formatted = formatRemaining(target - now);
            setDowntimeParts(formatted);
        };

        updateCountdown();
        const id = setInterval(updateCountdown, 1000);
        return () => clearInterval(id);
    }, [systemState]);

    const requireAuth = () => {
        if (!isAuthenticated) {
            alert('Please log in to manage updates.');
            return false;
        }
        return true;
    };

    const handleDownloadUpdate = async () => {
        if (!latestUpdate) return;
        if (!requireAuth()) return;
        try {
            await markDownloaded(latestUpdate._id);
            alert('Update download prepared for your account.');
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to download update';
            alert(msg);
        }
    };

    const handleApplyUpdate = async () => {
        if (!latestUpdate) return;
        if (!requireAuth()) return;
        try {
            await applyUpdate(latestUpdate._id);
            alert('Update applied to your workspace.');
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to apply update';
            alert(msg);
        }
    };

    const isMandatoryUpdate = latestUpdate?.rolloutType === 'mandatory';
    const shouldShowUpdateNotice = isAuthenticated && !isAdmin && latestUpdate && userUpdateState?.status !== 'applied' && !hideUpdateNotice;

    const updateNotice = shouldShowUpdateNotice ? (
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="font-semibold">There is a new update available</span>
                <span className="text-xs px-2 py-1 rounded-full bg-white border border-blue-200">
                    {latestUpdate.version}
                </span>
                <span className="text-xs uppercase tracking-wide bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {latestUpdate.updateType}
                </span>
            </div>
            <div className="text-blue-800 text-sm">
                {latestUpdate.description || latestUpdate.notes || 'Download now to stay up to date.'}
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleDownloadUpdate}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-700"
                    disabled={loadingUpdate}
                >
                    <Download className="w-4 h-4" />
                    {userUpdateState?.status === 'downloaded' ? 'Downloaded' : 'Download'}
                </button>
                {!isMandatoryUpdate && (
                    <button
                        onClick={() => setHideUpdateNotice(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-800 border border-gray-300 hover:bg-gray-50"
                        disabled={loadingUpdate}
                    >
                        Later
                    </button>
                )}
                {userUpdateState?.status === 'downloaded' && (
                    <button
                        onClick={handleApplyUpdate}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white text-sm font-semibold hover:bg-green-700"
                        disabled={loadingUpdate || userUpdateState?.status === 'applied'}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {userUpdateState?.status === 'applied' ? 'Applied' : 'Apply update'}
                    </button>
                )}
            </div>
        </div>
    ) : null;

    const statusBanner = (
        <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full ${mode === 'active'
                ? 'bg-green-100 text-green-800'
                : mode === 'partial'
                    ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
                }`}>
                {mode}
            </span>
            {systemState?.notes && (
                <span className="text-gray-600 text-sm truncate">{systemState.notes}</span>
            )}
            <button
                onClick={fetchSystemState}
                className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900"
                disabled={loadingState}
                title="Refresh status"
            >
                <RefreshCcw className="w-4 h-4" />
                Refresh
            </button>
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-50"> {/* Simple background */}
            {/* Sidebar */}
            <Sidebar currentView={currentView} onViewChange={onViewChange} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-gray-200">
                    <div className="px-6 py-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {getViewTitle(currentView)}
                            </h1>
                            {statusBanner}
                        </div>
                        {isAuthenticated && !isAdmin && mode === 'inactive' && (
                            <div className="flex items-center gap-2 text-sm text-red-800 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                                <AlertTriangle className="w-4 h-4" />
                                <span>The system is currently inactive. Access to features is disabled.</span>
                            </div>
                        )}
                        {isAuthenticated && !isAdmin && mode === 'partial' && (
                            <div className="flex items-center gap-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{systemState?.partialMessage || 'Only selected modules are available right now.'}</span>
                            </div>
                        )}
                        {isAuthenticated && !isAdmin && mode === 'inactive' && downtimeParts && (
                            <div className="flex flex-wrap items-center gap-3 text-sm text-blue-900 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-4 py-3 rounded-xl shadow-sm">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-blue-900">Downtime ends in</span>
                                </div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { label: 'Days', value: downtimeParts.days },
                                { label: 'Hours', value: downtimeParts.hours },
                                { label: 'Minutes', value: downtimeParts.minutes },
                                { label: 'Seconds', value: downtimeParts.seconds }
                                    ].map((item) => (
                                        <div
                                            key={item.label}
                                            className="px-3 py-2 rounded-lg bg-white border border-blue-100 text-center shadow-xs"
                                        >
                                            <div className="text-lg font-bold text-blue-800 leading-tight">{item.value}</div>
                                            <div className="text-[11px] uppercase tracking-wide text-blue-500">{item.label}</div>
                                        </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {isAuthenticated && !isAdmin && updateBlocked() && (
                        <div className="flex items-center gap-2 text-sm text-orange-800 bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{blockMessage || 'A mandatory update must be applied before continuing.'}</span>
                        </div>
                        )}
                        {updateNotice}
                    </div>
                </header>

                {/* Page Content - Remove any conflicting backgrounds */}
                <main className="flex-1 overflow-auto p-6 bg-transparent relative">
                    {blocked && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-br from-white/85 to-blue-50/80 backdrop-blur-sm text-center px-6">
                            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-red-50 border border-red-100 mb-3">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <p className="text-lg font-semibold text-gray-900 mb-1">
                                {blockMessage || 'This feature is unavailable right now.'}
                            </p>
                            <p className="text-sm text-gray-600 mb-4">
                                Please refresh status or apply the latest update to continue.
                            </p>
                            {/* <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={fetchSystemState}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                    Refresh status
                                </button>
                                {latestUpdate && (
                                    <button
                                        onClick={handleDownloadUpdate}
                                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-800 border border-blue-200 hover:bg-blue-50"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download update
                                    </button>
                                )}
                            </div> */}
                        </div>
                    )}
                    <div className={blocked ? 'pointer-events-none opacity-60' : ''}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

// Helper function to get view titles
const getViewTitle = (view) => {
    const titles = {
        login: 'Authentication',
        dashboard: 'Dashboard',
        automation: 'Automation Control',
        settings: 'Settings'
    };
    return titles[view] || 'AutoBot';
};

export default Layout;