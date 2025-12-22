import React, { useMemo } from 'react';
import { AppWindow, UploadCloud, Compass, ChevronRight, Info } from 'lucide-react';
import { useSystemControl } from '../context/SystemControlContext';
import { useValueNav } from '../context/ValueNavContext';
import navigation from '../constants/navigation';

const { valueSystemCards, valueSystemGroups } = navigation;

const cardIcons = {
    'uploading-reports': UploadCloud,
    'evaluation-sources': Compass
};

const Apps = ({ onViewChange }) => {
    const { isFeatureBlocked, blockReason } = useSystemControl();
    const {
        selectedCard,
        selectedDomain,
        selectedCompany,
        activeGroup,
        setActiveGroup,
        chooseCard,
        breadcrumbs
    } = useValueNav();

    const breadcrumbText = useMemo(() => breadcrumbs.map((b) => b.label).join(' > '), [breadcrumbs]);

    const stageHint = useMemo(() => {
        if (!selectedCard) return 'Pick a card to begin.';
        if (selectedCard === 'uploading-reports' && !selectedDomain) return 'Choose Real state or Equipments from the sidebar.';
        if (selectedCard === 'uploading-reports' && selectedDomain === 'real-estate') {
            return 'Real estate tools are coming soon.';
        }
        if (selectedCard === 'uploading-reports' && selectedDomain === 'equipments' && !selectedCompany) {
            return 'Pick a saved company under Equipments after you sync them from Taqeem.';
        }
        if (activeGroup) return 'Select a tab to open the related tool.';
        return '';
    }, [selectedCard, selectedDomain, selectedCompany, activeGroup]);

    const handleCardClick = (cardId) => {
        chooseCard(cardId);
        setActiveGroup(null);
        if (onViewChange) onViewChange('apps');
    };

    const renderGroupTabs = () => {
        if (!activeGroup) return null;
        const group = valueSystemGroups[activeGroup];
        if (!group) return null;

        return (
            <div className="mt-6">
                <div className="flex items-center gap-3 mb-3">
                    <AppWindow className="w-5 h-5 text-blue-600" />
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Tabs</p>
                        <h3 className="text-lg font-semibold text-gray-900">{group.title}</h3>
                    </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    {group.tabs.map((tab) => {
                        const blocked = isFeatureBlocked(tab.id);
                        const reason = blocked ? blockReason(tab.id) : null;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => !blocked && onViewChange && onViewChange(tab.id)}
                                disabled={blocked}
                                className={`group relative w-full text-left rounded-xl border px-4 py-3 transition ${blocked
                                    ? 'border-amber-200 bg-amber-50 text-amber-800 cursor-not-allowed'
                                    : 'border-gray-200 bg-gray-50 hover:border-blue-200 hover:bg-blue-50'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-gray-900 group-hover:text-blue-800">{tab.label}</p>
                                        <p className="text-xs text-gray-600 mt-1 leading-snug">{tab.description}</p>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 ${blocked ? 'text-amber-600' : 'text-blue-500 group-hover:translate-x-1 transition'}`} />
                                </div>
                                {blocked && reason && (
                                    <p className="mt-2 text-[11px] text-amber-700">{reason}</p>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const showCards = !selectedDomain && !selectedCompany && !activeGroup;

    return (
        <div className="space-y-6">
            {showCards && (
                <div className="w-full flex justify-center">
                    <div className="grid gap-4 justify-items-center sm:grid-cols-2">
                        {valueSystemCards.map((card) => {
                            const Icon = cardIcons[card.id] || Info;
                            const isActive = selectedCard === card.id;
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => handleCardClick(card.id)}
                                    className={`relative overflow-hidden rounded-xl border aspect-square w-72 text-left transition-all shadow-sm ${isActive
                                        ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md scale-[1.02]'
                                        : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-lg hover:-translate-y-1'
                                        }`}
                                >
                                    <div className="flex flex-col h-full p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                                                <Icon className="w-5 h-5" />
                                            </span>
                                            <span className="text-[11px] uppercase tracking-wide text-gray-400">Apps</span>
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <h2 className="text-lg font-bold text-gray-900 leading-snug line-clamp-2">{card.title}</h2>
                                            <p className="text-sm text-gray-600 mt-2 line-clamp-3">{card.description}</p>
                                        </div>
                                        <div className="mt-4 text-sm font-semibold text-blue-700 flex items-center gap-1">
                                            <span>Open</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {renderGroupTabs()}
        </div>
    );
};

export default Apps;
