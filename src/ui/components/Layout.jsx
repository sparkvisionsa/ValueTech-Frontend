import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { AlertTriangle, Bell, Download, HardDrive, Loader2, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { useSystemControl } from '../context/SystemControlContext';
import { useNavStatus } from '../context/NavStatusContext';
import { useValueNav } from '../context/ValueNavContext';
import { useRam } from '../context/RAMContext'; // Updated import
import navigation from '../constants/navigation';
const { viewTitles, valueSystemGroups, findTabInfo, valueSystemCards } = navigation;

const findCardForGroup = (groupId) =>
    valueSystemCards.find((card) => Array.isArray(card.groups) && card.groups.includes(groupId));

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
        selectedDomain,
        selectedCompany,
        chooseCard,
        chooseDomain,
        setSelectedCompany,
        setActiveGroup,
        setActiveTab,
        resetAll
    } = useValueNav();

    // Use RAM context
    const {
        ramInfo,
        readingRam,
        error: ramError,
        readRam,
        startPolling,
        stopPolling,
        isAvailable: isRamAvailable
    } = useRam();

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
        // Start RAM polling when component mounts
        if (isRamAvailable) {
            startPolling(5000);
        }

        // Cleanup when component unmounts
        return () => {
            stopPolling();
        };
    }, [startPolling, stopPolling, isRamAvailable]);

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

    const statusStyles = (state) => {
        switch (state) {
            case 'success':
                return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200';
            case 'error':
                return 'border-rose-400/30 bg-rose-500/15 text-rose-200';
            case 'info':
                return 'border-sky-400/30 bg-sky-500/15 text-sky-200';
            default:
                return 'border-slate-600/40 bg-slate-900/50 text-slate-200';
        }
    };

    const renderStatusPill = (label, status) => (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium shadow-[0_6px_14px_rgba(2,6,23,0.35)] ${statusStyles(status?.state)}`}>
            <span className="font-semibold">{label}:</span>
            <span className="truncate">{status?.message}</span>
        </div>
    );

    const updateNotice = shouldShowUpdateNotice ? (
        <div className="relative mb-2 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 px-4 py-2.5 text-[10px] text-slate-200 shadow-[0_10px_24px_rgba(2,6,23,0.45)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-8 h-20 w-20 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="relative flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
                        <Bell className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold text-[11px] text-slate-100">New update available</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900/70 border border-slate-700 text-slate-200">
                        {latestUpdate.version}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                        {latestUpdate.updateType}
                    </span>
                </div>
                <div className="text-[10px] text-slate-300">
                    {latestUpdate.description || latestUpdate.notes || 'Download now to stay up to date.'}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleDownloadUpdate}
                        className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
                        disabled={loadingUpdate}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {userUpdateState?.status === 'downloaded' ? 'Downloaded' : 'Download'}
                    </button>
                    {!isMandatoryUpdate && (
                        <button
                            onClick={() => setHideUpdateNotice(true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-semibold text-slate-200 border border-slate-700 hover:border-slate-600"
                            disabled={loadingUpdate}
                        >
                            Later
                        </button>
                    )}
                    {userUpdateState?.status === 'downloaded' && (
                        <button
                            onClick={handleApplyUpdate}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                            disabled={loadingUpdate || userUpdateState?.status === 'applied'}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {userUpdateState?.status === 'applied' ? 'Applied' : 'Apply update'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    const statusBanner = (
        <div className="flex items-center gap-2 text-[10px] text-slate-300 text-compact">
            <span className={`text-[9px] font-semibold px-2 py-1 rounded-full uppercase border ${mode === 'active'
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
                : mode === 'partial'
                    ? 'bg-amber-500/15 text-amber-200 border-amber-400/30'
                    : 'bg-rose-500/15 text-rose-200 border-rose-400/30'
                }`}>
                {mode}
            </span>
            {systemState?.notes && (
                <span className="text-[10px] text-slate-400 truncate">{systemState.notes}</span>
            )}
            <button
                onClick={fetchSystemState}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white"
                disabled={loadingState}
                title="Refresh status"
            >
                <RefreshCcw className="w-3.5 h-3.5" />
                Refresh
            </button>
        </div>
    );

    const handleAuthNav = (view) => {
        if (onViewChange) onViewChange(view);
    };

    const userBadge = isAuthenticated ? (
        <div className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-3 py-1 text-[10px] shadow-[0_8px_20px_rgba(2,6,23,0.45)]">
            <div className="h-6 w-6 rounded-full bg-slate-800 text-cyan-200 border border-slate-700 flex items-center justify-center text-[10px] font-semibold">
                {(user?.phone || '').charAt(0) || '?'}
            </div>
            <div className="text-[10px] text-slate-100 font-medium">{user?.phone || 'User'}</div>
            <button
                onClick={logout}
                className="text-[9px] font-semibold text-rose-300 hover:text-rose-200 underline decoration-dotted"
            >
                Logout
            </button>
        </div>
    ) : (
        <div className="flex items-center gap-2 text-[10px]">
            <button
                onClick={() => handleAuthNav('registration')}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[10px] font-semibold text-slate-200 hover:border-slate-600 hover:text-white"
            >
                Register
            </button>
            <button
                onClick={() => handleAuthNav('login')}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/50 bg-cyan-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
            >
                Login
            </button>
        </div>
    );

    const currentTabInfo = findTabInfo(currentView);
    const headerTitle = currentTabInfo?.tab?.label || viewTitles[currentView] || 'Value Tech';
    const groupTabs = activeGroup ? valueSystemGroups[activeGroup]?.tabs || [] : [];
    const showHeaderTabs = currentView !== 'apps' && groupTabs && groupTabs.length > 0;

    const handleBreadcrumbClick = (item) => {
        switch (item.kind) {
            case 'apps':
                // top-level
                onViewChange('apps');
                break;
            case 'card':
                {
                    const cardEntry = valueSystemCards.find((card) => card.id === item.key);
                    chooseCard(item.key);
                    setActiveGroup(cardEntry?.defaultGroup || null);
                }
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
                {
                    const owningCard = findCardForGroup(item.key);
                    if (owningCard?.id) {
                        chooseCard(owningCard.id);
                    }
                    if (owningCard?.id === 'uploading-reports' && selectedDomain) {
                        chooseDomain(selectedDomain);
                    }
                    setActiveGroup(item.key);
                    const targetTabs = valueSystemGroups[item.key]?.tabs || [];
                    const targetFirstTab = targetTabs?.[0]?.id;
                    if (targetFirstTab) {
                        onViewChange(targetFirstTab);
                    } else {
                        onViewChange('apps');
                    }
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
            <div className="mb-4 flex flex-col gap-2 page-animate">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 text-compact">
                        {breadcrumbs.map((item, idx) => {
                            const isLast = idx === breadcrumbs.length - 1;
                            return (
                                <React.Fragment key={item.key + idx}>
                                    <button
                                        onClick={() => handleBreadcrumbClick(item)}
                                        className={`px-1 py-0.5 text-[11px] font-semibold transition ${isLast
                                            ? 'text-slate-900'
                                            : 'text-slate-500 hover:text-slate-900'
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                    {idx < breadcrumbs.length - 1 && (
                                        <span className="text-slate-400 text-[11px]">/</span>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                    {showHeaderTabs && (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {groupTabs.map((tab) => {
                                const isActive = currentView === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => onViewChange(tab.id)}
                                        className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-compact transition ${isActive
                                            ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)]'
                                            : 'bg-white/70 text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900'
                                            }`}
                                    >
                                        <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-cyan-300' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-transparent">
            {/* Sidebar */}
            <Sidebar currentView={currentView} onViewChange={onViewChange} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-[0_12px_26px_rgba(2,6,23,0.65)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/5 to-transparent" />
                    <div className="pointer-events-none absolute -left-10 top-6 h-28 w-28 rounded-full bg-cyan-500/20 blur-2xl float-slow" />
                    <div className="pointer-events-none absolute -right-12 top-6 h-28 w-28 rounded-full bg-blue-500/15 blur-2xl float-slower" />
                    <div className="relative px-5 py-2.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex flex-col text-compact">
                                <span className="text-[9px] font-semibold text-slate-400">Workspace</span>
                                <h1 className="font-display text-[15px] font-semibold text-slate-100 leading-tight text-compact">
                                    {headerTitle}
                                </h1>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {userBadge}
                                {statusBanner}
                                <button
                                    type="button"
                                    onClick={readRam}
                                    disabled={readingRam || !isRamAvailable}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold text-slate-100 shadow-[0_10px_20px_rgba(2,6,23,0.5)] hover:bg-slate-800 disabled:opacity-60"
                                    title={!isRamAvailable ? "RAM reader not available" : "Refresh RAM info"}
                                >
                                    {readingRam ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <HardDrive className="w-3.5 h-3.5" />
                                    )}
                                    {readingRam ? 'Reading...' : 'Read RAM'}
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {renderStatusPill('Taqeem', taqeemStatus)}
                            {renderStatusPill('Company', companyStatus)}
                            {(ramInfo || ramError) && (
                                <div
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] shadow-[0_6px_14px_rgba(2,6,23,0.35)] ${ramError
                                        ? 'border-rose-400/30 bg-rose-500/15 text-rose-200'
                                        : 'border-slate-600/40 bg-slate-900/50 text-slate-200'
                                        }`}
                                >
                                    <HardDrive className="w-3.5 h-3.5" />
                                    {ramError ? (
                                        <span>{ramError}</span>
                                    ) : (
                                        <span>
                                            Used {ramInfo.usedGb} GB of {ramInfo.totalGb} GB
                                            {typeof ramInfo.freeGb === 'number' ? ` (Free ${ramInfo.freeGb} GB)` : ''}
                                            {ramInfo.usagePercentage && ` (${ramInfo.usagePercentage}%)`}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {isAuthenticated && !isAdmin && mode === 'inactive' && (
                            <div className="flex items-center gap-2 text-[10px] text-rose-200 bg-rose-500/15 border border-rose-400/30 px-3 py-1.5 rounded-xl">
                                <AlertTriangle className="w-4 h-4" />
                                <span>The system is currently inactive. Access to features is disabled.</span>
                            </div>
                        )}
                        {isAuthenticated && !isAdmin && mode === 'partial' && (
                            <div className="flex items-center gap-2 text-[10px] text-amber-200 bg-amber-500/15 border border-amber-400/30 px-3 py-1.5 rounded-xl">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{systemState?.partialMessage || 'Only selected modules are available right now.'}</span>
                            </div>
                        )}
                        {isAuthenticated && !isAdmin && mode === 'inactive' && downtimeParts && (
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-200 bg-slate-900/70 border border-slate-700/60 px-3 py-1.5 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-cyan-300" />
                                    <span className="font-semibold text-slate-100">Downtime ends in</span>
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
                                            className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-700/70 text-center shadow-sm"
                                        >
                                            <div className="text-[12px] font-semibold text-slate-100 leading-tight">{item.value}</div>
                                            <div className="text-[8px] uppercase text-slate-400">{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isAuthenticated && !isAdmin && updateBlocked() && (
                            <div className="flex items-center gap-2 text-[10px] text-orange-200 bg-orange-500/15 border border-orange-400/30 px-3 py-1.5 rounded-xl">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{blockMessage || 'A mandatory update must be applied before continuing.'}</span>
                            </div>
                        )}
                        {updateNotice}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto px-6 py-5 bg-transparent relative">
                    <div className="pointer-events-none absolute inset-0 z-0">
                        <div className="absolute -top-20 left-1/3 h-48 w-48 rounded-full bg-cyan-200/30 blur-3xl float-slow" />
                        <div className="absolute top-32 right-[-80px] h-56 w-56 rounded-full bg-emerald-200/20 blur-3xl float-slower" />
                        <div className="absolute bottom-12 left-[-80px] h-44 w-44 rounded-full bg-sky-200/25 blur-3xl float-slow" />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.55))]" />
                    </div>
                    {blocked && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(240,249,255,0.9))] backdrop-blur-sm text-center px-6">
                            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-rose-50 border border-rose-100 mb-3 shadow-sm">
                                <AlertTriangle className="w-7 h-7 text-rose-500" />
                            </div>
                            <p className="text-[14px] font-semibold text-slate-900 mb-1">
                                {blockMessage || 'This feature is unavailable right now.'}
                            </p>
                            <p className="text-[11px] text-slate-600 mb-4">
                                Please refresh status or apply the latest update to continue.
                            </p>
                        </div>
                    )}
                    <div className={`relative z-10 ${blocked ? 'pointer-events-none opacity-60' : ''}`}>
                        <PageChrome />
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
