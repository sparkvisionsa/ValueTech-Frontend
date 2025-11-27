import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Add this line
import Layout from './components/Layout';

import LoginForm from './screens/LoginForm';
import CheckBrowser from './screens/CheckBrowser';
import ValidateReport from './screens/ValidateReport';
import AssetCreate from './screens/AssetCreate';
import UploadExcel from './screens/UploadExcel';
import AddCommonFields from './screens/AddCommonFields';
import GrabMacroIds from './screens/GrabMacroIds';
import SubmitMacro from './screens/MacroEdits';
import DeleteReport from './screens/DeleteReport';


const App = () => {
    const [currentView, setCurrentView] = useState('login');

    const renderCurrentView = () => {
        switch (currentView) {
            case 'login':
                return <LoginForm />;

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

            default:
                return <LoginForm />;
        }
    };

    return (
        <Layout currentView={currentView} onViewChange={setCurrentView}>
            {renderCurrentView()}
        </Layout>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

export default App;