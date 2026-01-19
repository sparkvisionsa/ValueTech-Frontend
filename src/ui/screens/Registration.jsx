import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { registerUser } from '../../api/auth';
import { useTranslation } from 'react-i18next';

const Registration = ({ onViewChange }) => {
    const [step, setStep] = useState('welcome');
    const [userType, setUserType] = useState('');
    const [formData, setFormData] = useState({
        phone: '',
        password: '',
        companyName: 'companyA',
        companyHead: '',
        taqeemUsername: ''  // New field
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useSession();
    const { t } = useTranslation();

    const handleUserTypeSelect = (type) => {
        setUserType(type);
        setError('');
        setStep('form');
    };

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (!userType) {
                setError(t('registration.errors.chooseAccountType'));
                setLoading(false);
                return;
            }
            const registrationData = {
                type: userType || 'individual',
                phone: formData.phone,
                password: formData.password,
            };

            if (userType === 'company') {
                registrationData.companyName = formData.companyName;
                registrationData.companyHead = formData.companyHead;
            }

            // Add Taqeem Username only if provided (optional)
            if (formData.taqeemUsername && formData.taqeemUsername.trim() !== '') {
                registrationData.taqeemUsername = formData.taqeemUsername.trim();
            }

            // CALL THE IMPORTED API FUNCTION
            const result = await registerUser(registrationData);

            // Normalize different result shapes (Axios response vs direct)
            // If using axios, registerUser likely returns response object with .data
            const res = result?.data ?? result;

            // Expecting { status: 'SUCCESS', data: { user, ... } } per your earlier examples
            const succeeded = res && (res.status === 'SUCCESS' || res.status === 'success' || res.success === true || res.message);
            if (succeeded) {
                const user = res.data?.user ?? res.user ?? res?.user ?? null;
                const token = res.data?.token ?? res.token;
                if (user) {
                    login(user, token);
                    // Stay inside the main app; do not auto-redirect to Taqeem login/get-companies
                    onViewChange('apps');
                } else {
                    onViewChange('login');
                }
            } else {
                // Prefer structured server error message if present
                const serverMessage = res?.error || res?.message || (res && JSON.stringify(res)) || t('registration.errors.failed');
                setError(serverMessage);
            }
        } catch (err) {
            // Handle axios-style errors and others
            const serverErrMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || t('registration.errors.failed');
            setError(serverErrMsg);
            console.error('Registration error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (step === 'welcome') {
        return (
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('registration.welcomeTitle')}</h2>
                    <p className="text-gray-600">{t('registration.welcomeSubtitle')}</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => handleUserTypeSelect('individual')}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                        <span>{t('registration.accountTypes.individual')}</span>
                    </button>

                    <button
                        onClick={() => handleUserTypeSelect('company')}
                        className="w-full bg-green-100 text-green-800 py-3 px-4 rounded-lg hover:bg-green-200 transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                        <span>{t('registration.accountTypes.company')}</span>
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {userType === 'company' ? t('registration.titles.company') : t('registration.titles.individual')}
                </h2>
                <p className="text-gray-600">
                    {userType === 'company'
                        ? t('registration.subtitles.company')
                        : t('registration.subtitles.individual')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {userType === 'company' && (
                    <>
                        <div>
                            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('registration.fields.companyName')}
                            </label>
                            <select
                                id="companyName"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {['companyA', 'companyB', 'companyC', 'companyD'].map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="companyHead" className="block text-sm font-medium text-gray-700 mb-1">
                                {t('registration.fields.companyHead')}
                            </label>
                            <input
                                type="text"
                                id="companyHead"
                                name="companyHead"
                                value={formData.companyHead}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={t('registration.placeholders.companyHead')}
                                dir="auto"
                                required
                            />
                        </div>
                    </>
                )}

                {/* New Taqeem Username Field - Optional */}
                <div>
                    <label htmlFor="taqeemUsername" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('registration.fields.taqeemUsername')} <span className="text-gray-500 text-xs">({t('registration.optional')})</span>
                    </label>
                    <input
                        type="text"
                        id="taqeemUsername"
                        name="taqeemUsername"
                        value={formData.taqeemUsername}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('registration.placeholders.taqeemUsername')}
                        dir="auto"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        {t('registration.taqeemUsernameHelp')}
                    </p>
                </div>

                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('registration.fields.phone')}
                    </label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('registration.placeholders.phone')}
                        dir="auto"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('registration.fields.password')}
                    </label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('registration.placeholders.password')}
                        required
                    />
                </div>

                {error && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                    {loading ? t('registration.actions.registering') : t('registration.actions.register')}
                </button>
            </form>

            <div className="mt-4 text-center">
                <button
                    onClick={() => setStep('welcome')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                >
                    {t('registration.actions.back')}
                </button>
            </div>
        </div>
    );
};

export default Registration;
