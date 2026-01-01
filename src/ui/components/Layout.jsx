import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import {
    AlertTriangle,
    AppWindow,
    Bell,
    Building2,
    Compass,
    Download,
    FileText,
    HardDrive,
    Layers,
    Loader2,
    RefreshCcw,
    Settings,
    ShieldCheck,
    Trash2,
    UploadCloud
} from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { useSystemControl } from '../context/SystemControlContext';
import { useNavStatus } from '../context/NavStatusContext';
import { useValueNav } from '../context/ValueNavContext';
import { useRam } from '../context/RAMContext'; // Updated import
import navigation from '../constants/navigation';
import LanguageToggle from './LanguageToggle';
import { useTranslation } from 'react-i18next';
const { viewTitles, valueSystemGroups, findTabInfo, valueSystemCards, isValueSystemView } = navigation;

const findCardForGroup = (groupId) =>
    valueSystemCards.find((card) => Array.isArray(card.groups) && card.groups.includes(groupId));

const heroThemes = {
    uploadReports: {
        surface: 'from-white via-cyan-50 to-blue-50',
        accent: 'from-cyan-500 to-blue-600',
        border: 'border-cyan-200/70',
        blob: 'bg-cyan-200/60',
        text: 'text-cyan-700'
    },
    uploadSingleReport: {
        surface: 'from-white via-emerald-50 to-teal-50',
        accent: 'from-emerald-500 to-teal-600',
        border: 'border-emerald-200/70',
        blob: 'bg-emerald-200/60',
        text: 'text-emerald-700'
    },
    taqeemInfo: {
        surface: 'from-white via-sky-50 to-indigo-50',
        accent: 'from-sky-500 to-indigo-600',
        border: 'border-sky-200/70',
        blob: 'bg-sky-200/60',
        text: 'text-sky-700'
    },
    deleteReport: {
        surface: 'from-white via-rose-50 to-orange-50',
        accent: 'from-rose-500 to-orange-500',
        border: 'border-rose-200/70',
        blob: 'bg-rose-200/60',
        text: 'text-rose-700'
    },
    evaluationSources: {
        surface: 'from-white via-amber-50 to-orange-50',
        accent: 'from-amber-500 to-orange-500',
        border: 'border-amber-200/70',
        blob: 'bg-amber-200/60',
        text: 'text-amber-700'
    },
    companyConsole: {
        surface: 'from-white via-emerald-50 to-teal-50',
        accent: 'from-emerald-500 to-teal-600',
        border: 'border-emerald-200/70',
        blob: 'bg-emerald-200/60',
        text: 'text-emerald-700'
    },
    settings: {
        surface: 'from-white via-slate-50 to-slate-100',
        accent: 'from-slate-600 to-slate-800',
        border: 'border-slate-200/80',
        blob: 'bg-slate-200/70',
        text: 'text-slate-600'
    },
    adminConsole: {
        surface: 'from-white via-amber-50 to-orange-50',
        accent: 'from-amber-500 to-orange-600',
        border: 'border-amber-200/70',
        blob: 'bg-amber-200/60',
        text: 'text-amber-700'
    },
    default: {
        surface: 'from-white via-slate-50 to-slate-100',
        accent: 'from-slate-700 to-slate-900',
        border: 'border-slate-200/80',
        blob: 'bg-slate-200/70',
        text: 'text-slate-600'
    }
};

const heroIcons = {
    uploadReports: UploadCloud,
    uploadSingleReport: FileText,
    taqeemInfo: Compass,
    deleteReport: Trash2,
    evaluationSources: Layers,
    settings: Settings,
    companyConsole: Building2,
    adminConsole: ShieldCheck
};

const getInitials = (label = '') => {
    const words = String(label).split(' ').filter(Boolean);
    const initials = words.slice(0, 3).map((word) => word[0]?.toUpperCase());
    return initials.join('') || 'VT';
};

const HeroArt = ({ label, theme, Icon }) => {
    const initials = getInitials(label);
    const SafeIcon = Icon || AppWindow;
    return (
        <div
            aria-hidden="true"
            className={`relative h-24 w-full max-w-[240px] overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.surface} shadow-sm`}
        >
            <div className={`pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full ${theme.blob}`} />
            <div className={`pointer-events-none absolute bottom-2 right-2 h-12 w-12 rounded-2xl bg-gradient-to-br ${theme.accent} opacity-90`} />
            <div className="relative flex h-full flex-col justify-between p-3">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${theme.accent} text-white shadow-sm`}>
                    <SafeIcon className="h-4 w-4" />
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${theme.text}`}>{initials}</span>
            </div>
        </div>
    );
};

const Layout = ({ children, currentView, onViewChange }) => {
    const { isAuthenticated, user, logout } = useSession();
    const { t, i18n } = useTranslation();
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

    const numberFormatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);
    const formatNumber = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numberFormatter.format(numeric) : value;
    };

    const isAdmin = user?.phone === '011111';
    const blocked = isAuthenticated && (isFeatureBlocked(currentView) || updateBlocked());
    const blockMessage = blockReason(currentView);
    const mode = systemState?.mode || 'active';
    const modeLabel = t(`layout.modes.${mode}`, { defaultValue: mode });
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
            alert(t('layout.alerts.loginToManageUpdates'));
            return false;
        }
        return true;
    };

    const handleDownloadUpdate = async () => {
        if (!latestUpdate) return;
        if (!requireAuth()) return;
        try {
            await markDownloaded(latestUpdate._id);
            alert(t('layout.alerts.updateDownloadPrepared'));
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || t('layout.alerts.downloadUpdateFailed');
            alert(msg);
        }
    };

    const handleApplyUpdate = async () => {
        if (!latestUpdate) return;
        if (!requireAuth()) return;
        try {
            await applyUpdate(latestUpdate._id);
            alert(t('layout.alerts.updateApplied'));
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || t('layout.alerts.applyUpdateFailed');
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
                    <span className="font-semibold text-[11px] text-slate-100">{t('layout.updateNotice.title')}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900/70 border border-slate-700 text-slate-200">
                        {latestUpdate.version}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                        {latestUpdate.updateType}
                    </span>
                </div>
                <div className="text-[10px] text-slate-300">
                    {latestUpdate.description || latestUpdate.notes || t('layout.updateNotice.descriptionFallback')}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleDownloadUpdate}
                        className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
                        disabled={loadingUpdate}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {userUpdateState?.status === 'downloaded' ? t('layout.updateNotice.downloaded') : t('layout.updateNotice.download')}
                    </button>
                    {!isMandatoryUpdate && (
                        <button
                            onClick={() => setHideUpdateNotice(true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-semibold text-slate-200 border border-slate-700 hover:border-slate-600"
                            disabled={loadingUpdate}
                        >
                            {t('layout.updateNotice.later')}
                        </button>
                    )}
                    {userUpdateState?.status === 'downloaded' && (
                        <button
                            onClick={handleApplyUpdate}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                            disabled={loadingUpdate || userUpdateState?.status === 'applied'}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {userUpdateState?.status === 'applied' ? t('layout.updateNotice.applied') : t('layout.updateNotice.apply')}
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
                {modeLabel}
            </span>
            {systemState?.notes && (
                <span className="text-[10px] text-slate-400 truncate">{systemState.notes}</span>
            )}
            <button
                onClick={fetchSystemState}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 hover:text-white"
                disabled={loadingState}
                title={t('layout.status.refreshTitle')}
            >
                <RefreshCcw className="w-3.5 h-3.5" />
                {t('layout.status.refresh')}
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
            <div className="text-[10px] text-slate-100 font-medium">{user?.phone || t('layout.auth.userFallback')}</div>
            <button
                onClick={logout}
                className="text-[9px] font-semibold text-rose-300 hover:text-rose-200 underline decoration-dotted"
            >
                {t('layout.auth.logout')}
            </button>
        </div>
    ) : (
        <div className="flex items-center gap-2 text-[10px]">
            <button
                onClick={() => handleAuthNav('registration')}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[10px] font-semibold text-slate-200 hover:border-slate-600 hover:text-white"
            >
                {t('layout.auth.register')}
            </button>
            <button
                onClick={() => handleAuthNav('login')}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/50 bg-cyan-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-cyan-500"
            >
                {t('layout.auth.login')}
            </button>
        </div>
    );

    const currentTabInfo = findTabInfo(currentView);
    const resolvedGroupId = activeGroup || currentTabInfo?.groupId || null;
    const resolvedGroup = resolvedGroupId ? valueSystemGroups[resolvedGroupId] : null;
    const resolvedGroupLabel = resolvedGroup
        ? t(`navigation.groups.${resolvedGroupId}.title`, { defaultValue: resolvedGroup.title })
        : null;
    const headerTitle = (() => {
        if (currentTabInfo?.tab?.id) {
            return t(`navigation.tabs.${currentTabInfo.tab.id}.label`, {
                defaultValue: currentTabInfo.tab.label
            });
        }
        if (currentView === 'apps' && resolvedGroupLabel) {
            return resolvedGroupLabel;
        }
        const viewTitle = viewTitles[currentView];
        if (viewTitle) {
            return t(`navigation.viewTitles.${currentView}`, { defaultValue: viewTitle });
        }
        return t('layout.header.defaultTitle');
    })();
    const groupTabs = (() => {
        const tabs = resolvedGroup?.tabs || [];
        // For evaluationSources, only show Haraj Data tab
        if (resolvedGroupId === 'evaluationSources') {
            return tabs.filter(tab => tab.id === 'haraj');
        }
        return tabs;
    })();
    const isValueView = currentView === 'apps' || isValueSystemView(currentView);
    const showHeaderTabs = isValueView && groupTabs.length > 0;
    const tabLabel = currentTabInfo?.tab?.id
        ? t(`navigation.tabs.${currentTabInfo.tab.id}.label`, {
            defaultValue: currentTabInfo.tab.label
        })
        : null;
    const tabDescription = currentTabInfo?.tab?.id
        ? t(`navigation.tabs.${currentTabInfo.tab.id}.description`, {
            defaultValue: currentTabInfo.tab.description
        })
        : null;
    const heroTitle = tabLabel || resolvedGroupLabel || headerTitle;
    const heroArtLabel = resolvedGroupLabel || heroTitle;
    const heroKicker = resolvedGroupLabel && tabLabel
        ? resolvedGroupLabel
        : resolvedGroupLabel
            ? t('apps.mainLinks')
            : null;
    const heroSubtitle = tabDescription
        || (currentView === 'apps' && resolvedGroupLabel ? t('apps.stage.selectTab') : '');
    const heroTheme = heroThemes[resolvedGroupId] || heroThemes.default;
    const HeroIcon = heroIcons[resolvedGroupId] || AppWindow;
    const showHero = Boolean(resolvedGroupLabel || tabLabel);

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
            <div className="mb-5">
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 px-4 py-4 shadow-sm sm:px-5">
                    <div className="pointer-events-none absolute -top-16 right-12 h-28 w-28 rounded-full bg-cyan-200/40 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-8 h-24 w-24 rounded-full bg-emerald-200/35 blur-3xl" />
                    <div className="relative flex flex-col gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 text-compact">
                                {breadcrumbs.map((item, idx) => {
                                    const isLast = idx === breadcrumbs.length - 1;
                                    return (
                                        <React.Fragment key={item.key + idx}>
                                            <button
                                                onClick={() => handleBreadcrumbClick(item)}
                                                className={`px-1.5 py-0.5 text-[10px] font-semibold ${isLast
                                                    ? 'text-slate-900'
                                                    : 'text-slate-500 hover:text-slate-900'
                                                    }`}
                                            >
                                                {item.label}
                                            </button>
                                            {idx < breadcrumbs.length - 1 && (
                                                <span className="text-slate-300 text-[11px]">/</span>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                            {showHeaderTabs && (
                                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                                    {groupTabs.map((tab) => {
                                        const isActive = currentView === tab.id;
                                        const isBlocked = isFeatureBlocked(tab.id);
                                        const reason = isBlocked ? blockReason(tab.id) : '';
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => !isBlocked && onViewChange(tab.id)}
                                                disabled={isBlocked}
                                                title={isBlocked && reason ? reason : undefined}
                                                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold ${isBlocked
                                                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                                    : isActive
                                                        ? 'border-slate-900 bg-slate-900 text-white shadow-[0_6px_16px_rgba(15,23,42,0.15)]'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                                    }`}
                                            >
                                                {t(`navigation.tabs.${tab.id}.label`, { defaultValue: tab.label })}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {showHero && (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    {heroKicker && (
                                        <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">
                                            {heroKicker}
                                        </p>
                                    )}
                                    <h2 className="font-display text-[18px] font-semibold text-slate-900 leading-tight text-compact">
                                        {heroTitle}
                                    </h2>
                                    {heroSubtitle && (
                                        <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                                            {heroSubtitle}
                                        </p>
                                    )}
                                </div>
                                <HeroArt label={heroArtLabel} theme={heroTheme} Icon={HeroIcon} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-transparent overflow-x-hidden max-w-full">
            {/* Sidebar */}
            <Sidebar currentView={currentView} onViewChange={onViewChange} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden max-w-full">
                {/* Header */}
                <header className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-[0_12px_26px_rgba(2,6,23,0.65)] max-w-full">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/5 to-transparent" />
                    <div className="pointer-events-none absolute -left-10 top-6 h-28 w-28 rounded-full bg-cyan-500/20 blur-2xl float-slow" />
                    <div className="pointer-events-none absolute -right-12 top-6 h-28 w-28 rounded-full bg-blue-500/15 blur-2xl float-slower" />
                    <div className="relative px-5 py-2.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex flex-col text-compact">
                                <span className="text-[9px] font-semibold text-slate-400">{t('layout.header.workspace')}</span>
                                <h1 className="font-display text-[15px] font-semibold text-slate-100 leading-tight text-compact">
                                    {headerTitle}
                                </h1>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <LanguageToggle />
                                {userBadge}
                                {statusBanner}
                                <button
                                    type="button"
                                    onClick={readRam}
                                    disabled={readingRam || !isRamAvailable}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-2.5 py-1 text-[10px] font-semibold text-slate-100 shadow-[0_10px_20px_rgba(2,6,23,0.5)] hover:bg-slate-800 disabled:opacity-60"
                                    title={!isRamAvailable ? t('layout.ram.unavailable') : t('layout.ram.refreshTitle')}
                                >
                                    {readingRam ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <HardDrive className="w-3.5 h-3.5" />
                                    )}
                                    {readingRam ? t('layout.ram.reading') : t('layout.ram.read')}
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {renderStatusPill(t('layout.status.taqeem'), taqeemStatus)}
                            {renderStatusPill(t('layout.status.company'), companyStatus)}
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
                                            {t('layout.ram.usedOf', {
                                                used: formatNumber(ramInfo.usedGb),
                                                total: formatNumber(ramInfo.totalGb)
                                            })}
                                            {typeof ramInfo.freeGb === 'number'
                                                ? ` (${t('layout.ram.free', { free: formatNumber(ramInfo.freeGb) })})`
                                                : ''}
                                            {ramInfo.usagePercentage
                                                ? ` (${t('layout.ram.usage', { usage: formatNumber(ramInfo.usagePercentage) })})`
                                                : ''}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {isAuthenticated && !isAdmin && mode === 'inactive' && (
                            <div className="flex items-center gap-2 text-[10px] text-rose-200 bg-rose-500/15 border border-rose-400/30 px-3 py-1.5 rounded-xl">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{t('layout.messages.inactive')}</span>
                            </div>
                        )}
                        {isAuthenticated && !isAdmin && mode === 'partial' && (
                            <div className="flex items-center gap-2 text-[10px] text-amber-200 bg-amber-500/15 border border-amber-400/30 px-3 py-1.5 rounded-xl">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{systemState?.partialMessage || t('layout.messages.partialFallback')}</span>
                            </div>
                        )}
                        {isAuthenticated && !isAdmin && mode === 'inactive' && downtimeParts && (
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-200 bg-slate-900/70 border border-slate-700/60 px-3 py-1.5 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-cyan-300" />
                                    <span className="font-semibold text-slate-100">{t('layout.messages.downtimeEnds')}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { label: t('layout.time.days'), value: downtimeParts.days },
                                        { label: t('layout.time.hours'), value: downtimeParts.hours },
                                        { label: t('layout.time.minutes'), value: downtimeParts.minutes },
                                        { label: t('layout.time.seconds'), value: downtimeParts.seconds }
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
                                <span>{blockMessage || t('layout.messages.updateBlocked')}</span>
                            </div>
                        )}
                        {updateNotice}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 bg-transparent relative max-w-full">
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
                                {blockMessage || t('layout.messages.featureUnavailable')}
                            </p>
                            <p className="text-[11px] text-slate-600 mb-4">
                                {t('layout.messages.refreshOrUpdate')}
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
