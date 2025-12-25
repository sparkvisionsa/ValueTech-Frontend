import React from 'react';
import { AppWindow, CircleDot, Wrench, Truck, Loader2, AlertCircle, Home, MonitorDot, Settings } from 'lucide-react';
import { useSystemControl } from '../context/SystemControlContext';
import { useValueNav } from '../context/ValueNavContext';
import navigation from '../constants/navigation';

const { valueSystemGroups } = navigation;

const Sidebar = ({ currentView, onViewChange }) => {
    const { isFeatureBlocked } = useSystemControl();
    const {
        selectedCard,
        selectedDomain,
        selectedCompany,
        companies,
        loadingCompanies,
        companyError,
        activeGroup,
        setActiveGroup,
        resetAll,
        chooseCard,
        chooseDomain,
        loadSavedCompanies,
        setSelectedCompany
    } = useValueNav();

    const isAdmin = false;
    const isAppsActive = currentView === 'apps';
    const isSettingsActive = activeGroup === 'settings';
    const settingsBlocked = isFeatureBlocked('settings');
    const clickDelayMs = 160;
    const delayViewChange = (nextView) => {
        if (!onViewChange) return;
        setTimeout(() => onViewChange(nextView), clickDelayMs);
    };

    const domainButtons = [
        { id: 'real-estate', label: 'Real state', icon: Home },
        { id: 'equipments', label: 'Equipments', icon: Truck }
    ];

    const mainLinks = [
        { id: 'uploadReports', label: 'Upload Reports' },
        { id: 'uploadSingleReport', label: 'Upload Single Report' },
        { id: 'taqeemInfo', label: 'Taqeem Info' },
        { id: 'deleteReport', label: 'Delete Report' }
    ];

    const renderDomains = () => {
        if (selectedCard !== 'uploading-reports') return null;
        return (
            <div
                className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] sidebar-animate"
                style={{ animationDelay: '80ms' }}
            >
                <ul className="space-y-1">
                    {domainButtons.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = selectedDomain === item.id;
                        return (
                            <li
                                key={item.id}
                                className="sidebar-animate"
                                style={{ animationDelay: `${120 + index * 40}ms` }}
                            >
                                <button
                                    onClick={async () => {
                                        chooseDomain(item.id);
                                        setActiveGroup(null);
                                        setSelectedCompany(null);

                                        if (item.id === 'real-estate') {
                                            delayViewChange('coming-soon');
                                            return;
                                        }

                                        if (item.id === 'equipments') {
                                            await loadSavedCompanies('equipment');
                                            delayViewChange('apps');
                                            return;
                                        }

                                        delayViewChange('apps');
                                    }}
                                    className={`group relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-all duration-150 ${
                                        isActive
                                            ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600 text-white shadow-[0_8px_20px_rgba(14,116,144,0.35)]'
                                            : 'bg-slate-900/40 text-slate-200 hover:bg-slate-800/70'
                                    }`}
                                >
                                    <span
                                        className={`absolute left-1 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full ${
                                            isActive ? 'bg-cyan-200' : 'bg-transparent group-hover:bg-cyan-300/50'
                                        }`}
                                    />
                                    <Icon className="w-3.5 h-3.5 opacity-90" />
                                    <span className="text-[11px] font-semibold">{item.label}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    const renderCompanyList = () => {
        if (selectedDomain !== 'equipments') return null;
        const showPlaceholder = !selectedCompany && !loadingCompanies && !companyError && (!companies || companies.length === 0);
        const visibleCompanies = selectedCompany ? [selectedCompany] : companies;
        const hasCompanies = visibleCompanies && visibleCompanies.length > 0;
        return (
            <div
                className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-2 py-1.5 space-y-1.5 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] sidebar-animate"
                style={{ animationDelay: '160ms' }}
            >
                {loadingCompanies && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-100 bg-slate-900/70 border border-slate-800 rounded-md px-2 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading companies...</span>
                    </div>
                )}
                {companyError && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-100 bg-amber-900/40 border border-amber-800 rounded-md px-2 py-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{companyError}</span>
                    </div>
                )}
                {showPlaceholder && (
                    <div className="text-[10px] text-slate-300 bg-slate-900/60 border border-slate-800 rounded-md px-2 py-1">
                        No company showed.
                    </div>
                )}
                {hasCompanies && (
                    <ul className="space-y-1">
                        {visibleCompanies.map((company, index) => {
                            const isActive = selectedCompany?.name === company.name;
                            const isDisabled = selectedCompany && !isActive;
                            return (
                                <li
                                    key={company.name || company.id}
                                    className="sidebar-animate"
                                    style={{ animationDelay: `${200 + index * 35}ms` }}
                                >
                                    <button
                                        onClick={() => {
                                                if (isDisabled) return;
                                                setSelectedCompany(company);
                                                setActiveGroup(null);
                                                delayViewChange('apps');
                                            }}
                                        disabled={isDisabled}
                                        className={`group relative w-full text-left px-2.5 py-1.5 rounded-md flex flex-col gap-0.5 ${
                                            isActive
                                                ? 'bg-cyan-600/25 text-white shadow-[0_8px_20px_rgba(14,116,144,0.2)]'
                                                : 'bg-slate-900/50 text-slate-100 hover:bg-slate-800/80'
                                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span
                                            className={`absolute left-1 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full ${
                                                isActive ? 'bg-cyan-200' : 'bg-transparent group-hover:bg-cyan-300/50'
                                            }`}
                                        />
                                        <div className="text-[11px] font-semibold truncate">{company.name || 'Company'}</div>
                                        {company.officeId && (
                                            <div className="text-[9px] text-slate-400">Office {company.officeId}</div>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        );
    };

    const renderMainLinks = () => {
        if (selectedDomain !== 'equipments') return null;
        return (
            <div
                className="rounded-lg border border-slate-800/70 bg-slate-900/45 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] sidebar-animate"
                style={{ animationDelay: '240ms' }}
            >
                <ul className="space-y-1">
                    {mainLinks.map((item, index) => {
                        const blocked = isFeatureBlocked(item.id);
                        const isActive = activeGroup === item.id;
                        return (
                            <li
                                key={item.id}
                                className="sidebar-animate"
                                style={{ animationDelay: `${280 + index * 35}ms` }}
                            >
                                <button
                                    onClick={() => {
                                        if (blocked) return;
                                        setActiveGroup(item.id);
                                        delayViewChange('apps');
                                    }}
                                    disabled={blocked}
                                    className={`group relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-all duration-150 text-[11px] ${
                                        isActive
                                            ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600 text-white shadow-[0_8px_20px_rgba(14,116,144,0.35)]'
                                            : 'bg-slate-900/40 text-slate-200 hover:bg-slate-800/70'
                                    } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span
                                        className={`absolute left-1 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full ${
                                            isActive ? 'bg-cyan-200' : 'bg-transparent group-hover:bg-cyan-300/50'
                                        }`}
                                    />
                                    <span className="font-medium">{valueSystemGroups[item.id]?.title || item.label}</span>
                                </button>
                            </li>
                        );
                    })}
                    {isAdmin && (
                        <>
                            <li className="sidebar-animate" style={{ animationDelay: '360ms' }}>
                                <button
                                    onClick={() => delayViewChange('system-status')}
                                    className={`group relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-150 text-[11px] ${
                                        currentView === 'system-status'
                                            ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600 text-white shadow-[0_8px_20px_rgba(14,116,144,0.35)]'
                                            : 'bg-slate-900/40 text-slate-200 hover:bg-slate-800/70'
                                    }`}
                                >
                                    <span
                                        className={`absolute left-1 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full ${
                                            currentView === 'system-status'
                                                ? 'bg-cyan-200'
                                                : 'bg-transparent group-hover:bg-cyan-300/50'
                                        }`}
                                    />
                                    <MonitorDot className="w-3.5 h-3.5 opacity-90" />
                                    <span className="font-medium">System Operating Status</span>
                                </button>
                            </li>
                            <li className="sidebar-animate" style={{ animationDelay: '395ms' }}>
                                <button
                                    onClick={() => delayViewChange('system-updates')}
                                    className={`group relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-150 text-[11px] ${
                                        currentView === 'system-updates'
                                            ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600 text-white shadow-[0_8px_20px_rgba(14,116,144,0.35)]'
                                            : 'bg-slate-900/40 text-slate-200 hover:bg-slate-800/70'
                                    }`}
                                >
                                    <span
                                        className={`absolute left-1 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full ${
                                            currentView === 'system-updates'
                                                ? 'bg-cyan-200'
                                                : 'bg-transparent group-hover:bg-cyan-300/50'
                                        }`}
                                    />
                                    <Wrench className="w-3.5 h-3.5 opacity-90" />
                                    <span className="font-medium">System Updates</span>
                                </button>
                            </li>
                        </>
                    )}
                </ul>
            </div>
        );
    };

    return (
        <div className="relative w-[218px] min-w-[218px] h-screen text-white text-[11px] overflow-hidden border-r border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/5 to-transparent" />
            <div className="pointer-events-none absolute -left-10 top-16 h-32 w-32 rounded-full bg-cyan-500/20 blur-2xl" />
            <div className="pointer-events-none absolute -right-12 bottom-20 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

            <div className="relative flex h-full flex-col">
                <div
                    className="px-2.5 py-2 border-b border-slate-800/80 bg-slate-950/50 backdrop-blur-sm sidebar-animate"
                    style={{ animationDelay: '0ms' }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-cyan-300 to-blue-500 shadow-[0_0_12px_rgba(56,189,248,0.45)]" />
                            <div>
                                <h1 className="text-[12px] font-semibold tracking-wide">Value Tech</h1>
                                <p className="text-[9px] text-slate-400 leading-tight">Control panel</p>
                            </div>
                        </div>
                        <span className="px-1.5 py-0.5 text-[9px] rounded-full border border-cyan-300/30 bg-cyan-900/40 text-cyan-100">
                            Live
                        </span>
                    </div>

                    <div className="mt-1.5 flex gap-1">
                        <button
                            onClick={() => {
                                resetAll();
                                chooseCard(null);
                                delayViewChange('apps');
                            }}
                            className={`flex-1 inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-all duration-150 ${
                                isAppsActive
                                    ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600 text-white shadow-[0_8px_20px_rgba(14,116,144,0.35)]'
                                    : 'bg-slate-900/60 text-slate-100 hover:bg-slate-800/80'
                            }`}
                        >
                            <AppWindow className="w-3.5 h-3.5" />
                            <div className="flex flex-col leading-tight">
                                <span className="font-semibold text-[11px]">Apps</span>
                                <span className="text-[9px] text-slate-300">Open cards</span>
                            </div>
                        </button>
                    </div>
                </div>

                <nav className="flex-1 px-2 py-1.5 overflow-y-auto space-y-1.5">
                    {renderDomains()}
                    {renderCompanyList()}
                    {renderMainLinks()}
                </nav>

                <div
                    className="px-2 py-1.5 sidebar-animate"
                    style={{ animationDelay: '300ms' }}
                >
                    <button
                        onClick={() => {
                            if (settingsBlocked) return;
                            setActiveGroup('settings');
                            delayViewChange('apps');
                        }}
                        disabled={settingsBlocked}
                        className={`group relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-all duration-150 text-[11px] ${
                            isSettingsActive
                                ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600 text-white shadow-[0_8px_20px_rgba(14,116,144,0.35)]'
                                : 'bg-slate-900/50 text-slate-100 hover:bg-slate-800/80'
                        } ${settingsBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span
                            className={`absolute left-1 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full ${
                                isSettingsActive ? 'bg-cyan-200' : 'bg-transparent group-hover:bg-cyan-300/50'
                            }`}
                        />
                        <Settings className="w-3.5 h-3.5 opacity-90" />
                        <span className="font-medium">Settings</span>
                    </button>
                </div>

                <div
                    className="px-2.5 py-1.5 border-t border-slate-800/80 text-[9px] text-slate-400 flex items-center gap-1.5 bg-slate-950/60 sidebar-animate"
                    style={{ animationDelay: '320ms' }}
                >
                    <CircleDot className="w-3 h-3 text-emerald-400" />
                    <span>System Online</span>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
