import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';

const LoginForm = ({ onViewChange }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        phone: '',
        otp: '',
        method: 'EMAIL'
    });

    const [showOtp, setShowOtp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loginType, setLoginType] = useState('phone'); // 'legacy' or 'phone'
    const { login } = useSession();

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 'SMS' : 'EMAIL') : value
        }));
    };

    const setRefreshCookieIfPresent = async (result) => {
        try {
            // If backend returned a refreshToken in JSON, ensure it's persisted as HttpOnly cookie
            if (result?.refreshToken && window.electronAPI?.setRefreshToken) {
                // use default baseUrl (preload defaults to http://localhost:3000)
                await window.electronAPI.setRefreshToken(result.refreshToken, {
                    // override defaults if you want to
                    // baseUrl: 'http://localhost:3000',
                    name: 'refreshToken',
                    maxAgeDays: 7,
                    sameSite: 'lax'
                });
            }
        } catch (err) {
            console.warn('Failed to set refresh token in cookie store:', err);
        }
    };

    const handlePhoneLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            if (!formData.phone || !formData.password) {
                throw new Error('Please enter phone number and password');
            }

            if (!window.electronAPI) {
                throw new Error('Electron API not available. Make sure you are running this in Electron.');
            }

            // Use the apiRequest method (main process will set cookie if Set-Cookie header or refreshToken present)
            const result = await window.electronAPI.apiRequest('POST', '/api/users/login', {
                phone: formData.phone,
                password: formData.password
            });

            // Fallback: if server returned refreshToken in JSON but main didn't catch it (rare), set it explicitly
            await setRefreshCookieIfPresent(result);

            if (result && result.user) {
                login(result.user);
                setMessage({
                    text: '✅ Login successful!',
                    type: 'success'
                });
                setTimeout(() => {
                    if (onViewChange) onViewChange('profile');
                }, 500);
            } else {
                throw new Error(result?.error || result?.message || 'Login failed');
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Unknown error occurred';
            setMessage({
                text: '❌ Error: ' + errorMsg,
                type: 'error'
            });
            console.error('Phone login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLegacyLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            if (!showOtp) {
                console.log('Submitting credentials:', {
                    email: formData.email,
                    password: formData.password,
                    method: formData.method
                });

                if (!window.electronAPI) {
                    throw new Error('Electron API not available');
                }

                if (!window.electronAPI.login) {
                    throw new Error('Login handler not found');
                }

                const result = await window.electronAPI.login({
                    email: formData.email,
                    password: formData.password,
                    method: formData.method
                });

                console.log('Login result:', result);

                // If the python backend returned a refresh token, persist it via main-process helper
                await setRefreshCookieIfPresent(result);

                if (result.status === 'OTP_REQUIRED') {
                    setShowOtp(true);
                    setMessage({
                        text: result.message || `Two-factor authentication required. Please enter your ${formData.method === 'SMS' ? 'SMS' : 'email'} code.`,
                        type: 'info'
                    });
                } else if (result.status === 'SUCCESS') {
                    // Store user data in session context if available
                    if (result.user) {
                        login(result.user);
                    }
                    setMessage({
                        text: result.message || '✅ Login successful!',
                        type: 'success'
                    });
                    setTimeout(() => {
                        if (onViewChange) onViewChange('profile');
                    }, 500);
                } else {
                    throw new Error(result.error || 'Login failed');
                }
            } else {
                console.log('Submitting OTP:', formData.otp);

                if (!window.electronAPI) {
                    throw new Error('Electron API not available');
                }

                if (!window.electronAPI.submitOtp) {
                    throw new Error('OTP handler not found');
                }

                const result = await window.electronAPI.submitOtp(formData.otp);

                console.log('OTP result:', result);

                // persist refresh token if returned after OTP verification
                await setRefreshCookieIfPresent(result);

                if (result.status === 'SUCCESS') {
                    if (result.user) {
                        login(result.user);
                    }
                    setMessage({
                        text: result.message || '✅ Authentication complete!',
                        type: 'success'
                    });
                    setTimeout(() => {
                        if (onViewChange) onViewChange('profile');
                    }, 500);
                } else {
                    throw new Error(result.error || 'OTP verification failed');
                }
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Unknown error occurred';
            setMessage({
                text: '❌ Error: ' + errorMsg,
                type: 'error'
            });
            console.error('Legacy login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setFormData({ email: '', password: '', phone: '', otp: '', method: 'EMAIL' });
        setShowOtp(false);
        setMessage({ text: '', type: '' });
    };

    const getMessageStyles = (type) => {
        const baseStyles = "p-4 rounded-lg border";
        switch (type) {
            case 'success':
                return `${baseStyles} bg-green-50 border-green-200 text-green-800`;
            case 'error':
                return `${baseStyles} bg-red-50 border-red-200 text-red-800`;
            case 'info':
                return `${baseStyles} bg-blue-50 border-blue-200 text-blue-800`;
            default:
                return `${baseStyles} bg-gray-50 border-gray-200 text-gray-800`;
        }
    };

    // ... rest of the component unchanged (UI markup)
    // (I left the large JSX UI content unchanged — keep the original form JSX here)
    // For brevity in this snippet, return the original JSX you already had.

    // Phone login vs legacy UI (unchanged)...
    if (loginType === 'phone') {
        return (
            <div className="max-w-md w-full mx-auto py-8">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Login with Phone</h2>

                    <form onSubmit={handlePhoneLogin} className="space-y-4">
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                📱 Phone Number
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                disabled={isLoading}
                                placeholder="Enter your phone number"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                🔒 Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                disabled={isLoading}
                                placeholder="Enter your password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                required
                            />
                        </div>

                        {message.text && (
                            <div className={getMessageStyles(message.type)}>
                                {message.text}
                            </div>
                        )}

                        <div className="flex space-x-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${isLoading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                            >
                                {isLoading ? 'Logging in...' : 'Login'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setLoginType('legacy')}
                                disabled={isLoading}
                                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                Legacy
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Legacy form JSX unchanged (paste your existing legacy JSX here)
    return (
        <div className="max-w-md w-full mx-auto py-8">
            {/* ... paste the rest of your legacy JSX exactly as before ... */}
            {/* For readability I omitted repeated JSX in this snippet; keep it as in your original file. */}
        </div>
    );
};

export default LoginForm;
