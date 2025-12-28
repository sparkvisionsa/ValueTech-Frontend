import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Add this line
import Layout from './components/Layout';
import { SessionProvider, useSession } from './context/SessionContext';
import { SystemControlProvider } from './context/SystemControlContext';
import { NavStatusProvider } from './context/NavStatusContext';
import { ElrajhiUploadProvider } from './context/ElrajhiUploadContext';

import Registration from './screens/Registration';
import LoginForm from './screens/LoginForm';
import Profile from './screens/Profile';
import CheckBrowser from './screens/CheckBrowser';
import ValidateReport from './screens/ValidateReport';
import CompanyMembers from './screens/CompanyMembers';
import CompanyStatics from './screens/CompanyStatics';
import AssetCreate from './screens/AssetCreate';
import UploadExcel from './screens/UploadExcel';
import AddCommonFields from './screens/AddCommonFields';
import GrabMacroIds from './screens/GrabMacroIds';
import SubmitMacro from './screens/MacroEdits';
import DeleteReport from './screens/DeleteReport';
import GetCompanies from './screens/GetCompanies';
import Packages from './screens/Packages';
import TaqeemAuth from './screens/TaqeemAuth';
import SystemOperatingStatus from './screens/SystemOperatingStatus';
import SystemUpdates from './screens/SystemUpdates';
import Statics from './screens/Statics';
import ElRajhiUploadReport from './screens/ElRajhiUploadReport';
import DuplicateReport from './screens/DuplicateReport';
import MultiExcelUpload from './screens/MultiExcelUpload';
import ManualMultiReport from './screens/ManualMultiReport';
import DownloadCertificate from './screens/DownloadCertificate';
import { RamProvider } from './context/RAMContext';
import ValuationSystem from './screens/ValuationSystem';
import WordCopy from './screens/WordCopy';
import Apps from './screens/Apps';
import { ValueNavProvider } from './context/ValueNavContext';
import ComingSoon from './screens/ComingSoon';
import { useValueNav } from './context/ValueNavContext';

const AppContent = () => {
    const [currentView, setCurrentView] = useState('apps');
    const [pendingProtectedView, setPendingProtectedView] = useState(null);
    const { isAuthenticated } = useSession();
    const { syncNavForView, setActiveTab } = useValueNav();

    const handleViewChange = (nextView) => {
        const protectedViews = ['taqeem-login', 'get-companies'];
        if (!isAuthenticated && protectedViews.includes(nextView)) {
            setPendingProtectedView(nextView);
            setCurrentView('registration');
            return;
        }
        if (syncNavForView) {
            syncNavForView(nextView);
        }
        if (!nextView || nextView === 'apps') {
            setActiveTab(null);
        }
        setCurrentView(nextView);
    };

    useEffect(() => {
        if (isAuthenticated && pendingProtectedView) {
            if (syncNavForView) {
                syncNavForView(pendingProtectedView);
            }
            setCurrentView(pendingProtectedView);
            setPendingProtectedView(null);
        }
    }, [isAuthenticated, pendingProtectedView, syncNavForView]);

    const renderCurrentView = () => {
        switch (currentView) {
            case 'apps':
                return <Apps onViewChange={handleViewChange} />;

            case 'registration':
                return <Registration onViewChange={handleViewChange} />;

            case 'profile':
                return <Profile onViewChange={handleViewChange} />;

            case 'login':
                return <LoginForm onViewChange={handleViewChange} />;

            case 'taqeem-login':
                return <TaqeemAuth onViewChange={handleViewChange} />

            case 'check-status':
                return <CheckBrowser />;

            case 'validate-report':
                return <ValidateReport />;

            case 'asset-create':
                return <AssetCreate />;

            case 'company-members':
                return <CompanyMembers />;

            case 'company-statics':
                return <CompanyStatics />;

            case 'upload-excel':
                return <UploadExcel />;

            case 'common-fields':
                return <AddCommonFields />;

            case 'grab-macro-ids':
                return <GrabMacroIds />;

            case 'macro-edit':
                return <SubmitMacro />;

            case 'delete-report':
                return <DeleteReport />;

            case 'get-companies':
                return <GetCompanies onViewChange={handleViewChange} />

            case 'packages':
                return <Packages />;

            case 'admin-packages':
                return <Packages />;

            case 'system-status':
                return <SystemOperatingStatus />;

            case 'system-updates':
                return <SystemUpdates />;

            case 'statics':
                return <Statics />;

            case 'upload-report-elrajhi':
                return <ElRajhiUploadReport />;

            case 'download-certificate':
                return <DownloadCertificate />;

            case 'duplicate-report':
                return <DuplicateReport />;

            case 'multi-excel-upload':
                return <MultiExcelUpload />;

            case 'manual-multi-report':
                return <ManualMultiReport />;

            case 'valuation-system':
                return <ValuationSystem />;

            case 'word-copy':
                return <WordCopy />;

            case 'coming-soon':
                return <ComingSoon />;

            default:
                return <Apps onViewChange={handleViewChange} />;
        }
    };

    return (
        <Layout currentView={currentView} onViewChange={handleViewChange}>
            {renderCurrentView()}
        </Layout>
    );
};

const App = () => {
    return (
        <SessionProvider>
            <SystemControlProvider>
                <NavStatusProvider>
                    <RamProvider>
                        <ElrajhiUploadProvider>
                            <ValueNavProvider>
                                <AppContent />
                            </ValueNavProvider>
                        </ElrajhiUploadProvider>
                    </RamProvider>
                </NavStatusProvider>
            </SystemControlProvider>
        </SessionProvider>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

export default App;
