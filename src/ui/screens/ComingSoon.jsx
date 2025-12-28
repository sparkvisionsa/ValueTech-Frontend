import React from 'react';
import { useTranslation } from 'react-i18next';

const ComingSoon = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-2xl mx-auto py-12">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 mb-4">
                    <span className="text-2xl font-bold">RE</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('comingSoon.title')}</h1>
                <p className="text-gray-600">{t('comingSoon.description')}</p>
            </div>
        </div>
    );
};

export default ComingSoon;
