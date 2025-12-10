import React, { useState } from "react";
import axios from "axios";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { uploadElrajhiBatch } from "../../api/report";

import {
    FileSpreadsheet,
    Files,
    Loader2,
    Upload,
    CheckCircle2,
    AlertTriangle,
    File as FileIcon,
    RefreshCw,
    FolderOpen,
    Info,
    Send,
} from "lucide-react";

const TabButton = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${active
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
    >
        {children}
    </button>
);

const normalizeCellValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        if (value.text !== undefined) return value.text;
        if (Array.isArray(value.richText)) {
            return value.richText.map((t) => t.text || "").join("");
        }
        if (value.result !== undefined) return value.result;
        if (value.value !== undefined) return value.value;
    }
    return value;
};

const normalizeKey = (value) =>
    (value || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\W_]+/g, "");

const convertArabicDigits = (value) => {
    if (typeof value !== "string") return value;
    const map = {
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9",
    };
    return value.replace(/[٠-٩]/g, (d) => map[d] ?? d);
};

const detectValuerColumnsOrThrow = (exampleRow) => {
    const keys = Object.keys(exampleRow || {});
    const idKeys = [];
    const nameKeys = [];
    const pctKeys = [];

    const pushIfUnique = (arr, key) => {
        if (!arr.includes(key)) arr.push(key);
    };

    const extractIndex = (normalizedKey, base) => {
        const num = normalizedKey.slice(base.length).match(/^(\d+)/);
        return num ? Number(num[1]) : 0;
    };

    keys.forEach((originalKey) => {
        const normalized = normalizeKey(originalKey);

        const isIdKey =
            normalized.startsWith("valuerid") ||
            /^valuer\d+id/.test(normalized);
        const isNameKey =
            normalized.startsWith("valuername") ||
            /^valuer\d+name/.test(normalized);
        const isPctKey =
            normalized.startsWith("percentage") ||
            normalized.startsWith("percent") ||
            /^valuer\d+(percentage|percent)/.test(normalized);

        if (isIdKey) {
            pushIfUnique(idKeys, originalKey);
        } else if (isNameKey) {
            pushIfUnique(nameKeys, originalKey);
        } else if (isPctKey) {
            pushIfUnique(pctKeys, originalKey);
        }
    });

    const sortValuerKeys = (arr, base) =>
        arr.sort((a, b) => {
            const aIdx = extractIndex(normalizeKey(a), base);
            const bIdx = extractIndex(normalizeKey(b), base);
            return aIdx - bIdx || a.localeCompare(b);
        });

    sortValuerKeys(idKeys, "valuerid");
    sortValuerKeys(nameKeys, "valuername");
    sortValuerKeys(pctKeys, "percentage");

    const hasBaseName = nameKeys.length > 0;
    const hasBasePct = pctKeys.length > 0;

    if (!hasBaseName || !hasBasePct) {
        throw new Error(
            "Market sheet must contain headers 'valuerName' and 'percentage' (with optional 1, 2, etc.)."
        );
    }

    return { idKeys, nameKeys, pctKeys };
};

const buildValuersForAsset = (assetRow, valuerCols) => {
    const { idKeys, nameKeys, pctKeys } = valuerCols;
    const maxLen = Math.max(idKeys.length, nameKeys.length, pctKeys.length);
    const valuers = [];

    for (let i = 0; i < maxLen; i++) {
        const idKey = idKeys[i];
        const nameKey = nameKeys[i];
        const pctKey = pctKeys[i];

        const rawId = idKey ? assetRow[idKey] : null;
        const rawName = nameKey ? assetRow[nameKey] : null;
        const rawPct = pctKey ? assetRow[pctKey] : null;

        const allEmpty =
            (rawId === null || rawId === "" || rawId === undefined) &&
            (rawName === null || rawName === "" || rawName === undefined) &&
            (rawPct === null || rawPct === "" || rawPct === undefined);

        if (allEmpty) continue;

        let pctValue = normalizeCellValue(rawPct);
        if (typeof pctValue === "string") {
            pctValue = convertArabicDigits(pctValue)
                .replace(/[%٪]/g, "")
                .replace(/,/g, ".")
                .trim();
        }

        const hasPct =
            rawPct !== null &&
            rawPct !== undefined &&
            String(rawPct).toString().trim() !== "";

        if (!hasPct) {
            // Skip valuers that don't provide a percentage
            continue;
        }

        const pctNum = Number(pctValue);
        let percentage = 0;

        if (!Number.isNaN(pctNum)) {
            percentage = pctNum >= 0 && pctNum <= 1 ? pctNum * 100 : pctNum;
        } else {
            // Skip valuers with invalid/non-numeric percentages
            continue;
        }

        valuers.push({
            valuerId: rawId != null && rawId !== "" ? String(rawId) : "",
            valuerName: rawName != null ? String(rawName) : "",
            percentage,
        });
    }

    return valuers;
};

const worksheetToObjects = (worksheet) => {
    const headerRow = worksheet.getRow(1);
    const headerMap = [];
    const maxCol = worksheet.columnCount || (headerRow.values.length - 1);
    const headerCounts = {};

    const nextHeaderName = (rawHeader, fallback) => {
        const base = (String(rawHeader || fallback || "").trim()) || fallback;
        const count = (headerCounts[base] || 0) + 1;
        headerCounts[base] = count;
        return count === 1 ? base : `${base}_${count}`;
    };

    for (let col = 1; col <= maxCol; col++) {
        const header = String(
            normalizeCellValue(headerRow.getCell(col).value) || `col_${col}`
        )
            .trim() || `col_${col}`;
        headerMap[col] = nextHeaderName(header, `col_${col}`);
    }

    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};

        for (let col = 1; col < headerMap.length; col++) {
            const key = headerMap[col] || `col_${col}`;
            obj[key] = normalizeCellValue(row.getCell(col).value);
        }

        rows.push(obj);
    });

    return rows;
};

const UploadReportElrajhi = () => {
    const [activeTab, setActiveTab] = useState("no-validation");
    const [excelFile, setExcelFile] = useState(null);
    const [pdfFiles, setPdfFiles] = useState([]);
    const [batchId, setBatchId] = useState("");
    const [excelResult, setExcelResult] = useState(null);
    const [loadingExcel, setLoadingExcel] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [sendingTaqeem, setSendingTaqeem] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [validationFolderFiles, setValidationFolderFiles] = useState([]);
    const [validationExcelFile, setValidationExcelFile] = useState(null);
    const [validationPdfFiles, setValidationPdfFiles] = useState([]);
    const [validationReports, setValidationReports] = useState([]);
    const [marketAssets, setMarketAssets] = useState([]);
    const [validationMessage, setValidationMessage] = useState(null);
    const [savingValidation, setSavingValidation] = useState(false);
    const [sendingValidation, setSendingValidation] = useState(false);
    const [loadingValuers, setLoadingValuers] = useState(false);
    const [pdfOnlySending, setPdfOnlySending] = useState(false);

    // --- existing helpers (not used in new flow, but kept as requested) ---
    const uploadExcelOnly = async () => {
        throw new Error("uploadExcelOnly is deprecated in this flow.");
    };

    const handleSubmitElrajhi = async () => {
        try {
            setSendingValidation(true);
            setValidationMessage({
                type: "info",
                text: "Saving reports to database..."
            });

            if (!validationExcelFile) {
                throw new Error("Select a folder with Excel file before sending.");
            }
            // Upload to backend
            const data = await uploadElrajhiBatch(
                validationExcelFile,
                validationPdfFiles
            );

            console.log("ELRAJHI BATCH:", data);

            const batchIdFromData = data.batchId;
            const insertedCount = data.inserted || 0;

            // Update UI
            setValidationMessage({
                type: "success",
                text: `Reports saved (${insertedCount} assets). Sending to Taqeem...`
            });

            // Send to Electron with pdfOnly = false (send all)
            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromData, 1, false, true);

            if (electronResult?.status === "SUCCESS") {
                setValidationMessage({
                    type: "success",
                    text: `Upload succeeded. ${insertedCount} assets saved and sent to Taqeem browser.`
                });
            } else {
                setValidationMessage({
                    type: "error",
                    text: electronResult?.error || "Upload to Taqeem failed. Make sure you selected a company."
                });
            }
        } catch (err) {
            console.error("Upload failed", err);
            setValidationMessage({
                type: "error",
                text: err.message || "Failed to upload reports"
            });
        } finally {
            setSendingValidation(false);
        }
    };

    // New function for sending only reports with PDFs
    const handleSubmitPdfOnly = async () => {
        try {
            setPdfOnlySending(true);
            setValidationMessage({
                type: "info",
                text: "Saving PDF reports to database..."
            });

            if (!validationExcelFile) {
                throw new Error("Select a folder with Excel file before sending.");
            }
            // Upload to backend
            const data = await uploadElrajhiBatch(
                validationExcelFile,
                validationPdfFiles
            );

            console.log("ELRAJHI BATCH (PDF Only):", data);

            const batchIdFromData = data.batchId;
            const insertedCount = data.inserted || 0;

            // Filter reports to only include those with PDFs
            const pdfReports = validationReports.filter(report => report.pdf_name);
            const pdfCount = pdfReports.length;

            // Update UI
            setValidationMessage({
                type: "success",
                text: `PDF reports saved (${pdfCount} assets with PDFs). Sending to Taqeem...`
            });

            // Send to Electron with pdfOnly = true
            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromData, 1, true, true);

            if (electronResult?.status === "SUCCESS") {
                setValidationMessage({
                    type: "success",
                    text: `PDF-only upload succeeded. ${pdfCount} assets with PDFs sent to Taqeem browser.`
                });
            } else {
                setValidationMessage({
                    type: "error",
                    text: electronResult?.error || "PDF-only upload to Taqeem failed. Make sure you selected a company."
                });
            }
        } catch (err) {
            console.error("PDF-only upload failed", err);
            setValidationMessage({
                type: "error",
                text: err.message || "Failed to upload PDF reports"
            });
        } finally {
            setPdfOnlySending(false);
        }
    };

    const uploadPdfsOnly = async () => {
        throw new Error("uploadPdfsOnly is deprecated in this flow.");
    };

    const resetMessages = () => {
        setError("");
        setSuccess("");
    };

    const handleExcelChange = (e) => {
        resetMessages();
        const file = e.target.files?.[0];
        setExcelFile(file || null);
    };

    const handlePdfsChange = (e) => {
        resetMessages();
        const files = Array.from(e.target.files || []);
        setPdfFiles(files);
    };

    const parseExcelForValidation = async (excel, pdfList = [], options = {}) => {
        const { silent = false } = options;

        if (!excel) {
            setMarketAssets([]);
            setValidationReports([]);
            if (!silent) {
                setValidationMessage({
                    type: "error",
                    text: "Select an Excel file before saving.",
                });
            }
            return null;
        }

        if (!silent) resetValidationBanner();
        setLoadingValuers(true);
        try {
            const buffer = await excel.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const marketSheet = workbook.getWorksheet("market");
            if (!marketSheet) {
                throw new Error("Excel must include a sheet named 'market'.");
            }

            const marketRows = worksheetToObjects(marketSheet);
            if (!marketRows.length) {
                throw new Error("Sheet 'market' has no rows to read valuers from.");
            }

            const valuerCols = detectValuerColumnsOrThrow(marketRows[0]);

            const pdfMap = {};
            pdfList.forEach((file) => {
                const base = file.name.replace(/\.pdf$/i, "");
                pdfMap[normalizeKey(base)] = file.name;
            });

            const assets = [];
            const invalidTotals = [];

            for (let i = 0; i < marketRows.length; i++) {
                const row = marketRows[i];
                if (!row.asset_name) continue;

                const valuers = buildValuersForAsset(row, valuerCols);
                if (!valuers.length) {
                    throw new Error(
                        `Asset "${row.asset_name}" (row ${i + 2}) has no valuers.`
                    );
                }

                const total = valuers.reduce(
                    (sum, v) => sum + Number(v.percentage || 0),
                    0
                );
                const roundedTotal = Math.round(total * 100) / 100;

                if (Math.abs(roundedTotal - 100) > 0.001) {
                    invalidTotals.push({
                        assetName: row.asset_name,
                        rowNumber: i + 2,
                        total: roundedTotal,
                    });
                }

                const pdf_name = pdfMap[normalizeKey(row.asset_name)] || null;

                assets.push({
                    asset_name: row.asset_name,
                    client_name: row.client_name || row.owner_name || "",
                    pdf_name,
                    valuers,
                    totalPercentage: roundedTotal,
                });
            }

            if (!assets.length) {
                throw new Error("No assets with asset_name found in 'market' sheet.");
            }

            const reports = assets.map((asset, idx) => ({
                id: `${asset.asset_name}-${idx}`,
                asset_name: asset.asset_name,
                client_name: asset.client_name || "Pending client",
                pdf_name: asset.pdf_name,
                valuers: asset.valuers,
                totalPercentage: asset.totalPercentage,
            }));

            setMarketAssets(assets);
            setValidationReports(reports);

            const matchedCount = reports.filter((r) => !!r.pdf_name).length;

            if (!silent) {
                if (invalidTotals.length) {
                    const firstInvalid = invalidTotals[0];
                    setValidationMessage({
                        type: "error",
                        text: `Found ${invalidTotals.length} asset(s) with invalid totals. Example: Asset "${firstInvalid.assetName}" (row ${firstInvalid.rowNumber}) totals ${firstInvalid.total}%. Must be 100%.`,
                    });
                } else {
                    setValidationMessage({
                        type: "success",
                        text: `Loaded ${assets.length} asset(s). Matched ${matchedCount} PDF(s) by asset name.`,
                    });
                }
            }

            return { assets, matchedCount, invalidTotals };
        } catch (err) {
            setMarketAssets([]);
            setValidationReports([]);
            if (!silent) {
                setValidationMessage({
                    type: "error",
                    text: err.message || "Failed to read valuers from Excel.",
                });
            }
            return null;
        } finally {
            setLoadingValuers(false);
        }
    };

    const sendToTaqeem = async () => {
        try {
            resetMessages();
            setSendingTaqeem(true);

            // ---- Frontend validations ----
            if (!excelFile) {
                throw new Error("Please select an Excel file before sending.");
            }
            if (!pdfFiles.length) {
                throw new Error("Please select PDF files before sending.");
            }
            // ---- Build multipart/form-data ----
            const formData = new FormData();
            formData.append("excel", excelFile); // MUST be "excel"
            pdfFiles.forEach((file) => {
                formData.append("pdfs", file); // MUST be "pdfs"
            });

            // ---- Call our Node API: POST /api/upload ----
            const response = await axios.post(
                "http://localhost:3000/api/upload",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            const payloadFromApi = response.data; // { status, inserted, data: [...] }

            if (payloadFromApi.status !== "success") {
                throw new Error(
                    payloadFromApi.error || "Upload API returned non-success status."
                );
            }

            const insertedCount = payloadFromApi.inserted || 0;
            const docs = payloadFromApi.data || [];
            const batchIdFromApi = payloadFromApi.batchId || "urgent-upload";

            setBatchId(batchIdFromApi);
            setExcelResult({
                batchId: batchIdFromApi,
                reports: docs.map((d) => ({
                    asset_name: d.asset_name,
                    client_name: d.client_name,
                    path_pdf: d.pdf_path, // map pdf_path → path_pdf for UI
                })),
            });

            setSuccess(
                `Upload complete. Inserted ${insertedCount} urgent assets into DB. Now sending to Taqeem...`
            );

            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromApi, 1, false, false);

            if (electronResult?.status === "SUCCESS") {
                setSuccess(
                    `Upload succeeded. ${insertedCount} assets saved and sent to Taqeem browser.`
                );
            } else {
                const errMsg = electronResult?.error || "Upload to Taqeem failed. Make sure you selected a company.";
                setError(errMsg);
            }

        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err.message ||
                "Failed to send to Taqeem";
            setError(msg);
        } finally {
            setSendingTaqeem(false);
        }
    };

    const resetValidationBanner = () => setValidationMessage(null);

    const handleValidationFolderChange = (e) => {
        resetValidationBanner();
        const incomingFiles = Array.from(e.target.files || []);
        setValidationFolderFiles(incomingFiles);
        const excel = incomingFiles.find((file) => /\.(xlsx|xls)$/i.test(file.name));
        const pdfList = incomingFiles.filter((file) => /\.pdf$/i.test(file.name));
        setValidationExcelFile(excel || null);
        setValidationPdfFiles(pdfList);
    };

    const allAssetsTotalsValid = marketAssets.every(
        (a) => Math.abs((a.totalPercentage || 0) - 100) < 0.001
    );
    const canSendReports = marketAssets.length > 0 && allAssetsTotalsValid && !loadingValuers;
    const maxValuerSlots = Math.max(
        1,
        marketAssets.reduce(
            (max, asset) => Math.max(max, (asset.valuers || []).length),
            0
        )
    );

    const calculateAssetTotal = (asset) => {
        const total = (asset?.valuers || []).reduce(
            (sum, member) =>
                sum + Number(member.percentage ?? member.contribution ?? 0),
            0
        );
        return Math.round(total * 100) / 100;
    };

    const resetValidationSection = () => {
        setValidationFolderFiles([]);
        setValidationExcelFile(null);
        setValidationPdfFiles([]);
        setValidationReports([]);
        setValidationMessage(null);
        setMarketAssets([]);
    };

    const registerValidationFolder = async () => {
        resetValidationBanner();

        if (!validationFolderFiles.length) {
            setValidationMessage({
                type: "error",
                text: "Select a folder that includes Excel and PDF files.",
            });
            return;
        }
        if (!validationExcelFile) {
            setValidationMessage({
                type: "error",
                text: "The folder must include at least one Excel file for report info.",
            });
            return;
        }
        if (!validationPdfFiles.length) {
            setValidationMessage({
                type: "error",
                text: "Add at least one PDF in the folder to continue.",
            });
            return;
        }

        setSavingValidation(true);
        try {
            const parseResult = await parseExcelForValidation(
                validationExcelFile,
                validationPdfFiles,
                { silent: false }
            );

            if (!parseResult) return;

            const { assets, matchedCount } = parseResult;

            if (!assets.length) {
                setValidationMessage({
                    type: "error",
                    text: "No assets found in the Excel file.",
                });
                return;
            }

            const totalsValid = assets.every(
                (asset) => Math.abs((asset.totalPercentage || 0) - 100) < 0.001
            );

            if (!totalsValid) {
                setValidationMessage({
                    type: "error",
                    text: "Valuer percentages must total 100% for every asset before saving.",
                });
                return;
            }

            setValidationMessage({
                type: "success",
                text: `Folder staged. Found ${assets.length} asset(s) and ${validationPdfFiles.length} PDF(s). Matched ${matchedCount} PDF(s) by asset name.`,
            });
        } finally {
            setSavingValidation(false);
        }
    };

    const clearAll = () => {
        setExcelFile(null);
        setPdfFiles([]);
        setBatchId("");
        setExcelResult(null);
        resetMessages();
    };

    const noValidationContent = (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-800">
                            Upload Excel (Report Info + market)
                        </h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                        Only sheets "Report Info" and "market" are read. One report is
                        created per market row.
                    </p>
                    <label className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FolderOpen className="w-4 h-4" />
                            <span>{excelFile ? excelFile.name : "Choose Excel file"}</span>
                        </div>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleExcelChange}
                        />
                        <span className="text-xs text-blue-600">Browse</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                        Excel will be uploaded when you click &quot;Send to Taqeem&quot;.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={clearAll}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Files className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-800">
                            Upload PDFs (match by asset_name)
                        </h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                        Filenames should equal asset_name + ".pdf"
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                        Current Batch ID:{" "}
                        <span className="font-mono text-gray-800">{batchId || "—"}</span>
                    </p>
                    <label className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {pdfFiles.length
                                    ? `${pdfFiles.length} file(s) selected`
                                    : "Choose PDF files"}
                            </span>
                        </div>
                        <input
                            type="file"
                            multiple
                            accept=".pdf"
                            className="hidden"
                            onChange={handlePdfsChange}
                        />
                        <span className="text-xs text-blue-600">Browse</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                        PDFs will be uploaded when you click &quot;Send to Taqeem&quot;.
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button
                            onClick={() => {
                                setPdfFiles([]);
                                resetMessages();
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Clear PDFs
                        </button>
                    </div>
                </div>
            </div>

            {(error || success) && (
                <div
                    className={`rounded-lg p-3 flex items-start gap-2 ${error
                        ? "bg-red-50 text-red-700 border border-red-100"
                        : "bg-green-50 text-green-700 border border-green-100"
                        }`}
                >
                    {error ? (
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    )}
                    <div className="text-sm">{error || success}</div>
                </div>
            )}

            <div className="mt-3">
                <button
                    type="button"
                    onClick={sendToTaqeem}
                    disabled={sendingTaqeem || !excelFile || !pdfFiles.length}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                    {sendingTaqeem ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    Send to Taqeem
                </button>
                {/* Old message kept, though batch is now internal */}
                {!batchId && (
                    <p className="text-xs text-gray-500 mt-1">
                        Upload Excel and PDFs, then click &quot;Send to Taqeem&quot;.
                    </p>
                )}
            </div>

            {excelResult?.reports?.length ? (
                <div className="bg-white border rounded-lg shadow-sm">
                    <div className="px-4 py-3 border-b flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-800">
                                Created Reports
                            </p>
                            <p className="text-xs text-gray-500">
                                Batch: {excelResult.batchId}
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr className="text-left text-gray-600">
                                    <th className="px-4 py-2">#</th>
                                    <th className="px-4 py-2">Asset Name</th>
                                    <th className="px-4 py-2">Client Name</th>
                                    <th className="px-4 py-2">PDF Path</th>
                                </tr>
                            </thead>
                            <tbody>
                                {excelResult.reports.map((r, idx) => (
                                    <tr key={`${r.asset_name}-${idx}`} className="border-t">
                                        <td className="px-4 py-2 text-gray-700">{idx + 1}</td>
                                        <td className="px-4 py-2 text-gray-900 font-medium">
                                            {r.asset_name}
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">{r.client_name}</td>
                                        <td className="px-4 py-2 text-gray-600">
                                            {r.path_pdf ? (
                                                <span className="inline-flex items-center gap-1 text-green-700">
                                                    <FileIcon className="w-4 h-4" />
                                                    {r.pdf_path || r.path_pdf}

                                                </span>
                                            ) : (
                                                <span className="text-gray-400">Not uploaded</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    No results yet. Upload an Excel file to create reports.
                </div>
            )}
        </div>
    );

    const validationContent = (
        <div className="space-y-5">
            {validationMessage && (
                <div
                    className={`rounded-lg p-3 flex items-start gap-2 ${validationMessage.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-100"
                        : validationMessage.type === "success"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                        }`}
                >
                    {validationMessage.type === "error" ? (
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                    ) : validationMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    ) : (
                        <Info className="w-4 h-4 mt-0.5" />
                    )}
                    <div className="text-sm">{validationMessage.text}</div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-blue-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                Upload folder (Excel + PDFs)
                            </p>
                            <p className="text-xs text-gray-500">
                                Choose the folder that contains the Excel report file and all related PDFs.
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {validationFolderFiles.length
                                    ? `${validationFolderFiles.length} file(s) in folder`
                                    : "Pick a folder"}
                            </span>
                        </div>
                        <input
                            type="file"
                            multiple
                            webkitdirectory="true"
                            className="hidden"
                            onChange={handleValidationFolderChange}
                        />
                        <span className="text-xs text-blue-600">Browse</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div className="p-2 rounded bg-gray-50 border border-gray-100">
                            <p className="font-semibold text-gray-800">Excel detected</p>
                            <p>{validationExcelFile ? validationExcelFile.name : "—"}</p>
                        </div>
                        <div className="p-2 rounded bg-gray-50 border border-gray-100">
                            <p className="font-semibold text-gray-800">PDFs detected</p>
                            <p>{validationPdfFiles.length} file(s)</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={registerValidationFolder}
                            disabled={savingValidation || loadingValuers}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {(savingValidation || loadingValuers) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            Save folder for validation
                        </button>
                        <button
                            type="button"
                            onClick={resetValidationSection}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-emerald-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                Valuer contributions
                            </p>
                            <p className="text-xs text-gray-500">
                                Pulled from the Excel &quot;market&quot; sheet. Each asset row must have valuers totaling 100%. Listing all assets and their valuers below.
                            </p>
                            {marketAssets.length > 1 && (
                                <p className="text-[11px] text-gray-500">
                                    All {marketAssets.length} assets were validated for valuers and totals.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="px-3 py-2 text-left">Asset</th>
                                    {Array.from({ length: maxValuerSlots }).map((_, idx) => (
                                        <th key={`valuer-col-${idx}`} className="px-3 py-2 text-left">
                                            Valuer {idx + 1}
                                        </th>
                                    ))}
                                    <th className="px-3 py-2 text-left">Total (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {marketAssets.map((asset, assetIdx) => {
                                    const assetTotal = calculateAssetTotal(asset);
                                    const isComplete = Math.abs(assetTotal - 100) < 0.001;

                                    return (
                                        <tr
                                            key={`${asset.asset_name || "asset"}-${assetIdx}`}
                                            className="border-t align-top"
                                        >
                                            <td className="px-3 py-2 text-gray-900 font-medium">
                                                {asset.asset_name || `Asset ${assetIdx + 1}`}
                                            </td>
                                            {Array.from({ length: maxValuerSlots }).map((_, valIdx) => {
                                                const valuer = (asset.valuers || [])[valIdx];

                                                return (
                                                    <td
                                                        key={`asset-${assetIdx}-valuer-${valIdx}`}
                                                        className="px-3 py-2 text-gray-800"
                                                    >
                                                        {valuer ? (
                                                            <div className="space-y-0.5">
                                                                <div className="text-xs text-gray-500">
                                                                    ID: {valuer.valuerId || "—"}
                                                                </div>
                                                                <div className="text-sm font-semibold text-gray-800">
                                                                    {valuer.valuerName || "—"}
                                                                </div>
                                                                <div className="text-sm text-gray-700">
                                                                    {Number(valuer.percentage ?? valuer.contribution ?? 0)}%
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-2 font-semibold text-right">
                                                <span className={isComplete ? "text-emerald-600" : "text-red-600"}>
                                                    {assetTotal}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {loadingValuers && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Reading valuers from Excel...
                        </div>
                    )}
                    {!loadingValuers && !marketAssets.length && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Info className="w-4 h-4" />
                            Select a folder with an Excel file to load valuers.
                        </div>
                    )}
                    {!loadingValuers && marketAssets.length > 0 && !allAssetsTotalsValid && (
                        <div className="flex items-center gap-2 text-xs text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                            Every asset row must total 100% to enable sending to Taqeem.
                        </div>
                    )}
                    {!loadingValuers && marketAssets.length > 0 && allAssetsTotalsValid && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            Contributions are balanced. You can proceed to send.
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                    <Files className="w-5 h-5 text-blue-600" />
                    <div>
                        <p className="text-sm font-semibold text-gray-900">
                            Reports staged from folder
                        </p>
                        <p className="text-xs text-gray-500">
                            After the folder is saved to the database, PDFs will appear here with asset and client info.
                        </p>
                    </div>
                </div>
                {validationReports.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="px-4 py-2 text-left">#</th>
                                    <th className="px-4 py-2 text-left">PDF file</th>
                                    <th className="px-4 py-2 text-left">Asset name</th>
                                    <th className="px-4 py-2 text-left">Client name</th>
                                    <th className="px-4 py-2 text-left">Valuers (ID / Name / %)</th>
                                    <th className="px-4 py-2 text-left">Total %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {validationReports.map((report, idx) => (
                                    <tr key={report.id} className="border-t">
                                        <td className="px-4 py-2 text-gray-700">
                                            {idx + 1}
                                        </td>
                                        <td className="px-4 py-2 text-gray-900 font-medium">
                                            {report.pdf_name ? (
                                                <span className="inline-flex items-center gap-2 text-emerald-700">
                                                    <FileIcon className="w-4 h-4" />
                                                    {report.pdf_name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-500">
                                                    No matching PDF
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">
                                            {report.asset_name}
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">
                                            {report.client_name}
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">
                                            <div className="flex flex-wrap gap-1 text-xs">
                                                {(report.valuers || []).map((v, vIdx) => (
                                                    <span
                                                        key={`${report.id}-valuer-${vIdx}`}
                                                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 border border-gray-200"
                                                    >
                                                        <span className="font-semibold text-gray-700">
                                                            {v.valuerId || "—"}
                                                        </span>
                                                        <span className="text-gray-600">
                                                            {v.valuerName || "—"}
                                                        </span>
                                                        <span className="text-gray-700">
                                                            ({Number(v.percentage ?? 0)}%)
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-gray-900 font-semibold">
                                            {report.totalPercentage ?? 0}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Save a folder to preview the PDF files, assets, and client names.
                    </div>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-emerald-600" />
                    <div>
                        <p className="text-sm font-semibold text-gray-900">Send to Taqeem</p>
                        <p className="text-xs text-gray-500">
                            Total contributions must equal 100%. Hook the buttons to the Taqeem integration when ready.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleSubmitElrajhi}
                        disabled={sendingValidation || !canSendReports}
                        className="inline-flex items-center gap-2 
                        px-3 py-2 rounded-md bg-emerald-600 
                        text-white text-sm font-semibold 
                        hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {sendingValidation ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Send all reports to Taqeem
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmitPdfOnly}
                        disabled={pdfOnlySending || !canSendReports}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                        {pdfOnlySending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Files className="w-4 h-4" />
                        )}
                        Send only reports with PDFs
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        Upload Report Elrajhi
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Choose a flow: quick upload without validation or the new validation tab with folder upload, valuers, and Taqeem actions.
                    </p>
                </div>
                <div className="flex gap-2">
                    <TabButton
                        active={activeTab === "no-validation"}
                        onClick={() => setActiveTab("no-validation")}
                    >
                        No validation
                    </TabButton>
                    <TabButton
                        active={activeTab === "validation"}
                        onClick={() => setActiveTab("validation")}
                    >
                        With validation
                    </TabButton>
                </div>
            </div>

            {activeTab === "no-validation" ? noValidationContent : validationContent}
        </div>
    );
};

export default UploadReportElrajhi;
