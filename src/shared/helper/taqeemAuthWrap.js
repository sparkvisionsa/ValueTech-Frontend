async function ensureTaqeemAuthorized(token, onViewChange, isTaqeemLoggedIn, assetCount = 0) {
    try {
        if (!token) {
            onViewChange?.("taqeem-login");
            return false;
        }

        const res = await window.electronAPI.apiRequest(
            "POST",
            "/api/users/authorize",
            { assetCount },
            { Authorization: `Bearer ${token}` }
        );

        if (res?.status === "AUTHORIZED" && !isTaqeemLoggedIn) {
            onViewChange?.("taqeem-login");
            return false;
        }

        if (res?.status === "INSUFFICIENT_POINTS") {
            return { status: "INSUFFICIENT_POINTS" };
        }

        if (res?.status === "AUTHORIZED") return true;

        if (res?.status === "LOGIN_REQUIRED" || res?.data?.status === "LOGIN_REQUIRED") {
            onViewChange?.("login");
            return false;
        }

        onViewChange?.("taqeem-login");
        return false;

    } catch (err) {
        console.log("PROPS: ", Object.getOwnPropertyNames(err));

        // temporary heuristic
        if (err.message.includes("403")) {
            onViewChange?.("registration");
            return false;
        }

        onViewChange?.("taqeem-login");
        return false;
    }
}


module.exports = { ensureTaqeemAuthorized };
