import React, { useEffect, useState } from "react";
import axios from "axios";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { uploadElrajhiBatch, fetchElrajhiBatches, fetchElrajhiBatchReports } from "../../api/report";
import httpClient from "../../api/httpClient";
import { useElrajhiUpload } from "../context/ElrajhiUploadContext";

import {
    FileSpreadsheet,
    Files,
    Loader2,
    Upload,
    CheckCircle2,
    AlertTriangle,
    Table,
    File as FileIcon,
    RefreshCw,
    FolderOpen,
    Info,
    Send,
    Download,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Trash2,
    RotateCw,
    Pause,
    Play,
    Square,
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

const parseExcelDateValue = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;

    if (typeof value === "number") {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const msPerDay = 24 * 60 * 60 * 1000;
        return new Date(excelEpoch.getTime() + value * msPerDay);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;

        if (/^\d+$/.test(trimmed)) {
            const serial = parseInt(trimmed, 10);
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const msPerDay = 24 * 60 * 60 * 1000;
            return new Date(excelEpoch.getTime() + serial * msPerDay);
        }

        const normalized = trimmed.replace(/[.]/g, "/");
        const parts = normalized.split(/[\/\-]/).map((p) => p.trim());
        if (parts.length === 3) {
            const [a, b, c] = parts;
            // Try dd/mm/yyyy then yyyy-mm-dd
            if (a.length === 4) {
                const year = parseInt(a, 10);
                const month = parseInt(b, 10);
                const day = parseInt(c, 10);
                if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                    return new Date(year, month - 1, day);
                }
            } else {
                const day = parseInt(a, 10);
                const month = parseInt(b, 10);
                const year = parseInt(c, 10);
                if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                    return new Date(year, month - 1, day);
                }
            }
        }
    }

    return null;
};

const formatDateForDisplay = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
};

const hasValue = (val) =>
    val !== undefined &&
    val !== null &&
    (typeof val === "number" || String(val).toString().trim() !== "");

const pickFieldValue = (row, candidates = []) => {
    if (!row) return undefined;
    const normalizedMap = Object.keys(row).reduce((acc, key) => {
        acc[normalizeKey(key)] = key;
        return acc;
    }, {});

    for (const candidate of candidates) {
        const matchKey = normalizedMap[normalizeKey(candidate)];
        if (matchKey !== undefined) {
            return row[matchKey];
        }
    }
    return undefined;
};

const isValidEmail = (email) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

const validateReportInfoAndMarket = (reportRow = {}, marketRows = []) => {
    const issues = [];
    const addIssue = (field, location, message) => issues.push({ field, location, message });

    const purpose = pickFieldValue(reportRow, ["purpose_id", "purpose of valuation", "purpose"]);
    const valueAttributes = pickFieldValue(reportRow, ["value_premise_id", "value attributes", "value_attribute", "value premise id"]);
    const reportType = pickFieldValue(reportRow, ["report_type", "report", "report name", "report title", "title"]);
    const clientName = pickFieldValue(reportRow, ["client_name", "client name"]);
    const telephone = pickFieldValue(reportRow, ["telephone", "phone", "client telephone", "client phone", "mobile"]);
    const email = pickFieldValue(reportRow, ["email", "client email"]);

    const valuedAtRaw = pickFieldValue(reportRow, ["valued_at", "date of valuation", "valuation date"]);
    const submittedAtRaw = pickFieldValue(reportRow, ["submitted_at", "report issuing date", "report date", "report issuing"]);
    const valuedAt = parseExcelDateValue(valuedAtRaw);
    const submittedAt = parseExcelDateValue(submittedAtRaw);

    if (!hasValue(purpose)) addIssue("Purpose of Valuation", "Report Info", "Field Purpose of Valuation is required");
    if (!hasValue(valueAttributes)) addIssue("Value Attributes", "Report Info", "Field Value Attributes is required");
    if (!hasValue(reportType)) addIssue("Report", "Report Info", "Field Report is required");

    if (!hasValue(clientName)) {
        addIssue("Client Name", "Report Info", "Field client name is required");
    } else if (String(clientName).trim().length < 9) {
        addIssue("Client Name", "Report Info", "Client name field must contain at least 9 characters");
    }

    const telephoneClean = hasValue(telephone) ? String(telephone).replace(/\s+/g, "") : "";
    if (!hasValue(telephone)) {
        addIssue("Client Telephone", "Report Info", "Field client telephone is required");
    } else if (telephoneClean.length < 8) {
        addIssue("Client Telephone", "Report Info", "Client telephone must contain at least 8 characters");
    }

    if (!hasValue(email)) {
        addIssue("Client Email", "Report Info", "Field client email is required");
    } else if (!isValidEmail(email)) {
        addIssue("Client Email", "Report Info", "Client email field must contain a valid email address");
    }

    if (!valuedAt) addIssue("Date of Valuation", "Report Info", "Field Date of Valuation is required");
    if (!submittedAt) addIssue("Report Issuing Date", "Report Info", "Field Report Issuing Date is required");
    if (valuedAt && submittedAt && valuedAt > submittedAt) {
        addIssue("Date of Valuation", "Report Info", "Date of Valuation must be on or before Report Issuing Date");
    }

    if (!marketRows.length) {
        addIssue("Final Value", "market sheet", "No assets found in market sheet to validate final values");
    } else {
        marketRows.forEach((row, idx) => {
            const finalVal = pickFieldValue(row, ["final_value", "final value", "value"]);
            if (!hasValue(finalVal) || Number.isNaN(Number(finalVal))) {
                const rowNumber = idx + 2; // account for header row
                const assetName = row.asset_name || row.assetName || `Row ${rowNumber}`;
                addIssue(
                    "Final Value",
                    `market row ${rowNumber}`,
                    `Final Value is required for asset "${assetName}"`
                );
            }
        });
    }

    const snapshot = {
        purpose,
        valueAttributes,
        reportType,
        clientName,
        telephone,
        email,
        valuedAt,
        submittedAt,
    };

    return { issues, snapshot };
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
            continue;
        }

        const pctNum = Number(pctValue);
        let percentage = 0;

        if (!Number.isNaN(pctNum)) {
            percentage = pctNum >= 0 && pctNum <= 1 ? pctNum * 100 : pctNum;
        } else {
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
    const {
        activeTab,
        setActiveTab,
        numTabs,
        setNumTabs,
        excelFile,
        setExcelFile,
        pdfFiles,
        setPdfFiles,
        validationFolderFiles,
        setValidationFolderFiles,
        validationExcelFile,
        setValidationExcelFile,
        validationPdfFiles,
        setValidationPdfFiles,
        resetAllFiles,
        batchId,
        setBatchId,
        excelResult,
        setExcelResult,
        downloadPath,
        setDownloadPath,
        error,
        setError,
        success,
        setSuccess,
        validationReports,
        setValidationReports,
        marketAssets,
        setMarketAssets,
        validationMessage,
        setValidationMessage,
        validationDownloadPath,
        setValidationDownloadPath,
        rememberedFiles,
        setRememberedFiles,
        resetMainFlow,
        resetValidationFlow,
        sendingTaqeem,
        setSendingTaqeem,
        sendingValidation,
        setSendingValidation,
        pdfOnlySending,
        setPdfOnlySending,
        loadingValuers,
        setLoadingValuers,
    } = useElrajhiUpload();

    const [downloadingExcel, setDownloadingExcel] = useState(false);
    const [savingValidation, setSavingValidation] = useState(false);
    const [downloadingValidationExcel, setDownloadingValidationExcel] = useState(false);
    const [sendToConfirmerMain, setSendToConfirmerMain] = useState(false);
    const [sendToConfirmerValidation, setSendToConfirmerValidation] = useState(false);
    const [batchList, setBatchList] = useState([]);
    const [batchReports, setBatchReports] = useState({});
    const [expandedBatch, setExpandedBatch] = useState(null);
    const [checkingBatchId, setCheckingBatchId] = useState(null);
    const [retryingBatchId, setRetryingBatchId] = useState(null);
    const [checkingAllBatches, setCheckingAllBatches] = useState(false);
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchMessage, setBatchMessage] = useState(null);
    const [selectedReports, setSelectedReports] = useState(new Set());
    const [bulkActionBusy, setBulkActionBusy] = useState(null);
    const [actionMenuBatch, setActionMenuBatch] = useState(null);
    const [actionMenuOpen, setActionMenuOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [mainReportIssues, setMainReportIssues] = useState([]);
    const [mainReportSnapshot, setMainReportSnapshot] = useState(null);
    const [validationReportIssues, setValidationReportIssues] = useState([]);
    const [validationReportSnapshot, setValidationReportSnapshot] = useState(null);

    const resetMainValidationState = () => {
        setMainReportIssues([]);
        setMainReportSnapshot(null);
    };

    const resetValidationCardState = () => {
        setValidationReportIssues([]);
        setValidationReportSnapshot(null);
    };

    // Pause/Resume/Stop state management
    const [isPausedMain, setIsPausedMain] = useState(false);
    const [isPausedValidation, setIsPausedValidation] = useState(false);
    const [isPausedPdfOnly, setIsPausedPdfOnly] = useState(false);
    const [isPausedBatchCheck, setIsPausedBatchCheck] = useState(false);
    const [isPausedBatchRetry, setIsPausedBatchRetry] = useState(false);
    const [currentOperationBatchId, setCurrentOperationBatchId] = useState(null);

    // Pause/Resume/Stop handlers for Main flow (No Validation)
    const handlePauseMain = async () => {
        if (!batchId) return;
        try {
            await window.electronAPI.pauseElrajiBatch(batchId);
            setIsPausedMain(true);
            setSuccess("Operation paused");
        } catch (err) {
            setError("Failed to pause operation");
        }
    };

    const handleResumeMain = async () => {
        if (!batchId) return;
        try {
            await window.electronAPI.resumeElrajiBatch(batchId);
            setIsPausedMain(false);
            setSuccess("Operation resumed");
        } catch (err) {
            setError("Failed to resume operation");
        }
    };

    const handleStopMain = async () => {
        if (!batchId) return;
        try {
            await window.electronAPI.stopElrajiBatch(batchId);
            setIsPausedMain(false);
            setSendingTaqeem(false);
            setSuccess("Operation stopped");
        } catch (err) {
            setError("Failed to stop operation");
        }
    };

    // Pause/Resume/Stop handlers for Validation flow
    const handlePauseValidation = async () => {
        if (!validationReports.length) return;
        const reportBatchId = validationReports[0]?.batchId || batchId;
        if (!reportBatchId) return;
        try {
            await window.electronAPI.pauseElrajiBatch(reportBatchId);
            setIsPausedValidation(true);
            setValidationMessage({ type: "info", text: "Operation paused" });
        } catch (err) {
            setValidationMessage({ type: "error", text: "Failed to pause operation" });
        }
    };

    const handleResumeValidation = async () => {
        if (!validationReports.length) return;
        const reportBatchId = validationReports[0]?.batchId || batchId;
        if (!reportBatchId) return;
        try {
            await window.electronAPI.resumeElrajiBatch(reportBatchId);
            setIsPausedValidation(false);
            setValidationMessage({ type: "info", text: "Operation resumed" });
        } catch (err) {
            setValidationMessage({ type: "error", text: "Failed to resume operation" });
        }
    };

    const handleStopValidation = async () => {
        if (!validationReports.length) return;
        const reportBatchId = validationReports[0]?.batchId || batchId;
        if (!reportBatchId) return;
        try {
            await window.electronAPI.stopElrajiBatch(reportBatchId);
            setIsPausedValidation(false);
            setSendingValidation(false);
            setValidationMessage({ type: "info", text: "Operation stopped" });
        } catch (err) {
            setValidationMessage({ type: "error", text: "Failed to stop operation" });
        }
    };

    // Pause/Resume/Stop handlers for PDF Only flow
    const handlePausePdfOnly = async () => {
        if (!validationReports.length) return;
        const reportBatchId = validationReports[0]?.batchId || batchId;
        if (!reportBatchId) return;
        try {
            await window.electronAPI.pauseElrajiBatch(reportBatchId);
            setIsPausedPdfOnly(true);
            setValidationMessage({ type: "info", text: "PDF operation paused" });
        } catch (err) {
            setValidationMessage({ type: "error", text: "Failed to pause PDF operation" });
        }
    };

    const handleResumePdfOnly = async () => {
        if (!validationReports.length) return;
        const reportBatchId = validationReports[0]?.batchId || batchId;
        if (!reportBatchId) return;
        try {
            await window.electronAPI.resumeElrajiBatch(reportBatchId);
            setIsPausedPdfOnly(false);
            setValidationMessage({ type: "info", text: "PDF operation resumed" });
        } catch (err) {
            setValidationMessage({ type: "error", text: "Failed to resume PDF operation" });
        }
    };

    const handleStopPdfOnly = async () => {
        if (!validationReports.length) return;
        const reportBatchId = validationReports[0]?.batchId || batchId;
        if (!reportBatchId) return;
        try {
            await window.electronAPI.stopElrajiBatch(reportBatchId);
            setIsPausedPdfOnly(false);
            setPdfOnlySending(false);
            setValidationMessage({ type: "info", text: "PDF operation stopped" });
        } catch (err) {
            setValidationMessage({ type: "error", text: "Failed to stop PDF operation" });
        }
    };

    // Pause/Resume/Stop handlers for Batch Check
    const handlePauseBatchCheck = async (targetBatchId) => {
        const bId = targetBatchId || currentOperationBatchId;
        if (!bId) return;
        try {
            await window.electronAPI.pauseElrajiBatch(bId);
            setIsPausedBatchCheck(true);
            setBatchMessage({ type: "info", text: `Batch check paused for ${bId}` });
        } catch (err) {
            setBatchMessage({ type: "error", text: "Failed to pause batch check" });
        }
    };

    const handleResumeBatchCheck = async (targetBatchId) => {
        const bId = targetBatchId || currentOperationBatchId;
        if (!bId) return;
        try {
            await window.electronAPI.resumeElrajiBatch(bId);
            setIsPausedBatchCheck(false);
            setBatchMessage({ type: "info", text: `Batch check resumed for ${bId}` });
        } catch (err) {
            setBatchMessage({ type: "error", text: "Failed to resume batch check" });
        }
    };

    const handleStopBatchCheck = async (targetBatchId) => {
        const bId = targetBatchId || currentOperationBatchId;
        if (!bId) return;
        try {
            await window.electronAPI.stopElrajiBatch(bId);
            setIsPausedBatchCheck(false);
            setCheckingBatchId(null);
            setCheckingAllBatches(false);
            setBatchMessage({ type: "info", text: `Batch check stopped for ${bId}` });
        } catch (err) {
            setBatchMessage({ type: "error", text: "Failed to stop batch check" });
        }
    };

    // Pause/Resume/Stop handlers for Batch Retry
    const handlePauseBatchRetry = async (targetBatchId) => {
        const bId = targetBatchId || currentOperationBatchId;
        if (!bId) return;
        try {
            await window.electronAPI.pauseElrajiBatch(bId);
            setIsPausedBatchRetry(true);
            setBatchMessage({ type: "info", text: `Batch retry paused for ${bId}` });
        } catch (err) {
            setBatchMessage({ type: "error", text: "Failed to pause batch retry" });
        }
    };

    const handleResumeBatchRetry = async (targetBatchId) => {
        const bId = targetBatchId || currentOperationBatchId;
        if (!bId) return;
        try {
            await window.electronAPI.resumeElrajiBatch(bId);
            setIsPausedBatchRetry(false);
            setBatchMessage({ type: "info", text: `Batch retry resumed for ${bId}` });
        } catch (err) {
            setBatchMessage({ type: "error", text: "Failed to resume batch retry" });
        }
    };

    const handleStopBatchRetry = async (targetBatchId) => {
        const bId = targetBatchId || currentOperationBatchId;
        if (!bId) return;
        try {
            await window.electronAPI.stopElrajiBatch(bId);
            setIsPausedBatchRetry(false);
            setCheckingBatchId(null);
            setBatchMessage({ type: "info", text: `Batch retry stopped for ${bId}` });
        } catch (err) {
            setBatchMessage({ type: "error", text: "Failed to stop batch retry" });
        }
    };

    const uploadExcelOnly = async () => {
        throw new Error("uploadExcelOnly is deprecated in this flow.");
    };

    const handleSubmitElrajhi = async () => {
        try {
            setSendingValidation(true);
            setIsPausedValidation(false);
            setValidationMessage({
                type: "info",
                text: "Saving reports to database..."
            });

            if (!validationExcelFile) {
                throw new Error("Select a folder with Excel file before sending.");
            }

            if (validationReportIssues.length) {
                throw new Error("Resolve the report info validation issues before sending.");
            }
            // Upload to backend
            const data = await uploadElrajhiBatch(
                validationExcelFile,
                validationPdfFiles
            );

            console.log("ELRAJHI BATCH:", data);

            const batchIdFromData = data.batchId;
            setCurrentOperationBatchId(batchIdFromData);
            const insertedCount = data.inserted || 0;
            const reportsFromApi = Array.isArray(data.reports) ? data.reports : [];
            if (reportsFromApi.length) {
                setValidationReports((prev) => {
                    const byAsset = new Map();
                    reportsFromApi.forEach((r) => {
                        const key = (r.asset_name || "").toLowerCase();
                        if (!byAsset.has(key)) byAsset.set(key, []);
                        byAsset.get(key).push(r);
                    });
                    return prev.map((r) => {
                        const list = byAsset.get((r.asset_name || "").toLowerCase()) || [];
                        const next = list.shift();
                        if (next) {
                            return {
                                ...r,
                                record_id: next._id || next.id || next.record_id,
                                report_id: next.report_id || r.report_id,
                                batchId: batchIdFromData,
                            };
                        }
                        return r;
                    });
                });
            }
            setValidationDownloadPath(`/elrajhi-upload/export/${batchIdFromData}`);

            setValidationMessage({
                type: "success",
                text: `Reports saved (${insertedCount} assets). ${sendToConfirmerValidation ? "Sending to Taqeem..." : "Final submission skipped."}`
            });

            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromData, numTabs, false, sendToConfirmerValidation);

            if (electronResult?.status === "SUCCESS") {
                const resultMap = (electronResult.results || []).reduce((acc, res) => {
                    const key = res.record_id || res.recordId;
                    const reportId = res.report_id || res.reportId;
                    if (key && reportId) acc[key] = reportId;
                    return acc;
                }, {});

                if (Object.keys(resultMap).length || (electronResult.results || []).length) {
                    setValidationReports((prev) =>
                        prev.map((r, idx) => {
                            const key = r.record_id || r.recordId || r._id;
                            const fallback = (electronResult.results || [])[idx]?.report_id
                                || (electronResult.results || [])[idx]?.reportId;
                            const reportId = resultMap[key] || r.report_id || fallback;
                            return { ...r, report_id: reportId };
                        })
                    );
                }

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
            setCurrentOperationBatchId(null);
        }
    };

    const handleSubmitPdfOnly = async () => {
        try {
            setPdfOnlySending(true);
            setIsPausedPdfOnly(false);
            setValidationMessage({
                type: "info",
                text: "Saving PDF reports to database..."
            });

            if (!validationExcelFile) {
                throw new Error("Select a folder with Excel file before sending.");
            }

            if (validationReportIssues.length) {
                throw new Error("Resolve the report info validation issues before sending.");
            }
            // Upload to backend
            const data = await uploadElrajhiBatch(
                validationExcelFile,
                validationPdfFiles
            );

            console.log("ELRAJHI BATCH (PDF Only):", data);

            const batchIdFromData = data.batchId;
            setCurrentOperationBatchId(batchIdFromData);
            const insertedCount = data.inserted || 0;
            const reportsFromApi = Array.isArray(data.reports) ? data.reports : [];
            if (reportsFromApi.length) {
                setValidationReports((prev) => {
                    const byAsset = new Map();
                    reportsFromApi.forEach((r) => {
                        const key = (r.asset_name || "").toLowerCase();
                        if (!byAsset.has(key)) byAsset.set(key, []);
                        byAsset.get(key).push(r);
                    });
                    return prev.map((r) => {
                        const list = byAsset.get((r.asset_name || "").toLowerCase()) || [];
                        const next = list.shift();
                        if (next) {
                            return {
                                ...r,
                                record_id: next._id || next.id || next.record_id,
                                report_id: next.report_id || r.report_id,
                                batchId: batchIdFromData,
                            };
                        }
                        return r;
                    });
                });
            }
            setValidationDownloadPath(`/elrajhi-upload/export/${batchIdFromData}`);

            const pdfReports = validationReports.filter(report => report.pdf_name);
            const pdfCount = pdfReports.length;

            setValidationMessage({
                type: "success",
                text: `PDF reports saved (${pdfCount} assets with PDFs). ${sendToConfirmerValidation ? "Sending to Taqeem..." : "Final submission skipped."}`
            });

            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromData, numTabs, true, sendToConfirmerValidation);

            if (electronResult?.status === "SUCCESS") {
                const resultMap = (electronResult.results || []).reduce((acc, res) => {
                    const key = res.record_id || res.recordId;
                    const reportId = res.report_id || res.reportId;
                    if (key && reportId) acc[key] = reportId;
                    return acc;
                }, {});

                if (Object.keys(resultMap).length || (electronResult.results || []).length) {
                    setValidationReports((prev) =>
                        prev.map((r, idx) => {
                            const key = r.record_id || r.recordId || r._id;
                            const fallback = (electronResult.results || [])[idx]?.report_id
                                || (electronResult.results || [])[idx]?.reportId;
                            const reportId = resultMap[key] || r.report_id || fallback;
                            return { ...r, report_id: reportId };
                        })
                    );
                }

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
            setCurrentOperationBatchId(null);
        }
    };

    const uploadPdfsOnly = async () => {
        throw new Error("uploadPdfsOnly is deprecated in this flow.");
    };

    const loadBatchList = async () => {
        try {
            setBatchLoading(true);
            setBatchMessage(null);
            const data = await fetchElrajhiBatches();
            setBatchList(Array.isArray(data?.batches) ? data.batches : []);
            setCurrentPage(1);
        } catch (err) {
            setBatchMessage({
                type: "error",
                text: err?.response?.data?.error || err.message || "Failed to load batches",
            });
        } finally {
            setBatchLoading(false);
        }
    };

    const loadBatchReports = async (batchId) => {
        if (!batchId) return;
        try {
            setBatchLoading(true);
            const data = await fetchElrajhiBatchReports(batchId);
            setBatchReports((prev) => ({
                ...prev,
                [batchId]: Array.isArray(data?.reports) ? data.reports : [],
            }));
        } catch (err) {
            setBatchMessage({
                type: "error",
                text: err?.response?.data?.error || err.message || "Failed to load batch reports",
            });
        } finally {
            setBatchLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "check-reports") {
            loadBatchList();
        }
    }, [activeTab]);

    const toggleBatchExpand = async (batchId) => {
        if (expandedBatch === batchId) {
            setExpandedBatch(null);
            return;
        }
        setExpandedBatch(batchId);
        if (!batchReports[batchId]) {
            await loadBatchReports(batchId);
        }
    };

    const runBatchCheck = async (batchId = null) => {
        if (!window?.electronAPI?.checkElrajhiBatches) {
            setBatchMessage({
                type: "error",
                text: "Desktop integration unavailable. Restart the app.",
            });
            return;
        }
        if (batchId) {
            setCheckingBatchId(batchId);
            setCurrentOperationBatchId(batchId);
        } else {
            setCheckingAllBatches(true);
        }
        setIsPausedBatchCheck(false);
        setBatchMessage({
            type: "info",
            text: batchId ? `Checking batch ${batchId}...` : "Checking all batches...",
        });

        try {
            const result = await window.electronAPI.checkElrajhiBatches(batchId || null, numTabs);
            if (result?.status !== "SUCCESS") {
                throw new Error(result?.error || "Check failed");
            }

            setBatchMessage({
                type: "success",
                text: batchId ? `Check finished for ${batchId}` : "Completed check for all batches",
            });

            await loadBatchList();
            if (batchId) {
                await loadBatchReports(batchId);
            } else if (expandedBatch) {
                await loadBatchReports(expandedBatch);
            }
        } catch (err) {
            setBatchMessage({
                type: "error",
                text: err.message || "Failed to check reports",
            });
        } finally {
            setCheckingBatchId(null);
            setCheckingAllBatches(false);
            setCurrentOperationBatchId(null);
        }
    };

    const handleDeleteReport = async (reportId, batchId) => {
        if (!reportId) return;
        try {
            setCheckingBatchId(batchId || reportId);
            // Use the new deleteMultipleReports function
            const result = await window.electronAPI.deleteMultipleReports([reportId], 10);
            if (result?.status !== "SUCCESS") {
                throw new Error(result?.error || "Delete failed");
            }
            await loadBatchReports(batchId);
            await loadBatchList();
            setBatchMessage({
                type: "success",
                text: `Deleted report ${reportId}`,
            });
        } catch (err) {
            setBatchMessage({
                type: "error",
                text: err.message || "Failed to delete report",
            });
        } finally {
            setCheckingBatchId(null);
        }
    };

    const handleReuploadReport = async (reportId, batchId) => {
        if (!reportId) return;
        try {
            setCheckingBatchId(batchId || reportId);
            // Use the new function for consistency
            const result = await window.electronAPI.retryElrajhiReportReportIds([reportId], numTabs);
            if (result?.status !== "SUCCESS") {
                throw new Error(result?.error || "Reupload failed");
            }
            await loadBatchReports(batchId);
            await loadBatchList();
            setBatchMessage({
                type: "success",
                text: `Reupload completed for report ${reportId}`,
            });
        } catch (err) {
            setBatchMessage({
                type: "error",
                text: err.message || "Failed to reupload report",
            });
        } finally {
            setCheckingBatchId(null);
        }
    };

    const resetMessages = () => {
        setError("");
        setSuccess("");
    };

    const runReportValidationForFile = async (file, target = "main") => {
        if (!file) {
            if (target === "validation") {
                resetValidationCardState();
            } else {
                resetMainValidationState();
            }
            return { issues: [], snapshot: null };
        }

        try {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const reportSheet = workbook.getWorksheet("Report Info");
            const marketSheet = workbook.getWorksheet("market");

            if (!reportSheet || !marketSheet) {
                const issues = [
                    {
                        field: "Workbook",
                        location: "Sheets",
                        message: "Excel must contain sheets named 'Report Info' and 'market'.",
                    },
                ];
                if (target === "validation") {
                    setValidationReportIssues(issues);
                    setValidationReportSnapshot(null);
                } else {
                    setMainReportIssues(issues);
                    setMainReportSnapshot(null);
                }
                return { issues, snapshot: null };
            }

            const reportRows = worksheetToObjects(reportSheet);
            const marketRows = worksheetToObjects(marketSheet);
            const result = validateReportInfoAndMarket(reportRows[0] || {}, marketRows);

            if (target === "validation") {
                setValidationReportIssues(result.issues);
                setValidationReportSnapshot(result.snapshot);
            } else {
                setMainReportIssues(result.issues);
                setMainReportSnapshot(result.snapshot);
            }
            return result;
        } catch (err) {
            const fallback = [
                {
                    field: "Excel",
                    location: file?.name || "Workbook",
                    message: err?.message || "Failed to read Excel file",
                },
            ];
            if (target === "validation") {
                setValidationReportIssues(fallback);
                setValidationReportSnapshot(null);
            } else {
                setMainReportIssues(fallback);
                setMainReportSnapshot(null);
            }
            return { issues: fallback, snapshot: null };
        }
    };

    const downloadExcelFile = async (path, setBusy, setMessage) => {
        if (!path) return;
        try {
            setBusy(true);
            const response = await httpClient.get(path, { responseType: "blob" });
            const disposition = response.headers["content-disposition"] || "";
            const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
            const filename = match && match[1] ? match[1] : "updated.xlsx";
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to download Excel", err);
            if (setMessage) {
                setMessage({
                    type: "error",
                    text: "Failed to download updated Excel. Please try again.",
                });
            } else {
                setError("Failed to download updated Excel");
            }
        } finally {
            setBusy(false);
        }
    };

    const handleExcelChange = async (e) => {
        resetMessages();
        resetMainValidationState();
        const file = e.target.files?.[0];
        setExcelFile(file || null);
        setRememberedFiles((prev) => ({
            ...prev,
            mainExcel: file ? file.name : null,
        }));
        if (file) {
            await runReportValidationForFile(file, "main");
        }
    };

    const handlePdfsChange = (e) => {
        resetMessages();
        const files = Array.from(e.target.files || []);
        setPdfFiles(files);
        setRememberedFiles((prev) => ({
            ...prev,
            mainPdfs: files.map((f) => f.name),
        }));
    };

    const resetValidationBanner = () => setValidationMessage(null);

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

            const reportSheet = workbook.getWorksheet("Report Info");
            const marketSheet = workbook.getWorksheet("market");
            if (!marketSheet || !reportSheet) {
                throw new Error("Excel must include sheets named 'Report Info' and 'market'.");
            }

            const marketRows = worksheetToObjects(marketSheet);
            if (!marketRows.length) {
                throw new Error("Sheet 'market' has no rows to read valuers from.");
            }

            const reportRows = worksheetToObjects(reportSheet);
            const reportValidation = validateReportInfoAndMarket(reportRows[0] || {}, marketRows);
            setValidationReportIssues(reportValidation.issues);
            setValidationReportSnapshot(reportValidation.snapshot);

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
                if (reportValidation.issues.length) {
                    setValidationMessage({
                        type: "error",
                        text: `Found ${reportValidation.issues.length} validation issue(s). Review the table below.`,
                    });
                } else if (invalidTotals.length) {
                    const firstInvalid = invalidTotals[0];
                    setValidationMessage({
                        type: "error",
                        text: `Found ${invalidTotals.length} asset(s) with invalid totals. Example: Asset "${firstInvalid.assetName}" (row ${firstInvalid.rowNumber}) totals ${firstInvalid.total}%. Must be 100%.`,
                    });
                } else {
                    setValidationMessage({
                        type: "success",
                        text: `Loaded ${assets.length} asset(s). Matched ${matchedCount} PDF(s) by asset name. Report info looks valid.`,
                    });
                }
            }

            return { assets, matchedCount, invalidTotals, reportIssues: reportValidation.issues, reportSnapshot: reportValidation.snapshot };
        } catch (err) {
            setMarketAssets([]);
            setValidationReports([]);
            resetValidationCardState();
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
            setIsPausedMain(false);

            if (!excelFile) {
                throw new Error("Please select an Excel file before sending.");
            }
            if (!pdfFiles.length) {
                throw new Error("Please select PDF files before sending.");
            }

            const mainValidation = await runReportValidationForFile(excelFile, "main");
            if (mainValidation?.issues?.length) {
                throw new Error(`Found ${mainValidation.issues.length} validation issue(s) in the Excel file. Review the table below.`);
            }
            // ---- Build multipart/form-data ----
            const formData = new FormData();
            formData.append("excel", excelFile);
            pdfFiles.forEach((file) => {
                formData.append("pdfs", file);
            });

            const response = await axios.post(
                "http://localhost:3000/api/upload",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );

            const payloadFromApi = response.data;

            if (payloadFromApi.status !== "success") {
                throw new Error(
                    payloadFromApi.error || "Upload API returned non-success status."
                );
            }

            const insertedCount = payloadFromApi.inserted || 0;
            const docs = payloadFromApi.data || [];
            const batchIdFromApi = payloadFromApi.batchId || "urgent-upload";

            setBatchId(batchIdFromApi);
            setCurrentOperationBatchId(batchIdFromApi);
            setExcelResult({
                batchId: batchIdFromApi,
                reports: docs.map((d) => ({
                    asset_name: d.asset_name,
                    client_name: d.client_name,
                    path_pdf: d.pdf_path,
                    record_id: d._id || d.id || d.record_id || null,
                })),
                source: "system",
            });
            setDownloadPath(`/elrajhi-upload/export/${batchIdFromApi}`);

            setSuccess(
                `Upload complete. Inserted ${insertedCount} urgent assets into DB. ${sendToConfirmerMain ? "Sending to Taqeem..." : "Final submission skipped."}`
            );

            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromApi, numTabs, false, sendToConfirmerMain);

            if (electronResult?.status === "SUCCESS") {
                const resultMap = (electronResult.results || []).reduce((acc, res) => {
                    const key = res.record_id || res.recordId;
                    const reportId = res.report_id || res.reportId;
                    if (key && reportId) {
                        acc[key] = reportId;
                    }
                    return acc;
                }, {});

                if (Object.keys(resultMap).length || (electronResult.results || []).length) {
                    setExcelResult((prev) => {
                        if (!prev) return prev;
                        const reports = (prev.reports || []).map((r, idx) => {
                            const key = r.record_id || r.recordId || r._id;
                            const fallbackFromOrder = (electronResult.results || [])[idx]?.report_id
                                || (electronResult.results || [])[idx]?.reportId;
                            const reportId = resultMap[key] || r.report_id || fallbackFromOrder;
                            return { ...r, report_id: reportId };
                        });
                        return { ...prev, reports };
                    });
                }

                setSuccess(
                    `Upload succeeded. ${insertedCount} assets saved and dispatched to Taqeem tabs${sendToConfirmerMain ? "" : " (final submit skipped)"}.`
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
            setCurrentOperationBatchId(null);
        }
    };

    const handleValidationFolderChange = (e) => {
        resetValidationBanner();
        resetValidationCardState();
        const incomingFiles = Array.from(e.target.files || []);
        setValidationFolderFiles(incomingFiles);
        const excel = incomingFiles.find((file) => /\.(xlsx|xls)$/i.test(file.name));
        const pdfList = incomingFiles.filter((file) => /\.pdf$/i.test(file.name));
        setValidationExcelFile(excel || null);
        setValidationPdfFiles(pdfList);
        setRememberedFiles((prev) => ({
            ...prev,
            validationExcel: excel ? excel.name : null,
            validationPdfs: pdfList.map((p) => p.name),
        }));
    };

    const allAssetsTotalsValid = marketAssets.every(
        (a) => Math.abs((a.totalPercentage || 0) - 100) < 0.001
    );
    const canSendReports = marketAssets.length > 0 && allAssetsTotalsValid && !loadingValuers && !validationReportIssues.length;
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
        resetValidationFlow();
        setValidationFolderFiles([]);
        setValidationExcelFile(null);
        setValidationPdfFiles([]);
        setSendToConfirmerValidation(false);
        setIsPausedValidation(false);
        setIsPausedPdfOnly(false);
        resetValidationCardState();
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

            const { assets, matchedCount, reportIssues = [], reportSnapshot = null } = parseResult;

            // Ensure card state is aligned with the latest parse (extra safety even though parseExcelForValidation already sets it).
            setValidationReportIssues(reportIssues);
            setValidationReportSnapshot(reportSnapshot);

            if (!assets.length) {
                setValidationMessage({
                    type: "error",
                    text: "No assets found in the Excel file.",
                });
                return;
            }

            if (reportIssues.length) {
                setValidationMessage({
                    type: "error",
                    text: `Found ${reportIssues.length} validation issue(s). Review the details below before sending.`,
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
                text: `Folder staged. Found ${assets.length} asset(s) and ${validationPdfFiles.length} PDF(s). Matched ${matchedCount} PDF(s) by asset name. Report info is valid.`,
            });
        } finally {
            setSavingValidation(false);
        }
    };

    const clearAll = () => {
        resetAllFiles();
        resetMainFlow();
        setSendToConfirmerMain(false);
        setIsPausedMain(false);
        resetMessages();
        resetMainValidationState();
    };

    // Control button component for pause/resume/stop
    const ControlButtons = ({ isPaused, isRunning, onPause, onResume, onStop, disabled = false }) => (
        <div className="flex gap-2">
            {!isPaused && isRunning && (
                <button
                    type="button"
                    onClick={onPause}
                    disabled={disabled}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                    <Pause className="w-4 h-4" />
                    Pause
                </button>
            )}
            {isPaused && (
                <button
                    type="button"
                    onClick={onResume}
                    disabled={disabled}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                    <Play className="w-4 h-4" />
                    Resume
                </button>
            )}
            {isRunning && (
                <button
                    type="button"
                    onClick={onStop}
                    disabled={disabled}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                    <Square className="w-4 h-4" />
                    Stop
                </button>
            )}
        </div>
    );

    const ValidationResultsCard = ({ title, issues = [], snapshot }) => {
        if (!snapshot && !issues.length) return null;

        const fields = [
            { label: "Purpose of Valuation", value: snapshot?.purpose },
            { label: "Value Attributes", value: snapshot?.valueAttributes },
            { label: "Report", value: snapshot?.reportType },
            { label: "Client Name", value: snapshot?.clientName },
            { label: "Client Telephone", value: snapshot?.telephone },
            { label: "Client Email", value: snapshot?.email },
            { label: "Date of Valuation", value: snapshot?.valuedAt ? formatDateForDisplay(snapshot.valuedAt) : "" },
            { label: "Report Issuing Date", value: snapshot?.submittedAt ? formatDateForDisplay(snapshot.submittedAt) : "" },
        ];

        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-semibold text-gray-900">{title}</p>
                    </div>
                    <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${issues.length
                            ? "bg-red-50 text-red-700 border-red-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            }`}
                    >
                        {issues.length ? `${issues.length} issue(s)` : "No issues found"}
                    </span>
                </div>
                <div className="p-4 space-y-3">
                    {snapshot ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            {fields.map((field) => (
                                <div
                                    key={field.label}
                                    className="p-2 rounded-md bg-slate-50 border border-slate-100"
                                >
                                    <p className="font-semibold text-gray-800">{field.label}</p>
                                    <p className="text-gray-700 break-words">{field.value || "—"}</p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {issues.length ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead className="bg-red-50 text-red-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Field</th>
                                        <th className="px-3 py-2 text-left">Location</th>
                                        <th className="px-3 py-2 text-left">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {issues.map((issue, idx) => (
                                        <tr key={`${issue.field}-${idx}`} className="border-t bg-red-50">
                                            <td className="px-3 py-2 font-semibold text-red-800">{issue.field}</td>
                                            <td className="px-3 py-2 text-red-700">{issue.location || "—"}</td>
                                            <td className="px-3 py-2 text-red-700">{issue.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            All required fields look good.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const selectionKey = (batchId, reportId) => `${batchId || "batch"}::${reportId || "unknown"}`;

    const isSelected = (batchId, reportId) => selectedReports.has(selectionKey(batchId, reportId));

    const toggleReportSelection = (batchId, reportId, checked) => {
        setSelectedReports((prev) => {
            const next = new Set(prev);
            const key = selectionKey(batchId, reportId);
            if (checked) {
                next.add(key);
            } else {
                next.delete(key);
            }
            return next;
        });
    };

    const toggleSelectAllForBatch = (batchId, reports = [], checked) => {
        setSelectedReports((prev) => {
            const next = new Set(prev);
            reports.forEach((r) => {
                const rid = r.report_id || r.reportId;
                if (!rid) return;
                const key = selectionKey(batchId, rid);
                if (checked) {
                    next.add(key);
                } else {
                    next.delete(key);
                }
            });
            return next;
        });
    };

    const handleBulkAction = async (action, batchId, reports = []) => {
        const selected = reports.filter((r) => isSelected(batchId, r.report_id || r.reportId));
        if (!selected.length) {
            setBatchMessage({
                type: "info",
                text: "Select at least one report first.",
            });
            return;
        }

        const readableAction =
            action === "delete"
                ? "Delete"
                : action === "retry"
                    ? "Retry"
                    : action === "send"
                        ? "Finalize"
                        : "Approve";

        setBulkActionBusy(action);
        setBatchMessage({
            type: "info",
            text: `${readableAction} in progress for ${selected.length} report(s)...`,
        });

        try {
            // Extract report IDs for the selected reports
            const reportIds = selected
                .map(report => report.report_id || report.reportId)
                .filter(id => id && id.trim() !== "");

            if (reportIds.length === 0) {
                throw new Error("No valid report IDs found in selected reports");
            }

            if (action === "delete") {
                // Use the new deleteMultipleReports function
                const result = await window.electronAPI.deleteMultipleReports(reportIds, 10);
                if (result?.status !== "SUCCESS") {
                    throw new Error(result?.error || "Delete multiple reports failed");
                }

                // Refresh data
                await loadBatchReports(batchId);
                await loadBatchList();

                setBatchMessage({
                    type: "success",
                    text: `Deleted ${reportIds.length} report(s) successfully`,
                });

            } else if (action === "retry") {
                // Use the new retryElrajhiReportReportIds function
                const result = await window.electronAPI.retryElrajhiReportReportIds(reportIds, numTabs);
                if (result?.status !== "SUCCESS") {
                    throw new Error(result?.error || "Retry multiple reports failed");
                }

                // Refresh data
                await loadBatchReports(batchId);
                await loadBatchList();

                setBatchMessage({
                    type: "success",
                    text: `Retry completed for ${reportIds.length} report(s)`,
                });

            } else if (action === "send") {
                // Use the new finalizeMultipleReports function
                const result = await window.electronAPI.finalizeMultipleReports(reportIds);
                if (result?.status !== "SUCCESS") {
                    throw new Error(result?.error || "Finalize multiple reports failed");
                }

                // Refresh data
                await loadBatchReports(batchId);
                await loadBatchList();

                setBatchMessage({
                    type: "success",
                    text: `Finalized ${reportIds.length} report(s) successfully`,
                });

            } else if (action === "approve") {
                setBatchMessage({
                    type: "error",
                    text: "Approve via single-report automation is not wired to desktop integration yet.",
                });
            }
        } catch (err) {
            setBatchMessage({
                type: "error",
                text: err?.message || `Failed to ${readableAction.toLowerCase()} selected report(s).`,
            });
        } finally {
            setBulkActionBusy(null);
            setActionMenuOpen(false);
            setActionMenuBatch(null);

            // Clear selection after bulk action
            setSelectedReports(new Set());
        }
    };

    // pagination helpers
    const totalBatchPages = Math.max(1, Math.ceil((batchList.length || 0) / pageSize));
    const currentPageSafe = Math.min(Math.max(currentPage, 1), totalBatchPages);
    const batchPageStart = (currentPageSafe - 1) * pageSize;
    const displayedBatches = batchList.slice(batchPageStart, batchPageStart + pageSize);


    const validationContent = (
        <div className="space-y-5">
            <div className="space-y-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="px-2 py-1 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">Step 1</span>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                            <Upload className="w-4 h-4 text-blue-700" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900 leading-tight">
                                    Upload folder (Excel + PDFs)
                                </p>
                                <p className="text-[11px] text-gray-600 leading-tight">
                                    Choose the folder that contains the Excel report file and all related PDFs.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-gray-700 border border-slate-200">
                                <FileSpreadsheet className="w-3 h-3" />
                                {validationExcelFile
                                    ? validationExcelFile.name
                                    : rememberedFiles.validationExcel
                                        ? `Last: ${rememberedFiles.validationExcel}`
                                        : "No Excel selected"}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-gray-700 border border-slate-200">
                                <Files className="w-3 h-3" />
                                {validationPdfFiles.length
                                    ? `${validationPdfFiles.length} PDF(s)`
                                    : rememberedFiles.validationPdfs.length
                                        ? `Last: ${rememberedFiles.validationPdfs.length} PDF(s)`
                                        : "0 PDF(s)"}
                            </span>
                        </div>
                    </div>
                    <label className="flex items-center justify-between px-4 py-4 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition w-1/4 min-w-[260px]">
                        <div className="flex items-center gap-2 text-sm text-gray-800">
                            <FolderOpen className="w-4 h-4" />
                            <span className="font-semibold">
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
                        <span className="text-xs text-blue-600 font-semibold">Browse</span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex-1 min-w-[180px] p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                            <p className="font-semibold text-gray-900 text-sm">Excel detected</p>
                            <p className="text-xs text-gray-700">
                                {validationExcelFile
                                    ? validationExcelFile.name
                                    : rememberedFiles.validationExcel
                                        ? `Last: ${rememberedFiles.validationExcel}`
                                        : "—"}
                            </p>
                        </div>
                        <div className="flex-1 min-w-[180px] p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                            <p className="font-semibold text-gray-900 text-sm">PDFs detected</p>
                            <p className="text-xs text-gray-700">
                                {validationPdfFiles.length
                                    ? `${validationPdfFiles.length} file(s)`
                                    : rememberedFiles.validationPdfs.length
                                        ? `Last: ${rememberedFiles.validationPdfs.length} file(s)`
                                        : "0 file(s)"}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
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

                    <div className="space-y-3">
                        <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4 flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                <Info className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900">Validated folder flow</p>
                                <p className="text-xs text-slate-600">
                                    Add a folder, review valuers, choose tabs, then decide if you want to send to confirmer. PDFs can be sent selectively.
                                </p>
                                {validationMessage && (
                                    <div
                                        className={`mt-2 rounded-lg border px-3 py-2 inline-flex items-start gap-2 ${validationMessage.type === "error"
                                            ? "bg-red-50 text-red-700 border-red-100"
                                            : validationMessage.type === "success"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                : "bg-blue-50 text-blue-700 border-blue-100"
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
                            </div>
                        </div>

                        {(validationReportSnapshot || validationReportIssues.length) ? (
                            <ValidationResultsCard
                                title="Report Info validation"
                                issues={validationReportIssues}
                                snapshot={validationReportSnapshot}
                            />
                        ) : (
                            <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-sm text-gray-500 flex items-center justify-center">
                                Validation results will appear here after reading the Excel.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="px-4 py-3 border-b flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
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
                    {validationDownloadPath && (
                        <button
                            type="button"
                            onClick={() => downloadExcelFile(validationDownloadPath, setDownloadingValidationExcel, setValidationMessage)}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                            disabled={downloadingValidationExcel}
                        >
                            {downloadingValidationExcel ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {downloadingValidationExcel ? "Preparing..." : "Download updated Excel"}
                        </button>
                    )}
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
                                    <th className="px-4 py-2 text-left">Report ID</th>
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
                                        <td className="px-4 py-2 text-gray-800">
                                            {report.report_id ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-800 border border-emerald-100 text-xs">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {report.report_id}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Pending</span>
                                            )}
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

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-emerald-600" />
                    <div>
                        <p className="text-sm font-semibold text-gray-900">Send to Taqeem</p>
                        <p className="text-xs text-gray-500">
                            Total contributions must equal 100%. Hook the buttons to the Taqeem integration when ready.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-start gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">
                            Number of tabs to open in Taqeem:
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setNumTabs((prev) => Math.max(1, prev - 1))}
                                disabled={numTabs <= 1}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={numTabs}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(value) && value >= 1 && value <= 10) {
                                        setNumTabs(value);
                                    }
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setNumTabs((prev) => Math.min(10, prev + 1))}
                                disabled={numTabs >= 10}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                +
                            </button>
                            <span className="text-xs text-gray-500 ml-1">
                                (1-10)
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">
                            Each tab will process a portion of the reports.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded">
                            <input
                                type="checkbox"
                                className="h-4 w-4 text-amber-600 border-amber-400 focus:ring-amber-500"
                                checked={sendToConfirmerValidation}
                                onChange={(e) => setSendToConfirmerValidation(e.target.checked)}
                            />
                            <span className="text-sm text-gray-800 font-semibold">
                                Do you want to send the report to the confirmer? / هل تريد ارسال التقرير الي المعتمد ؟
                            </span>
                        </label>
                        {validationReportIssues.length ? (
                            <div className="flex items-center gap-2 text-xs text-red-600">
                                <AlertTriangle className="w-4 h-4" />
                                Resolve the report info issues above to enable sending.
                            </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2 items-center">
                            <button
                                type="button"
                                onClick={handleSubmitElrajhi}
                                disabled={sendingValidation || !canSendReports}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {sendingValidation ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                Send all reports ({numTabs} tab{numTabs !== 1 ? "s" : ""})
                            </button>
                            {sendingValidation && (
                                <ControlButtons
                                    isPaused={isPausedValidation}
                                    isRunning={sendingValidation}
                                    onPause={handlePauseValidation}
                                    onResume={handleResumeValidation}
                                    onStop={handleStopValidation}
                                />
                            )}
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
                                Send only reports with PDFs ({numTabs} tab{numTabs !== 1 ? "s" : ""})
                            </button>
                            {pdfOnlySending && (
                                <ControlButtons
                                    isPaused={isPausedPdfOnly}
                                    isRunning={pdfOnlySending}
                                    onPause={handlePausePdfOnly}
                                    onResume={handleResumePdfOnly}
                                    onStop={handleStopPdfOnly}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const noValidationContent = (
        <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <Info className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Quick upload without validation</p>
                    <p className="text-xs text-slate-600">
                        Step 1: Add Excel and PDFs. Step 2: Choose tabs and optionally send to confirmer. We create reports and
                        fill assets; final send depends on your checkbox.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">Step 1</span>
                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                            Upload Excel (Report Info + market)
                        </h3>
                    </div>
                    <p className="text-xs text-gray-600">
                        Only sheets &quot;Report Info&quot; and &quot;market&quot; are read. One report is created per market row.
                    </p>
                    <label className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2 text-sm text-gray-800">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {excelFile
                                    ? excelFile.name
                                    : rememberedFiles.mainExcel
                                        ? `Last: ${rememberedFiles.mainExcel}`
                                        : "Choose Excel file"}
                            </span>
                        </div>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleExcelChange}
                        />
                        <span className="text-xs text-blue-600 font-semibold">Browse</span>
                    </label>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Excel uploads when you click &quot;Send to Taqeem&quot;.</span>
                        <button
                            onClick={clearAll}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-100 text-gray-700 text-xs font-semibold hover:bg-slate-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-[11px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-100">Step 2</span>
                        <Files className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                            Upload PDFs (match by asset_name)
                        </h3>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                        <p>Filenames should equal asset_name + &quot;.pdf&quot;</p>
                        <p>Current Batch ID: <span className="font-mono text-gray-800">{batchId || "—"}</span></p>
                    </div>
                    <label className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2 text-sm text-gray-800">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {pdfFiles.length
                                    ? `${pdfFiles.length} file(s) selected`
                                    : rememberedFiles.mainPdfs.length
                                        ? `Last: ${rememberedFiles.mainPdfs.length} PDF(s)`
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
                        <span className="text-xs text-blue-600 font-semibold">Browse</span>
                    </label>

                    <div className="grid grid-cols-[auto,1fr] gap-y-2 gap-x-3 items-center">
                        <label className="text-xs font-semibold text-gray-700 col-span-2">
                            Number of tabs to open in Taqeem
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setNumTabs(prev => Math.max(1, prev - 1))}
                                disabled={numTabs <= 1}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={numTabs}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value >= 1 && value <= 10) {
                                        setNumTabs(value);
                                    }
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setNumTabs(prev => Math.min(10, prev + 1))}
                                disabled={numTabs >= 10}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                +
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-500 col-span-2">
                            Each tab will process a portion of the reports.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setPdfFiles([]);
                                resetMessages();
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 text-gray-700 text-sm hover:bg-slate-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Clear PDFs
                        </button>
                    </div>
                </div>
            </div>

            {(error || success) && (
                <div
                    className={`rounded-xl p-3 flex items-start gap-2 border ${error
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-emerald-50 text-emerald-700 border-emerald-100"
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

            {(mainReportSnapshot || mainReportIssues.length) ? (
                <ValidationResultsCard
                    title="Report Info validation"
                    issues={mainReportIssues}
                    snapshot={mainReportSnapshot}
                />
            ) : null}

            <div className="mt-3 space-y-3">
                <label className="inline-flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-amber-600 border-amber-400 focus:ring-amber-500"
                        checked={sendToConfirmerMain}
                        onChange={(e) => setSendToConfirmerMain(e.target.checked)}
                    />
                    <span className="text-sm text-gray-800 font-semibold leading-5">
                        Do you want to send the report to the confirmer? / هل تريد ارسال التقرير الي المعتمد ؟
                    </span>
                </label>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={sendToTaqeem}
                        disabled={sendingTaqeem || !excelFile || !pdfFiles.length || mainReportIssues.length > 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {sendingTaqeem ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Send to Taqeem
                    </button>
                    {mainReportIssues.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                            Resolve the report info issues above to enable sending.
                        </div>
                    )}
                    {sendingTaqeem && (
                        <ControlButtons
                            isPaused={isPausedMain}
                            isRunning={sendingTaqeem}
                            onPause={handlePauseMain}
                            onResume={handleResumeMain}
                            onStop={handleStopMain}
                        />
                    )}
                </div>
                {!batchId && (
                    <p className="text-xs text-gray-500">
                        Upload Excel and PDFs, then click &quot;Send to Taqeem&quot;. Toggle the checkbox if you want to finalize.
                    </p>
                )}
            </div>

            {excelResult?.reports?.length ? (
                <div className="bg-white border rounded-lg shadow-sm">
                    <div className="px-4 py-3 border-b flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-600" />
                            <div>
                                <p className="text-sm font-semibold text-gray-800">
                                    Created Reports
                                </p>
                                <p className="text-xs text-gray-500">
                                    Batch: {excelResult.batchId}
                                </p>
                                {excelResult.source === "system" && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Reports created from system upload
                                    </p>
                                )}
                            </div>
                        </div>
                        {downloadPath && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (downloadingExcel) return;
                                    try {
                                        setDownloadingExcel(true);
                                        const response = await httpClient.get(downloadPath, {
                                            responseType: "blob",
                                        });

                                        const disposition = response.headers["content-disposition"] || "";
                                        const match = disposition.match(/filename="?([^"]+)"?/);
                                        const filename = match && match[1] ? match[1] : "updated.xlsx";

                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                        const link = document.createElement("a");
                                        link.href = url;
                                        link.setAttribute("download", filename);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error("Failed to download updated Excel", err);
                                        setError("Failed to download updated Excel");
                                    } finally {
                                        setDownloadingExcel(false);
                                    }
                                }}
                                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                                disabled={downloadingExcel}
                            >
                                {downloadingExcel ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                {downloadingExcel ? "Preparing..." : "Download updated Excel"}
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr className="text-left text-gray-600">
                                    <th className="px-4 py-2">#</th>
                                    <th className="px-4 py-2">Asset Name</th>
                                    <th className="px-4 py-2">Client Name</th>
                                    <th className="px-4 py-2">PDF Path</th>
                                    <th className="px-4 py-2">Report ID</th>
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
                                        <td className="px-4 py-2 text-gray-700">
                                            {r.report_id ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-800 border border-emerald-100">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {r.report_id}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">Pending from Taqeem</span>
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

    const checkReportsContent = (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-gray-900">Check reports uploaded</p>
                    <p className="text-xs text-gray-600">
                        Expand a batch to view its reports, run a status check, delete completed reports, or reupload incomplete ones.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={loadBatchList}
                        className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-slate-200"
                        disabled={batchLoading}
                    >
                        <RefreshCw className={`w-4 h-4 ${batchLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => runBatchCheck()}
                        disabled={!batchList.length || checkingAllBatches}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {checkingAllBatches ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Check all batches
                    </button>
                    {/* Removed pause buttons from check all batches */}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                    <FolderOpen className="w-5 h-5 text-blue-600" />
                    <div>
                        <p className="text-sm font-semibold text-gray-900">Tabs Configuration</p>
                        <p className="text-xs text-gray-500">
                            Set the number of tabs to open in Taqeem for batch checking operations
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">
                            Number of tabs to open in Taqeem:
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setNumTabs(prev => Math.max(1, prev - 1))}
                                disabled={numTabs <= 1}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={numTabs}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value >= 1 && value <= 10) {
                                        setNumTabs(value);
                                    }
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setNumTabs(prev => Math.min(10, prev + 1))}
                                disabled={numTabs >= 10}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                +
                            </button>
                            <span className="text-xs text-gray-500 ml-1">
                                (1-10)
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">
                            Each tab will process a portion of the reports during batch checking.
                        </p>
                    </div>

                    <div className="text-xs text-gray-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="font-semibold text-gray-700 mb-1">Current setting: {numTabs} tab{numTabs !== 1 ? "s" : ""}</p>
                        <p>This setting is used when checking batches and reuploading reports.</p>
                    </div>
                </div>
            </div>

            {batchMessage && (
                <div
                    className={`rounded-lg border p-3 flex items-start gap-2 ${batchMessage.type === "error"
                        ? "bg-red-50 border-red-100 text-red-700"
                        : batchMessage.type === "success"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                            : "bg-blue-50 border-blue-100 text-blue-700"
                        }`}
                >
                    {batchMessage.type === "error" ? (
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                    ) : batchMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    ) : (
                        <Info className="w-4 h-4 mt-0.5" />
                    )}
                    <div className="text-sm">{batchMessage.text}</div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                {batchLoading && !batchList.length ? (
                    <div className="p-6 flex items-center gap-3 text-sm text-gray-600">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        Loading batches...
                    </div>
                ) : batchList.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="px-4 py-2 text-left">Local</th>
                                    <th className="px-4 py-2 text-left">Batch ID</th>
                                    <th className="px-4 py-2 text-left">Reports</th>
                                    <th className="px-4 py-2 text-left">With report ID</th>
                                    <th className="px-4 py-2 text-left">Complete</th>
                                    <th className="px-4 py-2 text-left"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedBatches.map((batch, idx) => {
                                    const isExpanded = expandedBatch === batch.batchId;
                                    const sent = batch.sentReports || 0;
                                    const confirmed = batch.confirmedReports || 0;
                                    const completed = batch.completedReports || 0;
                                    const total = batch.totalReports || 0;
                                    const isCheckingThisBatch = checkingBatchId === batch.batchId;
                                    const isRetryingThisBatch = retryingBatchId === batch.batchId;
                                    const localNumber = batchList.length - (batchPageStart + idx);
                                    return (
                                        <React.Fragment key={batch.batchId}>
                                            <tr className="border-b last:border-0">
                                                <td className="px-4 py-3 text-gray-800">{localNumber}</td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBatchExpand(batch.batchId)}
                                                        className="inline-flex items-center gap-2 text-left text-sm font-semibold text-gray-900"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4 text-gray-600" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4 text-gray-600" />
                                                        )}
                                                        <span>{batch.batchId}</span>
                                                    </button>
                                                    {batch.excelName ? (
                                                        <p className="text-xs text-gray-500 ml-6">
                                                            {batch.excelName}
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-gray-800">
                                                    {total}
                                                </td>
                                                <td className="px-4 py-3 text-gray-800">
                                                    {batch.withReportId || 0}/{total || 0}
                                                </td>
                                                <td className="px-4 py-3 text-gray-800">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-gray-800 border border-slate-200">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            {completed}/{total} done
                                                        </span>
                                                        {sent ? (
                                                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-100">
                                                                <Send className="w-3 h-3" />
                                                                {sent} sent
                                                            </span>
                                                        ) : null}
                                                        {confirmed ? (
                                                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700 border border-emerald-100">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                {confirmed} confirmed
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex gap-2 justify-end flex-wrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => runBatchCheck(batch.batchId)}
                                                            disabled={isCheckingThisBatch || isRetryingThisBatch}
                                                            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                                        >
                                                            {isCheckingThisBatch ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <RefreshCw className="w-4 h-4" />
                                                            )}
                                                            Check batch
                                                        </button>
                                                        {/* Removed pause buttons from check batch button */}
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!window?.electronAPI?.retryElrajhiReport) {
                                                                    setBatchMessage({
                                                                        type: "error",
                                                                        text: "Desktop integration unavailable. Restart the app.",
                                                                    });
                                                                    return;
                                                                }
                                                                setRetryingBatchId(batch.batchId);
                                                                setCurrentOperationBatchId(batch.batchId);
                                                                setIsPausedBatchRetry(false);
                                                                setBatchMessage({
                                                                    type: "info",
                                                                    text: `Retrying batch ${batch.batchId}...`
                                                                });
                                                                try {
                                                                    const result = await window.electronAPI.retryElrajhiReport(batch.batchId, numTabs);
                                                                    if (result?.status !== "SUCCESS") {
                                                                        throw new Error(result?.error || "Retry failed");
                                                                    }
                                                                    setBatchMessage({
                                                                        type: "success",
                                                                        text: `Retry completed for batch ${batch.batchId}`
                                                                    });
                                                                    await loadBatchReports(batch.batchId);
                                                                    await loadBatchList();
                                                                } catch (err) {
                                                                    setBatchMessage({
                                                                        type: "error",
                                                                        text: err.message || "Failed to retry batch"
                                                                    });
                                                                } finally {
                                                                    setRetryingBatchId(null);
                                                                    setCurrentOperationBatchId(null);
                                                                }
                                                            }}
                                                            disabled={isCheckingThisBatch || isRetryingThisBatch}
                                                            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                                                        >
                                                            {isRetryingThisBatch ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <RotateCw className="w-4 h-4" />
                                                            )}
                                                            Retry
                                                        </button>
                                                        {isRetryingThisBatch && (
                                                            <ControlButtons
                                                                isPaused={isPausedBatchRetry}
                                                                isRunning={isRetryingThisBatch}
                                                                onPause={() => handlePauseBatchRetry(batch.batchId)}
                                                                onResume={() => handleResumeBatchRetry(batch.batchId)}
                                                                onStop={() => handleStopBatchRetry(batch.batchId)}
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="border-b last:border-0">
                                                    <td colSpan={6} className="bg-slate-50">
                                                        <div className="p-4">
                                                            {batchReports[batch.batchId] ? (
                                                                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                                    <table className="min-w-full text-sm">
                                                                        <thead className="bg-gray-50 text-gray-600">
                                                                            <tr>
                                                                                <th className="px-3 py-2 text-left">Report ID</th>
                                                                                <th className="px-3 py-2 text-left">Client</th>
                                                                                <th className="px-3 py-2 text-left">Asset</th>
                                                                                <th className="px-3 py-2 text-left">Status</th>
                                                                                <th className="px-3 py-2 text-left">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                className="h-4 w-4"
                                                                                                checked={
                                                                                                    batchReports[batch.batchId]?.length
                                                                                                        ? batchReports[batch.batchId].every((r) =>
                                                                                                            isSelected(batch.batchId, r.report_id || r.reportId)
                                                                                                        )
                                                                                                        : false
                                                                                                }
                                                                                                onChange={(e) =>
                                                                                                    toggleSelectAllForBatch(
                                                                                                        batch.batchId,
                                                                                                        batchReports[batch.batchId] || [],
                                                                                                        e.target.checked
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                            <span className="text-xs text-gray-700">Select all</span>
                                                                                        </div>
                                                                                        <div className="relative">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setActionMenuBatch(
                                                                                                        actionMenuBatch === batch.batchId ? null : batch.batchId
                                                                                                    );
                                                                                                    setActionMenuOpen(actionMenuBatch !== batch.batchId ? true : !actionMenuOpen);
                                                                                                }}
                                                                                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-gray-800 border border-slate-200"
                                                                                            >
                                                                                                Actions
                                                                                                {actionMenuOpen && actionMenuBatch === batch.batchId ? (
                                                                                                    <ChevronUp className="w-3 h-3" />
                                                                                                ) : (
                                                                                                    <ChevronDown className="w-3 h-3" />
                                                                                                )}
                                                                                            </button>
                                                                                            {actionMenuOpen && actionMenuBatch === batch.batchId && (
                                                                                                <div className="absolute right-0 mt-1 w-44 rounded-md border border-slate-200 bg-white shadow-lg z-10">
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                                                                                                        onClick={() => handleBulkAction("delete", batch.batchId, batchReports[batch.batchId] || [])}
                                                                                                    >
                                                                                                        <Trash2 className="w-4 h-4" />
                                                                                                        Delete
                                                                                                    </button>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-blue-700 hover:bg-blue-50"
                                                                                                        onClick={() => handleBulkAction("retry", batch.batchId, batchReports[batch.batchId] || [])}
                                                                                                    >
                                                                                                        <RotateCw className="w-4 h-4" />
                                                                                                        Retry
                                                                                                    </button>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-emerald-700 hover:bg-emerald-50"
                                                                                                        onClick={() => handleBulkAction("send", batch.batchId, batchReports[batch.batchId] || [])}
                                                                                                    >
                                                                                                        <Send className="w-4 h-4" />
                                                                                                        Send
                                                                                                    </button>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-purple-700 hover:bg-purple-50"
                                                                                                        onClick={() => handleBulkAction("approve", batch.batchId, batchReports[batch.batchId] || [])}
                                                                                                    >
                                                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                                                        Approve
                                                                                                    </button>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {batchReports[batch.batchId].map((report) => {
                                                                                const reportId = report.report_id || report.reportId || "";
                                                                                const submitState = report.submit_state ?? report.submitState;
                                                                                const rawStatus = (report.report_status || report.reportStatus || report.status || "").toString().toUpperCase();

                                                                                // Handle status based on submit_state
                                                                                let normalizedStatus;
                                                                                if (submitState === -1) {
                                                                                    normalizedStatus = "DELETED";
                                                                                } else if (submitState === 1) {
                                                                                    normalizedStatus = "COMPLETE";
                                                                                } else if (submitState === 0) {
                                                                                    normalizedStatus = "INCOMPLETE";
                                                                                } else {
                                                                                    // Fallback to old logic if submit_state not set
                                                                                    normalizedStatus = rawStatus || ((report.status === "COMPLETE") ? "COMPLETE" : "INCOMPLETE");
                                                                                }

                                                                                let status;
                                                                                if (submitState === -1) {
                                                                                    status = "DELETED";
                                                                                } else if (!reportId) {
                                                                                    status = "MISSING_ID";
                                                                                } else if (report.report_status === "SENT") {
                                                                                    status = "SENT";
                                                                                }

                                                                                else {
                                                                                    status = normalizedStatus;
                                                                                }

                                                                                return (
                                                                                    <tr key={report.id || reportId || report.asset_name} className="border-t last:border-0">
                                                                                        <td className="px-3 py-2 text-gray-900 font-semibold">
                                                                                            {reportId || <span className="text-gray-500">Not created</span>}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-gray-800">{report.client_name || "—"}</td>
                                                                                        <td className="px-3 py-2 text-gray-800">{report.asset_name || "—"}</td>
                                                                                        <td className="px-3 py-2">
                                                                                            {status === "COMPLETE" ? (
                                                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 border border-emerald-100 text-xs">
                                                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                                                    Complete
                                                                                                </span>
                                                                                            ) : status === "DELETED" ? (
                                                                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-red-700 border border-red-100 text-xs">
                                                                                                    <Trash2 className="w-3 h-3" />
                                                                                                    Deleted
                                                                                                </span>)

                                                                                                : status === "SENT" ? (
                                                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700 border border-blue-100 text-xs">
                                                                                                        <Send className="w-3 h-3" />
                                                                                                        Sent
                                                                                                    </span>
                                                                                                )
                                                                                                    : status === "CONFIRMED" ? (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 border border-emerald-100 text-xs">
                                                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                                                            Confirmed
                                                                                                        </span>
                                                                                                    ) : status === "MISSING_ID" ? (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700 border border-amber-100 text-xs">
                                                                                                            <AlertTriangle className="w-3 h-3" />
                                                                                                            Missing report ID
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700 border border-amber-100 text-xs">
                                                                                                            <AlertTriangle className="w-3 h-3" />
                                                                                                            Incomplete
                                                                                                        </span>
                                                                                                    )}
                                                                                        </td>
                                                                                        <td className="px-3 py-2">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                className="h-4 w-4"
                                                                                                checked={isSelected(batch.batchId, reportId)}
                                                                                                onChange={(e) => toggleReportSelection(batch.batchId, reportId, e.target.checked)}
                                                                                            />
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                    Loading reports...
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <div className="text-xs text-gray-600">
                                Page {currentPageSafe} of {totalBatchPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPageSafe <= 1}
                                    className="px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-gray-700 disabled:opacity-50"
                                >
                                    Prev
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalBatchPages }, (_, i) => {
                                        const pageNum = i + 1;
                                        const isActive = pageNum === currentPageSafe;
                                        return (
                                            <button
                                                key={`page-${pageNum}`}
                                                type="button"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`min-w-[34px] px-2 py-1.5 text-xs rounded-md border ${isActive
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-white text-gray-700 border-slate-200 hover:bg-slate-100"
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(totalBatchPages, p + 1))}
                                    disabled={currentPageSafe >= totalBatchPages}
                                    className="px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-gray-700 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-sm text-gray-600 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        No batches yet. Upload reports first, then come back to check their status.
                    </div>
                )}
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
                        Choose a flow: quick upload, validation with folder parsing, or check previously uploaded batches.
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
                    <TabButton
                        active={activeTab === "check-reports"}
                        onClick={() => setActiveTab("check-reports")}
                    >
                        Check reports uploaded
                    </TabButton>
                </div>
            </div>

            {activeTab === "no-validation"
                ? noValidationContent
                : activeTab === "validation"
                    ? validationContent
                    : checkReportsContent}
        </div>
    );
};

export default UploadReportElrajhi;