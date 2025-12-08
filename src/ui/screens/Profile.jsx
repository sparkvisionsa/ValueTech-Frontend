import React from 'react';
import { LogOut, Phone, User, Calendar } from 'lucide-react';
import { useSession } from '../context/SessionContext';

const Profile = ({ onViewChange }) => {
    const { user, logout } = useSession();

    const handleLogout = () => {
        logout();
        onViewChange('login');
    };

    if (!user) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600">No user session found. Please register or login.</p>
            </div>
        );
    }

    // Format date if available
    const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Profile Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
                    <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md">
                            <User className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">User Profile</h1>
                            <p className="text-blue-100">Account Information</p>
                        </div>
                    </div>
                </div>

                {/* Profile Content */}
                <div className="p-6 space-y-6">
                    {/* Phone Information */}
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                        <Phone className="w-6 h-6 text-blue-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">Phone Number</p>
                            <p className="text-lg font-semibold text-gray-900">{user.phone || 'Not provided'}</p>
                        </div>
                    </div>

                    {/* Account Type */}
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                        <User className="w-6 h-6 text-green-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">Account Type</p>
                            <p className="text-lg font-semibold text-gray-900 capitalize">
                                {user.type || 'Individual'}
                            </p>
                        </div>
                    </div>

                    {/* Member Since */}
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                        <Calendar className="w-6 h-6 text-purple-600" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">Member Since</p>
                            <p className="text-lg font-semibold text-gray-900">{createdAt}</p>
                        </div>
                    </div>

                    {/* User ID (if available) */}
                    {user._id && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-600 mb-1">User ID</p>
                            <p className="text-sm font-mono text-gray-700 break-all">{user._id}</p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex space-x-4">
                    <button
                        onClick={() => onViewChange('packages')}
                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                    >
                        View Packages
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium flex items-center justify-center space-x-2"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
