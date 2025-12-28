// Centralized navigation/link registry for the Value Tech experience.
// This keeps all view labels and groupings in one place so the sidebar, layout,
// and the new Apps hub stay in sync.
const valueSystemGroups = {
    evaluationSources: {
        id: 'evaluationSources',
        title: 'Evaluation Sources',
        tabs: [
            { id: 'word-copy', label: 'نسخ بيانات الأكسيل للتقرير', description: 'تحضير ونسخ بيانات التقرير من ملف إكسل بسهولة.' },
            { id: 'valuation-system', label: 'نظام التقييم', description: 'تشغيل مسار نظام التقييم وإعداد ملفات البيانات والمخرجات.' }
        ]
    },
    uploadReports: {
        id: 'uploadReports',
        title: 'Upload Reports',
        tabs: [
            { id: 'upload-report-elrajhi', label: 'Upload Report Elrajhi', description: 'رفع تقارير الراجحي مباشرة للنظام.' },
            { id: 'download-certificate', label: 'download certificate with id', description: 'Download a registration certificate by report ID.' },
            { id: 'duplicate-report', label: 'Duplicate report & send new', description: 'استنساخ تقرير وإرساله بنسخة جديدة.' },
            { id: 'multi-excel-upload', label: 'Multi-Excel Upload', description: 'تحميل دفعات متعددة من ملفات الإكسيل.' },
            { id: 'manual-multi-report', label: 'نسخ بيانات الأكسيل للتقارير', description: 'نسخ بيانات التقارير يدويًا من الإكسيل.' }
        ]
    },
    uploadSingleReport: {
        id: 'uploadSingleReport',
        title: 'Upload Single Report',
        tabs: [
            { id: 'macro-edit', label: 'Edit Macro', description: 'تحرير الماكروز قبل الرفع.' },
            { id: 'grab-macro-ids', label: 'Grab Macro IDs', description: 'التقاط معرفات الماكرو من التقارير.' },
            { id: 'common-fields', label: 'Add Common Fields', description: 'تهيئة الحقول الشائعة للتقارير.' },
            { id: 'upload-excel', label: 'Upload Excel', description: 'رفع ملف إكسيل واحد.' },
            { id: 'asset-create', label: 'Create Asset', description: 'إنشاء أصل جديد داخل التقرير.' },
            { id: 'validate-report', label: 'Validate Report', description: 'التحقق من صحة التقرير قبل الإرسال.' }
        ]
    },
    taqeemInfo: {
        id: 'taqeemInfo',
        title: 'Taqeem Info',
        tabs: [
            { id: 'taqeem-login', label: 'Taqeem Login', description: 'تسجيل الدخول لنظام تقييم.' },
            { id: 'get-companies', label: 'Get Companies', description: 'جلب الشركات المرتبطة بالحساب.' },
            { id: 'check-status', label: 'Check Browser', description: 'فحص المتصفح قبل إجراءات تقييم.' }
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
            { id: 'profile', label: 'Profile', description: 'إدارة الملف الشخصي للمستخدم.' },
            { id: 'packages', label: 'Packages', description: 'عرض وإدارة الباقات.' }
        ]
    },
    deleteReport: {
        id: 'deleteReport',
        title: 'Delete Report',
        tabs: [
            { id: 'delete-report', label: 'Delete Report', description: 'حذف تقرير محدد مع التحقق.' }
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
        title: 'Uploading reports',
        description: 'كل مسارات الرفع مجمعة مع الروابط الداعمة والمعلومات.',
        groups: ['uploadReports', 'uploadSingleReport', 'taqeemInfo', 'settings', 'deleteReport']
    },
    {
        id: 'evaluation-sources',
        title: 'Evaluation sources',
        description: 'مصادر إنشاء ملفات التقييم (وورد، نظام التقييم).',
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
    'upload-report-elrajhi': 'Upload Report Elrajhi',
    'download-certificate': 'download certificate with id',
    'duplicate-report': 'Duplicate report & send new',
    'multi-excel-upload': 'Multi-Excel Upload',
    'manual-multi-report': 'التقارير اليدوية المتعددة',
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
    'valuation-system': 'نظام التقييم',
    'word-copy': 'نسخ بيانات الأكسيل للتقرير',
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
