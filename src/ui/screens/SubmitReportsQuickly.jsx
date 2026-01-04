import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../context/SessionContext";
import { useNavStatus } from "../context/NavStatusContext";
import usePersistentState from "../hooks/usePersistentState";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import {
    FileSpreadsheet,
    Files,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Send,
    Trash2,
    Edit,
    RefreshCw,
    Table,
    Info,
    ShieldCheck,
} from "lucide-react";
import {
    submitReportsQuicklyUpload,
    fetchSubmitReportsQuickly,
    updateSubmitReportsQuickly,
    deleteSubmitReportsQuickly,
} from "../../api/report";
import { ensureTaqeemAuthorized } from "../../shared/helper/taqeemAuthWrap";

const DUMMY_PDF_NAME = "dummy_placeholder.pdf";

const getReportRecordId = (report) => report?._id || report?.id || report?.recordId || "";

const getReportStatus = (report) => {
    if (report?.checked) return "approved";
    if (report?.endSubmitTime) return "complete";
    if (report?.report_id) return "sent";
    return report?.report_status || "new";
};

const reportStatusLabels = {
    approved: "Approved",
    complete: "Complete",
    sent: "Sent",
    new: "New",
    incomplete: "Incomplete",
};

const reportStatusClasses = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    complete: "border-blue-200 bg-blue-50 text-blue-700",
    sent: "border-amber-200 bg-amber-50 text-amber-700",
    new: "border-slate-200 bg-slate-50 text-slate-700",
    incomplete: "border-rose-200 bg-rose-50 text-rose-700",
};

// Helper functions for validation
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

const stripExtension = (filename = "") => filename.replace(/\.[^.]+$/, "");

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

const validateAssetUsageId = (sheetName, rows = []) => {
    const issues = [];
    const addIssue = (field, location, message) => issues.push({ field, location, message });

    rows.forEach((row, idx) => {
        const assetName = row.asset_name || row.assetName || row["asset_name\n"] || row["Asset Name"] || "";
        if (!hasValue(assetName)) return;
        const assetUsageId = pickFieldValue(row, ["asset_usage_id", "asset usage id", "asset usage", "asset_usage_id\n", "Asset Usage ID"]);
        if (!hasValue(assetUsageId)) {
            addIssue("asset_usage_id", `${sheetName} row ${idx + 2}`, `Missing asset_usage_id for asset "${assetName}"`);
        } else {
            const num = Number(assetUsageId);
            if (isNaN(num) || num <= 0) {
                addIssue("asset_usage_id", `${sheetName} row ${idx + 2}`, `Invalid asset_usage_id "${assetUsageId}" for asset "${assetName}"`);
            }
        }
    });

    return issues;
};

const validateCostSheetIntegers = (rows = []) => {
    const issues = [];
    const addIssue = (field, location, message) => issues.push({ field, location, message });

    rows.forEach((row, idx) => {
        const assetName = row.asset_name || row.assetName || row["asset_name\n"] || row["Asset Name"] || "";
        if (!hasValue(assetName)) return;
        const rawFinal = pickFieldValue(row, ["final_value", "final value", "value", "Final Value", "Value", "final_value\n"]);
        if (!hasValue(rawFinal)) {
            addIssue("final_value", `cost row ${idx + 2}`, `Missing final_value for asset "${assetName}"`);
            return;
        }

        const num = Number(rawFinal);
        if (Number.isNaN(num)) {
            addIssue("final_value", `cost row ${idx + 2}`, `Invalid final_value "${rawFinal}" for asset "${assetName}"`);
            return;
        }

        if (!Number.isInteger(num)) {
            addIssue("final_value", `cost row ${idx + 2}`, `final_value must be an integer for asset "${assetName}"`);
            return;
        }

        if (num <= 0) {
            addIssue("final_value", `cost row ${idx + 2}`, `final_value must be positive for asset "${assetName}"`);
        }
    });

    return issues;
};

const validateMarketSheet = (rows = []) => {
    const issues = [];
    const addIssue = (field, location, message) => issues.push({ field, location, message });

    rows.forEach((row, idx) => {
        const assetName = row.asset_name || row.assetName || row["asset_name\n"] || row["Asset Name"] || "";
        if (!hasValue(assetName)) return;
        const rawFinal = pickFieldValue(row, ["final_value", "final value", "value", "Final Value", "Value", "final_value\n"]);
        if (!hasValue(rawFinal)) {
            addIssue("final_value", `market row ${idx + 2}`, `Missing final_value for asset "${assetName}"`);
            return;
        }

        const num = Number(rawFinal);
        if (Number.isNaN(num)) {
            addIssue("final_value", `market row ${idx + 2}`, `Invalid final_value "${rawFinal}" for asset "${assetName}"`);
            return;
        }

        if (num <= 0) {
            addIssue("final_value", `market row ${idx + 2}`, `final_value must be positive for asset "${assetName}"`);
        }
    });

    return issues;
};

// PDF size validation (20 MB = 20 * 1024 * 1024 bytes)
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB in bytes

const SubmitReportsQuickly = ({ onViewChange }) => {
    const { token } = useSession();
    const { taqeemStatus } = useNavStatus();
    const [excelFiles, setExcelFiles] = useState([]);
    const [pdfFiles, setPdfFiles] = useState([]);
    const [wantsPdfUpload, setWantsPdfUpload] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validationItems, setValidationItems] = useState([]);
    const [validationMessage, setValidationMessage] = useState(null);
    const [validationTableTab, setValidationTableTab] = useState("assets");
    const [isValidationTableCollapsed, setIsValidationTableCollapsed] = useState(false);
    const [reports, setReports, resetReports] = usePersistentState("submitReportsQuickly:reports", [], { storage: "session" });
    const [reportsLoading, setReportsLoading] = useState(false);
    const [expandedReports, setExpandedReports] = useState([]);
    const [selectedReportIds, setSelectedReportIds] = useState([]);
    const [reportSelectFilter, setReportSelectFilter] = useState("all");
    const [reportActionBusy, setReportActionBusy] = useState({});
    const [actionDropdown, setActionDropdown] = useState({});
    const [bulkAction, setBulkAction] = useState("");
    const [editingReportId, setEditingReportId] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        client_name: "",
        purpose_id: "1",
        value_premise_id: "1",
        report_type: "تقرير مفصل",
        telephone: "999999999",
        email: "a@a.com",
    });

    const pdfInputRef = useRef(null);
    const isTaqeemLoggedIn = taqeemStatus?.state === "success";

    const handleExcelChange = (e) => {
        const files = Array.from(e.target.files || []);
        setExcelFiles(files);
        resetMessages();
    };

    const handlePdfChange = (e) => {
        const files = Array.from(e.target.files || []);
        const oversizedFiles = files.filter(file => file.size > MAX_PDF_SIZE);
        
        if (oversizedFiles.length > 0) {
            const oversizedNames = oversizedFiles.map(f => f.name).join(", ");
            setError(`PDF file(s) exceed 20 MB limit: ${oversizedNames}`);
            return;
        }
        
        setPdfFiles(files);
        resetMessages();
    };

    const handlePdfToggle = (checked) => {
        setWantsPdfUpload(checked);
        if (!checked) {
            setPdfFiles([]);
        } else {
            if (pdfInputRef?.current) {
                pdfInputRef.current.value = null;
                pdfInputRef.current.click();
            }
        }
        resetMessages();
    };

    const resetMessages = () => {
        setError("");
        setSuccess("");
    };

    const resetValidation = () => {
        setValidationItems([]);
        setValidationMessage(null);
    };

    const loadReports = useCallback(async () => {
        try {
            setReportsLoading(true);
            const result = await fetchSubmitReportsQuickly();
            if (!result?.success) {
                throw new Error(result?.message || "Failed to load reports.");
            }
            const reportList = Array.isArray(result.reports) ? result.reports : [];
            setReports(reportList);
        } catch (err) {
            setError(err?.message || "Failed to load reports.");
        } finally {
            setReportsLoading(false);
        }
    }, [setReports]);

    useEffect(() => {
        if (reports.length === 0 && !reportsLoading) {
            loadReports();
        }
    }, []);

    const pdfMatchInfo = useMemo(() => {
        if (!wantsPdfUpload) {
            return { unmatchedPdfs: [], excelsMissingPdf: [], pdfMap: {} };
        }
        const excelBaseNames = new Set(excelFiles.map((f) => normalizeKey(stripExtension(f.name))));
        const pdfBaseNames = new Set(pdfFiles.map((f) => normalizeKey(stripExtension(f.name))));

        const unmatchedPdfs = pdfFiles
            .filter((f) => !excelBaseNames.has(normalizeKey(stripExtension(f.name))))
            .map((f) => f.name);

        const excelsMissingPdf = excelFiles
            .filter((f) => !pdfBaseNames.has(normalizeKey(stripExtension(f.name))))
            .map((f) => f.name);

        const pdfMap = pdfFiles.reduce((acc, file) => {
            acc[normalizeKey(stripExtension(file.name))] = file;
            return acc;
        }, {});

        return { unmatchedPdfs, excelsMissingPdf, pdfMap };
    }, [excelFiles, pdfFiles, wantsPdfUpload]);

    const runValidation = async (excelList, pdfMap) => {
        if (!excelList.length) {
            resetValidation();
            return;
        }

        setValidating(true);
        setValidationMessage({
            type: "info",
            text: "Reading Excel files and validating...",
        });

        try {
            const shouldValidatePdf = wantsPdfUpload;
            const results = [];
            
            for (const file of excelList) {
                const buffer = await file.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);

                const marketSheet = workbook.getWorksheet("market");
                const costSheet = workbook.getWorksheet("cost");

                const issues = [];
                const addIssue = (field, location, message) => issues.push({ field, location, message });

                if (!marketSheet && !costSheet) {
                    addIssue(
                        "Workbook",
                        "Sheets",
                        "Excel must contain at least one of 'market' or 'cost' sheets."
                    );
                    results.push({
                        fileName: file.name,
                        baseName: normalizeKey(stripExtension(file.name)),
                        pdfMatched: false,
                        pdfName: "",
                        issues,
                        snapshot: null,
                        totals: null,
                        counts: null,
                    });
                    continue;
                }

                const marketRows = marketSheet ? worksheetToObjects(marketSheet) : [];
                const costRows = costSheet ? worksheetToObjects(costSheet) : [];

                // Validate market sheet
                if (marketSheet) {
                    issues.push(...validateMarketSheet(marketRows));
                    issues.push(...validateAssetUsageId("market", marketRows));
                }

                // Validate cost sheet
                if (costSheet) {
                    issues.push(...validateCostSheetIntegers(costRows));
                    issues.push(...validateAssetUsageId("cost", costRows));
                }

                const marketAssetCount = marketRows.filter((r) =>
                    hasValue(r.asset_name || r.assetName || r["asset_name\n"] || r["Asset Name"])
                ).length;
                const costAssetCount = costRows.filter((r) =>
                    hasValue(r.asset_name || r.assetName || r["asset_name\n"] || r["Asset Name"])
                ).length;
                
                if (marketAssetCount === 0 && costAssetCount === 0) {
                    addIssue(
                        "Assets",
                        "Sheets",
                        "No assets found in market or cost sheets."
                    );
                }

                const sumSheet = (rows, sheetName) =>
                    rows.reduce((acc, row, idx) => {
                        const assetName = row.asset_name || row.assetName || row["asset_name\n"] || row["Asset Name"] || "";
                        if (!hasValue(assetName)) return acc;
                        const rawFinal = pickFieldValue(row, ["final_value", "final value", "value", "Final Value", "Value", "final_value\n"]);
                        const num = Number(rawFinal);
                        if (Number.isNaN(num)) {
                            return acc;
                        }
                        return acc + num;
                    }, 0);

                const marketTotal = sumSheet(marketRows, "market");
                const costTotal = sumSheet(costRows, "cost");
                const assetsTotal = marketTotal + costTotal;

                // Calculate report data (will be auto-generated)
                const number_of_macros = marketAssetCount + costAssetCount;
                const title = `${number_of_macros} + ${assetsTotal}`;
                const client_name = `${number_of_macros} + ${assetsTotal}`;

                const baseName = normalizeKey(stripExtension(file.name));
                const matchedPdf = shouldValidatePdf ? pdfMap[baseName] : { name: DUMMY_PDF_NAME };
                if (shouldValidatePdf && !matchedPdf) {
                    addIssue("PDF Match", "Files", `No matching PDF found for Excel "${file.name}" (match by filename).`);
                }

                // Check PDF size if matched (only if it's a File object)
                if (matchedPdf && matchedPdf instanceof File && matchedPdf.size) {
                    if (matchedPdf.size > MAX_PDF_SIZE) {
                        const sizeMB = (matchedPdf.size / (1024 * 1024)).toFixed(2);
                        addIssue("PDF Size", "Files", `PDF "${matchedPdf.name}" exceeds 20 MB limit (${sizeMB} MB).`);
                    }
                }

                // Get today's date in yyyy-mm-dd format
                const today = new Date();
                const todayDate = today.toISOString().split('T')[0];

                results.push({
                    fileName: file.name,
                    baseName,
                    pdfMatched: shouldValidatePdf ? Boolean(matchedPdf) : true,
                    pdfName: shouldValidatePdf ? matchedPdf?.name || "" : DUMMY_PDF_NAME,
                    issues,
                    snapshot: {
                        title,
                        client_name,
                        purpose_id: "1",
                        value_premise_id: "1",
                        report_type: "تقرير مفصل",
                        telephone: "999999999",
                        email: "a@a.com",
                        number_of_macros,
                        final_value: assetsTotal,
                        value: assetsTotal,
                        valued_at: todayDate,
                        submitted_at: todayDate,
                    },
                    totals: {
                        assetsTotalValue: assetsTotal,
                        marketTotal,
                        costTotal,
                    },
                    counts: {
                        marketAssets: marketAssetCount,
                        costAssets: costAssetCount,
                    },
                });
            }

            // Add PDF size validation for all PDFs (check all files in pdfFiles array)
            if (shouldValidatePdf && pdfFiles.length > 0) {
                pdfFiles.forEach((pdfFile) => {
                    if (pdfFile.size > MAX_PDF_SIZE) {
                        const sizeMB = (pdfFile.size / (1024 * 1024)).toFixed(2);
                        const baseName = normalizeKey(stripExtension(pdfFile.name));
                        const matchingResult = results.find(r => r.baseName === baseName);
                        if (matchingResult) {
                            matchingResult.issues.push({
                                field: "PDF Size",
                                location: "Files",
                                message: `PDF "${pdfFile.name}" exceeds 20 MB limit (${sizeMB} MB).`
                            });
                        } else if (results.length > 0) {
                            // Add to first result if no match found
                            results[0].issues.push({
                                field: "PDF Size",
                                location: "Files",
                                message: `PDF "${pdfFile.name}" exceeds 20 MB limit (${sizeMB} MB).`
                            });
                        }
                    }
                });
            }

            setValidationItems(results);

            const totalIssues = results.reduce((acc, r) => acc + (r.issues?.length || 0), 0);
            const hasPdfMismatch = shouldValidatePdf
                ? (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length)
                : false;
            if (totalIssues === 0 && !hasPdfMismatch) {
                setValidationMessage({
                    type: "success",
                    text: shouldValidatePdf
                        ? "All Excel files look valid and PDFs are matched. You can Upload & Create Reports."
                        : `All Excel files look valid. PDFs will use ${DUMMY_PDF_NAME}. You can Upload & Create Reports.`,
                });
            } else {
                setValidationMessage({
                    type: "error",
                    text: "Validation found issues. Fix them to enable Upload & Create Reports.",
                });
            }
        } catch (err) {
            console.error("Validation failed", err);
            setValidationMessage({
                type: "error",
                text: err?.message || "Failed to validate Excel files.",
            });
        } finally {
            setValidating(false);
        }
    };

    useEffect(() => {
        if (excelFiles.length > 0) {
            runValidation(excelFiles, pdfMatchInfo.pdfMap);
        } else {
            resetValidation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [excelFiles, pdfFiles, wantsPdfUpload]);

    const isReadyToUpload = useMemo(() => {
        if (excelFiles.length === 0) return false;
        if (wantsPdfUpload && pdfFiles.length === 0) return false;
        if (wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length)) {
            return false;
        }
        if (validating) return false;
        if (!validationItems.length) return false;
        const anyIssues = validationItems.some((item) => (item.issues || []).length > 0);
        if (anyIssues) return false;
        return true;
    }, [excelFiles.length, pdfFiles.length, wantsPdfUpload, validating, validationItems, pdfMatchInfo]);

    const handleUpload = async () => {
        try {
            setLoading(true);
            resetMessages();

            if (excelFiles.length === 0) {
                throw new Error("Please select at least one Excel file");
            }
            if (wantsPdfUpload && pdfFiles.length === 0) {
                throw new Error("Please select at least one PDF file or disable PDF upload.");
            }
            if (wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length)) {
                throw new Error("PDF filenames must match the Excel filenames.");
            }
            if (!isReadyToUpload) {
                throw new Error("Please fix validation issues before uploading.");
            }

            setSuccess("Uploading files to server...");
            const data = await submitReportsQuicklyUpload(
                excelFiles,
                wantsPdfUpload ? pdfFiles : [],
                !wantsPdfUpload
            );

            if (data.status !== "success") {
                throw new Error(data.error || "Upload failed");
            }

            const insertedCount = data.created || 0;
            setSuccess(`Files uploaded successfully. Inserted ${insertedCount} report(s).`);
            await loadReports();
            setExcelFiles([]);
            setPdfFiles([]);
            setWantsPdfUpload(false);

        } catch (err) {
            console.error("Upload failed", err);
            const status = err?.response?.status;
            const apiError =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to upload files";

            if (status === 400) {
                setError(apiError || "Bad request. Please check the selected files and try again.");
            } else if (status === 500) {
                setError(apiError || "Server error while processing your files. Please try again or contact support.");
            } else if (err?.code === "ERR_NETWORK") {
                setError("Network error. Make sure the backend server is running and reachable.");
            } else {
                setError(apiError);
            }
        } finally {
            setLoading(false);
        }
    };

    const resolveTabsForAssets = useCallback(
        (assetCount) => {
            const fallbackTabs = 3; // Default tabs
            if (!assetCount || assetCount < 1) return fallbackTabs;
            return Math.max(1, Math.min(fallbackTabs, assetCount));
        },
        []
    );

    const submitToTaqeem = useCallback(
        async (recordId, tabsNum, options = {}) => {
            const { withLoading = true, resume = false } = options;
            
            if (!recordId) {
                setError("Missing report record id.");
                return;
            }

            // Find the report to get asset count
            const report = reports.find(r => getReportRecordId(r) === recordId);
            const assetCount = report?.asset_data?.length || 0;
            const resolvedTabs = tabsNum || resolveTabsForAssets(assetCount);

            setReportActionBusy((prev) => ({ ...prev, [recordId]: true }));

            try {
                const ok = await ensureTaqeemAuthorized(token, onViewChange, isTaqeemLoggedIn);
                if (!ok) {
                    setError("Taqeem login required. Finish login and choose a company to continue.");
                    return;
                }

                setSuccess(resume ? "Resuming Taqeem submission..." : "Submitting report to Taqeem...");

                if (!window?.electronAPI?.createReportById) {
                    throw new Error("Desktop integration unavailable. Restart the app.");
                }

                const result = await window.electronAPI.createReportById(recordId, resolvedTabs);

                if (result?.status === "SUCCESS") {
                    setSuccess("Report submitted to Taqeem successfully.");
                    await loadReports();
                    return;
                }

                const errMsg = result?.error || "Upload to Taqeem failed. Make sure you selected a company.";
                setError(errMsg);
            } catch (err) {
                setError(err?.message || "Failed to submit report to Taqeem.");
            } finally {
                setReportActionBusy((prev) => ({ ...prev, [recordId]: false }));
            }
        },
        [isTaqeemLoggedIn, loadReports, onViewChange, token, reports, resolveTabsForAssets]
    );

    const handleDeleteReport = async (recordId) => {
        if (!recordId) return;
        if (!window.confirm("Are you sure you want to delete this report?")) return;

        setReportActionBusy((prev) => ({ ...prev, [recordId]: true }));

        try {
            const result = await deleteSubmitReportsQuickly(recordId);
            if (result?.success) {
                setSuccess("Report deleted successfully.");
                await loadReports();
            } else {
                setError(result?.message || "Failed to delete report.");
            }
        } catch (err) {
            setError(err?.message || "Failed to delete report.");
        } finally {
            setReportActionBusy((prev) => ({ ...prev, [recordId]: false }));
        }
    };

    const handleEditReport = (report) => {
        const recordId = getReportRecordId(report);
        if (!recordId) return;
        setFormData({
            title: report.title || "",
            client_name: report.client_name || "",
            purpose_id: String(report.purpose_id || "1"),
            value_premise_id: String(report.value_premise_id || "1"),
            report_type: report.report_type || "تقرير مفصل",
            telephone: report.telephone || "999999999",
            email: report.email || "a@a.com",
        });
        setEditingReportId(recordId);
    };

    const handleUpdateReport = async () => {
        if (!editingReportId) return;

        setSubmitting(true);
        try {
            const result = await updateSubmitReportsQuickly(editingReportId, formData);
            if (result?.success) {
                setSuccess("Report updated successfully.");
                setEditingReportId(null);
                await loadReports();
            } else {
                setError(result?.message || "Failed to update report.");
            }
        } catch (err) {
            setError(err?.message || "Failed to update report.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleBulkAction = async () => {
        if (!bulkAction) return;

        const selectedIds = selectedReportIds.filter(Boolean);
        if (selectedIds.length === 0) {
            setError("Please select at least one report.");
            return;
        }

        if (bulkAction === "delete") {
            if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} report(s)?`)) return;
            for (const id of selectedIds) {
                await handleDeleteReport(id);
            }
            setSelectedReportIds([]);
            setBulkAction("");
            return;
        }

        if (bulkAction === "upload-submit") {
            for (const id of selectedIds) {
                const report = reports.find(r => getReportRecordId(r) === id);
                const assetCount = report?.asset_data?.length || 0;
                const tabsNum = resolveTabsForAssets(assetCount);
                await submitToTaqeem(id, tabsNum);
            }
            setSelectedReportIds([]);
            setBulkAction("");
            return;
        }

        if (bulkAction === "retry-submit") {
            for (const id of selectedIds) {
                const report = reports.find(r => getReportRecordId(r) === id);
                const assetCount = report?.asset_data?.length || 0;
                const tabsNum = resolveTabsForAssets(assetCount);
                await submitToTaqeem(id, tabsNum);
            }
            setSelectedReportIds([]);
            setBulkAction("");
            return;
        }
    };

    const handleReportAction = (report, action) => {
        const recordId = getReportRecordId(report);
        if (!recordId) return;

        if (action === "retry") {
            const assetCount = report?.asset_data?.length || 0;
            const tabsNum = resolveTabsForAssets(assetCount);
            submitToTaqeem(recordId, tabsNum);
        } else if (action === "delete") {
            handleDeleteReport(recordId);
        } else if (action === "edit") {
            handleEditReport(report);
        }
    };

    const toggleReportExpansion = (reportId) => {
        setExpandedReports((prev) =>
            prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]
        );
    };

    const toggleReportSelection = (reportId) => {
        setSelectedReportIds((prev) =>
            prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]
        );
    };

    const filteredReports = useMemo(() => {
        if (reportSelectFilter === "all") return reports;
        return reports.filter((report) => getReportStatus(report) === reportSelectFilter);
    }, [reports, reportSelectFilter]);

    const selectedReportSet = useMemo(() => new Set(selectedReportIds), [selectedReportIds]);

    return (
        <div className="relative p-3 space-y-3 page-animate overflow-x-hidden">
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-200/30 blur-3xl" />
                <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
                <div className="relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 py-3">
                    <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Quick Submission
                        </p>
                        <h2 className="text-lg md:text-xl font-display text-compact text-slate-900 font-bold">
                            Submit Reports Quickly
                        </h2>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 shadow-sm font-medium">
                                <Files className="h-3 w-3 text-sky-600" />
                                {wantsPdfUpload ? "PDF upload on" : "PDF upload optional"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 shadow-sm font-medium">
                                <ShieldCheck className="h-3 w-3 text-indigo-600" />
                                Validation enabled
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all min-w-[180px] flex-[0.85] group">
                            <div className="flex items-center gap-2 text-xs text-slate-700">
                                <FileSpreadsheet className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                                <span className="font-semibold">
                                    {excelFiles.length
                                        ? excelFiles.length === 1
                                            ? <span className="truncate max-w-[150px]" title={excelFiles[0].name}>{excelFiles[0].name}</span>
                                            : `${excelFiles.length} file(s) selected`
                                        : "Choose Excel file"}
                                </span>
                            </div>
                            <input type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={handleExcelChange} />
                            <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700 whitespace-nowrap">Browse</span>
                        </label>
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 transition-all hover:bg-blue-50 hover:border-blue-400 min-w-[220px] flex-[1.35] group">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    checked={wantsPdfUpload}
                                    onChange={(e) => handlePdfToggle(e.target.checked)}
                                />
                                <Files className="w-4 h-4 text-blue-600" />
                                <span className="font-semibold">Upload PDFs</span>
                                <span className="text-xs text-slate-600">
                                    {pdfFiles.length
                                        ? `${pdfFiles.length} file(s) selected`
                                        : wantsPdfUpload ? "Choose PDF files" : `Will use ${DUMMY_PDF_NAME}`}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (pdfInputRef?.current) {
                                        pdfInputRef.current.value = null;
                                        pdfInputRef.current.click();
                                    }
                                }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                            >
                                Browse
                            </button>
                            <input
                                ref={pdfInputRef}
                                type="file"
                                multiple
                                accept=".pdf"
                                className="hidden"
                                onChange={handlePdfChange}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setExcelFiles([]);
                                    setPdfFiles([]);
                                    resetMessages();
                                }}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Reset
                            </button>
                        </div>
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
                    <div className="text-xs font-medium">{error || success}</div>
                </div>
            )}

            {/* Validation Console */}
            <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden card-animate">
                    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 px-3 py-2.5 text-white">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                                <p className="text-xs font-semibold">Validation Console</p>
                                <p className="text-[10px] text-blue-100">Review and validate your Excel files before upload</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => runValidation(excelFiles, pdfMatchInfo.pdfMap)}
                                disabled={validating || !excelFiles.length}
                                className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {validating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                )}
                                {validating ? "Validating..." : "Re-validate"}
                            </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
                            <div className="inline-flex rounded-md bg-white/15 p-0.5 gap-0.5">
                                <button
                                    type="button"
                                    onClick={() => setValidationTableTab("report-info")}
                                    className={`px-3 py-1 rounded-md transition-all ${validationTableTab === "report-info"
                                        ? "bg-white text-blue-900 shadow-sm"
                                        : "text-blue-100 hover:text-white hover:bg-white/10"
                                        }`}
                                >
                                    Report Info
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setValidationTableTab("assets")}
                                    className={`px-3 py-1 rounded-md transition-all ${validationTableTab === "assets"
                                        ? "bg-white text-blue-900 shadow-sm"
                                        : "text-blue-100 hover:text-white hover:bg-white/10"
                                        }`}
                                >
                                    Assets & PDFs
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsValidationTableCollapsed((prev) => !prev)}
                                className="inline-flex items-center gap-1 rounded-md border border-white/30 bg-white/15 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur transition hover:bg-white/25 hover:text-white"
                            >
                                {isValidationTableCollapsed ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                )}
                                {isValidationTableCollapsed ? "Show" : "Hide"}
                            </button>
                        </div>
                    </div>
                    <div className="p-2 space-y-2">
                        {validationMessage && (
                            <div
                                className={`rounded-md border px-3 py-2 inline-flex items-start gap-2 text-xs ${validationMessage.type === "error"
                                    ? "bg-rose-50 text-rose-700 border-rose-300"
                                    : validationMessage.type === "success"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        : "bg-blue-50 text-blue-700 border-blue-300"
                                    }`}
                            >
                                {validationMessage.type === "error" ? (
                                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                ) : validationMessage.type === "success" ? (
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="text-xs font-medium">{validationMessage.text}</div>
                            </div>
                        )}

                        {validationTableTab === "report-info" ? (
                            validationItems.length ? (
                                <div className="space-y-2">
                                    {validationItems.map((item) => {
                                        const fields = [
                                            { label: "Title", value: item.snapshot?.title },
                                            { label: "Client Name", value: item.snapshot?.client_name },
                                            { label: "Purpose ID", value: item.snapshot?.purpose_id },
                                            { label: "Value Premise ID", value: item.snapshot?.value_premise_id },
                                            { label: "Report Type", value: item.snapshot?.report_type },
                                            { label: "Telephone", value: item.snapshot?.telephone },
                                            { label: "Email", value: item.snapshot?.email },
                                            { label: "Number of Macros", value: item.snapshot?.number_of_macros },
                                            { label: "Final Value", value: item.snapshot?.final_value },
                                            { label: "Value", value: item.snapshot?.value },
                                            { label: "Valued At", value: item.snapshot?.valued_at },
                                            { label: "Submitted At", value: item.snapshot?.submitted_at },
                                        ];
                                        return (
                                            <div key={item.fileName} className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                    <div className="text-xs font-semibold text-slate-800">{item.fileName}</div>
                                                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-300">
                                                        Auto-generated
                                                    </span>
                                                </div>
                                                {isValidationTableCollapsed ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                        Table hidden.
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto max-h-[200px] overflow-y-auto mt-2">
                                                        <table className="min-w-full text-xs border-collapse">
                                                            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                                                <tr>
                                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider rounded-tl-md">Field</th>
                                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Value</th>
                                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Status</th>
                                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider rounded-tr-md">Notes</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {fields.map((field) => {
                                                                    const hasFieldValue = hasValue(field.value);
                                                                    const statusLabel = hasFieldValue ? "OK" : "N/A";
                                                                    const statusTone = hasFieldValue
                                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                                        : "bg-slate-50 text-slate-700 border-slate-300";
                                                                    const notesText = hasFieldValue ? "Auto-generated from Excel" : "Will be set automatically";
                                                                    
                                                                    // Format the display value
                                                                    let displayValue = field.value;
                                                                    if (hasFieldValue) {
                                                                        if (field.label === "Final Value" || field.label === "Value") {
                                                                            // Format numbers with commas
                                                                            displayValue = typeof field.value === 'number' 
                                                                                ? field.value.toLocaleString() 
                                                                                : Number(field.value || 0).toLocaleString();
                                                                        } else if (field.label === "Valued At" || field.label === "Submitted At") {
                                                                            // Format dates (already in yyyy-mm-dd format, but ensure it displays nicely)
                                                                            displayValue = field.value;
                                                                        }
                                                                    }
                                                                    
                                                                    return (
                                                                        <tr key={field.label} className="border-b border-slate-200 hover:bg-slate-50/50">
                                                                            <td className="px-2 py-1.5 bg-white font-semibold text-slate-800">
                                                                                {field.label}
                                                                            </td>
                                                                            <td className="px-2 py-1.5 bg-white text-slate-700">
                                                                                {hasFieldValue ? displayValue : "N/A"}
                                                                            </td>
                                                                            <td className="px-2 py-1.5 bg-white">
                                                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone}`}>
                                                                                    {statusLabel}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-2 py-1.5 bg-white text-slate-600 text-[10px]">
                                                                                {notesText}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-xs text-slate-600 flex items-center justify-center font-medium">
                                    Validation results will appear here after reading the Excel.
                                </div>
                            )
                        ) : (
                            <div className="space-y-2">
                                {wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length) && (
                                    <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                        <div className="font-semibold mb-1">File matching issues</div>
                                        <div className="mt-1 space-y-1">
                                            {pdfMatchInfo.excelsMissingPdf.length > 0 && (
                                                <div className="font-medium">
                                                    Excel files missing PDF: {pdfMatchInfo.excelsMissingPdf.join(", ")}
                                                </div>
                                            )}
                                            {pdfMatchInfo.unmatchedPdfs.length > 0 && (
                                                <div className="font-medium">
                                                    Unmatched PDFs: {pdfMatchInfo.unmatchedPdfs.join(", ")}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {validationItems.length ? (
                                    <div className="space-y-2">
                                        <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                                            <div className="text-xs font-semibold text-slate-800 mb-2">Assets &amp; PDF summary</div>
                                            {isValidationTableCollapsed ? (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                    Table hidden.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
                                                    <table className="min-w-full text-xs text-slate-700">
                                                        <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0">
                                                            <tr>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Excel</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">PDF</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Market</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Cost</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Market total</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Cost total</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Assets total</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Issues</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {validationItems.map((item) => {
                                                                const assetIssues = item.issues || [];
                                                                return (
                                                                    <tr key={`summary-${item.fileName}`} className="border-b border-slate-200 hover:bg-slate-50/50">
                                                                        <td className="px-2 py-1.5 text-slate-800 font-medium">{item.fileName}</td>
                                                                        <td className="px-2 py-1.5">
                                                                            {item.pdfMatched ? (
                                                                                <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Matched</span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Missing</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-2 py-1.5 text-slate-700">{item.counts?.marketAssets ?? "-"}</td>
                                                                        <td className="px-2 py-1.5 text-slate-700">{item.counts?.costAssets ?? "-"}</td>
                                                                        <td className="px-2 py-1.5 text-slate-700">{item.totals?.marketTotal ?? "-"}</td>
                                                                        <td className="px-2 py-1.5 text-slate-700">{item.totals?.costTotal ?? "-"}</td>
                                                                        <td className="px-2 py-1.5 text-slate-700">{item.totals?.assetsTotalValue ?? "-"}</td>
                                                                        <td className="px-2 py-1.5 text-slate-700 font-medium">{assetIssues.length}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                        {!isValidationTableCollapsed && (
                                            <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                                                <div className="text-xs font-semibold text-slate-800 mb-2">Issues</div>
                                                <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
                                                    <table className="min-w-full text-xs text-slate-700">
                                                        <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white sticky top-0">
                                                            <tr>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Excel</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Field</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Location</th>
                                                                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Details</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {validationItems.flatMap((item) => {
                                                                const assetIssues = item.issues || [];
                                                                if (!assetIssues.length) {
                                                                    return [
                                                                        <tr key={`issue-none-${item.fileName}`} className="border-b border-slate-200">
                                                                            <td className="px-2 py-1.5 text-slate-800 font-medium">{item.fileName}</td>
                                                                            <td className="px-2 py-1.5 text-slate-600" colSpan={3}>
                                                                                No issues
                                                                            </td>
                                                                        </tr>,
                                                                    ];
                                                                }
                                                                return assetIssues.map((issue, idx) => (
                                                                    <tr key={`issue-${item.fileName}-${idx}`} className="border-b border-slate-200 hover:bg-slate-50/50">
                                                                        <td className="px-2 py-1.5 text-slate-800 font-medium">{item.fileName}</td>
                                                                        <td className="px-2 py-1.5 font-semibold text-slate-800">{issue.field}</td>
                                                                        <td className="px-2 py-1.5 text-slate-700">{issue.location || "-"}</td>
                                                                        <td className="px-2 py-1.5 text-slate-700">{issue.message}</td>
                                                                    </tr>
                                                                ));
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-xs text-slate-600 flex items-center justify-center font-medium">
                                        Validation results will appear here after reading the Excel.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                    type="button"
                    onClick={handleUpload}
                    disabled={loading || !isReadyToUpload}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 text-white text-xs font-semibold shadow-md hover:shadow-lg hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    {loading ? "Uploading..." : "Upload & Create Reports"}
                </button>
            </div>

            {wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length) && (
                <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <div className="font-semibold mb-1">File matching issues</div>
                    {pdfMatchInfo.excelsMissingPdf.length > 0 && (
                        <div>Excel files missing PDF: {pdfMatchInfo.excelsMissingPdf.join(", ")}</div>
                    )}
                    {pdfMatchInfo.unmatchedPdfs.length > 0 && (
                        <div>Unmatched PDFs: {pdfMatchInfo.unmatchedPdfs.join(", ")}</div>
                    )}
                </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-800">Reports</h3>
                </div>
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => loadReports()}
                            disabled={reportsLoading}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                            {reportsLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            Filter:
                            <select
                                value={reportSelectFilter}
                                onChange={(e) => setReportSelectFilter(e.target.value)}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
                            >
                                <option value="all">All statuses</option>
                                <option value="new">New</option>
                                <option value="sent">Sent</option>
                                <option value="complete">Complete</option>
                                <option value="approved">Approved</option>
                            </select>
                        </label>
                        <div className="flex items-center gap-2 ml-auto">
                            <select
                                value={bulkAction}
                                onChange={(e) => setBulkAction(e.target.value)}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
                            >
                                <option value="">Bulk Actions</option>
                                <option value="upload-submit">Upload & Submit to Taqeem</option>
                                <option value="delete">Delete</option>
                                <option value="retry-submit">Retry Submit</option>
                            </select>
                            <button
                                type="button"
                                onClick={handleBulkAction}
                                disabled={!bulkAction || selectedReportIds.length === 0}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
                            >
                                Go
                            </button>
                        </div>
                        {filteredReports.length > 0 && (
                            <span className="text-xs text-slate-600 ml-auto font-medium">
                                Total: {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>

                {reportsLoading && reports.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        Loading reports...
                    </div>
                )}

                {!reportsLoading && !reports.length && (
                    <div className="text-xs text-slate-600 py-2 text-center">
                        No reports found. Upload Excel files to create reports.
                    </div>
                )}

                {!reportsLoading && reports.length > 0 && !filteredReports.length && (
                    <div className="text-xs text-slate-600 py-2 text-center">
                        No reports match the selected status.
                    </div>
                )}

                {filteredReports.length > 0 && (
                    <div className="w-full overflow-x-auto">
                        <div className="min-w-full">
                            <table className="w-full text-xs text-slate-700">
                                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 text-slate-800 border-b-2 border-blue-200">
                                    <tr>
                                        <th className="px-2 py-2 text-left w-12 text-[10px] font-semibold uppercase tracking-wider">#</th>
                                        <th className="px-2 py-2 text-left w-10 text-[10px] font-semibold uppercase tracking-wider"></th>
                                        <th className="px-2 py-2 text-left w-32 text-[10px] font-semibold uppercase tracking-wider">Report ID</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Client</th>
                                        <th className="px-2 py-2 text-left w-24 text-[10px] font-semibold uppercase tracking-wider">Final value</th>
                                        <th className="px-2 py-2 text-left w-28 text-[10px] font-semibold uppercase tracking-wider">Status</th>
                                        <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Action</th>
                                        <th className="px-2 py-2 text-left w-16 text-[10px] font-semibold uppercase tracking-wider">Select</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReports.map((report, idx) => {
                                        const recordId = getReportRecordId(report);
                                        const statusKey = getReportStatus(report);
                                        const assetList = Array.isArray(report.asset_data) ? report.asset_data : [];
                                        const isExpanded = recordId ? expandedReports.includes(recordId) : false;
                                        const reportBusy = recordId ? reportActionBusy[recordId] : null;

                                        return (
                                            <React.Fragment key={recordId || `report-${idx}`}>
                                                <tr className="border-t border-slate-200 bg-white hover:bg-blue-50/30 transition-colors">
                                                    <td className="px-2 py-2 text-slate-600 text-xs font-medium">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => recordId && toggleReportExpansion(recordId)}
                                                            disabled={!recordId}
                                                            className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50 transition-colors"
                                                            aria-label={isExpanded ? "Hide assets" : "Show assets"}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <ChevronRight className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div className="text-xs font-semibold text-slate-900 truncate" title={report.report_id || "Not sent"}>
                                                            {report.report_id || "Not sent"}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate" title={recordId || "-"}>
                                                            {recordId || "-"}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2 truncate" title={report.client_name || "-"}>
                                                        <span className="text-xs text-slate-700">{report.client_name || "-"}</span>
                                                    </td>
                                                    <td className="px-2 py-2 text-xs font-medium text-slate-700">
                                                        {report.final_value || "-"}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <span
                                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                                reportStatusClasses[statusKey] || "border-blue-200 bg-blue-50 text-blue-700"
                                                            }`}
                                                        >
                                                            {reportStatusLabels[statusKey] || statusKey}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1">
                                                                <select
                                                                    value={actionDropdown[recordId] || ""}
                                                                    disabled={!recordId || submitting || !!reportBusy}
                                                                    onChange={(e) => {
                                                                        const action = e.target.value;
                                                                        setActionDropdown((prev) => ({
                                                                            ...prev,
                                                                            [recordId]: action,
                                                                        }));
                                                                    }}
                                                                    className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
                                                                >
                                                                    <option value="">Actions</option>
                                                                    <option value="retry">Retry submit</option>
                                                                    <option value="delete">Delete</option>
                                                                    <option value="edit">Edit</option>
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const action = actionDropdown[recordId];
                                                                        if (action) {
                                                                            handleReportAction(report, action);
                                                                            setActionDropdown((prev) => {
                                                                                const next = { ...prev };
                                                                                delete next[recordId];
                                                                                return next;
                                                                            });
                                                                        }
                                                                    }}
                                                                    disabled={!recordId || submitting || !!reportBusy || !actionDropdown[recordId]}
                                                                    className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold transition-colors"
                                                                >
                                                                    Go
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {reportBusy && (
                                                            <div className="text-[10px] text-blue-600 mt-0.5 font-medium">
                                                                Working...
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            disabled={!recordId}
                                                            checked={!!recordId && selectedReportSet.has(recordId)}
                                                            onChange={() => recordId && toggleReportSelection(recordId)}
                                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={8} className="bg-blue-50/20 border-t border-blue-200">
                                                            <div className="p-2 space-y-2">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <div className="text-xs text-slate-700 font-medium">
                                                                        Assets: <span className="text-blue-600 font-semibold">{assetList.length}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
                                                                    <div className="max-h-48 overflow-y-auto">
                                                                        <table className="w-full text-xs text-slate-700">
                                                                            <thead className="bg-slate-50 text-slate-800 border-b border-slate-200 sticky top-0">
                                                                                <tr>
                                                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Asset name</th>
                                                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Final value</th>
                                                                                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Sheet</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {assetList.length === 0 ? (
                                                                                    <tr>
                                                                                        <td colSpan={3} className="px-2 py-2 text-center text-slate-500 text-xs">
                                                                                            No assets available for this report.
                                                                                        </td>
                                                                                    </tr>
                                                                                ) : (
                                                                                    assetList.map((asset, assetIdx) => (
                                                                                        <tr key={`${recordId}-${assetIdx}`} className="border-t border-slate-200 hover:bg-slate-50/50">
                                                                                            <td className="px-2 py-1.5 text-slate-700 text-xs font-medium">
                                                                                                {asset.asset_name || "-"}
                                                                                            </td>
                                                                                            <td className="px-2 py-1.5 text-slate-700 text-xs">
                                                                                                {asset.final_value || "-"}
                                                                                            </td>
                                                                                            <td className="px-2 py-1.5 text-slate-600 text-xs">
                                                                                                {asset.source_sheet || "-"}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingReportId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
                            <h3 className="text-lg font-semibold text-slate-800">Edit Report</h3>
                            <button
                                type="button"
                                onClick={() => setEditingReportId(null)}
                                className="text-sm font-medium text-slate-600 hover:text-slate-900"
                            >
                                Close
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Client Name</label>
                                <input
                                    type="text"
                                    value={formData.client_name}
                                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Telephone</label>
                                    <input
                                        type="text"
                                        value={formData.telephone}
                                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setEditingReportId(null)}
                                    className="px-4 py-2 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUpdateReport}
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                                >
                                    {submitting ? "Updating..." : "Update"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubmitReportsQuickly;

