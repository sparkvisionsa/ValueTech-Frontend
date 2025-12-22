// Centralized navigation/link registry for the Value Tech experience.
// This keeps all view labels and groupings in one place so the sidebar, layout,
// and the new Apps hub stay in sync.
const valueSystemGroups = {
    evaluationSources: {
        id: 'evaluationSources',
        title: 'Evaluation Sources',
        tabs: [
            { id: 'word-copy', label: 'نسخ ملف وورد', description: 'إنشاء نسخ متعددة من ملفات الوورد مع خيارات التسمية والإرفاق.' },
            { id: 'valuation-system', label: 'نظام التقييم', description: 'تشغيل مسار نظام التقييم وإعداد ملفات البيانات والمخرجات.' }
        ]
    },
    uploadReports: {
        id: 'uploadReports',
        title: 'Upload Reports',
        tabs: [
            { id: 'upload-report-elrajhi', label: 'Upload Report Elrajhi', description: 'رفع تقارير الراجحي مباشرة للنظام.' },
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
    }
];

const viewTitles = {
    apps: 'Apps',
    'upload-report-elrajhi': 'Upload Report Elrajhi',
    'duplicate-report': 'Duplicate report & send new',
    'multi-excel-upload': 'Multi-Excel Upload',
    'manual-multi-report': 'نسخ بيانات الأكسيل للتقارير',
    'macro-edit': 'Edit Macro',
    'grab-macro-ids': 'Grab Macro IDs',
    'common-fields': 'Add Common Fields',
    'upload-excel': 'Upload Excel',
    'asset-create': 'Create Asset',
    'validate-report': 'Validate Report',
    'taqeem-login': 'Taqeem Login',
    'get-companies': 'Get Companies',
    'check-status': 'Check Browser',
    profile: 'Profile',
    packages: 'Packages',
    'valuation-system': 'نظام التقييم',
    'word-copy': 'نسخ ملف وورد',
    'delete-report': 'Delete Report',
    'system-status': 'System Operating Status',
    'system-updates': 'System Updates',
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
