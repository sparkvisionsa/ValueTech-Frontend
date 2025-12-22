import React, { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { AlertTriangle, Bell, Download, HardDrive, Loader2, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { useSystemControl } from '../context/SystemControlContext';
import { useNavStatus } from '../context/NavStatusContext';
import { useValueNav } from '../context/ValueNavContext';
import navigation from '../constants/navigation';
const { viewTitles, valueSystemGroups, findTabInfo } = navigation;

const Layout = ({ children, currentView, onViewChange }) => {
    const { isAuthenticated, user, logout } = useSession();
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
    const { taqeemStatus, companyStatus } = useNavStatus();
    const {
        breadcrumbs,
        activeGroup,
        activeTab,
        selectedCompany,
        chooseCard,
        chooseDomain,
        setSelectedCompany,
        setActiveGroup,
        setActiveTab,
        resetAll
    } = useValueNav();

    const isAdmin = user?.phone === '011111';
    const blocked = isAuthenticated && (isFeatureBlocked(currentView) || updateBlocked());
    const blockMessage = blockReason(currentView);
    const mode = systemState?.mode || 'active';
    const [downtimeParts, setDowntimeParts] = useState(null);
    const [hideUpdateNotice, setHideUpdateNotice] = useState(false);
    const [ramInfo, setRamInfo] = useState(null);
    const [readingRam, setReadingRam] = useState(false);
    const ramInFlight = useRef(false);

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

    const handleReadRam = async () => {
        if (ramInFlight.current) return;
        if (!window?.electronAPI?.readRam) {
            setRamInfo({ error: 'RAM reader not available in this build.' });
            return;
        }

        setReadingRam(true);
        ramInFlight.current = true;
        try {
            const result = await window.electronAPI.readRam();
            if (result?.ok) {
                setRamInfo({
                    usedGb: result.usedGb,
                    totalGb: result.totalGb,
                    freeGb: result.freeGb,
                    readAt: Date.now()
                });
            } else {
                setRamInfo({ error: result?.error || 'Unable to read RAM.' });
            }
        } catch (err) {
            setRamInfo({ error: err?.message || 'Failed to read RAM.' });
        } finally {
            setReadingRam(false);
            ramInFlight.current = false;
        }
    };

    useEffect(() => {
        // Auto-refresh RAM usage without manual clicks
        const pollRam = () => {
            handleReadRam();
        };

        pollRam();
        const id = setInterval(pollRam, 5000);
        return () => clearInterval(id);
    }, []);

    const isMandatoryUpdate = latestUpdate?.rolloutType === 'mandatory';
    const shouldShowUpdateNotice = isAuthenticated && !isAdmin && latestUpdate && userUpdateState?.status !== 'applied' && !hideUpdateNotice;

    const statusStyles = (state) => {
        switch (state) {
            case 'success':
                return 'border-green-200 bg-green-50 text-green-800';
            case 'error':
                return 'border-red-200 bg-red-50 text-red-800';
            case 'info':
                return 'border-blue-200 bg-blue-50 text-blue-800';
            default:
                return 'border-gray-200 bg-gray-50 text-gray-700';
        }
    };

    const renderStatusPill = (label, status) => (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm shadow-sm ${statusStyles(status?.state)}`}>
            <span className="font-semibold">{label}:</span>
            <span className="truncate">{status?.message}</span>
        </div>
    );

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

    const handleAuthNav = (view) => {
        if (onViewChange) onViewChange(view);
    };

    const userBadge = isAuthenticated ? (
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-sm">
            <div className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
                {(user?.phone || '').charAt(0) || '?'}
            </div>
            <div className="text-sm text-gray-800 font-medium">{user?.phone || 'User'}</div>
            <button
                onClick={logout}
                className="text-xs font-semibold text-red-600 hover:text-red-700 underline decoration-dotted"
            >
                Logout
            </button>
        </div>
    ) : (
        <div className="flex items-center gap-2">
            <button
                onClick={() => handleAuthNav('registration')}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
                Register
            </button>
            <button
                onClick={() => handleAuthNav('login')}
                className="inline-flex items-center gap-1 rounded-full border border-gray-900 bg-gray-900 px-3 py-1 text-sm font-semibold text-white hover:bg-gray-800"
            >
                Login
            </button>
        </div>
    );

    const currentTabInfo = findTabInfo(currentView);
    const headerTitle = currentTabInfo?.tab?.label || viewTitles[currentView] || 'Value Tech';
    const groupTabs = activeGroup ? valueSystemGroups[activeGroup]?.tabs || [] : [];
    const firstGroupTab = groupTabs?.[0]?.id;

    const handleBreadcrumbClick = (item) => {
        switch (item.kind) {
            case 'apps':
                // top-level
                onViewChange('apps');
                break;
            case 'card':
                chooseCard(item.key);
                setActiveGroup(null);
                setActiveTab(null);
                onViewChange('apps');
                break;
            case 'domain':
                chooseCard('uploading-reports');
                chooseDomain(item.key);
                onViewChange('apps');
                break;
            case 'company':
                chooseCard('uploading-reports');
                chooseDomain('equipments');
                if (item.value) {
                    setSelectedCompany(item.value);
                }
                onViewChange('apps');
                break;
            case 'group':
                chooseCard('uploading-reports');
                if (selectedDomain) {
                    chooseDomain(selectedDomain);
                }
                setActiveGroup(item.key);
                if (firstGroupTab) {
                    onViewChange(firstGroupTab);
                } else {
                    onViewChange('apps');
                }
                break;
            case 'tab':
                onViewChange(item.key);
                break;
            default:
                onViewChange('apps');
        }
    };

    const PageChrome = () => {
        if (!breadcrumbs || breadcrumbs.length === 0) return null;
        return (
            <div className="flex flex-col gap-3 mb-4">
                <div className="text-sm text-gray-700 flex flex-wrap items-center gap-2">
                    {breadcrumbs.map((item, idx) => (
                        <React.Fragment key={item.key + idx}>
                            <button
                                onClick={() => handleBreadcrumbClick(item)}
                                className={`px-1 text-sm ${idx === breadcrumbs.length - 1 ? 'font-semibold text-gray-900' : 'text-blue-700 hover:underline'}`}
                            >
                                {item.label}
                            </button>
                            {idx < breadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
                        </React.Fragment>
                    ))}
                </div>
                {groupTabs && groupTabs.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {groupTabs.map((tab) => {
                            const isActive = currentView === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onViewChange(tab.id)}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${isActive
                                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50'
                                        }`}
                                >
                                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-50"> {/* Simple background */}
            {/* Sidebar */}
            <Sidebar currentView={currentView} onViewChange={onViewChange} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-gray-200">
                    <div className="px-6 py-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex flex-col">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {headerTitle}
                                </h1>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap justify-end">
                                {userBadge}
                                {statusBanner}
                                <button
                                    type="button"
                                    onClick={handleReadRam}
                                    disabled={readingRam}
                                    className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
                                >
                                    {readingRam ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <HardDrive className="w-4 h-4" />
                                    )}
                                    Read RAM
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {renderStatusPill('Taqeem', taqeemStatus)}
                            {renderStatusPill('Company', companyStatus)}
                            {ramInfo && (
                                <div
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm shadow-sm ${ramInfo.error
                                        ? 'border-red-200 bg-red-50 text-red-800'
                                        : 'border-slate-200 bg-slate-50 text-gray-800'
                                        }`}
                                >
                                    <HardDrive className="w-4 h-4" />
                                    {ramInfo.error ? (
                                        <span>{ramInfo.error}</span>
                                    ) : (
                                        <span>
                                            Used {ramInfo.usedGb} GB of {ramInfo.totalGb} GB
                                            {typeof ramInfo.freeGb === 'number' ? ` (Free ${ramInfo.freeGb} GB)` : ''}
                                        </span>
                                    )}
                                </div>
                            )}
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
                    <PageChrome />
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
const getViewTitle = (view) => viewTitles[view] || 'Value Tech';

export default Layout;
