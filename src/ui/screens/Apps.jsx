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

const cardThemes = {
    'uploading-reports': {
        glow: 'bg-cyan-400/25',
        border: 'border-cyan-400/40',
        accent: 'text-cyan-200',
        badge: 'from-cyan-500 to-blue-600',
        ring: 'ring-cyan-300/50'
    },
    'evaluation-sources': {
        glow: 'bg-emerald-400/25',
        border: 'border-emerald-400/40',
        accent: 'text-emerald-200',
        badge: 'from-emerald-500 to-teal-600',
        ring: 'ring-emerald-300/50'
    },
    default: {
        glow: 'bg-slate-400/25',
        border: 'border-slate-700/60',
        accent: 'text-slate-200',
        badge: 'from-slate-700 to-slate-900',
        ring: 'ring-slate-600/60'
    }
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
            <div className="mt-6 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
                <div className="flex items-center justify-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]">
                        <AppWindow className="w-4 h-4" />
                    </span>
                    <div className="text-compact text-center">
                        <p className="text-[10px] font-semibold text-slate-500">Main Links</p>
                        <h3 className="font-display text-[15px] font-semibold text-slate-900 leading-tight text-compact">{group.title}</h3>
                    </div>
                </div>
                <div className="grid w-full max-w-6xl justify-items-center gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {group.tabs.map((tab, index) => {
                        const blocked = isFeatureBlocked(tab.id);
                        const reason = blocked ? blockReason(tab.id) : null;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => !blocked && onViewChange && onViewChange(tab.id)}
                                disabled={blocked}
                                className={`group relative w-full max-w-[200px] aspect-square overflow-hidden text-left rounded-2xl border px-4 py-3 transition-all card-animate ${blocked
                                    ? 'border-amber-300/50 bg-amber-900/40 text-amber-100 cursor-not-allowed'
                                    : 'border-slate-800/70 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 hover:border-slate-700 hover:shadow-[0_16px_30px_rgba(15,23,42,0.25)]'
                                    }`}
                                style={{ animationDelay: `${index * 70}ms` }}
                            >
                                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),rgba(15,23,42,0))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                <div className="relative flex h-full flex-col gap-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-semibold text-[12px] text-slate-100 leading-tight text-compact">{tab.label}</p>
                                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${blocked
                                            ? 'border-amber-200/60 bg-amber-100/20 text-amber-100'
                                            : 'border-slate-700 bg-slate-900 text-slate-300 group-hover:text-white'
                                            }`}
                                        >
                                            <ChevronRight className={`w-3.5 h-3.5 ${blocked ? '' : 'group-hover:translate-x-0.5 transition'}`} />
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-300 leading-snug line-clamp-3">{tab.description}</p>
                                    {blocked && reason && (
                                        <p className="mt-auto text-[9px] text-amber-200">{reason}</p>
                                    )}
                                </div>
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
                    <div className="grid w-full max-w-5xl justify-items-center gap-4 sm:grid-cols-2">
                        {valueSystemCards.map((card, index) => {
                            const Icon = cardIcons[card.id] || Info;
                            const theme = cardThemes[card.id] || cardThemes.default;
                            const isActive = selectedCard === card.id;
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => handleCardClick(card.id)}
                                    className={`group relative w-full max-w-[280px] aspect-square overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-left transition-all shadow-[0_16px_30px_rgba(15,23,42,0.25)] card-animate ${theme.border} ${isActive
                                        ? `ring-2 ${theme.ring} scale-[1.01]`
                                        : 'hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(15,23,42,0.35)]'
                                        }`}
                                    style={{ animationDelay: `${index * 80}ms` }}
                                >
                                    <span className={`pointer-events-none absolute -top-12 right-[-40px] h-32 w-32 rounded-full blur-3xl ${theme.glow}`} />
                                    <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),rgba(15,23,42,0))] opacity-70" />
                                    <div className="relative flex h-full flex-col gap-4 p-6">
                                        <div className="flex items-center justify-between">
                                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.badge} text-white shadow-[0_12px_26px_rgba(15,23,42,0.2)]`}>
                                                <Icon className="w-5 h-5" />
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-300 text-compact">Main</span>
                                        </div>
                                        <div className="flex-1">
                                            <h2 className="font-display text-[15px] font-semibold text-slate-100 leading-tight text-compact line-clamp-2">
                                                {card.title}
                                            </h2>
                                            <p className="mt-2 text-[10px] text-slate-300 leading-snug line-clamp-3">
                                                {card.description}
                                            </p>
                                        </div>
                                        <div className={`flex items-center gap-1 text-[11px] font-semibold ${theme.accent}`}>
                                            <span>Open</span>
                                            <ChevronRight className="w-4 h-4 transition group-hover:translate-x-0.5" />
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
