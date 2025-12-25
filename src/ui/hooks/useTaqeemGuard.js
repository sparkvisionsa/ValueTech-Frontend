import { useNavStatus } from '../context/NavStatusContext';
import { useSession } from '../context/SessionContext';

export const useTaqeemGuard = ({ onViewChange }) => {
    const { isAuthenticated } = useSession();
    const { setTaqeemStatus } = useNavStatus();

    const withTaqeemGuard = async (actionFn) => {
        try {
            const status = await window.electronAPI.checkTaqeemAccess();

            if (status === 'REQUIRE_SYSTEM_LOGIN') {
                setTaqeemStatus('error', 'Please login to continue');
                onViewChange?.('login');
                return;
            }

            if (status === 'REQUIRE_TAQEEM_LOGIN') {
                setTaqeemStatus('info', 'Taqeem login required');
                onViewChange?.('taqeem-auth');
                return;
            }

            // 2. Allowed → run the action
            await actionFn();
        } catch (err) {
            console.error('Taqeem guard failed:', err);
            setTaqeemStatus('error', err.message || 'Taqeem check failed');
        }
    };

    return { withTaqeemGuard };
};
