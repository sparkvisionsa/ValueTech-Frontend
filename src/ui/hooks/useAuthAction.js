// hooks/useAuthAction.js
import { useState, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useNavStatus } from '../context/NavStatusContext';
import { useValueNav } from '../context/ValueNavContext';
import { ensureTaqeemAuthorized } from '../../shared/helper/taqeemAuthWrap';

export const useAuthAction = () => {
    const { token, login } = useSession();
    const { taqeemStatus, setTaqeemStatus } = useNavStatus();
    const { selectedCompany } = useValueNav();
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState(null);

    const executeWithAuth = useCallback(async (
        action,
        actionParams = {},
        options = {}
    ) => {
        const {
            requiredPoints = 1,
            showInsufficientPointsModal = () => { },
            onAuthSuccess = () => { },
            onAuthFailure = () => { },
            onViewChange = null,      // ✅ add this
            skipAuth = false
        } = options;

        setAuthLoading(true);
        setAuthError(null);

        try {
            // Skip authentication if explicitly requested
            if (skipAuth) {
                return await action(actionParams);
            }

            // Check authentication
            const isTaqeemLoggedIn = taqeemStatus?.state === "success";
            const authStatus = await ensureTaqeemAuthorized(
                token,
                onViewChange, // onViewChange - can be passed via options if needed
                isTaqeemLoggedIn,
                requiredPoints,
                login,
                setTaqeemStatus
            );

            console.log("[useAuthAction] authStatus:", authStatus);
            // Handle authentication results
            if (authStatus?.status === "INSUFFICIENT_POINTS") {
                showInsufficientPointsModal();
                onAuthFailure("INSUFFICIENT_POINTS");
                return null;
            }

            if (authStatus?.status === "LOGIN_REQUIRED") {
                onAuthFailure("LOGIN_REQUIRED");
                return null;
            }

            // Authentication successful
            if (authStatus?.token) {
                // Token was refreshed, use the new one
                actionParams.token = authStatus.token;
            }

            onAuthSuccess(authStatus);

            // Navigate to selected company using the active Taqeem browser/session right before the action
            if (selectedCompany && window?.electronAPI?.navigateToCompany) {
                try {
                    await window.electronAPI.navigateToCompany({
                        name: selectedCompany.name,
                        url: selectedCompany.url,
                        officeId: selectedCompany.officeId || selectedCompany.office_id,
                        sectorId: selectedCompany.sectorId || selectedCompany.sector_id,
                        skipNavigation: false
                    });
                } catch (err) {
                    console.warn('[useAuthAction] navigateToCompany skipped:', err?.message || err);
                }
            }

            return await action(actionParams);

        } catch (error) {
            console.error("[useAuthAction] Error:", error);
            setAuthError(error.message);
            onAuthFailure(error);
            return null;
        } finally {
            setAuthLoading(false);
        }
    }, [token, login, taqeemStatus, setTaqeemStatus]);

    return {
        executeWithAuth,
        authLoading,
        authError,
        clearAuthError: () => setAuthError(null)
    };
};
