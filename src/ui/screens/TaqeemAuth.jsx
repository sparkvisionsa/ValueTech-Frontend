import React, { useEffect, useState } from 'react';
import { useNavStatus } from '../context/NavStatusContext';
import usePersistentState from "../hooks/usePersistentState";

const TaqeemAuth = ({ onViewChange }) => {
    const [formData, setFormData, resetFormData] = usePersistentState('taqeem-auth:form', {
        email: '',
        password: '',
        otp: '',
        method: 'EMAIL' // Default method
    }, { storage: 'session' });
    const [showOtp, setShowOtp, resetShowOtp] = usePersistentState('taqeem-auth:showOtp', false, { storage: 'session' });
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage, resetMessage] = usePersistentState('taqeem-auth:message', { text: '', type: '' }, { storage: 'session' });
    const { taqeemStatus, setTaqeemStatus } = useNavStatus();

    useEffect(() => {
        if (taqeemStatus?.state !== 'success') {
            setTaqeemStatus('info', 'Taqeem login is required to proceed');
        }
    }, [setTaqeemStatus, taqeemStatus?.state]);

    const goToCompanies = () => {
        if (onViewChange) {
            // Small delay so the success message is visible
            setTimeout(() => onViewChange('get-companies'), 400);
        }
    };

    const handleInputChange = (e) => {
            const { name, value, type, checked } = e.target;
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? (checked ? 'SMS' : 'EMAIL') : value
            }));
            if (name === 'otp' && message?.text) {
                setMessage((prev) => ({ ...prev, text: '' }));
            }
        };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            if (!showOtp) {
                // First stage: Email + Password + Method
                console.log('Submitting credentials:', {
                    email: formData.email,
                    password: formData.password,
                    method: formData.method
                });

                if (window.electronAPI && window.electronAPI.login) {
                    const result = await window.electronAPI.login({
                        email: formData.email,
                        password: formData.password,
                        method: formData.method
                    });

                    console.log('Login result:', result);

                    if (result.status === 'OTP_REQUIRED') {
                        setShowOtp(true);
                        setMessage({
                            text: result.message || `Two-factor authentication required. Please enter your ${formData.method === 'SMS' ? 'SMS' : 'email'} code.`,
                            type: 'info'
                        });
                        setTaqeemStatus('info', 'Awaiting OTP to finish Taqeem sign-in');
                    } else if (result.status === 'SUCCESS') {
                        setMessage({
                            text: result.message || '✅ Login successful! Starting automation...',
                            type: 'success'
                        });
                        setTaqeemStatus('success', 'Taqeem login completed');
                        goToCompanies();
                    } else {
                        throw new Error(result.error || 'Login failed');
                    }
                } else {
                    throw new Error('Electron API not available');
                }
            } else {
                // Second stage: OTP
                console.log('Submitting OTP:', formData.otp);

                if (window.electronAPI && window.electronAPI.submitOtp) {
                    const result = await window.electronAPI.submitOtp(formData.otp);

                    console.log('OTP result:', result);

                    if (result.status === 'SUCCESS') {
                        setMessage({
                            text: result.message || '✅ Authentication complete! Automation running...',
                            type: 'success'
                        });
                        setTaqeemStatus('success', 'Taqeem login completed');
                        goToCompanies();
                    } else {
                        throw new Error(result.error || 'OTP verification failed');
                    }
                } else {
                    throw new Error('Electron API not available');
                }
            }
        } catch (error) {
            setMessage({
                text: '❌ Error: ' + error.message,
                type: 'error'
            });
            setTaqeemStatus('error', error.message || 'Taqeem login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoLogin = async () => {
        if (isLoading) return;
        const autoCreds = {
            email: '1026592343',
            password: 'Aa@@654321',
            method: 'AUTO',
            autoOtp: true
        };
        setFormData((prev) => ({ ...prev, ...autoCreds, otp: '' }));
        setShowOtp(false);
        setMessage({ text: '', type: '' });
        setIsLoading(true);

        try {
            if (window.electronAPI && window.electronAPI.login) {
                const result = await window.electronAPI.login(autoCreds);

                if (result.status === 'OTP_REQUIRED') {
                    setShowOtp(true);
                    setMessage({
                        text: result.message || 'Two-factor authentication required. Please enter your email code.',
                        type: 'info'
                    });
                    setTaqeemStatus('info', 'Awaiting OTP to finish Taqeem sign-in');
                } else if (result.status === 'SUCCESS') {
                    setMessage({
                        text: result.message || '✅ Login successful! Starting automation...',
                        type: 'success'
                    });
                    setTaqeemStatus('success', 'Taqeem login completed');
                    goToCompanies();
                } else {
                    throw new Error(result.error || 'Login failed');
                }
            } else {
                throw new Error('Electron API not available');
            }
        } catch (error) {
            setMessage({
                text: '❌ Error: ' + error.message,
                type: 'error'
            });
            setTaqeemStatus('error', error.message || 'Taqeem login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        resetFormData();
        resetShowOtp();
        resetMessage();
        setTaqeemStatus('info', 'Taqeem login is required to proceed');
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

    return (
        <div className="max-w-md w-full mx-auto py-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
                {taqeemStatus?.state === 'success' && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-100 p-4 text-green-900 flex items-start gap-3">
                        <div className="mt-0.5">
                            <svg className="w-5 h-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-green-900">You are already logged in to Taqeem</p>
                            <p className="text-sm text-green-800">Move straight to selecting companies or keep this form for re-authentication.</p>
                        </div>
                        <button
                            onClick={() => onViewChange && onViewChange('get-companies')}
                            className="text-sm font-semibold text-green-900 bg-white border border-green-200 px-3 py-2 rounded-lg hover:bg-green-100"
                        >
                            Go to companies
                        </button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Field */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            📧 Email Address
                        </label>
                        <input
                            type="text"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            disabled={showOtp || isLoading}
                            placeholder="Enter your email"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    {/* Password Field */}
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
                            disabled={showOtp || isLoading}
                            placeholder="Enter your password"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            required
                        />
                    </div>

                    {/* SMS Checkbox */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="method"
                            name="method"
                            checked={formData.method === 'SMS'}
                            onChange={handleInputChange}
                            disabled={showOtp || isLoading}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="method" className="ml-2 block text-sm text-gray-700">
                            📱 Use SMS for two-factor authentication
                        </label>
                    </div>

                    {/* Conditional OTP Field */}
                    {showOtp && (
                        <div>
                            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                                {formData.method === 'SMS' ? '📱' : '🔑'} One-Time Password
                            </label>
                            <input
                                type="text"
                                id="otp"
                                name="otp"
                                value={formData.otp}
                                onChange={handleInputChange}
                                disabled={isLoading}
                                placeholder={`Enter ${formData.method === 'SMS' ? 'SMS' : '6-digit'} code`}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                maxLength={formData.method === 'SMS' ? undefined : "6"}
                                pattern={formData.method === 'SMS' ? undefined : "[0-9]{6}"}
                                required
                            />
                            <p className="mt-2 text-sm text-gray-500">
                                {formData.method === 'SMS'
                                    ? 'Check your phone for the SMS code'
                                    : 'Check your authenticator app for the code'
                                }
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </span>
                            ) : showOtp ? (
                                'Verify OTP'
                            ) : (
                                'Login & Start Automation'
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleAutoLogin}
                            disabled={isLoading}
                            className="px-4 py-3 rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed transition-all duration-200"
                            title="Use preset credentials and start login automatically"
                        >
                            Auto login
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={isLoading}
                            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Status Message */}
                    {message.text && (
                        <div className={getMessageStyles(message.type)}>
                            {message.text}
                        </div>
                    )}

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center space-x-8 pt-4">
                        <div className={`flex items-center space-x-2 ${!showOtp ? 'text-blue-600' : 'text-green-600'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${!showOtp ? 'border-blue-600 bg-blue-600 text-white' : 'border-green-600 bg-green-600 text-white'
                                }`}>
                                1
                            </div>
                            <span className="text-sm font-medium">Credentials</span>
                        </div>
                        <div className="w-12 h-0.5 bg-gray-300"></div>
                        <div className={`flex items-center space-x-2 ${showOtp ? 'text-blue-600' : 'text-gray-400'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${showOtp ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                                }`}>
                                2
                            </div>
                            <span className="text-sm font-medium">Verification</span>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaqeemAuth;
