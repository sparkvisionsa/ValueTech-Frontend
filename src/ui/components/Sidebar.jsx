import React from 'react';
import { AppWindow, CircleDot, Wrench, Truck, Loader2, AlertCircle, Home, MonitorDot } from 'lucide-react';
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

    const domainButtons = [
        { id: 'real-estate', label: 'Real state', icon: Home },
        { id: 'equipments', label: 'Equipments', icon: Truck }
    ];

    const mainLinks = [
        { id: 'uploadReports', label: 'Upload Reports' },
        { id: 'uploadSingleReport', label: 'Upload Single Report' },
        { id: 'taqeemInfo', label: 'Taqeem Info' },
        { id: 'settings', label: 'Settings' },
        { id: 'deleteReport', label: 'Delete Report' }
    ];

    const renderDomains = () => {
        if (selectedCard !== 'uploading-reports') return null;
        return (
            <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 px-2.5 py-2 shadow-inner ring-1 ring-slate-900/40">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                    <span>Domains</span>
                    <span className="text-[10px] text-slate-500 normal-case">Pick area</span>
                </div>
                <ul className="space-y-1">
                    {domainButtons.map((item) => {
                        const Icon = item.icon;
                        const isActive = selectedDomain === item.id;
                        return (
                            <li key={item.id}>
                                <button
                                    onClick={async () => {
                                        chooseDomain(item.id);
                                        setActiveGroup(null);
                                        setSelectedCompany(null);

                                        if (item.id === 'real-estate') {
                                            onViewChange('coming-soon');
                                            return;
                                        }

                                        if (item.id === 'equipments') {
                                            await loadSavedCompanies('equipment');
                                            onViewChange('apps');
                                            return;
                                        }

                                        onViewChange('apps');
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all duration-200 ${
                                        isActive
                                            ? 'border-blue-400/70 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md ring-1 ring-blue-200/60'
                                            : 'border-slate-800 bg-slate-900/40 text-slate-200 hover:border-blue-500/60 hover:bg-slate-800/70'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 opacity-80" />
                                    <span className="text-[12px] font-semibold">{item.label}</span>
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
        const showPlaceholder = !loadingCompanies && !companyError && (!companies || companies.length === 0);
        return (
            <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 px-2.5 py-2 space-y-2 shadow-inner ring-1 ring-slate-900/40">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
                    <span>Companies</span>
                    <span className={`text-[10px] ${selectedCompany ? 'text-blue-200' : 'text-slate-500'}`}>
                        {selectedCompany ? 'Selected' : 'Choose one'}
                    </span>
                </div>
                {loadingCompanies && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-100 bg-slate-900/70 border border-slate-800 rounded-lg px-2.5 py-1.5">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading companies...</span>
                    </div>
                )}
                {companyError && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-100 bg-amber-900/40 border border-amber-800 rounded-lg px-2.5 py-1.5">
                        <AlertCircle className="w-4 h-4" />
                        <span>{companyError}</span>
                    </div>
                )}
                {showPlaceholder && (
                    <div className="text-[11px] text-slate-300 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
                        No company showed.
                    </div>
                )}
                {companies && companies.length > 0 && (
                    <ul className="space-y-1">
                        {companies.map((company) => {
                            const isActive = selectedCompany?.name === company.name;
                            const isDisabled = selectedCompany && !isActive;
                            return (
                                <li key={company.name || company.id}>
                                    <button
                                        onClick={() => {
                                            if (isDisabled) return;
                                            setSelectedCompany(company);
                                            setActiveGroup(null);
                                            onViewChange('apps');
                                        }}
                                        disabled={isDisabled}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg border flex flex-col gap-0.5 ${
                                            isActive
                                                ? 'border-blue-400/70 bg-blue-600/25 text-white shadow-inner ring-1 ring-blue-300/50'
                                                : 'border-slate-800 bg-slate-900/50 text-slate-100 hover:border-blue-500/60 hover:bg-slate-800/80'
                                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="text-[12px] font-semibold truncate">{company.name || 'Company'}</div>
                                        {company.officeId && (
                                            <div className="text-[10px] text-slate-400">Office {company.officeId}</div>
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
            <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 px-2.5 py-2 shadow-inner ring-1 ring-slate-900/40">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                    <span>Workspace</span>
                    <span className="text-[10px] text-slate-500 normal-case">Choose module</span>
                </div>
                <ul className="space-y-1">
                    {mainLinks.map((item) => {
                        const blocked = isFeatureBlocked(item.id);
                        const isActive = activeGroup === item.id;
                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => {
                                        if (blocked) return;
                                        setActiveGroup(item.id);
                                        onViewChange('apps');
                                    }}
                                    disabled={blocked}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all duration-200 text-[12px] ${
                                        isActive
                                            ? 'border-blue-400/70 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md ring-1 ring-blue-200/60'
                                            : 'border-slate-800 bg-slate-900/40 text-slate-200 hover:border-blue-500/60 hover:bg-slate-800/70'
                                    } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="font-medium">{valueSystemGroups[item.id]?.title || item.label}</span>
                                </button>
                            </li>
                        );
                    })}
                    {isAdmin && (
                        <>
                            <li>
                                <button
                                    onClick={() => onViewChange('system-status')}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
                                        currentView === 'system-status'
                                            ? 'border-blue-400/70 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md ring-1 ring-blue-200/60'
                                            : 'border-slate-800 bg-slate-900/40 text-slate-200 hover:border-blue-500/60 hover:bg-slate-800/70'
                                    }`}
                                >
                                    <MonitorDot className="w-4 h-4 opacity-80" />
                                    <span className="font-medium">System Operating Status</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => onViewChange('system-updates')}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
                                        currentView === 'system-updates'
                                            ? 'border-blue-400/70 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md ring-1 ring-blue-200/60'
                                            : 'border-slate-800 bg-slate-900/40 text-slate-200 hover:border-blue-500/60 hover:bg-slate-800/70'
                                    }`}
                                >
                                    <Wrench className="w-4 h-4 opacity-80" />
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
        <div className="w-56 min-w-[13.5rem] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white h-screen flex flex-col text-[12px] border-r border-slate-800 shadow-xl">
            <div className="px-3 py-2.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-sm font-semibold text-white leading-tight tracking-tight">Value Tech</h1>
                        <p className="text-[10px] text-slate-400 leading-tight">Control panel</p>
                    </div>
                    <span className="px-2 py-1 text-[10px] rounded-full border border-blue-400/30 bg-blue-900/40 text-blue-100 shadow-sm ring-1 ring-blue-300/40">
                        Live
                    </span>
                </div>

                <div className="flex gap-1.5 mt-2">
                    <button
                        onClick={() => {
                            resetAll();
                            chooseCard(null);
                            onViewChange('apps');
                        }}
                        className={`flex-1 inline-flex items-center gap-2 rounded-lg px-2.5 py-2 border text-left transition-all duration-150 ${
                            isAppsActive
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 border-blue-400 text-white shadow-lg ring-1 ring-blue-200/60'
                                : 'bg-slate-900/60 border-slate-800 text-slate-100 hover:border-blue-500/60 hover:bg-slate-800/80'
                        }`}
                    >
                        <AppWindow className="w-4 h-4" />
                        <div className="flex flex-col leading-tight">
                            <span className="font-semibold text-[12px]">Apps</span>
                            <span className="text-[10px] text-slate-300">Open cards</span>
                        </div>
                    </button>
                </div>
            </div>

            <nav className="flex-1 px-2.5 py-2 overflow-y-auto space-y-2">
                {renderDomains()}
                {renderCompanyList()}
                {renderMainLinks()}
            </nav>

            <div className="px-3 py-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center gap-1.5 bg-slate-900/70">
                <CircleDot className="w-3 h-3 text-green-500" />
                <span>System Online</span>
            </div>
        </div>
    );
};

export default Sidebar;
