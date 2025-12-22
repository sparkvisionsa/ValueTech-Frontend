import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, FileText, FolderOpen, Hash, Image, Loader2, Play } from 'lucide-react';

const WordCopy = () => {
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
            setError('أداة اختيار ملف وورد غير متاحة حالياً.');
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
                setError(res.error || 'تعذر اختيار ملف وورد.');
            }
        } catch (err) {
            setError(err?.message || 'تعذر اختيار ملف وورد.');
        }
    };

    const handlePickTargetDir = async () => {
        setError('');
        setResult(null);
        if (!window?.electronAPI?.selectFolder) {
            setError('أداة اختيار المجلد غير متاحة حالياً.');
            return;
        }
        try {
            const res = await window.electronAPI.selectFolder();
            const folderPath = res?.folderPath || res?.filePaths?.[0];
            if (folderPath) {
                setTargetDir(folderPath);
            } else {
                setError('لم يتم اختيار مجلد حفظ.');
            }
        } catch (err) {
            setError(err?.message || 'تعذر اختيار مجلد الحفظ.');
        }
    };

    const handlePickImages = async () => {
        setError('');
        setResult(null);
        if (!window?.electronAPI?.showOpenDialogImages) {
            setError('Image picker is not available right now.');
            return;
        }
        try {
            const res = await window.electronAPI.showOpenDialogImages();
            if (res?.status === 'SUCCESS' && Array.isArray(res?.filePaths)) {
                setImages(res.filePaths || []);
            } else if (res?.error) {
                setError(res.error || 'تعذر اختيار الصور.');
            }
        } catch (err) {
            setError(err?.message || 'تعذر اختيار الصور.');
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
            setError('يرجى اختيار ملف وورد ومجلد الحفظ أولاً.');
            return;
        }
        if (!Number.isInteger(count) || count <= 0) {
            setError('عدد النسخ يجب أن يكون رقماً صحيحاً أكبر من صفر.');
            return;
        }
        if (!window?.electronAPI?.copyWordFile) {
            setError('أداة نسخ ملفات الوورد غير متاحة في هذا الإصدار.');
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
                setError(res?.error || 'فشل إنشاء نسخ الوورد.');
            }
        } catch (err) {
            setError(err?.message || 'فشل إنشاء نسخ الوورد.');
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
                    <p className="text-lg font-bold text-gray-900">نسخ ملف وورد</p>
                    <p className="text-sm text-gray-600">
                        اختر ملف وورد، ثم حدد مجلد الحفظ وعدد النسخ المطلوبة. سيتم إنشاء ملفات وورد جديدة بنفس العدد داخل المجلد الذي تختاره.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">اختيار ملف وورد</h3>
                    </div>
                    <p className="text-xs text-gray-600">ملف المصدر الذي سيتم نسخه.</p>
                    <button
                        type="button"
                        onClick={handlePickWordFile}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition text-sm text-gray-800"
                    >
                        <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            {wordPath ? extractBaseName(wordPath) : 'اختر ملف وورد'}
                        </span>
                        <span className="text-xs text-blue-600 font-semibold">تغيير</span>
                    </button>
                    {wordPath && <p className="text-xs text-gray-500 break-all">المسار: {wordPath}</p>}
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-gray-900">مجلد الحفظ</h3>
                    </div>
                    <p className="text-xs text-gray-600">المكان الذي ستُحفظ فيه النسخ.</p>
                    <button
                        type="button"
                        onClick={handlePickTargetDir}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition text-sm text-gray-800"
                    >
                        <span className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-emerald-600" />
                            {targetDir ? targetDir : 'اختر مجلد الحفظ'}
                        </span>
                        <span className="text-xs text-blue-600 font-semibold">تغيير</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Hash className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-semibold text-gray-900">عدد النسخ</h3>
                    </div>
                    <input
                        type="number"
                        min="1"
                        value={copies}
                        onChange={(e) => setCopies(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="أدخل عدد النسخ المطلوبة"
                    />
                </div>
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-semibold text-gray-900">اسم الملف</h3>
                    </div>
                    <input
                        type="text"
                        value={baseName}
                        onChange={(e) => setBaseName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="الاسم الأساسي للنسخ (اختياري)"
                    />
                    <p className="text-xs text-gray-500">سيتم ترقيم النسخ مثل: {`${baseName || 'Document'}-1.docx`}</p>
                </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                    <Image className="w-5 h-5 text-purple-600" />
                    <h3 className="text-sm font-semibold text-gray-900">إضافة صور للنسخ</h3>
                </div>
                <p className="text-xs text-gray-600">اختر صور ليتم إلحاقها في نهاية كل ملف يتم إنشاؤه.</p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handlePickImages}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm text-gray-800"
                    >
                        <Image className="w-4 h-4 text-purple-600" />
                        {images.length ? 'تحديث قائمة الصور' : 'اختيار صور'}
                    </button>
                    {images.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearImages}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-sm"
                        >
                            مسح الصور المختارة
                        </button>
                    )}
                </div>
                {images.length > 0 ? (
                    <div className="text-xs text-gray-700 space-y-1">
                        <p>سيتم إلحاق {images.length} صورة في الصفحة الأخيرة لكل نسخة.</p>
                        <div className="flex flex-wrap gap-1">
                            {images.slice(0, 4).map((img) => (
                                <span key={img} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md">
                                    {img.split(/[/\\]/).pop()}
                                </span>
                            ))}
                            {images.length > 4 && <span className="text-gray-500">+{images.length - 4} أخرى</span>}
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">اختياري: أضف صوراً ليتم وضعها في نهاية الملف المنسوخ.</p>
                )}
                <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                        type="checkbox"
                        checked={pageBreakBeforeImages}
                        onChange={(e) => setPageBreakBeforeImages(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>إضافة فاصل صفحة قبل الصور للتأكد من ظهورها في الصفحة الأخيرة</span>
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
                    إنشاء ملفات الوورد
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
                        <span className="font-semibold">تم إنشاء {result.createdCount} ملف وورد</span>
                    </div>
                    <div className="text-sm text-emerald-900 space-y-1">
                        <p>مجلد الحفظ: <span className="font-mono break-all">{result.targetDir}</span></p>
                        {typeof result.appendedImages === 'number' && result.appendedImages > 0 && (
                            <p className="text-xs text-emerald-800">
                                تم إلحاق {result.appendedImages} صورة عبر {result.appendedFiles || result.createdCount} ملف.
                            </p>
                        )}
                        {result.files?.length > 0 && (
                            <p className="text-xs text-emerald-800">
                                أمثلة على الملفات: {result.files.slice(0, 3).map((f) => f.split(/[/\\]/).pop()).join(', ')}
                                {result.files.length > 3 ? ` ... (+${result.files.length - 3})` : ''}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WordCopy;


