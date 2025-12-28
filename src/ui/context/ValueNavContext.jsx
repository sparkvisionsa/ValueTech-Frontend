import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import navigation from '../constants/navigation';
import { useSession } from './SessionContext';
import { useTranslation } from 'react-i18next';

const { valueSystemCards, valueSystemGroups, findTabInfo } = navigation;

const ValueNavContext = createContext(null);

export const useValueNav = () => {
    const ctx = useContext(ValueNavContext);
    if (!ctx) {
        throw new Error('useValueNav must be used within ValueNavProvider');
    }
    return ctx;
};

const findCardForGroup = (groupId) =>
    valueSystemCards.find((card) => Array.isArray(card.groups) && card.groups.includes(groupId));

export const ValueNavProvider = ({ children }) => {
    const { user, token } = useSession();
    const { t } = useTranslation();
    const [selectedCard, setSelectedCard] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [companyError, setCompanyError] = useState('');
    const [activeGroup, setActiveGroup] = useState(null);
    const [activeTab, setActiveTab] = useState(null);

    const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

    const getCardLabel = useCallback(
        (cardId) => {
            const card = valueSystemCards.find((c) => c.id === cardId);
            return t(`navigation.cards.${cardId}.title`, { defaultValue: card?.title || cardId });
        },
        [t]
    );

    const getDomainLabel = useCallback(
        (domainId) => {
            const fallbacks = {
                'real-estate': 'Real Estate',
                equipments: 'Equipment'
            };
            return t(`sidebar.domains.${domainId}`, { defaultValue: fallbacks[domainId] || domainId });
        },
        [t]
    );

    const normalizeCompanyList = useCallback((payload) => {
        if (!payload) return [];
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.items)) return payload.items;
        if (Array.isArray(payload.results)) return payload.results;
        if (Array.isArray(payload?.data?.data)) return payload.data.data;
        return [];
    }, []);

    const resetAll = useCallback(() => {
        setSelectedCard(null);
        setSelectedDomain(null);
        setSelectedCompany(null);
        setCompanies([]);
        setCompanyError('');
        setActiveGroup(null);
        setActiveTab(null);
    }, []);

    const chooseCard = useCallback((cardId) => {
        setSelectedCard(cardId);
        setSelectedDomain(null);
        setSelectedCompany(null);
        setCompanies([]);
        setCompanyError('');
        setActiveGroup(null);
        setActiveTab(null);
    }, []);

    const chooseDomain = useCallback((domainId) => {
        setSelectedDomain(domainId);
        setSelectedCompany(null);
        setCompanies([]);
        setCompanyError('');
        setActiveGroup(null);
        setActiveTab(null);
    }, []);

    const loadSavedCompanies = useCallback(async (type = 'equipment') => {
        if (!window?.electronAPI?.apiRequest) {
            setCompanyError(t('navigation.companyFetchUnavailable'));
            return [];
        }
        if (!user) {
            setCompanies([]);
            setCompanyError('');
            return [];
        }

        setLoadingCompanies(true);
        setCompanyError('');
        try {
            const res = await window.electronAPI.apiRequest('GET', `/api/companes/me?type=${type}`, {}, authHeaders);
            const list = normalizeCompanyList(res);
            setCompanies(list);
            return list;
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || t('navigation.loadCompaniesFailed');
            setCompanyError(msg);
            return [];
        } finally {
            setLoadingCompanies(false);
        }
    }, [authHeaders, normalizeCompanyList, t, user]);

    const syncCompanies = useCallback(async (items = [], defaultType = 'equipment') => {
        if (!window?.electronAPI?.apiRequest) {
            throw new Error(t('navigation.companySyncUnavailable'));
        }
        if (!user) {
            throw new Error(t('navigation.loginRequiredToSaveCompanies'));
        }

        const payload = {
            companies: items.map((item) => ({
                ...item,
                type: item.type || defaultType
            }))
        };

        const res = await window.electronAPI.apiRequest('POST', '/api/companes/sync', payload, authHeaders);
        const list = normalizeCompanyList(res);
        // refresh from backend to reflect normalization and any merging
        const fresh = await loadSavedCompanies(defaultType);
        if (fresh.length === 0 && list.length > 0) {
            setCompanies(list);
        }
        return list;
    }, [authHeaders, loadSavedCompanies, normalizeCompanyList, t, user]);

    useEffect(() => {
        if (user) {
            loadSavedCompanies();
        } else {
            setCompanies([]);
            setCompanyError('');
        }
    }, [user, loadSavedCompanies]);

    const syncNavForView = useCallback((viewId) => {
        const info = findTabInfo(viewId);
        if (!info) {
            setActiveTab(null);
            return;
        }
        const owningCard = findCardForGroup(info.groupId);
        if (owningCard?.id) {
            setSelectedCard(owningCard.id);
        }

        if (owningCard?.id === 'uploading-reports') {
            // preserve existing domain/company if already set; otherwise default to equipments
            if (!selectedDomain) {
                setSelectedDomain('equipments');
            }
        } else {
            setSelectedDomain(null);
            setSelectedCompany(null);
        }
        setActiveGroup(info.groupId);
        setActiveTab(viewId);
    }, [selectedDomain]);

    const breadcrumbs = useMemo(() => {
        const items = [{ label: t('navigation.apps'), key: 'apps' }];
        if (selectedCard) {
            items.push({ label: getCardLabel(selectedCard), key: selectedCard, kind: 'card' });
        }
        if (selectedDomain) {
            items.push({ label: getDomainLabel(selectedDomain), key: selectedDomain, kind: 'domain' });
        }
        if (selectedCompany) {
            items.push({
                label: selectedCompany.name || t('sidebar.company.fallback'),
                key: selectedCompany.name || 'company',
                kind: 'company',
                value: selectedCompany
            });
        }
        if (activeGroup) {
            const group = valueSystemGroups[activeGroup];
            items.push({
                label: t(`navigation.groups.${activeGroup}.title`, { defaultValue: group?.title || activeGroup }),
                key: activeGroup,
                kind: 'group'
            });
        }
        if (activeTab) {
            const info = findTabInfo(activeTab);
            if (info?.tab) {
                items.push({
                    label: t(`navigation.tabs.${activeTab}.label`, { defaultValue: info.tab.label }),
                    key: activeTab,
                    kind: 'tab'
                });
            }
        }
        return items;
    }, [activeGroup, activeTab, getCardLabel, getDomainLabel, selectedCard, selectedCompany, selectedDomain, t]);

    return (
        <ValueNavContext.Provider
            value={{
                selectedCard,
                selectedDomain,
                selectedCompany,
                companies,
                loadingCompanies,
                companyError,
                activeGroup,
                activeTab,
                setActiveGroup,
                setActiveTab,
                resetAll,
                chooseCard,
                chooseDomain,
                loadSavedCompanies,
                syncCompanies,
                setSelectedCompany,
                syncNavForView,
                breadcrumbs,
                valueSystemCards,
                valueSystemGroups
            }}
        >
            {children}
        </ValueNavContext.Provider>
    );
};

export default ValueNavContext;
