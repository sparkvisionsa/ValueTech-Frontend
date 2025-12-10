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
    User,
    MonitorDot,
    Wrench,
    Users,
    UploadCloud,
    Files
} from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { useSystemControl } from '../context/SystemControlContext';

const Sidebar = ({ currentView, onViewChange }) => {
    const { isAuthenticated, user, logout } = useSession();
    const { isFeatureBlocked } = useSystemControl();
    const isAdmin = user?.phone === '011111';
    const isCompanyHead = user?.type === 'company' || user?.role === 'company-head';
    const isMember = user?.role === 'member';
    const isCompanyLinked = !!user?.company && !isCompanyHead;
    const permissionSet = new Set(user?.permissions || []);

    const authMenuItems = [
        { id: 'taqeem-login', label: 'Taqeem Login ', icon: User },
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
        { id: 'upload-report-elrajhi', label: 'Upload Report Elrajhi', icon: UploadCloud },
        { id: 'duplicate-report', label: 'Duplicate report & send new', icon: Files },
    ];

    if (isCompanyHead) {
        authMenuItems.unshift({ id: 'company-members', label: 'Company Members', icon: Users });
    }

    if (isAdmin) {
        authMenuItems.push(
            { id: 'system-status', label: 'System Operating Status', icon: MonitorDot },
            { id: 'system-updates', label: 'System Updates', icon: Wrench }
        );
    }

    const publicMenuItems = [
        { id: 'registration', label: 'Registration', icon: UserPlus },
        { id: 'login', label: 'Login', icon: Lock },
    ];

    const filteredMenuItems = !isAuthenticated
        ? publicMenuItems
        : authMenuItems.filter((item) => {
            if (isCompanyHead || isAdmin) return true;
            const alwaysAllowed = new Set(['taqeem-login', 'profile']);

            // Members or company-linked accounts (non-head) are restricted to permissions
            if ((isMember || isCompanyLinked)) {
                if (permissionSet.size === 0) {
                    return alwaysAllowed.has(item.id);
                }
                return alwaysAllowed.has(item.id) || permissionSet.has(item.id);
            }

            // Standalone individuals get all features unless explicit permissions exist
            if (permissionSet.size === 0) return true;
            return alwaysAllowed.has(item.id) || permissionSet.has(item.id);
        });

    const menuItems = filteredMenuItems;

    return (
        <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b border-gray-700">
                <h1 className="text-xl font-bold text-white">🤖 AutoBot</h1>
                <p className="text-gray-400 text-sm mt-1">Automation Suite</p>
                {isAuthenticated && user && (
                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-blue-400 text-xs truncate">📱 {user.phone}</p>
                        <button
                            onClick={() => {
                                logout();
                                onViewChange('login');
                            }}
                            className="ml-2 text-xs text-red-200 hover:text-white border border-red-300 hover:border-white px-2 py-1 rounded"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <ul className="space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const blocked = isFeatureBlocked(item.id);
                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => !blocked && onViewChange(item.id)}
                                    disabled={blocked}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentView === item.id
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                        } ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
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
