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

const stripExtension = (filename = "") => filename.replace(/\.[^.]+$/, "");

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
    const [tabsNum, setTabsNum] = useState(1);
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

    const handleTabsNumChange = (e) => {
        const value = parseInt(e.target.value);
        if (!isNaN(value) && value >= 1) {
            // Optional: Add a very high but reasonable limit
            // const maxTabs = 50; // or whatever you want
            // setTabsNum(Math.min(value, maxTabs));

            setTabsNum(value);
        } else if (e.target.value === "") {
            // Handle empty input
            setTabsNum(1);
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

    const resetAll = () => {
        setExcelFiles([]);
        setPdfFiles([]);
        setTabsNum(1);
        setBatchId("");
        setUploadResult(null);
        resetMessages();
        resetValidation();
    };

    const pdfMatchInfo = useMemo(() => {
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
    }, [excelFiles, pdfFiles]);

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
                const matchedPdf = pdfMap[baseName];
                if (!matchedPdf) {
                    addIssue("PDF Match", "Files", `No matching PDF found for Excel "${file.name}" (match by filename).`);
                }

                results.push({
                    fileName: file.name,
                    baseName,
                    pdfMatched: Boolean(matchedPdf),
                    pdfName: matchedPdf?.name || "",
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
            if (totalIssues === 0 && !pdfMatchInfo.excelsMissingPdf.length && !pdfMatchInfo.unmatchedPdfs.length) {
                setValidationMessage({
                    type: "success",
                    text: "All Excel files look valid and PDFs are matched. You can upload & create reports.",
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
        if (!ramInfo?.recommendedTabs) return;

        setTabsNum((prev) => {
            // Only auto-set if still at default (1)
            if (prev !== 1) return prev;
            return ramInfo.recommendedTabs;
        });
    }, [ramInfo?.recommendedTabs]);

    useEffect(() => {
        if (activeTab !== "validation") return;
        runValidation(excelFiles, pdfMatchInfo.pdfMap);
    }, [activeTab, excelFiles, pdfFiles]);

    const isReadyToUpload = useMemo(() => {
        if (excelFiles.length === 0 || pdfFiles.length === 0) return false;
        if (tabsNum < 1) return false;
        if (activeTab === "validation") {
            if (validating) return false;
            if (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length) return false;
            if (!validationItems.length) return false;
            const anyIssues = validationItems.some((item) => (item.issues || []).length > 0);
            if (anyIssues) return false;
        }
        return true;
    }, [excelFiles.length, pdfFiles.length, tabsNum, activeTab, validating, validationItems, pdfMatchInfo]);

    const handleUploadAndCreate = async () => {
        try {
            setLoading(true);
            resetMessages();

            // Validation
            if (excelFiles.length === 0) {
                throw new Error("Please select at least one Excel file");
            }
            if (pdfFiles.length === 0) {
                throw new Error("Please select at least one PDF file");
            }
            if (tabsNum < 1) {
                throw new Error("Number of tabs must be at least 1");
            }

            // Step 1: Upload files to backend
            setSuccess("Uploading files to server...");
            const data = await multiExcelUpload(excelFiles, pdfFiles);

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
                tabsNum
            );

            if (electronResult?.status === "SUCCESS") {
                setSuccess(
                    `Reports created successfully! ${insertedCount} report(s) processed with ${tabsNum} tab(s).`
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
        const fields = [
            { label: "Purpose of Valuation", value: snapshot?.purpose },
            { label: "Value Attributes", value: snapshot?.valueAttributes },
            { label: "Report", value: snapshot?.reportType },
            { label: "Client Name", value: snapshot?.clientName },
            { label: "Client Telephone", value: snapshot?.telephone },
            { label: "Client Email", value: snapshot?.email },
            { label: "Date of Valuation", value: snapshot?.valuedAt ? formatDateForDisplay(snapshot.valuedAt) : "" },
            { label: "Report Issuing Date", value: snapshot?.submittedAt ? formatDateForDisplay(snapshot.submittedAt) : "" },
            { label: "Matched PDF", value: pdfName || "—" },
            { label: "Market assets", value: counts ? String(counts.marketAssets) : "—" },
            { label: "Cost assets", value: counts ? String(counts.costAssets) : "—" },
            { label: "Market total", value: totals ? String(totals.marketTotal) : "—" },
            { label: "Cost total", value: totals ? String(totals.costTotal) : "—" },
            { label: "Assets total", value: totals ? String(totals.assetsTotalValue) : "—" },
            { label: "Report total", value: totals ? String(totals.reportTotalValue) : "—" },
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

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        Multi-Excel Upload
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Choose a flow: quick upload (no validation) or validate Excel sheets before uploading.
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-800">Upload Excel Files</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                        Select multiple Excel files (.xlsx, .xls). Each file will be processed.
                    </p>
                    <label className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {excelFiles.length ? `${excelFiles.length} Excel file(s) selected` : "Choose Excel files"}
                            </span>
                        </div>
                        <input type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={handleExcelChange} />
                        <span className="text-xs text-blue-600">Browse</span>
                    </label>

                    {excelFiles.length > 0 && (
                        <div className="mt-3 max-h-40 overflow-y-auto">
                            <ul className="text-xs text-gray-600 space-y-1">
                                {excelFiles.map((file, index) => (
                                    <li key={index} className="flex items-center gap-2 p-1 bg-gray-50 rounded">
                                        <FileIcon className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                        <span className="text-gray-400 text-xs">
                                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Files className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-800">Upload PDF Files</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                        Select multiple PDF files. Files must match Excel names (same basename).
                    </p>
                    <label className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FolderOpen className="w-4 h-4" />
                            <span>{pdfFiles.length ? `${pdfFiles.length} PDF file(s) selected` : "Choose PDF files"}</span>
                        </div>
                        <input type="file" multiple accept=".pdf" className="hidden" onChange={handlePdfChange} />
                        <span className="text-xs text-blue-600">Browse</span>
                    </label>

                    {pdfFiles.length > 0 && (
                        <div className="mt-3 max-h-40 overflow-y-auto">
                            <ul className="text-xs text-gray-600 space-y-1">
                                {pdfFiles.slice(0, 5).map((file, index) => (
                                    <li key={index} className="flex items-center gap-2 p-1 bg-gray-50 rounded">
                                        <FileIcon className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{file.name}</span>
                                        <span className="text-gray-400 text-xs">
                                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                        </span>
                                    </li>
                                ))}
                                {pdfFiles.length > 5 && (
                                    <li className="text-xs text-gray-500 text-center">+ {pdfFiles.length - 5} more files</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Hash className="w-5 h-5 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-gray-800">Number of Tabs</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                        Specify how many tabs to open in Taqeem browser for report creation.
                    </p>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="1"
                            max="200"
                            value={tabsNum}
                            onChange={handleTabsNumChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter number of tabs"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Recommended: 1-3 tabs for stable performance</p>
                </div>
            </div>

            {/* Status Messages */}
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

            {activeTab === "validation" && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4 flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">Validated flow</p>
                            <p className="text-xs text-slate-600">
                                Excel will be checked for required sheets, key Report Info fields, asset usage IDs, integer values in cost sheet, and totals matching.
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
                            {validating && (
                                <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Reading and validating...
                                </div>
                            )}
                        </div>
                        <div className="ml-auto">
                            <button
                                type="button"
                                onClick={() => runValidation(excelFiles, pdfMatchInfo.pdfMap)}
                                disabled={validating || !excelFiles.length}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-60"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Re-validate
                            </button>
                        </div>
                    </div>

                    {(pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length) && (
                        <div className="bg-white border border-red-100 rounded-lg shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-2 text-red-700">
                                <AlertTriangle className="w-4 h-4" />
                                <p className="text-sm font-semibold">File matching issues</p>
                            </div>
                            <div className="text-xs text-gray-700 space-y-2">
                                {pdfMatchInfo.excelsMissingPdf.length > 0 && (
                                    <div>
                                        <p className="font-semibold text-gray-800">Excel files missing PDF</p>
                                        <ul className="list-disc list-inside text-gray-700">
                                            {pdfMatchInfo.excelsMissingPdf.map((name) => (
                                                <li key={name}>{name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {pdfMatchInfo.unmatchedPdfs.length > 0 && (
                                    <div>
                                        <p className="font-semibold text-gray-800">Unmatched PDFs</p>
                                        <ul className="list-disc list-inside text-gray-700">
                                            {pdfMatchInfo.unmatchedPdfs.map((name) => (
                                                <li key={name}>{name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <p className="text-[11px] text-gray-500">
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
                        <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-sm text-gray-500 flex items-center justify-center">
                            Validation results will appear here after reading the Excel.
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                {(activeTab === "no-validation" || isReadyToUpload) && (
                    <button
                        type="button"
                        onClick={handleUploadAndCreate}
                        disabled={loading || creatingReports || !isReadyToUpload}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {(loading || creatingReports) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        {creatingReports ? "Creating Reports..." : loading ? "Uploading..." : "Upload & Create Reports"}
                    </button>
                )}

                <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset All
                </button>
            </div>

            {/* Batch Info Section */}
            {batchId && (
                <div className="bg-white border rounded-lg shadow-sm">
                    <div className="px-4 py-3 border-b flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-800">
                                Batch Information
                            </p>
                            <p className="text-xs text-gray-500">
                                Batch ID: <span className="font-mono">{batchId}</span>
                            </p>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="p-3 bg-gray-50 rounded">
                                <p className="text-gray-600">Excel Files</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {excelFiles.length}
                                </p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded">
                                <p className="text-gray-600">PDF Files</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {pdfFiles.length}
                                </p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded">
                                <p className="text-gray-600">Tabs to Open</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {tabsNum}
                                </p>
                            </div>
                        </div>

                        {(uploadResult?.reports || []).length > 0 && (
                            <div className="mt-4">
                                <h4 className="text-sm font-semibold text-gray-800 mb-2">
                                    Created Reports ({(uploadResult.reports || []).length})
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr className="text-left text-gray-600">
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
                                                    <td className="px-4 py-2 text-gray-700">{idx + 1}</td>
                                                    <td className="px-4 py-2 text-gray-900 font-medium">
                                                        {item.excel_name || item.excel_basename || "—"}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-800">
                                                        {item.client_name}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {item.pdf_path ? (
                                                            <span className="inline-flex items-center gap-1 text-green-700">
                                                                <FileIcon className="w-4 h-4" />
                                                                Yes
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">No</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-gray-800">
                                                        {Array.isArray(item.asset_data) ? item.asset_data.length : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(uploadResult.reports || []).length > 10 && (
                                                <tr className="border-t">
                                                    <td colSpan="5" className="px-4 py-2 text-center text-gray-500 text-sm">
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

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="text-sm font-semibold text-blue-800 mb-1">
                            How this works:
                        </h4>
                        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                            <li>Select multiple Excel files containing report data</li>
                            <li>Select matching PDF files (same filename as Excel)</li>
                            <li>Specify how many browser tabs to use (for parallel processing)</li>
                            <li>In "With validation" tab, fix issues until the upload button becomes available</li>
                            <li>Click "Upload & Create Reports" to:
                                <ul className="ml-4 mt-1 list-disc list-inside">
                                    <li>Upload files to backend for processing</li>
                                    <li>Create a batch with all assets</li>
                                    <li>Open specified number of Taqeem browser tabs</li>
                                    <li>Automatically create reports in each tab</li>
                                </ul>
                            </li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MultiExcelUpload;
