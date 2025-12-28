import React, { useState } from 'react';
import {
    FolderPlus,
    FileSpreadsheet,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Info,
    Save,
    FolderOpen,
    ListTree,
    FileText,
    Calculator,
    Images,
    BadgeCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ValuationSystem = () => {
    const { t } = useTranslation();
    const [basePath, setBasePath] = useState('');
    const [folderName, setFolderName] = useState('');
    const [dataFileName, setDataFileName] = useState('');
    const [dataFilePath, setDataFilePath] = useState('');
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [loadingCalc, setLoadingCalc] = useState(false);
    const [loadingDocx, setLoadingDocx] = useState(false);
    const [loadingValueCalcs, setLoadingValueCalcs] = useState(false);
    const [loadingPreviewImages, setLoadingPreviewImages] = useState(false);
    const [loadingRegCerts, setLoadingRegCerts] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const chooseBaseFolder = async () => {
        if (!window?.electronAPI?.selectFolder) {
            setError(t('valuationSystem.errors.folderPickerUnavailable'));
            return;
        }
        try {
            const chosen = await window.electronAPI.selectFolder();
            const path = chosen?.folderPath || chosen?.filePaths?.[0];
            if (path) {
                setBasePath(path);
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.selectFolderFailed'));
        }
    };

    const chooseDataFile = async () => {
        if (!window?.electronAPI?.showOpenDialog) {
            setError(t('valuationSystem.errors.filePickerUnavailable'));
            return;
        }
        try {
            const res = await window.electronAPI.showOpenDialog();
            const path = res?.filePaths?.[0];
            if (path) {
                setDataFilePath(path);
                const parts = path.split(/[/\\]/);
                setDataFileName(parts[parts.length - 1] || 'Data.xlsx');
                setResult(null);
                setError('');
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.selectFileFailed'));
        }
    };

    const resetForm = () => {
        setBasePath('');
        setFolderName('');
        setDataFileName('');
        setDataFilePath('');
        setResult(null);
        setError('');
    };

    const handleCreateFolders = async () => {
        setError('');
        setResult(null);
        if (!basePath || !folderName || !dataFilePath) {
            setError(t('valuationSystem.errors.missingInputs'));
            return;
        }
        if (!window?.electronAPI?.createValuationFolders) {
            setError(t('valuationSystem.errors.serviceUnavailable'));
            return;
        }
        setLoadingFolders(true);
        try {
            const payload = { basePath, folderName, dataExcelPath: dataFilePath };
            const res = await window.electronAPI.createValuationFolders(payload);
            if (res?.ok) {
                setResult(res);
            } else {
                setError(res?.error || t('valuationSystem.errors.createFoldersFailed'));
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.createFoldersFailed'));
        } finally {
            setLoadingFolders(false);
        }
    };

    const handleUpdateCalc = async () => {
        setError('');
        setResult(null);
        if (!basePath || !folderName || !dataFilePath) {
            setError(t('valuationSystem.errors.missingInputs'));
            return;
        }
        if (!window?.electronAPI?.updateValuationCalc) {
            setError(t('valuationSystem.errors.serviceUnavailable'));
            return;
        }
        setLoadingCalc(true);
        try {
            const payload = { basePath, folderName, dataExcelPath: dataFilePath };
            const res = await window.electronAPI.updateValuationCalc(payload);
            if (res?.ok) {
                setResult(res);
            } else {
                setError(res?.error || t('valuationSystem.errors.updateCalcFailed'));
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.updateCalcFailed'));
        } finally {
            setLoadingCalc(false);
        }
    };

    const handleCreateDocx = async () => {
        setError('');
        setResult(null);
        if (!basePath || !folderName) {
            setError(t('valuationSystem.errors.missingBase'));
            return;
        }
        if (!window?.electronAPI?.createValuationDocx) {
            setError(t('valuationSystem.errors.serviceUnavailable'));
            return;
        }
        setLoadingDocx(true);
        try {
            const payload = { basePath, folderName };
            const res = await window.electronAPI.createValuationDocx(payload);
            if (res?.ok) {
                setResult(res);
            } else {
                setError(res?.error || t('valuationSystem.errors.createDocxFailed'));
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.createDocxFailed'));
        } finally {
            setLoadingDocx(false);
        }
    };

    const handleValueCalcs = async () => {
        setError('');
        setResult(null);
        if (!basePath || !folderName) {
            setError(t('valuationSystem.errors.missingBase'));
            return;
        }
        if (!window?.electronAPI?.generateValuationValueCalcs) {
            setError(t('valuationSystem.errors.serviceUnavailable'));
            return;
        }
        setLoadingValueCalcs(true);
        try {
            const payload = { basePath, folderName };
            const res = await window.electronAPI.generateValuationValueCalcs(payload);
            if (res?.ok) {
                setResult(res);
            } else {
                setError(res?.error || t('valuationSystem.errors.valueCalcsFailed'));
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.valueCalcsFailed'));
        } finally {
            setLoadingValueCalcs(false);
        }
    };

    const handleAppendPreviewImages = async () => {
        setError('');
        setResult(null);
        if (!basePath || !folderName) {
            setError(t('valuationSystem.errors.missingBase'));
            return;
        }
        if (!window?.electronAPI?.appendValuationPreviewImages) {
            setError(t('valuationSystem.errors.serviceUnavailable'));
            return;
        }
        setLoadingPreviewImages(true);
        try {
            const payload = { basePath, folderName };
            const res = await window.electronAPI.appendValuationPreviewImages(payload);
            if (res?.ok) {
                setResult(res);
            } else {
                setError(res?.error || t('valuationSystem.errors.previewImagesFailed'));
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.previewImagesFailed'));
        } finally {
            setLoadingPreviewImages(false);
        }
    };

    const handleAppendRegistrationCertificates = async () => {
        setError('');
        setResult(null);
        if (!basePath || !folderName) {
            setError(t('valuationSystem.errors.missingBase'));
            return;
        }
        if (!window?.electronAPI?.appendValuationRegistrationCertificates) {
            setError(t('valuationSystem.errors.serviceUnavailable'));
            return;
        }
        setLoadingRegCerts(true);
        try {
            const payload = { basePath, folderName };
            const res = await window.electronAPI.appendValuationRegistrationCertificates(payload);
            if (res?.ok) {
                setResult(res);
            } else {
                setError(res?.error || t('valuationSystem.errors.registrationCertsFailed'));
            }
        } catch (err) {
            setError(err?.message || t('valuationSystem.errors.registrationCertsFailed'));
        } finally {
            setLoadingRegCerts(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <ListTree className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">{t('valuationSystem.title')}</p>
                    <p className="text-sm text-gray-600">{t('valuationSystem.description')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t('valuationSystem.base.title')}</h3>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">{t('valuationSystem.base.pathLabel')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={basePath}
                                onChange={(e) => setBasePath(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder={t('valuationSystem.base.pathPlaceholder')}
                                dir="auto"
                            />
                            <button
                                type="button"
                                onClick={chooseBaseFolder}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
                            >
                                <FolderOpen className="w-4 h-4" />
                                {t('valuationSystem.actions.browse')}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">{t('valuationSystem.base.folderLabel')}</label>
                        <input
                            type="text"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder={t('valuationSystem.base.folderPlaceholder')}
                            dir="auto"
                        />
                    </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t('valuationSystem.data.title')}</h3>
                    </div>
                    <p className="text-xs text-gray-600">{t('valuationSystem.data.subtitle')}</p>
                    <button
                        type="button"
                        onClick={chooseDataFile}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition text-sm text-gray-800"
                    >
                        <span className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            {dataFileName || t('valuationSystem.data.select')}
                        </span>
                        <span className="text-xs text-blue-600 font-semibold">{t('valuationSystem.actions.select')}</span>
                    </button>
                    {dataFilePath ? (
                        <p className="text-xs text-gray-500 break-all">
                            {t('valuationSystem.data.selectedPath', { path: dataFilePath })}
                        </p>
                    ) : (
                        <p className="text-xs text-red-600">{t('valuationSystem.data.missing')}</p>
                    )}
                    <div className="text-xs text-gray-600 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        {t('valuationSystem.data.note')}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleCreateFolders}
                    disabled={loadingFolders}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                    {loadingFolders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('valuationSystem.actions.createFolders')}
                </button>
                <button
                    type="button"
                    onClick={handleUpdateCalc}
                    disabled={loadingCalc}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                    {loadingCalc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('valuationSystem.actions.updateCalc')}
                </button>
                <button
                    type="button"
                    onClick={handleCreateDocx}
                    disabled={loadingDocx}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                    {loadingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {t('valuationSystem.actions.createDocx')}
                </button>
                <button
                    type="button"
                    onClick={handleValueCalcs}
                    disabled={loadingValueCalcs}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loadingValueCalcs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                    {t('valuationSystem.actions.generateValueCalcs')}
                </button>
                <button
                    type="button"
                    onClick={handleAppendPreviewImages}
                    disabled={loadingPreviewImages}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-50"
                >
                    {loadingPreviewImages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Images className="w-4 h-4" />}
                    {t('valuationSystem.actions.appendPreviewImages')}
                </button>
                <button
                    type="button"
                    onClick={handleAppendRegistrationCertificates}
                    disabled={loadingRegCerts}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50"
                >
                    {loadingRegCerts ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                    {t('valuationSystem.actions.appendRegistrationCerts')}
                </button>
                <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-gray-800 text-sm font-semibold hover:bg-slate-200"
                >
                    <RefreshCw className="w-4 h-4" />
                    {t('valuationSystem.actions.reset')}
                </button>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm inline-flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}

            {result?.ok && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">
                            {result.calcPath
                                ? t('valuationSystem.result.calcUpdated')
                                : t('valuationSystem.result.foldersCreated')}
                        </span>
                    </div>
                    <div className="text-sm text-emerald-900 space-y-1">
                        <p>
                            {t('valuationSystem.result.rootPath')}: <span className="font-mono break-all">{result.root}</span>
                        </p>
                        {result.created && (
                            <>
                                <p>
                                    {t('valuationSystem.result.createdFolders', { count: result.created?.mainFolders?.length || 0 })}
                                </p>
                                <p>{t('valuationSystem.result.locations', { count: result.created?.locations || 0 })}</p>
                                <p>{t('valuationSystem.result.plates', { count: result.created?.plates || 0 })}</p>
                            </>
                        )}
                        {result.calcPath && (
                            <p>
                                {t('valuationSystem.result.calcPath')}: <span className="font-mono break-all">{result.calcPath}</span>
                            </p>
                        )}
                        {typeof result.docsCreated === 'number' && (
                            <p>{t('valuationSystem.result.docsCreated', { count: result.docsCreated })}</p>
                        )}
                        {typeof result.processed === 'number' && (
                            <p>
                                {t('valuationSystem.result.valueCalcs', {
                                    processed: result.processed,
                                    skipped: result.skipped || 0
                                })}
                            </p>
                        )}
                        {typeof result.previewProcessed === 'number' && (
                            <p>
                                {t('valuationSystem.result.previewImages', {
                                    processed: result.previewProcessed,
                                    skipped: result.previewSkipped || 0
                                })}
                            </p>
                        )}
                        {typeof result.certProcessed === 'number' && (
                            <p>
                                {t('valuationSystem.result.registrationCerts', {
                                    processed: result.certProcessed,
                                    skipped: result.certSkipped || 0
                                })}
                            </p>
                        )}
                        {result.imagesDir && (
                            <p>
                                {t('valuationSystem.result.imagesDir')}: <span className="font-mono break-all">{result.imagesDir}</span>
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ValuationSystem;
