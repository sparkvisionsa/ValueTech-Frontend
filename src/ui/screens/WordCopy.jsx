import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, FileText, FolderOpen, Hash, Image, Loader2, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WordCopy = () => {
    const { t } = useTranslation();
    const [wordPath, setWordPath] = useState('');
    const [targetDir, setTargetDir] = useState('');
    const [copies, setCopies] = useState(1);
    const [baseName, setBaseName] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [images, setImages] = useState([]);
    const [pageBreakBeforeImages, setPageBreakBeforeImages] = useState(true);

    const extractBaseName = (filePath) => {
        if (!filePath) return '';
        const parts = filePath.split(/[/\\]/);
        const file = parts[parts.length - 1] || '';
        return file.replace(/\.[^.]+$/, '');
    };

    const handlePickWordFile = async () => {
        setError('');
        setResult(null);
        if (!window?.electronAPI?.showOpenDialogWord) {
            setError(t('wordCopy.errors.wordPickerUnavailable'));
            return;
        }
        try {
            const res = await window.electronAPI.showOpenDialogWord();
            if (res?.status === 'SUCCESS' && res?.filePaths?.length) {
                const picked = res.filePaths[0];
                setWordPath(picked);
                if (!baseName) {
                    setBaseName(extractBaseName(picked));
                }
            } else if (res?.error) {
                setError(res.error || t('wordCopy.errors.wordPickFailed'));
            }
        } catch (err) {
            setError(err?.message || t('wordCopy.errors.wordPickFailed'));
        }
    };

    const handlePickTargetDir = async () => {
        setError('');
        setResult(null);
        if (!window?.electronAPI?.selectFolder) {
            setError(t('wordCopy.errors.folderPickerUnavailable'));
            return;
        }
        try {
            const res = await window.electronAPI.selectFolder();
            const folderPath = res?.folderPath || res?.filePaths?.[0];
            if (folderPath) {
                setTargetDir(folderPath);
            } else {
                setError(t('wordCopy.errors.noFolderSelected'));
            }
        } catch (err) {
            setError(err?.message || t('wordCopy.errors.folderPickFailed'));
        }
    };

    const handlePickImages = async () => {
        setError('');
        setResult(null);
        if (!window?.electronAPI?.showOpenDialogImages) {
            setError(t('wordCopy.errors.imagesPickerUnavailable'));
            return;
        }
        try {
            const res = await window.electronAPI.showOpenDialogImages();
            if (res?.status === 'SUCCESS' && Array.isArray(res?.filePaths)) {
                setImages(res.filePaths || []);
            } else if (res?.error) {
                setError(res.error || t('wordCopy.errors.imagesPickFailed'));
            }
        } catch (err) {
            setError(err?.message || t('wordCopy.errors.imagesPickFailed'));
        }
    };

    const handleClearImages = () => {
        setImages([]);
    };

    const handleCopyWordFile = async () => {
        setError('');
        setResult(null);
        const count = Number(copies);
        if (!wordPath || !targetDir) {
            setError(t('wordCopy.errors.missingSourceOrTarget'));
            return;
        }
        if (!Number.isInteger(count) || count <= 0) {
            setError(t('wordCopy.errors.invalidCopies'));
            return;
        }
        if (!window?.electronAPI?.copyWordFile) {
            setError(t('wordCopy.errors.copyNotAvailable'));
            return;
        }

        setLoading(true);
        try {
            const payload = {
                sourcePath: wordPath,
                targetDir,
                copies: count,
                baseName: baseName?.trim() || undefined,
                imagePaths: images,
                pageBreakBeforeImages
            };
            const res = await window.electronAPI.copyWordFile(payload);
            if (res?.ok) {
                setResult(res);
            } else {
                setError(res?.error || t('wordCopy.errors.copyFailed'));
            }
        } catch (err) {
            setError(err?.message || t('wordCopy.errors.copyFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <Copy className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-lg font-bold text-gray-900">{t('wordCopy.title')}</p>
                    <p className="text-sm text-gray-600">{t('wordCopy.description')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t('wordCopy.source.title')}</h3>
                    </div>
                    <p className="text-xs text-gray-600">{t('wordCopy.source.subtitle')}</p>
                    <button
                        type="button"
                        onClick={handlePickWordFile}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition text-sm text-gray-800"
                    >
                        <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            {wordPath ? extractBaseName(wordPath) : t('wordCopy.source.select')}
                        </span>
                        <span className="text-xs text-blue-600 font-semibold">{t('wordCopy.actions.browse')}</span>
                    </button>
                    {wordPath && <p className="text-xs text-gray-500 break-all">{t('wordCopy.source.selected', { path: wordPath })}</p>}
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t('wordCopy.destination.title')}</h3>
                    </div>
                    <p className="text-xs text-gray-600">{t('wordCopy.destination.subtitle')}</p>
                    <button
                        type="button"
                        onClick={handlePickTargetDir}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition text-sm text-gray-800"
                    >
                        <span className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-emerald-600" />
                            {targetDir ? targetDir : t('wordCopy.destination.select')}
                        </span>
                        <span className="text-xs text-blue-600 font-semibold">{t('wordCopy.actions.browse')}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Hash className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t('wordCopy.copies.title')}</h3>
                    </div>
                    <input
                        type="number"
                        min="1"
                        value={copies}
                        onChange={(e) => setCopies(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder={t('wordCopy.copies.placeholder')}
                        dir="auto"
                    />
                </div>
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t('wordCopy.baseName.title')}</h3>
                    </div>
                    <input
                        type="text"
                        value={baseName}
                        onChange={(e) => setBaseName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder={t('wordCopy.baseName.placeholder')}
                        dir="auto"
                    />
                    <p className="text-xs text-gray-500">
                        {t('wordCopy.baseName.example', { example: `${baseName || 'Document'}-1.docx` })}
                    </p>
                </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                    <Image className="w-5 h-5 text-purple-600" />
                    <h3 className="text-sm font-semibold text-gray-900">{t('wordCopy.images.title')}</h3>
                </div>
                <p className="text-xs text-gray-600">{t('wordCopy.images.subtitle')}</p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handlePickImages}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm text-gray-800"
                    >
                        <Image className="w-4 h-4 text-purple-600" />
                        {images.length ? t('wordCopy.images.selected') : t('wordCopy.images.select')}
                    </button>
                    {images.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearImages}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-sm"
                        >
                            {t('wordCopy.images.clear')}
                        </button>
                    )}
                </div>
                {images.length > 0 ? (
                    <div className="text-xs text-gray-700 space-y-1">
                        <p>{t('wordCopy.images.count', { count: images.length })}</p>
                        <div className="flex flex-wrap gap-1">
                            {images.slice(0, 4).map((img) => (
                                <span key={img} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md">
                                    {img.split(/[/\\]/).pop()}
                                </span>
                            ))}
                            {images.length > 4 && (
                                <span className="text-gray-500">{t('wordCopy.images.more', { count: images.length - 4 })}</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">{t('wordCopy.images.optional')}</p>
                )}
                <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                        type="checkbox"
                        checked={pageBreakBeforeImages}
                        onChange={(e) => setPageBreakBeforeImages(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{t('wordCopy.images.pageBreak')}</span>
                </label>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleCopyWordFile}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {t('wordCopy.actions.generate')}
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
                            {t('wordCopy.result.created', { count: result.createdCount })}
                        </span>
                    </div>
                    <div className="text-sm text-emerald-900 space-y-1">
                        <p>
                            {t('wordCopy.result.outputDir')}: <span className="font-mono break-all">{result.targetDir}</span>
                        </p>
                        {typeof result.appendedImages === 'number' && result.appendedImages > 0 && (
                            <p className="text-xs text-emerald-800">
                                {t('wordCopy.result.appendedImages', {
                                    images: result.appendedImages,
                                    files: result.appendedFiles || result.createdCount
                                })}
                            </p>
                        )}
                        {result.files?.length > 0 && (
                            <p className="text-xs text-emerald-800">
                                {(() => {
                                    const files = result.files.slice(0, 3).map((f) => f.split(/[/\\]/).pop()).join(', ');
                                    const moreCount = result.files.length > 3 ? result.files.length - 3 : 0;
                                    const moreLabel = moreCount > 0 ? t('wordCopy.result.more', { count: moreCount }) : '';
                                    return t('wordCopy.result.sampleFiles', { files, more: moreLabel });
                                })()}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WordCopy;
