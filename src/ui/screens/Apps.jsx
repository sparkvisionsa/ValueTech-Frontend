import React, { useMemo } from 'react';
import { AppWindow, UploadCloud, Compass, ChevronRight, Info, ShieldCheck, Building2 } from 'lucide-react';
import { useSystemControl } from '../context/SystemControlContext';
import { useValueNav } from '../context/ValueNavContext';
import { useSession } from '../context/SessionContext';
import navigation from '../constants/navigation';

const { valueSystemCards, valueSystemGroups } = navigation;

const cardIcons = {
    'uploading-reports': UploadCloud,
    'evaluation-sources': Compass,
    'admin-console': ShieldCheck,
    'company-console': Building2
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
    'admin-console': {
        glow: 'bg-amber-400/25',
        border: 'border-amber-400/40',
        accent: 'text-amber-200',
        badge: 'from-amber-500 to-orange-600',
        ring: 'ring-amber-300/50'
    },
    'company-console': {
        glow: 'bg-orange-400/25',
        border: 'border-orange-400/40',
        accent: 'text-orange-200',
        badge: 'from-orange-500 to-rose-600',
        ring: 'ring-orange-300/50'
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
    const { isFeatureBlocked, blockReason, isAdmin } = useSystemControl();
    const { user } = useSession();
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
    const isCompanyHead = user?.type === 'company' || user?.role === 'company-head';

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

    const handleCardClick = (card) => {
        chooseCard(card.id);
        setActiveGroup(card.defaultGroup || null);
        if (onViewChange) onViewChange('apps');
    };

    const renderGroupTabs = () => {
        if (!activeGroup) return null;
        const group = valueSystemGroups[activeGroup];
        if (!group) return null;

        return (
            <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center justify-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]">
                        <AppWindow className="w-4 h-4" />
                    </span>
                    <div className="text-compact text-center">
                        <p className="text-[10px] font-semibold text-slate-500">Main Links</p>
                        <h3 className="font-display text-[15px] font-semibold text-slate-900 leading-tight text-compact">{group.title}</h3>
                    </div>
                </div>
                <div className="grid w-full gap-4 px-2 sm:px-4 justify-items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {group.tabs.map((tab, index) => {
                        const blocked = isFeatureBlocked(tab.id);
                        const reason = blocked ? blockReason(tab.id) : null;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => !blocked && onViewChange && onViewChange(tab.id)}
                                disabled={blocked}
                                className={`group relative h-[200px] w-[200px] overflow-hidden text-left rounded-2xl border p-2.5 transition-all card-animate ${blocked
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
                        {valueSystemCards.filter((card) => {
                            if (card.id === 'admin-console') return isAdmin;
                            if (card.id === 'company-console') return isCompanyHead;
                            return true;
                        }).map((card, index) => {
                            const Icon = cardIcons[card.id] || Info;
                            const theme = cardThemes[card.id] || cardThemes.default;
                            const isActive = selectedCard === card.id;
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => handleCardClick(card)}
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
