import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from './SessionContext';

const SystemControlContext = createContext(null);

export const useSystemControl = () => {
    const ctx = useContext(SystemControlContext);
    if (!ctx) {
        throw new Error('useSystemControl must be used within SystemControlProvider');
    }
    return ctx;
};

const DEFAULT_STATE = {
    systemName: 'Electron System',
    mode: 'active',
    allowedModules: []
};

const DEMO_MODULES = ['taqeem-login', 'profile', 'asset-create', 'packages', 'get-companies'];

const computeDowntimeTarget = (state) => {
    if (!state || state.mode !== 'inactive') return null;
    const msFromDays = Number(state.downtimeDays || 0) * 24 * 60 * 60 * 1000;
    const msFromHours = Number(state.downtimeHours || 0) * 60 * 60 * 1000;
    const durationMs = msFromHours > 0 ? msFromHours : msFromDays;

    if (state.expectedReturn) {
        const t = new Date(state.expectedReturn).getTime();
        return Number.isNaN(t) ? null : t;
    }

    if (durationMs > 0) {
        const base = state.updatedAt ? new Date(state.updatedAt).getTime() : Date.now();
        const t = base + durationMs;
        return Number.isNaN(t) ? null : t;
    }

    return null;
};

const isDowntimeExpired = (state) => {
    const target = computeDowntimeTarget(state);
    if (!target) return false;
    return Date.now() >= target;
};

export const SystemControlProvider = ({ children }) => {
    const { token, user } = useSession();
    const [systemState, setSystemState] = useState(null);
    const [latestUpdate, setLatestUpdate] = useState(null);
    const [userUpdateState, setUserUpdateState] = useState(null);
    const [loadingState, setLoadingState] = useState(false);
    const [loadingUpdate, setLoadingUpdate] = useState(false);
    const [error, setError] = useState(null);
    const [autoActivating, setAutoActivating] = useState(false);

    const isAdmin = user?.phone === '011111';
    const isAuthenticated = !!user;

    const fetchSystemState = useCallback(async () => {
        if (!window?.electronAPI) return;
        setLoadingState(true);
        try {
            const data = await window.electronAPI.apiRequest('GET', '/api/system/state');
            const state = data || DEFAULT_STATE;
            if (state.mode === 'inactive' && isDowntimeExpired(state)) {
                setSystemState({
                    ...state,
                    mode: 'active',
                    expectedReturn: null,
                    downtimeDays: 0,
                    downtimeHours: 0
                });
            } else {
                setSystemState(state);
            }
            setError(null);
        } catch (err) {
            console.error('Failed to fetch system state', err);
            setError(err.message || 'Failed to load system state');
            setSystemState(DEFAULT_STATE);
        } finally {
            setLoadingState(false);
        }
    }, []);

    const fetchUpdateNotice = useCallback(async () => {
        if (!window?.electronAPI) return;
        setLoadingUpdate(true);
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const data = await window.electronAPI.apiRequest('GET', '/api/updates/notifications/latest', {}, headers);
            setLatestUpdate(data?.update || null);
            setUserUpdateState(data?.userState || null);
        } catch (err) {
            console.error('Failed to fetch update notice', err);
        } finally {
            setLoadingUpdate(false);
        }
    }, [token]);

    useEffect(() => {
        fetchSystemState();
        fetchUpdateNotice();
    }, [fetchSystemState, fetchUpdateNotice]);

    const updateSystemState = useCallback(async (payload) => {
        if (!token) {
            throw new Error('You must be logged in to change system state');
        }
        const headers = { Authorization: `Bearer ${token}` };
        const data = await window.electronAPI.apiRequest('PUT', '/api/system/state', payload, headers);
        setSystemState(data || DEFAULT_STATE);
        return data;
    }, [token]);

    const markDownloaded = async (updateId) => {
        if (!token) {
            throw new Error('Login required to download updates');
        }
        const headers = { Authorization: `Bearer ${token}` };
        const data = await window.electronAPI.apiRequest('POST', `/api/updates/${updateId}/download`, {}, headers);
        setUserUpdateState(data);
        return data;
    };

    const applyUpdate = async (updateId) => {
        if (!token) {
            throw new Error('Login required to apply updates');
        }
        const headers = { Authorization: `Bearer ${token}` };
        const data = await window.electronAPI.apiRequest('POST', `/api/updates/${updateId}/apply`, {}, headers);
        setUserUpdateState(data);
        if (data?.status === 'applied') {
            setLatestUpdate(null);
        }
        await fetchUpdateNotice();
        return data;
    };

    const activateAfterExpiry = useCallback(async () => {
        if (!systemState) return { success: false, error: 'No system state available' };
        const payload = {
            mode: 'active',
            expectedReturn: null,
            downtimeDays: 0,
            downtimeHours: 0,
            notes: systemState.notes || '',
            partialMessage: systemState.partialMessage || '',
            allowedModules: systemState.allowedModules || []
        };

        // Optimistically flip locally so any user can continue once downtime hits zero.
        setSystemState((prev) => ({
            ...(prev || DEFAULT_STATE),
            ...payload
        }));

        // Only admins can persist this to the backend; regular users stop here to avoid 403 spam.
        if (!token || !isAdmin) {
            return { success: true, localOnly: true };
        }

        try {
            await updateSystemState(payload);
            await fetchSystemState();
            return { success: true };
        } catch (err) {
            console.error('Failed to activate after downtime', err);
            return { success: false, error: err?.response?.data?.message || err.message || 'Failed to activate' };
        }
    }, [systemState, token, updateSystemState, fetchSystemState, isAdmin]);

    useEffect(() => {
        // Auto-switch to active once downtime expires for all users.
        if (!systemState || systemState.mode !== 'inactive') return;

        const target = computeDowntimeTarget(systemState);
        const durationMs = Number(systemState.downtimeHours || 0) > 0
            ? Number(systemState.downtimeHours || 0) * 60 * 60 * 1000
            : Number(systemState.downtimeDays || 0) * 24 * 60 * 60 * 1000;

        // If there is no target and no positive duration, flip active immediately.
        if (!target && durationMs <= 0) {
            setSystemState((prev) => ({
                ...(prev || DEFAULT_STATE),
                mode: 'active',
                expectedReturn: null,
                downtimeDays: 0,
                downtimeHours: 0
            }));
            return;
        }

        if (!target) return;

        let cancelled = false;

        const triggerAutoActivation = async () => {
            if (cancelled || autoActivating) return;
            if (Date.now() < target) return;

            // Fail-open locally so users are unblocked even if the backend call fails.
            setSystemState((prev) => ({
                ...(prev || DEFAULT_STATE),
                mode: 'active',
                expectedReturn: null,
                downtimeDays: 0,
                downtimeHours: 0
            }));

            try {
                setAutoActivating(true);
                if (token && isAdmin) {
                    await updateSystemState({
                        mode: 'active',
                        expectedReturn: null,
                        downtimeDays: 0,
                        downtimeHours: 0,
                        notes: systemState.notes || '',
                        partialMessage: systemState.partialMessage || '',
                        allowedModules: systemState.allowedModules || []
                    });
                    await fetchSystemState();
                }
            } catch (err) {
                console.error('Failed to auto-activate system after downtime', err);
            } finally {
                if (!cancelled) {
                    setAutoActivating(false);
                }
            }
        };

        // Check every second so we don't miss edge cases; trigger immediately if already expired.
        triggerAutoActivation();
        const intervalId = setInterval(triggerAutoActivation, 1000);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [systemState, token, autoActivating, updateSystemState, fetchSystemState, isAdmin]);

    const hasPermission = (viewId) => {
        const alwaysAllowed = ['login', 'registration', 'taqeem-login', 'profile'];
        if (alwaysAllowed.includes(viewId)) return true;
        if (!user) return true;
        if (isAdmin) return true;

        const isCompanyHead = user.type === 'company' || user.role === 'company-head';
        const isCompanyLinked = !!user.company && !isCompanyHead;
        const perms = Array.isArray(user.permissions) ? user.permissions : [];

        if (isCompanyHead) return true;

        // Members or any account linked to a company (non-head) must follow permissions
        if (user.role === 'member' || isCompanyLinked) {
            if (perms.length === 0) return false;
            return perms.includes(viewId);
        }

        // Standalone individuals keep full access unless permissions are explicitly set
        if (perms.length === 0) return true;
        return perms.includes(viewId);
    };

    const isFeatureBlocked = (viewId) => {
        const alwaysAllowed = ['login', 'registration'];
        if (alwaysAllowed.includes(viewId)) return false;
        if (!hasPermission(viewId)) return true;

        if (!systemState || isAdmin) return false;
        if (systemState.mode === 'inactive') {
            return true;
        }

        if (systemState.mode === 'demo') {
            return !DEMO_MODULES.includes(viewId);
        }

        if (systemState.mode === 'partial') {
            if (!Array.isArray(systemState.allowedModules) || systemState.allowedModules.length === 0) {
                return true;
            }
            return !systemState.allowedModules.includes(viewId);
        }
        return false;
    };

    const updateBlocked = () => {
        if (!isAuthenticated || isAdmin) return false;
        if (!latestUpdate) return false;
        if (latestUpdate.rolloutType !== 'mandatory') return false;
        return userUpdateState?.status !== 'applied';
    };

    const blockReason = (viewId) => {
        if (isAdmin) return null;

        if (!hasPermission(viewId)) {
            return 'Your access is limited for this account.';
        }

        if (updateBlocked()) {
            return latestUpdate?.description || 'A mandatory update must be applied before continuing.';
        }

        if (!systemState) return null;
        if (systemState.mode === 'inactive') {
            return 'The system is currently inactive.';
        }
        if (systemState.mode === 'demo' && isFeatureBlocked(viewId)) {
            return systemState.partialMessage || 'Demo mode limits access to a few modules.';
        }
        if (systemState.mode === 'partial' && isFeatureBlocked(viewId)) {
            return systemState.partialMessage || 'This feature is disabled while the system is partially enabled.';
        }
        return null;
    };

    return (
        <SystemControlContext.Provider
            value={{
                systemState,
                latestUpdate,
                userUpdateState,
                loadingState,
                loadingUpdate,
                error,
                isAdmin,
                fetchSystemState,
                fetchUpdateNotice,
                updateSystemState,
                markDownloaded,
                applyUpdate,
                activateAfterExpiry,
                isFeatureBlocked,
                blockReason,
                updateBlocked
            }}
        >
            {children}
        </SystemControlContext.Provider>
    );
};

export default SystemControlContext;
