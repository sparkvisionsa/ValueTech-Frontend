import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Add this line
import Layout from './components/Layout';
import { SessionProvider, useSession } from './context/SessionContext';

import Registration from './screens/Registration';
import LoginForm from './screens/LoginForm';
import Profile from './screens/Profile';
import CheckBrowser from './screens/CheckBrowser';
import ValidateReport from './screens/ValidateReport';
import AssetCreate from './screens/AssetCreate';
import UploadExcel from './screens/UploadExcel';
import AddCommonFields from './screens/AddCommonFields';
import GrabMacroIds from './screens/GrabMacroIds';
import SubmitMacro from './screens/MacroEdits';
import DeleteReport from './screens/DeleteReport';
import GetCompanies from './screens/GetCompanies';
import Packages from './screens/Packages';
import RechargeBalance from './screens/RechargeBalance';
import TaqeemAuth from './screens/TaqeemAuth';
import UploadReportElrajhi from './screens/ElRajhiUploadReport';

const AppContent = () => {
    const [currentView, setCurrentView] = useState(null);
    const { isAuthenticated, isLoading } = useSession();

    // Choose initial page based on existing session
    useEffect(() => {
        if (!isLoading && currentView === null) {
            // If a session exists, resume at Taqeem login; otherwise go to app login
            setCurrentView(isAuthenticated ? 'taqeem-login' : 'login');
        }
    }, [isLoading, isAuthenticated, currentView]);

    if (currentView === null) {
        return null;
    }

    const renderCurrentView = () => {
        switch (currentView) {
            case 'registration':
                return <Registration onViewChange={setCurrentView} />;

            case 'profile':
                return <Profile onViewChange={setCurrentView} />;

            case 'login':
                return <LoginForm onViewChange={setCurrentView} />;

            case 'taqeem-login':
                return <TaqeemAuth onViewChange={setCurrentView} />

            case 'check-status':
                return <CheckBrowser />;

            case 'validate-report':
                return <ValidateReport />;

            case 'asset-create':
                return <AssetCreate />;

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
                return <GetCompanies />

            case 'packages':
                return <Packages onViewChange={setCurrentView} />;

            case 'recharge-balance':
                return <RechargeBalance />;

            case 'upload-report-elrajhi':
                return <UploadReportElrajhi />;

            default:
                return <LoginForm onViewChange={setCurrentView} />;
        }
    };

    return (
        <Layout currentView={currentView} onViewChange={setCurrentView}>
            {renderCurrentView()}
        </Layout>
    );
};

const App = () => {
    return (
        <SessionProvider>
            <AppContent />
        </SessionProvider>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

export default App;
