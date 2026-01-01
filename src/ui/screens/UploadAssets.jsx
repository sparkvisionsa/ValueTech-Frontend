import React, { useState } from "react";
import { useRam } from "../context/RAMContext";
import { useSession } from "../context/SessionContext";
import {
    Upload,
    AlertTriangle,
    RefreshCw,
    Table,
    FileText,
    X,
    CheckCircle,
    Calendar,
    MapPin,
    User,
    Info
} from "lucide-react";
import ReportsTable from "../components/ReportsTable";

const UploadAssets = () => {
    const [excelFileName, setExcelFileName] = useState(null);
    const [excelFilePath, setExcelFilePath] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [uploadLoading, setUploadLoading] = useState(false);
    const [reportId, setReportId] = useState("");

    const { token } = useSession();

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

            // Call the new backend endpoint
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

                // Add common fields info if any were applied
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

                // ✅ NEW: Call completeFlow after successful upload
                try {
                    // Get the tabsNum from RAM context
                    const tabsNum = getTabsCount();

                    console.log("[UploadAssets] Calling completeFlow for report:", reportId, "tabsNum:", tabsNum);

                    const flowResult = await window.electronAPI.completeFlow(reportId.trim(), tabsNum);

                    console.log("[UploadAssets] completeFlow result:", flowResult);

                    if (flowResult?.success) {
                        setSuccess(prev =>
                            prev + `\n\n✅ Flow completed successfully`
                        );
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
            <div className="p-6 text-center text-gray-500 border-2 border-dashed rounded-lg">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <div>No preview data to display</div>
            </div>
        );

        const displayData = data.slice(0, 50);

        return (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <Table className="w-5 h-5 text-blue-600" />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Data Preview</h3>
                            <p className="text-sm text-gray-600">
                                Showing {displayData.length} of {data.length} records
                                {displayData.length < data.length && " (first 50 rows)"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleUploadToDB}
                        disabled={uploadLoading || !reportId.trim()}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                    >
                        {uploadLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle className="w-4 h-4" />
                        )}
                        {uploadLoading ? "Uploading..." : "Upload to Database and Submit to Taqeem"}
                    </button>
                </div>

                <div className="max-h-96 overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                {tableHeadings.map(column => (
                                    <th
                                        key={column}
                                        className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                                    >
                                        {formatColumnName(column)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {displayData.map((row, rowIndex) => (
                                <tr
                                    key={rowIndex}
                                    className="hover:bg-gray-50 transition-colors"
                                >
                                    {tableHeadings.map(column => (
                                        <td
                                            key={column}
                                            className={`px-3 py-2 text-sm border-r border-gray-100 last:border-r-0 whitespace-nowrap ${(column === 'inspection_date' && inspectionDate) ||
                                                (column === 'region' && region) ||
                                                (column === 'city' && city)
                                                ? 'text-green-600 font-semibold'
                                                : 'text-gray-900'
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

                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
                    <div className="flex justify-between items-center">
                        <span>Columns: {tableHeadings.length}</span>
                        <span>Total rows: {data.length}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-[95vw] mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <Table className="w-7 h-7" />
                            <h1 className="text-2xl font-bold">Upload Assets</h1>
                        </div>
                        <p className="text-blue-100 text-sm">
                            Upload Excel files and apply common fields
                        </p>
                    </div>

                    {/* Main Content - Side by Side Layout */}
                    <div className="p-4">
                        {/* Simple RAM Info Box */}
                        {ramInfo && (
                            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                    <Info className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm text-blue-700">
                                        Recommended tabs: <strong>{getTabsCount()}</strong>
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-12 gap-4">
                            {/* Left Column - File Selection & Common Fields */}
                            <div className="col-span-4 space-y-4">
                                {/* File Selection */}
                                <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-lg font-semibold text-gray-900">File Selection</h2>
                                        {excelFileName && (
                                            <button
                                                onClick={removeFile}
                                                className="text-red-600 hover:text-red-700 flex items-center gap-1 text-sm"
                                            >
                                                <X className="w-4 h-4" />
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <button
                                            onClick={openFileDialogAndExtract}
                                            disabled={previewLoading}
                                            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                                        >
                                            {previewLoading ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Upload className="w-4 h-4" />
                                            )}
                                            {previewLoading ? "Processing..." : "Select Excel File"}
                                        </button>

                                        {excelFileName ? (
                                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-green-600" />
                                                    <span className="text-sm font-medium text-green-800 truncate">
                                                        {excelFileName}
                                                    </span>
                                                </div>
                                                {reportId && (
                                                    <div className="mt-2 text-xs text-blue-700 font-medium">
                                                        Report ID: {reportId}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-500 p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                                No file selected
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Common Fields */}
                                {previewData && (
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Common Fields</h2>

                                        <div className="space-y-4">
                                            {/* Inspection Date */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Inspection Date
                                                </label>
                                                <div className="relative">
                                                    <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                    <input
                                                        type="date"
                                                        value={inspectionDate}
                                                        onChange={(e) => handleCommonFieldChange('inspectionDate', e.target.value)}
                                                        max={getTodayDate()}
                                                        className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Region & City */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Region
                                                    </label>
                                                    <div className="relative">
                                                        <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                        <select
                                                            value={region}
                                                            onChange={(e) => handleCommonFieldChange('region', e.target.value)}
                                                            className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
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
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        City
                                                    </label>
                                                    <div className="relative">
                                                        <MapPin className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                        <select
                                                            value={city}
                                                            onChange={(e) => handleCommonFieldChange('city', e.target.value)}
                                                            disabled={!region}
                                                            className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
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
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Owner Name
                                                </label>
                                                <div className="relative">
                                                    <User className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                    <input
                                                        type="text"
                                                        value={ownerName}
                                                        onChange={(e) => handleCommonFieldChange('ownerName', e.target.value)}
                                                        className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                                <div className="border border-gray-200 rounded-lg p-4 h-full">
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-lg font-semibold text-gray-900">Data Preview</h2>
                                        {previewData && (
                                            <div className="text-sm text-gray-600">
                                                {previewData.length} records
                                            </div>
                                        )}
                                    </div>

                                    {previewLoading ? (
                                        <div className="flex items-center justify-center gap-3 p-8">
                                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                                            <div className="text-gray-600">
                                                <div className="font-medium">Extracting data...</div>
                                                <div className="text-sm">Processing your Excel file</div>
                                            </div>
                                        </div>
                                    ) : previewData ? (
                                        <PreviewTable data={previewData} />
                                    ) : (
                                        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                                            <Table className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <div className="text-gray-500">
                                                <div className="font-medium mb-1">No preview available</div>
                                                <div className="text-sm">Select an Excel file to see data preview</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Status Messages */}
                        <div className="mt-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-red-700">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                </div>
                            )}

                            {success && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-green-700">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-sm whitespace-pre-line">{success}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reports Table Section - Added below the existing content */}
                <div className="mt-8">
                    <ReportsTable />
                </div>
            </div>
        </div>
    );
};

export default UploadAssets;