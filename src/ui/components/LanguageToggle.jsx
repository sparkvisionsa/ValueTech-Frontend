import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LanguageToggle = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
    const isArabic = currentLang === 'ar';

    const setLanguage = (nextLang) => {
        if (!nextLang || nextLang === currentLang) return;
        console.info(`[i18n] User selected ${nextLang}`);
        i18n.changeLanguage(nextLang);
    };

    return (
        <div
            className="relative inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900/80 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.45)]"
            role="group"
            aria-label={t('common.language')}
        >
            <span
                className={`pointer-events-none absolute inset-y-1 left-1 w-1/2 rounded-full bg-cyan-600 shadow-[0_6px_14px_rgba(8,145,178,0.35)] transition-transform duration-300 ease-out ${isArabic ? 'translate-x-full' : 'translate-x-0'}`}
            />
            <span className="relative z-10 mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-cyan-200 shadow-[0_6px_14px_rgba(2,6,23,0.35)]">
                <Globe className="h-3.5 w-3.5" />
            </span>
            <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`relative z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${!isArabic
                    ? 'text-white'
                    : 'text-slate-300 hover:text-white'
                    }`}
                aria-pressed={!isArabic}
                title={t('common.english')}
            >
                {t('common.english')}
            </button>
            <button
                type="button"
                onClick={() => setLanguage('ar')}
                className={`relative z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${isArabic
                    ? 'text-white'
                    : 'text-slate-300 hover:text-white'
                    }`}
                aria-pressed={isArabic}
                title={t('common.arabic')}
            >
                {t('common.arabic')}
            </button>
        </div>
    );
};

export default LanguageToggle;
