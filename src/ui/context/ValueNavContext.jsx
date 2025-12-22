import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import navigation from '../constants/navigation';
import { useSession } from './SessionContext';

const { valueSystemCards, valueSystemGroups, findTabInfo } = navigation;

const ValueNavContext = createContext(null);

export const useValueNav = () => {
    const ctx = useContext(ValueNavContext);
    if (!ctx) {
        throw new Error('useValueNav must be used within ValueNavProvider');
    }
    return ctx;
};

const cardLabel = (cardId) => valueSystemCards.find((c) => c.id === cardId)?.title || cardId;

const domainLabels = {
    'real-estate': 'Real state',
    equipments: 'Equipments'
};

export const ValueNavProvider = ({ children }) => {
    const { user, token } = useSession();
    const [selectedCard, setSelectedCard] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [companyError, setCompanyError] = useState('');
    const [activeGroup, setActiveGroup] = useState(null);
    const [activeTab, setActiveTab] = useState(null);

    const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

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
            setCompanyError('Company fetch is not available in this build.');
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
            const msg = err?.response?.data?.message || err?.message || 'Failed to load saved companies';
            setCompanyError(msg);
            return [];
        } finally {
            setLoadingCompanies(false);
        }
    }, [authHeaders, normalizeCompanyList, user]);

    const syncCompanies = useCallback(async (items = [], defaultType = 'equipment') => {
        if (!window?.electronAPI?.apiRequest) {
            throw new Error('Company sync is not available in this build.');
        }
        if (!user) {
            throw new Error('Login is required to save companies');
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
    }, [authHeaders, loadSavedCompanies, normalizeCompanyList, user]);

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
        if (!selectedCard) {
            setSelectedCard('uploading-reports');
        }
        // preserve existing domain/company if already set; otherwise default to equipments
        if (!selectedDomain) {
            setSelectedDomain('equipments');
        }
        setActiveGroup(info.groupId);
        setActiveTab(viewId);
    }, [selectedCard, selectedDomain]);

    const breadcrumbs = useMemo(() => {
        const items = [{ label: 'Apps', key: 'apps' }];
        if (selectedCard) {
            items.push({ label: cardLabel(selectedCard), key: selectedCard, kind: 'card' });
        }
        if (selectedDomain) {
            items.push({ label: domainLabels[selectedDomain] || selectedDomain, key: selectedDomain, kind: 'domain' });
        }
        if (selectedCompany) {
            items.push({ label: selectedCompany.name || 'Company', key: selectedCompany.name || 'company', kind: 'company', value: selectedCompany });
        }
        if (activeGroup) {
            const group = valueSystemGroups[activeGroup];
            items.push({ label: group?.title || activeGroup, key: activeGroup, kind: 'group' });
        }
        if (activeTab) {
            const info = findTabInfo(activeTab);
            if (info?.tab) {
                items.push({ label: info.tab.label, key: activeTab, kind: 'tab' });
            }
        }
        return items;
    }, [selectedCard, selectedDomain, selectedCompany, activeGroup, activeTab]);

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
