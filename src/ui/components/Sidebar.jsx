import React from 'react';
import {
    UserPlus,
    Lock,
    Activity,
    Search,
    FolderPlus,
    FileSpreadsheet,
    ClipboardList,
    ListChecks,
    Edit3,
    CircleDot,
    CompassIcon,
    Package,
    CreditCard,
    User
} from 'lucide-react';
import { useSession } from '../context/SessionContext';

const Sidebar = ({ currentView, onViewChange }) => {
    const { isAuthenticated, user } = useSession();

    const authMenuItems = [
        { id: 'profile', label: 'My Profile', icon: User },
        { id: 'check-status', label: 'Check Browser', icon: Activity },
        { id: 'validate-report', label: 'Validate Report', icon: Search },
        { id: 'asset-create', label: 'Create Asset', icon: FolderPlus },
        { id: 'upload-excel', label: 'Upload Excel', icon: FileSpreadsheet },
        { id: 'common-fields', label: 'Add Common Fields', icon: ClipboardList },
        { id: 'grab-macro-ids', label: 'Grab Macro IDs', icon: ListChecks },
        { id: 'macro-edit', label: 'Edit Macro', icon: Edit3 },
        { id: 'delete-report', label: 'Delete Report', icon: CircleDot },
        { id: 'get-companies', label: 'Get Companies', icon: CompassIcon },
        { id: 'packages', label: 'Packages', icon: Package },
        { id: 'recharge-balance', label: 'Recharge Balance', icon: CreditCard },
        { id: 'taqeem-login', label: 'Recharge ', icon: CreditCard },

        
    ];

    const publicMenuItems = [
        { id: 'registration', label: 'Registration', icon: UserPlus },
        { id: 'login', label: 'Login', icon: Lock },
    ];

    const menuItems = isAuthenticated ? authMenuItems : publicMenuItems;

    return (
        <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b border-gray-700">
                <h1 className="text-xl font-bold text-white">🤖 AutoBot</h1>
                <p className="text-gray-400 text-sm mt-1">Automation Suite</p>
                {isAuthenticated && user && (
                    <p className="text-blue-400 text-xs mt-2 truncate">📱 {user.phone}</p>
                )}
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <ul className="space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => onViewChange(item.id)}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentView === item.id
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Footer/Status */}
            <div className="p-4 border-t border-gray-700">
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <CircleDot className="w-3 h-3 text-green-500" />
                    <span>System Online</span>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
