import React, { createContext, useContext, useState, useEffect } from 'react';

const SessionContext = createContext();

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within SessionProvider');
    }
    return context;
};

export const SessionProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize session from localStorage on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('token');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse saved user:', e);
                localStorage.removeItem('user');
            }
        }
        if (savedToken && savedToken !== 'undefined' && savedToken !== 'null') {
            setToken(savedToken);
        }
        setIsLoading(false);
    }, []);

    const login = (userData, accessToken) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        if (accessToken) {
            setToken(accessToken);
            localStorage.setItem('token', accessToken);
        } else {
            setToken(null);
            localStorage.removeItem('token');
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    const updateUser = (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    return (
        <SessionContext.Provider
            value={{
                user,
                token,
                isLoading,
                login,
                logout,
                updateUser,
                isAuthenticated: !!user
            }}
        >
            {children}
        </SessionContext.Provider>
    );
};

export default SessionContext;
