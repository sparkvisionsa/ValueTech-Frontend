async function runPublicLogin(isAuth) {
    try {
        const loginFlow = await window.electronAPI.publicLogin(isAuth);

        // normalize failures so caller doesn't have to know implementation details
        if (!loginFlow || loginFlow.status === "FAILED") {
            return { status: "FAILED", error: loginFlow?.error || "Unknown login failure" };
        }

        return loginFlow;
    } catch (err) {
        console.error("Login failed:", err);
        return { status: "FAILED", error: err.message };
    }
}


async function ensureTaqeemAuthorized(
    token,
    onViewChange,
    isTaqeemLoggedIn,
    assetCount = 0,
    login = null,
    setTaqeemStatus = null,
    options = {}
) {
    const {
        allowLoginRedirect = true,
        isGuest = false,
        guestAccessEnabled
    } = options || {};
    const suppressSystemRedirect = isGuest && guestAccessEnabled !== undefined;
    const canRedirect = allowLoginRedirect && typeof onViewChange === 'function' && !suppressSystemRedirect;

    const redirectToSystemLogin = () => {
        if (canRedirect) {
            onViewChange('login');
        }
    };

    const redirectToRegistration = () => {
        if (canRedirect) {
            onViewChange('registration');
        }
    };
    try {
        // Check browser status first to see if we're actually logged in
        const browserStatus = await window.electronAPI.checkStatus();
        if (browserStatus?.browserOpen && browserStatus?.status === "SUCCESS") {
            setTaqeemStatus?.("success", "Taqeem login: On");
            return true;
        }

        // If the automation browser is already logged into Taqeem, skip any extra login flow.
        if (isTaqeemLoggedIn) {
            setTaqeemStatus?.("success", "Taqeem login: On");
            return true;
        }

        if (!token) {
            const loginFlow = await runPublicLogin(false);
            console.log("Login flow:", loginFlow);

            if (loginFlow.status === "CHECK") {
                setTaqeemStatus?.("success", "Taqeem login: On");
                const res = await window.electronAPI.apiRequest(
                    "POST",
                    "/api/users/new-bootstrap",
                    { username: loginFlow.user_id },
                    { Authorization: `Bearer ${token}` }
                );

                console.log("res:", res);

                if (res?.status === "BOOTSTRAP_GRANTED") {
                    setTaqeemStatus?.("success", "Taqeem login: On");
                    login({ id: res.userId, guest: true }, res.token);
                    return { success: true, token: res.token };
                }

                if (res?.status === "LOGIN_REQUIRED") {
                    setTaqeemStatus?.("info", "Taqeem login: Off");
                    redirectToSystemLogin();
                    return res;
                }
            }

            return loginFlow;
        }

        // Token exists — validate authorization
        const res = await window.electronAPI.apiRequest(
            "POST",
            "/api/users/authorize",
            { assetCount },
            { Authorization: `Bearer ${token}` }
        );

        if (res?.status === "AUTHORIZED" && !isTaqeemLoggedIn) {
            const loginFlow = await runPublicLogin(true);
            if (loginFlow.status === "SUCCESS") {
                setTaqeemStatus?.("success", "Taqeem login: On");
                return true;
            } else if (setTaqeemStatus) {
                setTaqeemStatus("info", "Taqeem login: Off");
            }
            return loginFlow;
        }

        if (res?.status === "INSUFFICIENT_POINTS") {
            return { status: "INSUFFICIENT_POINTS" };
        }

        if (res?.status === "AUTHORIZED") {
            setTaqeemStatus?.("success", "Taqeem login: On");
            return true;
        }

        if (res?.status === "LOGIN_REQUIRED" || res?.data?.status === "LOGIN_REQUIRED") {
            setTaqeemStatus?.("info", "Taqeem login: Off");
            redirectToSystemLogin();
            return res;
        }

        onViewChange?.("taqeem-login");
        return false;

    } catch (err) {
        console.log("PROPS: ", Object.getOwnPropertyNames(err));

        if (err.message.includes("403")) {
            setTaqeemStatus?.("info", "Taqeem login: Off");
            redirectToRegistration();
            return false;
        }

        setTaqeemStatus?.("info", "Taqeem login: Off");
        onViewChange?.("taqeem-login");
        return false;
    }
}

module.exports = { ensureTaqeemAuthorized };
