import React from 'react';
import { AppWindow, CircleDot, Wrench, Truck, Loader2, AlertCircle, Home } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { useSystemControl } from '../context/SystemControlContext';
import { useValueNav } from '../context/ValueNavContext';
import navigation from '../constants/navigation';

const { valueSystemGroups } = navigation;

const Sidebar = ({ currentView, onViewChange }) => {
    const { isAuthenticated, user } = useSession();
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

    const isAdmin = user?.phone === '011111';
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
            <div className="mt-3">
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
                                            if (!isAuthenticated) {
                                                onViewChange('registration');
                                                return;
                                            }
                                            const list = await loadSavedCompanies('equipment');
                                            if (!list || list.length === 0) {
                                                onViewChange('taqeem-login');
                                            } else {
                                                onViewChange('apps');
                                            }
                                            return;
                                        }

                                        onViewChange('apps');
                                    }}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="text-sm font-semibold">{item.label}</span>
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
            <div className="mt-3 space-y-2">
                {loadingCompanies && (
                    <div className="flex items-center gap-2 text-[11px] text-gray-200 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading companies...</span>
                    </div>
                )}
                {companyError && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-200 bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>{companyError}</span>
                    </div>
                )}
                {showPlaceholder && (
                    <div className="text-[11px] text-gray-400 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2">
                        Saved companies will appear here after you fetch them from Taqeem.
                    </div>
                )}
                {companies && companies.length > 0 && (
                    <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Companies</p>
                        <ul className="space-y-1">
                            {companies.map((company) => {
                                const isActive = selectedCompany?.name === company.name;
                                return (
                                    <li key={company.name || company.id}>
                                        <button
                                            onClick={() => {
                                                setSelectedCompany(company);
                                                setActiveGroup(null);
                                                onViewChange('apps');
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg border ${isActive
                                                ? 'border-blue-500 bg-blue-600/30 text-white'
                                                : 'border-gray-700 bg-gray-800 text-gray-100 hover:border-blue-500 hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className="text-sm font-semibold truncate">{company.name || 'Company'}</div>
                                            {company.officeId && (
                                                <div className="text-[11px] text-gray-400">Office {company.officeId}</div>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    const renderMainLinks = () => {
        if (selectedDomain !== 'equipments') return null;
        if (!selectedCompany) {
            return (
                <div className="mt-4 text-xs text-gray-400 bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2">
                    Select a company under Equipments to view tools.
                </div>
            );
        }
        return (
            <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Main links</p>
                <ul className="space-y-1.5">
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
                                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm ${isActive
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
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
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentView === 'system-status'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                        }`}
                                >
                                    <MonitorDot className="w-5 h-5" />
                                    <span className="font-medium">System Operating Status</span>
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => onViewChange('system-updates')}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentView === 'system-updates'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                        }`}
                                >
                                    <Wrench className="w-5 h-5" />
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
        <div className="w-60 bg-gray-900 text-white h-screen flex flex-col text-[12px]">
            <div className="p-3 border-b border-gray-700">
                <h1 className="text-base font-bold text-white leading-tight tracking-tight">Value Tech</h1>

                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => {
                            resetAll();
                            chooseCard(null);
                            onViewChange('apps');
                        }}
                        className={`flex-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 border text-left transition ${isAppsActive
                            ? 'bg-blue-600 border-blue-500 text-white shadow'
                            : 'bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700'
                            }`}
                    >
                        <AppWindow className="w-4 h-4" />
                        <div className="flex flex-col">
                            <span className="font-semibold leading-tight text-[13px]">Apps</span>
                            <span className="text-[10px] text-gray-200/80">Open cards</span>
                        </div>
                    </button>
                </div>
            </div>

            <nav className="flex-1 p-3 overflow-y-auto space-y-2">
                {!selectedCard && (
                    <p className="text-[10px] text-gray-400 leading-snug">Choose a card inside Apps to load navigation.</p>
                )}

                {renderDomains()}
                {renderCompanyList()}
                {renderMainLinks()}
            </nav>

            <div className="p-3 border-t border-gray-700 text-[10px] text-gray-400 flex items-center gap-2">
                <CircleDot className="w-3 h-3 text-green-500" />
                <span>System Online</span>
            </div>
        </div>
    );
};

export default Sidebar;
