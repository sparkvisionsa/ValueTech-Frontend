import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TaqeemAuthWrap({ children }) {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const authorize = async () => {
            try {
                // Prefer Electron as the source of truth
                const token = await window.electronAPI.getToken();

                if (!token) {
                    navigate("/login");
                    return;
                }

                const res = await window.electronAPI.apiRequest(
                    "POST",
                    "/api/taqeem/authorize",
                    {},
                    {
                        Authorization: `Bearer ${token}`
                    }
                );

                if (res?.status === "AUTHORIZED") {
                    setAuthorized(true);
                } else {
                    navigate("/login");
                }
            } catch (err) {
                navigate("/login");
            } finally {
                setLoading(false);
            }
        };

        authorize();
    }, [navigate]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                Checking authorization…
            </div>
        );
    }

    if (!authorized) return null;

    return children;
}
