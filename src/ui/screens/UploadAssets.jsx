import React, { useState } from "react";
import { useRam } from "../context/RAMContext";
import { useNavStatus } from "../context/NavStatusContext";
import { useSession } from "../context/SessionContext";
import { ensureTaqeemAuthorized } from "../../shared/helper/taqeemAuthWrap";
import InsufficientPointsModal from "../components/InsufficientPointsModal";
import {
    Upload, AlertTriangle, Table, FileText, X, CheckCircle,
    Calendar, MapPin, User, CheckCircle2, Loader2, Download
} from "lucide-react";
import ReportsTable from "../components/ReportsTable";
import { downloadTemplateFile } from "../utils/templateDownload";

const UploadAssets = ({ onViewChange }) => {
    const [excelFileName, setExcelFileName] = useState(null);
    const [showInsufficientPointsModal, setShowInsufficientPointsModal] = useState(false);
    const [excelFilePath, setExcelFilePath] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [uploadLoading, setUploadLoading] = useState(false);
    const [reportId, setReportId] = useState("");
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);

    let { token, login } = useSession();
    const { taqeemStatus, setTaqeemStatus } = useNavStatus();


    // Common fields state
    const [inspectionDate, setInspectionDate] = useState("");
    const [region, setRegion] = useState("");
    const [city, setCity] = useState("");
    const [ownerName, setOwnerName] = useState("");
    const [availableCities, setAvailableCities] = useState([]);

    // Get RAM info from context
    const { ramInfo } = useRam();

    // Helper function to get tabs count from RAM info
    const getTabsCount = () => {
        return ramInfo?.recommendedTabs || 1;
    };

    // Updated table headings to match backend field names
    const tableHeadings = [
        'asset_name',
        'asset_usage_id',
        'market_approach',
        'market_approach_value',
        'cost_approach',
        'cost_approach_value',
        'region',
        'city',
        'inspection_date'
    ];

    // Saudi Arabia regions and cities data
    const saudiRegions = {
        "منطقة الرياض": ["الرياض", "الدرعية", "ضرما", "المزاحمية", "شقراء", "الدوادمي", "وادي الدواسر"],
        "مكة المكرمة": ["مكة المكرمة", "جدة", "الطائف", "القنفذة", "الليث", "رابغ"],
        "المدينة المنورة": ["المدينة المنورة", "ينبع", "العلا", "المهد", "الحناكية"],
        "القصيم": ["بريدة", "عنيزة", "الرس", "المذنب", "البكيرية", "البدائع"],
        "الشرقية": ["الدمام", "الخبر", "الأحساء", "الجبيل", "القطيف", "حفر الباطن"],
        "عسير": ["أبها", "خميس مشيط", "بيشة", "النماص", "ظهران الجنوب"],
        "تبوك": ["تبوك", "الوجه", "ضباء", "تيماء", "أملج"],
        "حائل": ["حائل", "بقعاء", "الغزالة", "الشنان"],
        "الحدود الشمالية": ["عرعر", "رفحاء", "طريف", "العويقيلة"],
        "جازان": ["جازان", "صبيا", "أبو عريش", "صامطة", "بيش", "الدرب"],
        "نجران": ["نجران", "شرورة", "حبونا", "بدر الجنوب"],
        "الباحة": ["الباحة", "بلجرشي", "المندق", "المخواة", "قلوة"],
        "الجوف": ["سكاكا", "القريات", "دومة الجندل", "طبرجل"]
    };

    const extractFileNameWithoutExtension = (filePath) => {
        if (!filePath) return "";
        const fullFileName = filePath.split(/[\\/]/).pop();
        const lastDotIndex = fullFileName.lastIndexOf('.');
        if (lastDotIndex === -1) return fullFileName;
        return fullFileName.substring(0, lastDotIndex);
    };

    const handleRegionChange = (selectedRegion) => {
        setRegion(selectedRegion);
        setCity("");

        if (selectedRegion && saudiRegions[selectedRegion]) {
            setAvailableCities(saudiRegions[selectedRegion]);
        } else {
            setAvailableCities([]);
        }
    };

    const openFileDialogAndExtract = async () => {
        try {
            setError("");
            setSuccess("");
            setPreviewData(null);
            setReportId("");

            const dlgResult = await window.electronAPI.showOpenDialog();

            if (!dlgResult) {
                return;
            }

            let filePath = null;

            if (typeof dlgResult === "string") {
                filePath = dlgResult;
            } else if (Array.isArray(dlgResult) && dlgResult.length > 0 && typeof dlgResult[0] === "string") {
                filePath = dlgResult[0];
            } else if (typeof dlgResult === "object") {
                if (Array.isArray(dlgResult.filePaths) && dlgResult.filePaths.length > 0 && typeof dlgResult.filePaths[0] === "string") {
                    filePath = dlgResult.filePaths[0];
                } else if (typeof dlgResult.path === "string") {
                    filePath = dlgResult.path;
                }
            }

            if (!filePath || typeof filePath !== "string") {
                setError("Unexpected result from file dialog. Please try again.");
                return;
            }

            setExcelFilePath(filePath);
            const name = filePath.split(/[\\/]/).pop();
            setExcelFileName(name);

            const extractedReportId = extractFileNameWithoutExtension(filePath);
            setReportId(extractedReportId);

            setPreviewLoading(true);
            console.log("[UploadAssets] calling extract-asset-data for", filePath);

            const result = await window.electronAPI.extractAssetData(filePath, { cleanup: false });

            console.log("[UploadAssets] extract-asset-data result:", result);

            const preview = result?.data ?? null;
            if (!preview) {
                setError("No preview data returned from extract-asset-data.");
                setPreviewData(null);
            } else {
                const processedData = processPreviewData(Array.isArray(preview) ? preview : [preview]);
                setPreviewData(processedData);
                const info = result?.info || {};
                setSuccess(`Successfully extracted ${processedData.length} records (${info.marketCount || 0} market approach, ${info.costCount || 0} cost approach)`);
            }
        } catch (err) {
            console.error("[UploadAssets] error extracting preview:", err);
            setError(err?.message || "Failed to extract preview via IPC");
            setPreviewData(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleDownloadTemplate = async () => {
        if (downloadingTemplate) return;
        setError("");
        setSuccess("");
        setDownloadingTemplate(true);
        try {
            await downloadTemplateFile("upload-assets-template.xlsx");
            setSuccess("Excel template downloaded successfully.");
        } catch (err) {
            const message = err?.message || "Failed to download Excel template. Please try again.";
            setError(
                message.includes("not found")
                    ? "Template file not found. Please contact administrator to ensure the template file exists in the public folder."
                    : message
            );
        } finally {
            setDownloadingTemplate(false);
        }
    };

    const processPreviewData = (data) => {
        if (!data || !Array.isArray(data)) return [];

        return data.map(item => {
            const processed = { ...item };

            if (processed.baseData !== undefined) {
                delete processed.baseData;
            }

            // Apply common fields if they're filled
            if (inspectionDate) {
                processed.inspection_date = inspectionDate;
            }
            if (region) {
                processed.region = region;
            }
            if (city) {
                processed.city = city;
            }
            if (ownerName) {
                processed.owner_name = ownerName;
            }

            const mappedData = {
                'asset_name': processed.asset_name || processed.assetName,
                'asset_usage_id': String(
                    processed.asset_usage_id ?? processed.assetUsageId ?? ""
                ),
                'market_approach': processed.market_approach || processed.marketApproach ||
                    (processed.approach_type === 'market' ? 'Market' : undefined),
                'market_approach_value': processed.market_approach_value || processed.marketApproachValue ||
                    (processed.approach_type === 'market' ? processed.final_value || processed.finalValue : undefined),
                'cost_approach': processed.cost_approach || processed.costApproach ||
                    (processed.approach_type === 'cost' ? 'Cost' : undefined),
                'cost_approach_value': processed.cost_approach_value || processed.costApproachValue ||
                    processed.cost_value || processed.costValue ||
                    (processed.approach_type === 'cost' ? processed.final_value || processed.finalValue : undefined),
                'region': processed.region || processed.Region || processed.location_region,
                'city': processed.city || processed.City || processed.location_city,
                'inspection_date': processed.inspection_date || processed.inspectionDate || processed.date,
                'asset_type': processed.asset_type || processed.assetType || '0',
                'production_capacity': processed.production_capacity || processed.productionCapacity || '0',
                'production_capacity_measuring_unit': processed.production_capacity_measuring_unit || processed.productionCapacityMeasuringUnit || '0',
                'product_type': processed.product_type || processed.productType || '0',
                'country': processed.country || processed.Country || 'المملكة العربية السعودية',
                'submitState': processed.submitState || 0,
                'final_value': processed.final_value || processed.finalValue,
                'owner_name': processed.owner_name || processed.ownerName || ownerName || undefined
            };

            Object.keys(mappedData).forEach(key => {
                if (mappedData[key] === undefined || mappedData[key] === null) {
                    delete mappedData[key];
                }
            });

            return mappedData;
        });
    };

    const updatePreviewWithCommonFields = () => {
        if (previewData) {
            const updatedData = processPreviewData(previewData);
            setPreviewData(updatedData);
        }
    };

    const handleCommonFieldChange = (field, value) => {
        switch (field) {
            case 'inspectionDate':
                setInspectionDate(value);
                break;
            case 'region':
                handleRegionChange(value);
                break;
            case 'city':
                setCity(value);
                break;
            case 'ownerName':
                setOwnerName(value);
                break;
        }

        setTimeout(() => {
            updatePreviewWithCommonFields();
        }, 0);
    };

    const handleUploadToDB = async () => {
        try {
            setError("");
            setSuccess("");
            setUploadLoading(true);

            if (!reportId.trim()) {
                setError("Report ID could not be extracted from file name. Please check the file name.");
                return;
            }

            if (!previewData || previewData.length === 0) {
                setError("No data to upload");
                return;
            }

            console.log("[UploadAssets] Uploading to backend:", {
                reportId,
                commonFields: { region, city, inspectionDate, ownerName },
                recordCount: previewData.length,
                data: previewData
            });

            const isTaqeemLoggedIn = taqeemStatus?.state === "success";
            const authStatus = await ensureTaqeemAuthorized(token, onViewChange, isTaqeemLoggedIn, previewData.length || 0, login, setTaqeemStatus);

            if (authStatus?.status === "INSUFFICIENT_POINTS") {
                setShowInsufficientPointsModal(true);
                return;
            }

            if (authStatus?.status === "LOGIN_REQUIRED") {
                return;
            }

            if (authStatus?.token) {
                token = authStatus.token
            }

            const result = await window.electronAPI.apiRequest(
                "POST",
                "/api/report/createReportWithCommonFields",
                {
                    reportId: reportId.trim(),
                    reportData: previewData,
                    commonFields: {
                        region: region || undefined,
                        city: city || undefined,
                        inspectionDate: inspectionDate || undefined,
                        ownerName: ownerName || undefined
                    }
                },
                {
                    Authorization: `Bearer ${token}`
                }
            );

            console.log("[UploadAssets] Upload response:", result);

            if (result.success) {
                const successMessage = `✅ Successfully created report "${reportId}" with ${previewData.length} assets`;

                const commonFieldsInfo = [];
                if (inspectionDate) commonFieldsInfo.push(`Inspection Date: ${inspectionDate}`);
                if (region) commonFieldsInfo.push(`Region: ${region}`);
                if (city) commonFieldsInfo.push(`City: ${city}`);
                if (ownerName) commonFieldsInfo.push(`Owner: ${ownerName}`);

                if (commonFieldsInfo.length > 0) {
                    setSuccess(`${successMessage}\n\nCommon fields applied:\n• ${commonFieldsInfo.join('\n• ')}`);
                } else {
                    setSuccess(successMessage);
                }

                try {
                    const tabsNum = getTabsCount();
                    console.log("[UploadAssets] Calling completeFlow for report:", reportId, "tabsNum:", tabsNum);
                    const flowResult = await window.electronAPI.completeFlow(reportId.trim(), tabsNum);
                    console.log("[UploadAssets] completeFlow result:", flowResult);

                    if (flowResult?.status === "SUCCESS") {
                        setSuccess(prev => prev + `\n\n✅ Flow completed successfully`);

                        const completedAssets = flowResult?.summary?.complete_macros
                        console.log("[UploadAssets] Completed assets:", flowResult?.summary?.complete_macros);
                        if (completedAssets) {
                            try {
                                await window.electronAPI.apiRequest(
                                    "PATCH",
                                    `/api/packages/deduct`,
                                    { amount: completedAssets },
                                    { Authorization: `Bearer ${token}` }
                                );

                                console.log("[UploadAssets] Deducting assets:", completedAssets);
                            } catch (err) {
                                console.error("[UploadAssets] Error deducting assets:", err);
                            }
                        }
                    }
                } catch (flowError) {
                    console.error("[UploadAssets] Error calling completeFlow:", flowError);
                }

            } else {
                setError(result.message || "Failed to create report");
            }

        } catch (err) {
            console.error("[UploadAssets] error uploading to DB:", err);
            setError(err?.message || "Failed to upload data to database");
        } finally {
            setUploadLoading(false);
        }
    };

    const removeFile = () => {
        setExcelFileName(null);
        setExcelFilePath(null);
        setPreviewData(null);
        setReportId("");
        setInspectionDate("");
        setRegion("");
        setCity("");
        setOwnerName("");
        setAvailableCities([]);
        setError("");
        setSuccess("");
    };

    const formatValue = (v) => {
        if (v === null || v === undefined || v === '-') return "-";
        if (typeof v === "boolean") return v ? "Yes" : "No";
        if (typeof v === "object") {
            if (v.value !== undefined) return formatValue(v.value);
            return JSON.stringify(v);
        }

        if (typeof v === "string" && /^\d+$/.test(v) && v.length > 3) {
            const num = parseInt(v);
            if (num > 1000) {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(num);
            }
        }

        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
            return new Date(v).toLocaleDateString();
        }

        return String(v);
    };

    const formatColumnName = (columnName) => {
        return columnName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    const PreviewTable = ({ data }) => {
        if (!data || data.length === 0) return (
            <div className="p-6 text-center text-slate-500 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <div className="text-sm font-medium">No preview data to display</div>
            </div>
        );

        const displayData = data.slice(0, 50);

        return (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-blue-600" />
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">Data Preview</h3>
                            <p className="text-[10px] text-slate-600">
                                Showing {displayData.length} of {data.length} records
                                {displayData.length < data.length && " (first 50 rows)"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="max-h-96 overflow-auto">
                    <table className="min-w-full text-xs">
                        <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0">
                            <tr>
                                {tableHeadings.map(column => (
                                    <th
                                        key={column}
                                        className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider border-r border-white/10 last:border-r-0"
                                    >
                                        {formatColumnName(column)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {displayData.map((row, rowIndex) => (
                                <tr
                                    key={rowIndex}
                                    className="hover:bg-blue-50/30 transition-colors"
                                >
                                    {tableHeadings.map(column => (
                                        <td
                                            key={column}
                                            className={`px-2 py-1.5 border-r border-slate-100 last:border-r-0 whitespace-nowrap ${(column === 'inspection_date' && inspectionDate) ||
                                                (column === 'region' && region) ||
                                                (column === 'city' && city)
                                                ? 'text-emerald-600 font-semibold'
                                                : 'text-slate-700'
                                                }`}
                                        >
                                            {formatValue(row[column])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-600">
                    <div className="flex justify-between items-center">
                        <span>Columns: <span className="font-semibold text-slate-800">{tableHeadings.length}</span></span>
                        <span>Total rows: <span className="font-semibold text-slate-800">{data.length}</span></span>
                    </div>
                </div>
            </div>
        );
    };

    // Check if upload should be enabled
    const isUploadEnabled = excelFileName && previewData && previewData.length > 0 && reportId.trim();

    return (
        <div className="relative p-3 space-y-3 page-animate overflow-x-hidden">
            {showInsufficientPointsModal && (
                <div className="fixed inset-0 z-[9999]">
                    {/* Modal positioned at top */}
                    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-full max-w-sm">
                        <InsufficientPointsModal
                            viewChange={onViewChange}
                            onClose={() => setShowInsufficientPointsModal(false)}
                        />
                    </div>
                </div>
            )}

            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-200/30 blur-3xl" />
                <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
                <div className="relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 py-3">
                    <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Asset Management
                        </p>
                        <h2 className="text-lg md:text-xl font-display text-compact text-slate-900 font-bold">
                            Upload Assets
                        </h2>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 shadow-sm font-medium">
                                <Table className="h-3 w-3 text-emerald-600" />
                                {getTabsCount()} tab{getTabsCount() !== 1 ? 's' : ''} auto
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={downloadingTemplate}
                            className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {downloadingTemplate ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Download className="w-3.5 h-3.5" />
                            )}
                            {downloadingTemplate ? "Downloading..." : "Export Excel Template"}
                        </button>
                        <button
                            onClick={handleUploadToDB}
                            disabled={!isUploadEnabled || uploadLoading}
                            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 text-white shadow-sm hover:shadow-md hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-sm"
                            title={!isUploadEnabled ? "Please select a file first" : ""}
                        >
                            {uploadLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4" />
                            )}
                            {uploadLoading ? "Uploading..." : "Upload & Submit"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Messages */}
            {(error || success) && (
                <div
                    className={`rounded-lg border px-3 py-2 flex items-start gap-2 shadow-sm card-animate ${error
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "bg-emerald-50 text-emerald-700 border-emerald-300"
                        }`}
                >
                    {error ? (
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="text-xs font-medium whitespace-pre-line">{error || success}</div>
                </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-12 gap-3">
                {/* Left Column - File Selection & Common Fields */}
                <div className="col-span-4 space-y-3">
                    {/* File Selection */}
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-800">File Selection</h3>
                            {excelFileName && (
                                <button
                                    onClick={removeFile}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                    Remove
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={openFileDialogAndExtract}
                                disabled={previewLoading}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {previewLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                )}
                                {previewLoading ? "Processing..." : "Select Excel File"}
                            </button>

                            {excelFileName ? (
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                        <span className="text-xs font-medium text-emerald-800 truncate">
                                            {excelFileName}
                                        </span>
                                    </div>
                                    {reportId && (
                                        <div className="mt-1 text-[10px] text-blue-700 font-medium">
                                            Report ID: {reportId}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 px-2 py-2 bg-slate-50 border border-slate-200 rounded-md text-center">
                                    No file selected
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Common Fields */}
                    {previewData && (
                        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
                            <h3 className="text-sm font-semibold text-slate-800 mb-2">Common Fields</h3>

                            <div className="space-y-2">
                                {/* Inspection Date */}
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                                        Inspection Date
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={inspectionDate}
                                            onChange={(e) => handleCommonFieldChange('inspectionDate', e.target.value)}
                                            max={getTodayDate()}
                                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Region & City */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                                            Region
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                                            <select
                                                value={region}
                                                onChange={(e) => handleCommonFieldChange('region', e.target.value)}
                                                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none bg-white cursor-pointer"
                                            >
                                                <option value="">Select Region</option>
                                                {Object.keys(saudiRegions).map(regionName => (
                                                    <option key={regionName} value={regionName}>
                                                        {regionName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                                            City
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                                            <select
                                                value={city}
                                                onChange={(e) => handleCommonFieldChange('city', e.target.value)}
                                                disabled={!region}
                                                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all appearance-none bg-white disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                <option value="">{region ? "Select City" : "Select region first"}</option>
                                                {availableCities.map(cityName => (
                                                    <option key={cityName} value={cityName}>
                                                        {cityName}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Owner Name */}
                                <div>
                                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                                        Owner Name
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={ownerName}
                                            onChange={(e) => handleCommonFieldChange('ownerName', e.target.value)}
                                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                            placeholder="Owner name (optional)"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Preview Table */}
                <div className="col-span-8">
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3 h-full">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-800">Data Preview</h3>
                            {previewData && (
                                <div className="text-xs text-slate-600 font-medium">
                                    {previewData.length} records
                                </div>
                            )}
                        </div>

                        {previewLoading ? (
                            <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <div className="text-slate-600">
                                    <div className="text-xs font-semibold">Extracting data...</div>
                                    <div className="text-[10px]">Processing your Excel file</div>
                                </div>
                            </div>
                        ) : previewData ? (
                            <PreviewTable data={previewData} />
                        ) : (
                            <div className="text-center p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                                <Table className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <div className="text-slate-500">
                                    <div className="text-xs font-semibold mb-1">No preview available</div>
                                    <div className="text-[10px]">Select an Excel file to see data preview</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reports Table Section */}
            <div className="mt-4">
                <ReportsTable />
            </div>
        </div>
    );
};

export default UploadAssets;
