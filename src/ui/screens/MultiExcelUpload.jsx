import React, { useEffect, useMemo, useState } from "react";
import { useRam } from "../context/RAMContext";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import {
    FileSpreadsheet,
    Files,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    FileIcon,
    RefreshCw,
    FolderOpen,
    Info,
    Send,
    Hash,
    Table,
    ShieldCheck,
} from "lucide-react";
import { multiExcelUpload } from "../../api/report"; // Adjust the import path as needed

const TabButton = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-full transition-all border ${active
            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
            : "bg-white/60 text-slate-600 border-transparent hover:border-slate-200 hover:bg-white"
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

const stripExtension = (filename = "") => filename.replace(/\.[^.]+$/, "");

const DUMMY_PDF_NAME = "dummy_placeholder.pdf";

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
            const assetName = row.asset_name || row.assetName || "";
            if (!hasValue(assetName)) return;
            const finalVal = pickFieldValue(row, ["final_value", "final value", "value"]);
            if (!hasValue(finalVal) || Number.isNaN(Number(finalVal))) {
                const rowNumber = idx + 2;
                addIssue(
                    "Final Value",
                    `market row ${rowNumber}`,
                    `Final Value is required for asset "${assetName || `Row ${rowNumber}`}"`
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

const getReportTotalValue = (reportRow = {}) => {
    const raw = pickFieldValue(reportRow, [
        "value",
        "final_value",
        "total_value",
        "total value",
        "Total Value",
        "Final Value",
    ]);

    const num = Number(raw);
    return Number.isNaN(num) ? null : num;
};

const validateAssetUsageId = (sheetName, rows = []) => {
    const issues = [];
    const addIssue = (field, location, message) => issues.push({ field, location, message });

    rows.forEach((row, idx) => {
        const assetName = row.asset_name || row.assetName || "";
        if (!hasValue(assetName)) return;
        const assetUsageId = pickFieldValue(row, ["asset_usage_id", "asset usage id", "asset usage"]);
        if (!hasValue(assetUsageId)) {
            addIssue("asset_usage_id", `${sheetName} row ${idx + 2}`, `Missing asset_usage_id for asset "${assetName}"`);
        }
    });

    return issues;
};

const validateCostSheetIntegers = (rows = []) => {
    const issues = [];
    const addIssue = (field, location, message) => issues.push({ field, location, message });

    rows.forEach((row, idx) => {
        const assetName = row.asset_name || row.assetName || "";
        if (!hasValue(assetName)) return;
        const rawFinal = pickFieldValue(row, ["final_value", "final value", "value", "Final Value", "Value"]);
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

        if (num < 0) {
            addIssue("final_value", `cost row ${idx + 2}`, `final_value cannot be negative for asset "${assetName}"`);
        }
    });

    return issues;
};

const MultiExcelUpload = () => {
    const [activeTab, setActiveTab] = useState("no-validation");
    const [excelFiles, setExcelFiles] = useState([]);
    const [pdfFiles, setPdfFiles] = useState([]);
    const [wantsPdfUpload, setWantsPdfUpload] = useState(false);
    const [batchId, setBatchId] = useState("");
    const [uploadResult, setUploadResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [creatingReports, setCreatingReports] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validationItems, setValidationItems] = useState([]);
    const [validationMessage, setValidationMessage] = useState(null);

    const { ramInfo } = useRam();
    const recommendedTabs = ramInfo?.recommendedTabs || 1;

    const handleExcelChange = (e) => {
        const files = Array.from(e.target.files || []);
        setExcelFiles(files);
        resetMessages();
    };

    const handlePdfChange = (e) => {
        const files = Array.from(e.target.files || []);
        setPdfFiles(files);
        resetMessages();
    };

    const handlePdfToggle = (checked) => {
        setWantsPdfUpload(checked);
        if (!checked) {
            setPdfFiles([]);
        }
        resetMessages();
        resetValidation();
    };

    const resetMessages = () => {
        setError("");
        setSuccess("");
    };

    const resetValidation = () => {
        setValidationItems([]);
        setValidationMessage(null);
    };

    const resetAll = () => {
        setExcelFiles([]);
        setPdfFiles([]);
        setWantsPdfUpload(false);
        setBatchId("");
        setUploadResult(null);
        resetMessages();
        resetValidation();
    };

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

                const reportSheet = workbook.getWorksheet("Report Info");
                const marketSheet = workbook.getWorksheet("market");
                const costSheet = workbook.getWorksheet("cost");

                const issues = [];
                const addIssue = (field, location, message) => issues.push({ field, location, message });

                if (!reportSheet || !marketSheet || !costSheet) {
                    addIssue(
                        "Workbook",
                        "Sheets",
                        "Excel must contain sheets named 'Report Info', 'market', and 'cost'."
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

                const reportRows = worksheetToObjects(reportSheet);
                const marketRows = worksheetToObjects(marketSheet);
                const costRows = worksheetToObjects(costSheet);

                if (!reportRows.length) addIssue("Report Info", "Report Info", "Sheet 'Report Info' is empty.");

                const reportRow = reportRows[0] || {};
                const reportValidation = validateReportInfoAndMarket(reportRow, marketRows);
                issues.push(...(reportValidation.issues || []));
                issues.push(...validateAssetUsageId("market", marketRows));
                issues.push(...validateAssetUsageId("cost", costRows));
                issues.push(...validateCostSheetIntegers(costRows));

                const reportTotalValue = getReportTotalValue(reportRow);
                if (reportTotalValue === null) {
                    addIssue("Total Value", "Report Info", "Total value is missing or not a number.");
                }

                const sumSheet = (rows, sheetName) =>
                    rows.reduce((acc, row, idx) => {
                        const assetName = row.asset_name || row.assetName || "";
                        if (!hasValue(assetName)) return acc;
                        const rawFinal = pickFieldValue(row, ["final_value", "final value", "value", "Final Value", "Value"]);
                        const num = Number(rawFinal);
                        if (Number.isNaN(num)) {
                            addIssue("final_value", `${sheetName} row ${idx + 2}`, `Invalid final_value "${rawFinal}" for asset "${assetName}"`);
                            return acc;
                        }
                        return acc + num;
                    }, 0);

                const marketTotal = sumSheet(marketRows, "market");
                const costTotal = sumSheet(costRows, "cost");
                const assetsTotal = marketTotal + costTotal;

                if (reportTotalValue !== null) {
                    const diff = Math.abs(assetsTotal - reportTotalValue);
                    if (diff > 0.01) {
                        addIssue(
                            "Totals",
                            "Workbook",
                            `Total assets value (${assetsTotal}) does not match Report Info total value (${reportTotalValue}).`
                        );
                    }
                }

                const baseName = normalizeKey(stripExtension(file.name));
                const matchedPdf = shouldValidatePdf ? pdfMap[baseName] : { name: DUMMY_PDF_NAME };
                if (shouldValidatePdf && !matchedPdf) {
                    addIssue("PDF Match", "Files", `No matching PDF found for Excel "${file.name}" (match by filename).`);
                }

                results.push({
                    fileName: file.name,
                    baseName,
                    pdfMatched: shouldValidatePdf ? Boolean(matchedPdf) : true,
                    pdfName: shouldValidatePdf ? matchedPdf?.name || "" : DUMMY_PDF_NAME,
                    issues,
                    snapshot: reportValidation.snapshot,
                    totals: reportTotalValue === null
                        ? null
                        : {
                            reportTotalValue,
                            assetsTotalValue: assetsTotal,
                            marketTotal,
                            costTotal,
                        },
                    counts: {
                        marketAssets: marketRows.filter((r) => hasValue(r.asset_name || r.assetName)).length,
                        costAssets: costRows.filter((r) => hasValue(r.asset_name || r.assetName)).length,
                    },
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
                        ? "All Excel files look valid and PDFs are matched. You can upload & create reports."
                        : `All Excel files look valid. PDFs will use ${DUMMY_PDF_NAME}. You can upload & create reports.`,
                });
            } else {
                setValidationMessage({
                    type: "error",
                    text: "Validation found issues. Fix them to enable upload & create reports.",
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
        if (activeTab !== "validation") return;
        runValidation(excelFiles, pdfMatchInfo.pdfMap);
    }, [activeTab, excelFiles, pdfFiles, wantsPdfUpload]);

    const isReadyToUpload = useMemo(() => {
        if (excelFiles.length === 0) return false;
        if (wantsPdfUpload && pdfFiles.length === 0) return false;
        if (wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length)) {
            return false;
        }
        if (activeTab === "validation") {
            if (validating) return false;
            if (!validationItems.length) return false;
            const anyIssues = validationItems.some((item) => (item.issues || []).length > 0);
            if (anyIssues) return false;
        }
        return true;
    }, [excelFiles.length, pdfFiles.length, wantsPdfUpload, activeTab, validating, validationItems, pdfMatchInfo]);

    const handleUploadAndCreate = async () => {
        try {
            setLoading(true);
            resetMessages();

            // Validation
            if (excelFiles.length === 0) {
                throw new Error("Please select at least one Excel file");
            }
            if (wantsPdfUpload && pdfFiles.length === 0) {
                throw new Error("Please select at least one PDF file or disable PDF upload.");
            }
            if (wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length)) {
                throw new Error("PDF filenames must match the Excel filenames.");
            }

            // Step 1: Upload files to backend
            setSuccess(
                wantsPdfUpload
                    ? "Uploading files to server..."
                    : `Uploading Excel files. PDFs will use ${DUMMY_PDF_NAME}.`
            );
            const data = await multiExcelUpload(excelFiles, wantsPdfUpload ? pdfFiles : []);

            if (data.status !== "success") {
                throw new Error(data.error || "Upload failed");
            }

            const batchIdFromApi = data.batchId;
            const insertedCount = data.created || data.inserted || 0;

            setBatchId(batchIdFromApi);
            setUploadResult(data);
            setSuccess(`Files uploaded successfully. Batch ID: ${batchIdFromApi}. Inserted ${insertedCount} report(s).`);

            // Step 2: Create reports via Electron
            setCreatingReports(true);
            setSuccess("Creating reports in Taqeem browser...");

            const electronResult = await window.electronAPI.createReportsByBatch(
                batchIdFromApi,
                recommendedTabs
            );

            if (electronResult?.status === "SUCCESS") {
                setSuccess(
                    `Reports created successfully! ${insertedCount} report(s) processed with ${recommendedTabs} tab(s).`
                );
            } else {
                throw new Error(electronResult?.error || "Failed to create reports in Taqeem");
            }

        } catch (err) {
            console.error("Upload failed", err);
            const status = err?.response?.status;
            const apiError =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.response?.data?.details;

            if (status === 400) {
                setError(apiError || "Bad request. Please check the selected files and try again.");
            } else if (status === 500) {
                setError(apiError || "Server error while processing your files. Please try again or contact support.");
            } else if (err?.code === "ERR_NETWORK") {
                setError("Network error. Make sure the backend server is running and reachable.");
            } else {
                setError(apiError || err?.message || "Failed to upload and create reports");
            }
        } finally {
            setLoading(false);
            setCreatingReports(false);
        }
    };

    const ValidationResultsCard = ({ title, issues = [], snapshot, totals, counts, pdfName }) => {
        const pdfLabel = wantsPdfUpload ? "Matched PDF" : "PDF (placeholder)";
        const pdfDisplay = pdfName || (wantsPdfUpload ? "Not matched" : DUMMY_PDF_NAME);
        const fields = [
            { label: "Purpose of Valuation", value: snapshot?.purpose },
            { label: "Value Attributes", value: snapshot?.valueAttributes },
            { label: "Report", value: snapshot?.reportType },
            { label: "Client Name", value: snapshot?.clientName },
            { label: "Client Telephone", value: snapshot?.telephone },
            { label: "Client Email", value: snapshot?.email },
            { label: "Date of Valuation", value: snapshot?.valuedAt ? formatDateForDisplay(snapshot.valuedAt) : "" },
            { label: "Report Issuing Date", value: snapshot?.submittedAt ? formatDateForDisplay(snapshot.submittedAt) : "" },
            { label: pdfLabel, value: pdfDisplay },
            { label: "Market assets", value: counts ? String(counts.marketAssets) : "—" },
            { label: "Cost assets", value: counts ? String(counts.costAssets) : "—" },
            { label: "Market total", value: totals ? String(totals.marketTotal) : "—" },
            { label: "Cost total", value: totals ? String(totals.costTotal) : "—" },
            { label: "Assets total", value: totals ? String(totals.assetsTotalValue) : "—" },
            { label: "Report total", value: totals ? String(totals.reportTotalValue) : "—" },
        ];

        return (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-sky-500 to-emerald-400" />
                <div className="px-4 py-3 border-b border-slate-200/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-sky-600" />
                        <p className="text-sm font-semibold text-slate-900">{title}</p>
                    </div>
                    <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full border ${issues.length
                            ? "bg-rose-50 text-rose-700 border-rose-100"
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
                                    className="p-2 rounded-md bg-slate-50/80 border border-slate-100/80"
                                >
                                    <p className="font-semibold text-slate-800">{field.label}</p>
                                    <p className="text-slate-700 break-words">{field.value || "—"}</p>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {issues.length ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                                <thead className="bg-rose-50/90 text-rose-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Field</th>
                                        <th className="px-3 py-2 text-left">Location</th>
                                        <th className="px-3 py-2 text-left">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {issues.map((issue, idx) => (
                                        <tr key={`${issue.field}-${idx}`} className="border-t border-rose-100 bg-rose-50/70">
                                            <td className="px-3 py-2 font-semibold text-rose-800">{issue.field}</td>
                                            <td className="px-3 py-2 text-rose-700">{issue.location || "—"}</td>
                                            <td className="px-3 py-2 text-rose-700">{issue.message}</td>
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

    return (
        <div className="relative p-4 space-y-4 page-animate">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 shadow-xl backdrop-blur">
                <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-sky-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
                <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-5 py-4">
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                            Batch Automation
                        </p>
                        <h2 className="text-2xl md:text-3xl font-display text-compact text-slate-900">
                            Multi-Excel Upload
                        </h2>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 shadow-sm">
                                <Table className="h-3.5 w-3.5 text-emerald-600" />
                                {recommendedTabs} tab{recommendedTabs !== 1 ? "s" : ""} auto
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 shadow-sm">
                                <Files className="h-3.5 w-3.5 text-sky-600" />
                                {wantsPdfUpload ? "PDF upload on" : "PDF upload optional"}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 shadow-sm">
                                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                                Two upload flows
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-slate-900/5 p-1">
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
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1.15fr_1.15fr_0.7fr]">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm card-animate">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-400" />
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                                    <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">Excel sources</h3>
                                    <span className="text-xs text-slate-500">.xlsx / .xls</span>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">
                                {excelFiles.length} selected
                            </span>
                        </div>
                        <label className="group flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                <FolderOpen className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
                                <span className="font-medium">
                                    {excelFiles.length ? `${excelFiles.length} Excel file(s) selected` : "Choose Excel files"}
                                </span>
                            </div>
                            <input type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={handleExcelChange} />
                            <span className="text-xs font-semibold text-slate-600">Browse</span>
                        </label>

                        {excelFiles.length > 0 && (
                            <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                                <ul className="text-xs text-slate-600 space-y-1">
                                    {excelFiles.map((file, index) => (
                                        <li key={index} className="flex items-center gap-2 p-1 rounded-lg bg-white/80">
                                            <FileIcon className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                            <span className="truncate">{file.name}</span>
                                            <span className="text-slate-400 text-xs">
                                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm card-animate">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400" />
                    <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                    <Files className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">PDF attachments</h3>
                                    <span className="text-xs text-slate-500">
                                        {wantsPdfUpload ? "Match Excel filename" : `Auto-use ${DUMMY_PDF_NAME}`}
                                    </span>
                                </div>
                            </div>
                            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 text-slate-900 border-slate-400 focus:ring-slate-700"
                                    checked={wantsPdfUpload}
                                    onChange={(e) => handlePdfToggle(e.target.checked)}
                                />
                                Upload PDFs
                            </label>
                        </div>

                        {wantsPdfUpload ? (
                            <>
                                <label className="group flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition">
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                        <FolderOpen className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
                                        <span className="font-medium">
                                            {pdfFiles.length ? `${pdfFiles.length} PDF file(s) selected` : "Choose PDF files"}
                                        </span>
                                    </div>
                                    <input type="file" multiple accept=".pdf" className="hidden" onChange={handlePdfChange} />
                                    <span className="text-xs font-semibold text-slate-600">Browse</span>
                                </label>

                                {pdfFiles.length > 0 && (
                                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-2">
                                        <ul className="text-xs text-slate-600 space-y-1">
                                            {pdfFiles.slice(0, 5).map((file, index) => (
                                                <li key={index} className="flex items-center gap-2 p-1 rounded-lg bg-white/80">
                                                    <FileIcon className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                                    <span className="truncate">{file.name}</span>
                                                    <span className="text-slate-400 text-xs">
                                                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                                    </span>
                                                </li>
                                            ))}
                                            {pdfFiles.length > 5 && (
                                                <li className="text-xs text-slate-500 text-center">
                                                    + {pdfFiles.length - 5} more files
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                                Placeholder PDF will be applied per Excel during upload.
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm card-animate">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-sky-500" />
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                <Table className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Tabs runtime</h3>
                                <span className="text-xs text-slate-500">Auto based on RAM</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2.5 text-white">
                            <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-emerald-300" />
                                <span className="text-sm font-semibold">
                                    {recommendedTabs} tab{recommendedTabs !== 1 ? "s" : ""}
                                </span>
                            </div>
                            <span className="text-xs text-slate-300">Auto</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Messages */}
            {(error || success) && (
                <div
                    className={`rounded-2xl border px-3 py-2.5 flex items-start gap-3 shadow-sm card-animate ${error
                        ? "bg-rose-50/90 text-rose-700 border-rose-100"
                        : "bg-emerald-50/90 text-emerald-700 border-emerald-100"
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

            {activeTab === "validation" && (
                <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm p-4 flex flex-col gap-3 md:flex-row md:items-center card-animate">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-sky-500 to-emerald-400" />
                        <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">Validation console</p>
                            <p className="text-xs text-slate-600">
                                Checks sheets, required report info, asset IDs, integer values, and totals.
                            </p>
                            {validationMessage && (
                                <div
                                    className={`mt-3 rounded-xl border px-3 py-2 inline-flex items-start gap-2 ${validationMessage.type === "error"
                                        ? "bg-rose-50 text-rose-700 border-rose-100"
                                        : validationMessage.type === "success"
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                            : "bg-sky-50 text-sky-700 border-sky-100"
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
                            {validating && (
                                <div className="flex items-center gap-2 text-xs text-slate-600 mt-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Reading and validating...
                                </div>
                            )}
                        </div>
                        <div className="md:ml-auto">
                            <button
                                type="button"
                                onClick={() => runValidation(excelFiles, pdfMatchInfo.pdfMap)}
                                disabled={validating || !excelFiles.length}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Re-validate
                            </button>
                        </div>
                    </div>

                    {wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length) && (
                        <div className="bg-white/90 border border-rose-100 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-2 text-rose-700">
                                <AlertTriangle className="w-4 h-4" />
                                <p className="text-sm font-semibold">File matching issues</p>
                            </div>
                            <div className="text-xs text-slate-700 space-y-2">
                                {pdfMatchInfo.excelsMissingPdf.length > 0 && (
                                    <div>
                                        <p className="font-semibold text-slate-800">Excel files missing PDF</p>
                                        <ul className="list-disc list-inside text-slate-700">
                                            {pdfMatchInfo.excelsMissingPdf.map((name) => (
                                                <li key={name}>{name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {pdfMatchInfo.unmatchedPdfs.length > 0 && (
                                    <div>
                                        <p className="font-semibold text-slate-800">Unmatched PDFs</p>
                                        <ul className="list-disc list-inside text-slate-700">
                                            {pdfMatchInfo.unmatchedPdfs.map((name) => (
                                                <li key={name}>{name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <p className="text-[11px] text-slate-500">
                                    Matching rule: PDF filename (without extension) must equal Excel filename (without extension).
                                </p>
                            </div>
                        </div>
                    )}

                    {validationItems.length ? (
                        <div className="grid grid-cols-1 gap-4">
                            {validationItems.map((item) => (
                                <ValidationResultsCard
                                    key={item.fileName}
                                    title={item.fileName}
                                    issues={item.issues}
                                    snapshot={item.snapshot}
                                    totals={item.totals}
                                    counts={item.counts}
                                    pdfName={item.pdfName}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-3 border border-dashed border-slate-200 rounded-2xl bg-white/70 text-sm text-slate-500 flex items-center justify-center">
                            Validation results will appear here after reading the Excel.
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={handleUploadAndCreate}
                    disabled={loading || creatingReports || !isReadyToUpload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 text-white text-sm font-semibold shadow-lg hover:opacity-90 disabled:opacity-50"
                >
                    {(loading || creatingReports) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    {creatingReports ? "Creating Reports..." : loading ? "Uploading..." : "Upload & Create Reports"}
                </button>

                <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset All
                </button>
            </div>

            {/* Batch Info Section */}
            {batchId && (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm card-animate">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-cyan-500" />
                    <div className="px-4 py-3 border-b border-slate-200/70 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                            <Info className="w-4 h-4 text-sky-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                Batch Information
                            </p>
                            <p className="text-xs text-slate-500">
                                Batch ID: <span className="font-mono">{batchId}</span>
                            </p>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                <p className="text-slate-600">Excel Files</p>
                                <p className="text-lg font-semibold text-slate-900">
                                    {excelFiles.length}
                                </p>
                            </div>
                            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                <p className="text-slate-600">PDF Files</p>
                                <p className="text-lg font-semibold text-slate-900">
                                    {wantsPdfUpload ? pdfFiles.length : "Placeholder"}
                                </p>
                            </div>
                            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                <p className="text-slate-600">Tabs to Open</p>
                                <p className="text-lg font-semibold text-slate-900">
                                    {recommendedTabs}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Auto-configured
                                </p>
                            </div>
                        </div>

                        {(uploadResult?.reports || []).length > 0 && (
                            <div className="mt-4">
                                <h4 className="text-sm font-semibold text-slate-900 mb-2">
                                    Created Reports ({(uploadResult.reports || []).length})
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-50/80">
                                            <tr className="text-left text-slate-600">
                                                <th className="px-4 py-2">#</th>
                                                <th className="px-4 py-2">Excel</th>
                                                <th className="px-4 py-2">Client Name</th>
                                                <th className="px-4 py-2">PDF Matched</th>
                                                <th className="px-4 py-2">Assets</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(uploadResult.reports || []).slice(0, 10).map((item, idx) => (
                                                <tr key={idx} className="border-t">
                                                    <td className="px-4 py-2 text-slate-700">{idx + 1}</td>
                                                    <td className="px-4 py-2 text-slate-900 font-medium">
                                                        {item.excel_name || item.excel_basename || "—"}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-800">
                                                        {item.client_name}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {item.pdf_path ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-700">
                                                                <FileIcon className="w-4 h-4" />
                                                                Yes
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">No</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-800">
                                                        {Array.isArray(item.asset_data) ? item.asset_data.length : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(uploadResult.reports || []).length > 10 && (
                                                <tr className="border-t">
                                                    <td colSpan="5" className="px-4 py-2 text-center text-slate-500 text-sm">
                                                        ... and {(uploadResult.reports || []).length - 10} more reports
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};

export default MultiExcelUpload;
