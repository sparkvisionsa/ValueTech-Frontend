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


async function ensureTaqeemAuthorized(token, onViewChange, isTaqeemLoggedIn, assetCount = 0, login = null, setTaqeemStatus = null) {
    try {
        if (!token) {
            const loginFlow = await runPublicLogin(false);
            console.log("Login flow:", loginFlow);

            if (loginFlow.status === "CHECK") {
                const res = await window.electronAPI.apiRequest(
                    "POST",
                    "/api/users/new-bootstrap",
                    { username: loginFlow.user_id },
                    { Authorization: `Bearer ${token}` }
                );

                console.log("res:", res);

                if (res?.status === "BOOTSTRAP_GRANTED") {
                    setTaqeemStatus?.("success", "Taqeem login completed");
                    login(res.userId, res.token);
                    return { success: true, token: res.token };
                }

                if (res?.status === "LOGIN_REQUIRED") {
                    setTaqeemStatus?.("success", "Taqeem login completed");
                    onViewChange?.("login");
                    return false;
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
                setTaqeemStatus?.("success", "Taqeem login completed");
            }
            return loginFlow;
        }

        if (res?.status === "INSUFFICIENT_POINTS") {
            return { status: "INSUFFICIENT_POINTS" };
        }

        if (res?.status === "AUTHORIZED") return true;

        if (res?.status === "LOGIN_REQUIRED" || res?.data?.status === "LOGIN_REQUIRED") {
            onViewChange?.("login");
            return res;
        }

        onViewChange?.("taqeem-login");
        return false;

    } catch (err) {
        console.log("PROPS: ", Object.getOwnPropertyNames(err));

        if (err.message.includes("403")) {
            onViewChange?.("registration");
            return false;
        }

        onViewChange?.("taqeem-login");
        return false;
    }
}

module.exports = { ensureTaqeemAuthorized };