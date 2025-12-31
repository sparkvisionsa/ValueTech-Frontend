// Centralized navigation/link registry for the Value Tech experience.
// This keeps all view labels and groupings in one place so the sidebar, layout,
// and the new Apps hub stay in sync.
const valueSystemGroups = {
    evaluationSources: {
        id: 'evaluationSources',
        title: 'Evaluation Sources',
        tabs: [
            {
                id: 'word-copy',
                label: 'Word Copy',
                description: 'Duplicate Word report templates, optionally append images, and generate batch outputs.'
            },
            {
                id: 'valuation-system',
                label: 'Valuation System',
                description: 'Create valuation folders, calculations, and report files from the valuation system.'
            }
        ]
    },
    uploadReports: {
        id: 'uploadReports',
        title: 'Upload Reports',
        tabs: [
            {
                id: 'upload-report-elrajhi',
                label: 'Upload Report (El Rajhi)',
                description: 'Upload El Rajhi reports, validate data, and process batches.'
            },
            {
                id: 'download-certificate',
                label: 'Download certificate with ID',
                description: 'Download a registration certificate by report ID.'
            },
            {
                id: 'duplicate-report',
                label: 'Duplicate report & send new',
                description: 'Duplicate existing reports, update data, and send a fresh submission.'
            },
            {
                id: 'multi-excel-upload',
                label: 'Multi-Excel Upload',
                description: 'Upload multiple Excel files and create reports in bulk.'
            },
            {
                id: 'manual-multi-report',
                label: 'Manual Multi-Report Upload',
                description: 'Upload multiple reports manually for bulk processing.'
            },
            {
                id: 'upload-assets',
                label: 'Upload Assets',
                description: 'Upload asset files and attach them to existing reports.'
            }
        ]
    },
    uploadSingleReport: {
        id: 'uploadSingleReport',
        title: 'Upload Single Report',
        tabs: [
            { id: 'macro-edit', label: 'Edit Macro', description: 'Edit macro values and update report fields.' },
            { id: 'grab-macro-ids', label: 'Grab Macro IDs', description: 'Fetch macro IDs from reports for processing.' },
            { id: 'common-fields', label: 'Add Common Fields', description: 'Add shared fields to a report in one step.' },
            { id: 'upload-excel', label: 'Upload Excel', description: 'Upload a single Excel report file.' },
            { id: 'asset-create', label: 'Create Asset', description: 'Create report assets from uploaded data.' },
            { id: 'validate-report', label: 'Validate Report', description: 'Validate report data before submission.' }
        ]
    },
    taqeemInfo: {
        id: 'taqeemInfo',
        title: 'Taqeem Info',
        tabs: [
            { id: 'taqeem-login', label: 'Taqeem Login', description: 'Authenticate and connect to the Taqeem system.' },
            { id: 'get-companies', label: 'Get Companies', description: 'Fetch and sync your companies from Taqeem.' },
            { id: 'check-status', label: 'Check Browser', description: 'Check the browser status for Taqeem automation.' }
        ]
    },
    companyConsole: {
        id: 'companyConsole',
        title: 'Company Dashboard',
        tabs: [
            { id: 'company-members', label: 'Company Members', description: 'Manage team accounts and permissions.' },
            { id: 'company-statics', label: 'Company Statics', description: 'Track user and report activity for your company.' }
        ]
    },
    settings: {
        id: 'settings',
        title: 'Settings',
        tabs: [
            { id: 'profile', label: 'Profile', description: 'Manage your profile, password, and account details.' },
            { id: 'packages', label: 'Packages', description: 'Review and manage packages and subscriptions.' }
        ]
    },
    deleteReport: {
        id: 'deleteReport',
        title: 'Delete Report',
        tabs: [
            { id: 'delete-report', label: 'Delete Report', description: 'Delete reports and related assets safely.' }
        ]
    },
    adminConsole: {
        id: 'adminConsole',
        title: 'Super Admin Console',
        tabs: [
            { id: 'system-status', label: 'System Operating Status', description: 'Monitor and control system availability.' },
            { id: 'system-updates', label: 'System Updates', description: 'Publish and manage system update releases.' },
            { id: 'admin-packages', label: 'Packages', description: 'Manage packages and subscriptions.' },
            { id: 'statics', label: 'Statics', description: 'Review system-wide statistics and activity.' }
        ]
    }
};

const valueSystemCards = [
    {
        id: 'uploading-reports',
        title: 'Uploading Reports',
        description: 'Upload, validate, and manage valuation reports across domains.',
        groups: ['uploadReports', 'uploadSingleReport', 'taqeemInfo', 'settings', 'deleteReport']
    },
    {
        id: 'evaluation-sources',
        title: 'Evaluation Sources',
        description: 'Manage valuation sources, reports, and supporting tools.',
        groups: ['evaluationSources']
    },
    {
        id: 'company-console',
        title: 'Company Dashboard',
        description: 'Team members, access, and company statics in one hub.',
        groups: ['companyConsole'],
        defaultGroup: 'companyConsole'
    },
    {
        id: 'admin-console',
        title: 'Super Admin',
        description: 'System controls, updates, packages, and live statics in one command center.',
        groups: ['adminConsole'],
        defaultGroup: 'adminConsole'
    }
];

const viewTitles = {
    apps: 'Apps',
    'upload-report-elrajhi': 'Upload Report (El Rajhi)',
    'download-certificate': 'Download certificate with ID',
    'duplicate-report': 'Duplicate report & send new',
    'multi-excel-upload': 'Multi-Excel Upload',
    'manual-multi-report': 'Manual Multi-Report Upload',
    'macro-edit': 'Edit Macro',
    'grab-macro-ids': 'Grab Macro IDs',
    'common-fields': 'Add Common Fields',
    'upload-excel': 'Upload Excel',
    'asset-create': 'Create Asset',
    'validate-report': 'Validate Report',
    'taqeem-login': 'Taqeem Login',
    'get-companies': 'Get Companies',
    'check-status': 'Check Browser',
    'company-members': 'Company Members',
    'company-statics': 'Company Statics',
    profile: 'Profile',
    packages: 'Packages',
    'admin-packages': 'Packages',
    'valuation-system': 'Valuation System',
    'word-copy': 'Word Copy',
    'delete-report': 'Delete Report',
    'system-status': 'System Operating Status',
    'system-updates': 'System Updates',
    statics: 'Statics',
    'coming-soon': 'Coming Soon'
};

const allValueSystemViews = [
    ...Object.values(valueSystemGroups).flatMap((group) => group.tabs.map((tab) => tab.id))
];

const isValueSystemView = (viewId) => allValueSystemViews.includes(viewId);

// Helper maps to lookup group and tab metadata by tab id
const tabToGroup = allValueSystemViews.reduce((acc, tabId) => {
    const groupEntry = Object.values(valueSystemGroups).find((g) =>
        g.tabs.some((t) => t.id === tabId)
    );
    if (groupEntry) acc[tabId] = groupEntry.id;
    return acc;
}, {});

const findTabInfo = (tabId) => {
    for (const group of Object.values(valueSystemGroups)) {
        const tab = group.tabs.find((t) => t.id === tabId);
        if (tab) {
            return { groupId: group.id, groupTitle: group.title, tab };
        }
    }
    return null;
};

module.exports = {
    valueSystemGroups,
    valueSystemCards,
    viewTitles,
    allValueSystemViews,
    isValueSystemView,
    tabToGroup,
    findTabInfo
};
