// hooks/useAuthAction.js
import { useState, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import { useNavStatus } from "../context/NavStatusContext";
import { useValueNav } from "../context/ValueNavContext";
import { ensureTaqeemAuthorized } from "../../shared/helper/taqeemAuthWrap";
import { useSystemControl } from "../context/SystemControlContext";

export const useAuthAction = () => {
  const { token, login, isGuest } = useSession();
  const { taqeemStatus, setTaqeemStatus } = useNavStatus();
  const { systemState } = useSystemControl();
  const { selectedCompany } = useValueNav();

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  /**
   * Single source of truth:
   * - This function is responsible for Taqeem auth checks + taqeemStatus updates.
   * - Callers should NOT call ensureTaqeemAuthorized again inside action functions.
   */
  const executeWithAuth = useCallback(
    async (action, actionParams = {}, options = {}) => {
      const {
        requiredPoints = 1,
        showInsufficientPointsModal = () => {},
        onAuthSuccess = () => {},
        onAuthFailure = () => {},
        onViewChange = null,
        skipAuth = false,
      } = options;

      setAuthLoading(true);
      setAuthError(null);

      try {
        if (skipAuth) {
          return await action(actionParams);
        }

        const isTaqeemLoggedIn = taqeemStatus?.state === "success";
        const guestSession = isGuest || !token;

        // ✅ Always run auth through this hook so taqeemStatus is updated here.
        const authStatus = await ensureTaqeemAuthorized(
          token,
          onViewChange,
          isTaqeemLoggedIn,
          requiredPoints,
          login,
          setTaqeemStatus,
          {
            isGuest: guestSession,
            guestAccessEnabled: systemState?.guestAccessEnabled ?? true,
          }
        );

        console.log("[useAuthAction] authStatus:", authStatus);

        if (authStatus?.status === "INSUFFICIENT_POINTS") {
          showInsufficientPointsModal();
          onAuthFailure("INSUFFICIENT_POINTS");
          return null;
        }

        if (authStatus?.status === "LOGIN_REQUIRED") {
          onAuthFailure("LOGIN_REQUIRED");
          return null;
        }

        // If ensureTaqeemAuthorized refreshed token, pass it down to action
        const activeToken = authStatus?.token || token;
        actionParams.token = activeToken;

        onAuthSuccess(authStatus);

        // ✅ Navigate to selected company before running action
        if (selectedCompany && window?.electronAPI?.navigateToCompany) {
          try {
            await window.electronAPI.navigateToCompany({
              name: selectedCompany.name,
              url: selectedCompany.url,
              officeId: selectedCompany.officeId || selectedCompany.office_id,
              sectorId: selectedCompany.sectorId || selectedCompany.sector_id,
              skipNavigation: false,
            });
          } catch (err) {
            console.warn(
              "[useAuthAction] navigateToCompany skipped:",
              err?.message || err
            );
          }
        }

        return await action(actionParams);
      } catch (error) {
        console.error("[useAuthAction] Error:", error);
        setAuthError(error?.message || String(error));
        onAuthFailure(error);
        return null;
      } finally {
        setAuthLoading(false);
      }
    },
    [
      token,
      login,
      taqeemStatus,
      setTaqeemStatus,
      isGuest,
      systemState?.guestAccessEnabled,
      selectedCompany, // ✅ was missing
    ]
  );

  return {
    executeWithAuth,
    authLoading,
    authError,
    clearAuthError: () => setAuthError(null),
  };
};
