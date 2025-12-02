import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';

const Registration = ({ onViewChange }) => {
    const [step, setStep] = useState('welcome');
    const [userType, setUserType] = useState('');
    const [formData, setFormData] = useState({ phone: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useSession();

    const handleUserTypeSelect = (type) => {
        setUserType(type);
        if (type === 'individual') {
            setStep('form');
        } else {
            setError('Company registration not implemented yet. Please select Individual.');
        }
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
            const registrationData = {
                userType: userType,
                phone: formData.phone,
                password: formData.password
            };

            if (window.electronAPI && window.electronAPI.register) {
                const result = await window.electronAPI.register(registrationData);

                if (result.status === 'SUCCESS') {
                    // Login the user with the returned user data
                    if (result.data && result.data.user) {
                        login(result.data.user);
                        onViewChange('profile');
                    } else {
                        onViewChange('login');
                    }
                } else {
                    setError(result.error || 'Registration failed. Please try again.');
                }
            } else {
                setError('Electron API not available');
            }
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
            console.error('Registration error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (step === 'welcome') {
        return (
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to AutoBot</h2>
                    <p className="text-gray-600">Please select your account type to continue</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => handleUserTypeSelect('individual')}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                        <span>👤</span>
                        <span>Individual</span>
                    </button>

                    <button
                        onClick={() => handleUserTypeSelect('company')}
                        className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-200 flex items-center justify-center space-x-2"
                        disabled
                    >
                        <span>🏢</span>
                        <span>Company (Coming Soon)</span>
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
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Individual Registration</h2>
                <p className="text-gray-600">Please enter your details</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                    </label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your phone number"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                    </label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your password"
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
                    {loading ? 'Registering...' : 'Register'}
                </button>
            </form>

            <div className="mt-4 text-center">
                <button
                    onClick={() => setStep('welcome')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                >
                    ← Back to selection
                </button>
            </div>
        </div>
    );
};

export default Registration;
