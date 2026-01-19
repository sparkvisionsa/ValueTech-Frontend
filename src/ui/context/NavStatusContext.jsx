import React, { createContext, useContext, useMemo, useCallback } from 'react';
import usePersistentState from '../hooks/usePersistentState';

const NavStatusContext = createContext(null);

const DEFAULT_TAQEEM = { state: 'idle', message: 'Taqeem login: Off' };
const DEFAULT_COMPANY = { state: 'idle', message: 'No company selected' };

export const useNavStatus = () => {
    const ctx = useContext(NavStatusContext);
    if (!ctx) {
        throw new Error('useNavStatus must be used within NavStatusProvider');
    }
    return ctx;
};

export const NavStatusProvider = ({ children }) => {
    const [taqeemStatus, setTaqeemStatusState, resetTaqeemStatus] = usePersistentState('nav:taqeem-status', DEFAULT_TAQEEM, { storage: 'session' });
    const [companyStatus, setCompanyStatusState, resetCompanyStatus] = usePersistentState('nav:company-status', DEFAULT_COMPANY, { storage: 'session' });

    const updateTaqeemStatus = useCallback((state, message) => {
        setTaqeemStatusState({
            state,
            message: message || DEFAULT_TAQEEM.message
        });
    }, [setTaqeemStatusState]);

    const updateCompanyStatus = useCallback((state, message) => {
        setCompanyStatusState({
            state,
            message: message || DEFAULT_COMPANY.message
        });
    }, [setCompanyStatusState]);

    const value = useMemo(() => ({
        taqeemStatus,
        companyStatus,
        setTaqeemStatus: updateTaqeemStatus,
        setCompanyStatus: updateCompanyStatus,
        resetStatuses: () => {
            resetTaqeemStatus();
            resetCompanyStatus();
        }
    }), [taqeemStatus, companyStatus, updateTaqeemStatus, updateCompanyStatus, resetCompanyStatus, resetTaqeemStatus]);

    return (
        <NavStatusContext.Provider value={value}>
            {children}
        </NavStatusContext.Provider>
    );
};

export default NavStatusContext;
