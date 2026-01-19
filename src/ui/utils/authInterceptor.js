const AUTH_EXPIRED_EVENT = 'auth-expired';

const isAuthExpiredError = (error) => {
    if (!error) return false;
    const status = Number(error.status || error?.response?.status || 0);
    if ([401, 403, 419].includes(status)) {
        return true;
    }

    const messageParts = [
        error?.response?.data?.message,
        error?.response?.data?.error,
        error?.message
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (!messageParts) {
        return false;
    }

    return (
        messageParts.includes('expired token') ||
        messageParts.includes('token expired') ||
        messageParts.includes('session expired') ||
        messageParts.includes('please login to our system') ||
        messageParts.includes('please login') ||
        messageParts.includes('unauthorized')
    );
};

const installAuthExpiryInterceptor = () => {
    if (typeof window === 'undefined') return null;
    if (window.__authExpiryInterceptorInstalled) return null;

    const restorers = [];

    if (typeof window.fetch === 'function') {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            if (response && [401, 403, 419].includes(Number(response.status))) {
                try {
                    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { status: response.status } }));
                } catch (dispatchErr) {
                    console.warn('Failed to dispatch auth expiry event', dispatchErr);
                }
            }
            return response;
        };

        restorers.push(() => {
            window.fetch = originalFetch;
        });
    }

    if (window.electronAPI?.onAuthExpired) {
        const listener = (detail) => {
            try {
                window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail }));
            } catch (dispatchErr) {
                console.warn('Failed to dispatch auth expiry event', dispatchErr);
            }
        };
        const unsubscribe = window.electronAPI.onAuthExpired(listener);
        if (typeof unsubscribe === 'function') {
            restorers.push(unsubscribe);
        }
    }

    if (restorers.length === 0) return null;

    window.__authExpiryInterceptorInstalled = true;

    return () => {
        restorers.forEach((restore) => {
            try {
                if (typeof restore === 'function') {
                    restore();
                }
            } catch (err) {
                console.warn('Failed to restore auth interceptor handler', err);
            }
        });
        window.__authExpiryInterceptorInstalled = false;
    };
};

export { AUTH_EXPIRED_EVENT, installAuthExpiryInterceptor };
