import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRam } from "../context/RAMContext";
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
    FileIcon,
    RefreshCw,
    FolderOpen,
    Info,
    Send,
    Hash,
    Table,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    ChevronRight,
} from "lucide-react";
import { multiExcelUpload, fetchMultiApproachReports, updateMultiApproachReport, deleteMultiApproachReport, updateMultiApproachAsset, deleteMultiApproachAsset } from "../../api/report"; // Adjust the import path as needed
import { ensureTaqeemAuthorized } from "../../shared/helper/taqeemAuthWrap";

const InputField = ({
    label,
    required = false,
    error,
    className = "",
    ...props
}) => (
    <div className={`space-y-1 ${className}`}>
        <label className="block text-[10px] font-semibold text-blue-900/70">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <input
            {...props}
            className={`w-full px-2 py-1.5 border rounded-md text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900/40 transition-all ${error ? "border-rose-300 bg-rose-50" : "border-blue-900/20 bg-white/90"
                }`}
        />
        {error && <p className="text-rose-600 text-[10px] mt-1">{error}</p>}
    </div>
);

const SelectField = ({
    label,
    required = false,
    options,
    error,
    className = "",
    ...props
}) => (
    <div className={`space-y-1 ${className}`}>
        <label className="block text-[10px] font-semibold text-blue-900/70">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <select
            {...props}
            className={`w-full px-2 py-1.5 border rounded-md text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900/40 transition-all ${error ? "border-rose-300 bg-rose-50" : "border-blue-900/20 bg-white/90"
                }`}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
        {error && <p className="text-rose-600 text-[10px] mt-1">{error}</p>}
    </div>
);

const TextAreaField = ({
    label,
    required = false,
    error,
    className = "",
    ...props
}) => (
    <div className={`space-y-1 ${className}`}>
        <label className="block text-[10px] font-semibold text-blue-900/70">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <textarea
            {...props}
            className={`w-full px-2 py-1.5 border rounded-md text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900/40 transition-all resize-none ${error ? "border-rose-300 bg-rose-50" : "border-blue-900/20 bg-white/90"
                }`}
        />
        {error && <p className="text-rose-600 text-[10px] mt-1">{error}</p>}
    </div>
);

const Section = ({ title, children }) => (
    <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-2.5">
        <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[13px] font-semibold text-blue-950">{title}</h3>
        </div>
        {children}
    </div>
);

const Modal = ({ open, onClose, title, children, maxWidth = "max-w-6xl" }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 px-4 py-6 overflow-auto">
            <div className={`w-full ${maxWidth}`}>
                <div className="rounded-2xl border border-blue-900/15 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-blue-900/10 px-4 py-3">
                        <h3 className="text-[14px] font-semibold text-blue-950">{title}</h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[12px] font-semibold text-blue-700 hover:text-blue-900"
                        >
                            Close
                        </button>
                    </div>
                    <div className="p-4">{children}</div>
                </div>
            </div>
        </div>
    );
};

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

const reportStatusLabels = {
    approved: "Approved",
    complete: "Complete",
    sent: "Sent",
    incomplete: "Incomplete",
};

const assetStatusLabels = {
    complete: "Complete",
    incomplete: "Incomplete",
};

const reportStatusClasses = {
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    complete: "border-blue-200 bg-blue-50 text-blue-700",
    sent: "border-amber-200 bg-amber-50 text-amber-700",
    incomplete: "border-rose-200 bg-rose-50 text-rose-700",
};

const assetStatusClasses = {
    complete: "border-emerald-200 bg-emerald-50 text-emerald-700",
    incomplete: "border-rose-200 bg-rose-50 text-rose-700",
};

const buildDefaultFormData = () => ({
    report_id: "",
    title: "",
    purpose_id: "to set",
    value_premise_id: "1",
    report_type: "",
    valued_at: "",
    submitted_at: "",
    inspection_date: "",
    assumptions: "",
    special_assumptions: "",
    value: "",
    final_value: "",
    valuation_currency: "1",
    client_name: "",
    owner_name: "",
    telephone: "",
    email: "",
    region: "",
    city: "",
    has_other_users: false,
    report_users: [],
});

const buildDefaultValuers = () => ([
    {
        valuer_name: "",
        contribution_percentage: 100,
    },
]);

const getReportStatus = (report) => {
    if (report?.checked) return "approved";
    if (report?.endSubmitTime) return "complete";
    if (report?.report_id) return "sent";
    return "incomplete";
};

const getReportSortTimestamp = (report) => {
    const raw = report?.createdAt || report?.updatedAt;
    if (raw) {
        const date = new Date(raw);
        const ts = date.getTime();
        if (!Number.isNaN(ts)) return ts;
    }
    const id = report?._id || report?.id;
    if (typeof id === "string" && id.length >= 8) {
        const ts = parseInt(id.slice(0, 8), 16);
        if (!Number.isNaN(ts)) return ts * 1000;
    }
    return 0;
};

const getAssetMacroId = (asset, report) => {
    if (!(report?.report_id || report?.reportId)) return "";
    return asset?.id || asset?.macro_id || asset?.macroId || "";
};

const getAssetStatus = (asset, report) =>
    getAssetMacroId(asset, report) ? "complete" : "incomplete";

const getAssetApproach = (asset) => {
    const hasMarket = asset?.market_approach || asset?.market_approach_value;
    const hasCost = asset?.cost_approach || asset?.cost_approach_value;
    if (hasMarket && hasCost) return "Market + Cost";
    if (hasMarket) return "Market";
    if (hasCost) return "Cost";
    if (asset?.source_sheet) return String(asset.source_sheet);
    if (asset?.sheet) return String(asset.sheet);
    return "-";
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

const asDateString = (value) => {
    if (!value) return "";
    if (typeof value === "string") {
        return value.slice(0, 10);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
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

const mapReportToForm = (report) => {
    const base = buildDefaultFormData();
    return {
        ...base,
        report_id: report?.report_id || "",
        title: report?.title || "",
        purpose_id:
            report?.purpose_id !== undefined && report?.purpose_id !== null
                ? String(report.purpose_id)
                : base.purpose_id,
        value_premise_id:
            report?.value_premise_id !== undefined && report?.value_premise_id !== null
                ? String(report.value_premise_id)
                : base.value_premise_id,
        report_type: report?.report_type || base.report_type,
        valued_at: asDateString(report?.valued_at),
        submitted_at: asDateString(report?.submitted_at),
        inspection_date: asDateString(report?.inspection_date),
        assumptions: report?.assumptions ?? "",
        special_assumptions: report?.special_assumptions ?? "",
        value:
            report?.value !== undefined && report?.value !== null
                ? String(report.value)
                : report?.final_value !== undefined && report?.final_value !== null
                    ? String(report.final_value)
                    : "",
        final_value:
            report?.final_value !== undefined && report?.final_value !== null
                ? String(report.final_value)
                : report?.value !== undefined && report?.value !== null
                    ? String(report.value)
                    : "",
        valuation_currency:
            report?.valuation_currency !== undefined && report?.valuation_currency !== null
                ? String(report.valuation_currency)
                : base.valuation_currency,
        client_name: report?.client_name || "",
        owner_name: report?.owner_name || "",
        telephone: report?.telephone || "",
        email: report?.email || "",
        region: report?.region || "",
        city: report?.city || "",
        has_other_users: !!report?.has_other_users,
        report_users: Array.isArray(report?.report_users) ? report.report_users : [],
    };
};

const normalizeValuers = (valuers = []) => {
    if (!Array.isArray(valuers)) return buildDefaultValuers();
    const cleaned = valuers
        .map((valuer) => ({
            valuer_name: valuer?.valuer_name || valuer?.valuerName || "",
            contribution_percentage: Number(
                valuer?.contribution_percentage ?? valuer?.percentage ?? 0
            ),
        }))
        .filter(
            (valuer) =>
                valuer.valuer_name || Number.isFinite(valuer.contribution_percentage)
        );
    return cleaned.length ? cleaned : buildDefaultValuers();
};

const getReportRecordId = (report) =>
    report?._id || report?.id || report?.recordId || "";

const isReportInfoIssue = (issue) => {
    const location = String(issue?.location || "").toLowerCase();
    return location.includes("report info");
};

const MultiExcelUpload = ({ onViewChange }) => {
    const { token } = useSession();
    const { taqeemStatus } = useNavStatus();
    const [excelFiles, setExcelFiles] = useState([]);
    const [pdfFiles, setPdfFiles] = useState([]);
    const [wantsPdfUpload, setWantsPdfUpload] = useState(false);
    const [batchId, setBatchId] = useState("");
    const [uploadResult, setUploadResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [creatingReports, setCreatingReports] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [validating, setValidating] = useState(false);
    const [validationItems, setValidationItems] = useState([]);
    const [validationMessage, setValidationMessage] = useState(null);
    const [validationTableTab, setValidationTableTab] = useState("report-info");
    const [isValidationTableCollapsed, setIsValidationTableCollapsed] = useState(false);
    const [reports, setReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsError, setReportsError] = useState(null);
    const [expandedReports, setExpandedReports] = useState([]);
    const [selectedReportIds, setSelectedReportIds] = useState([]);
    const [reportSelectFilter, setReportSelectFilter] = useState("all");
    const [reportActionBusy, setReportActionBusy] = useState({});
    const [selectedAssetsByReport, setSelectedAssetsByReport] = useState({});
    const [assetSelectFilters, setAssetSelectFilters] = useState({});
    const [assetActionBusy, setAssetActionBusy] = useState({});
    const [editingReportId, setEditingReportId] = useState(null);
    const [formData, setFormData] = useState(buildDefaultFormData());
    const [errors, setErrors] = useState({});
    const [reportUsers, setReportUsers] = useState([]);
    const [valuers, setValuers] = useState(buildDefaultValuers());
    const [assetEdit, setAssetEdit] = useState(null);
    const [assetDraft, setAssetDraft] = useState({
        asset_name: "",
        asset_usage_id: "",
        final_value: "",
        region: "",
        city: "",
    });
    const [actionStatus, setActionStatus] = useState(null);
    const [updatingReport, setUpdatingReport] = useState(false);
    const [pendingSubmit, setPendingSubmit, resetPendingSubmit] = usePersistentState("multiExcel:pendingSubmit", null, { storage: "session" });
    const [pendingBatch, setPendingBatch, resetPendingBatch] = usePersistentState("multiExcel:pendingBatch", null, { storage: "session" });
    const [, setReturnView, resetReturnView] = usePersistentState("taqeem:returnView", null, { storage: "session" });

    const { ramInfo } = useRam();
    const recommendedTabs = ramInfo?.recommendedTabs || 1;
    const isTaqeemLoggedIn = taqeemStatus?.state === "success";

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
        resetPendingSubmit();
        resetPendingBatch();
        resetReturnView();
    };

    const selectedReportSet = useMemo(() => new Set(selectedReportIds), [selectedReportIds]);
    const isEditing = Boolean(editingReportId);

    const loadReports = useCallback(async () => {
        try {
            setReportsLoading(true);
            setReportsError(null);
            const result = await fetchMultiApproachReports();
            if (!result?.success) {
                throw new Error(result?.message || "Failed to load reports.");
            }
            const reportList = Array.isArray(result.reports) ? result.reports : [];
            setReports(reportList);
        } catch (err) {
            setReportsError(err?.message || "Failed to load reports.");
        } finally {
            setReportsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

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

    const resolveTabsForAssets = useCallback(
        (assetCount) => {
            const fallbackTabs = Math.max(1, Number(recommendedTabs) || 1);
            if (!assetCount || assetCount < 1) return fallbackTabs;
            return Math.max(1, Math.min(fallbackTabs, assetCount));
        },
        [recommendedTabs]
    );

    const createReportsByBatch = useCallback(
        async (batchId, tabsNum, insertedCount, options = {}) => {
            const { resume = false } = options;
            const resolvedTabs = Math.max(1, Number(tabsNum) || Number(recommendedTabs) || 1);

            setCreatingReports(true);

            try {
                if (!batchId) {
                    setError("Missing batch id for report creation.");
                    return;
                }

                const ok = await ensureTaqeemAuthorized(token, onViewChange, isTaqeemLoggedIn);
                if (!ok) {
                    setError("Taqeem login required. Finish login and choose a company to continue.");
                    setPendingBatch({
                        batchId,
                        tabsNum: resolvedTabs,
                        insertedCount,
                        resumeOnLoad: true,
                    });
                    setReturnView("multi-excel-upload");
                    return;
                }

                setSuccess(
                    resume
                        ? "Resuming report creation in Taqeem..."
                        : "Creating reports in Taqeem browser..."
                );

                if (!window?.electronAPI?.createReportsByBatch) {
                    throw new Error("Desktop integration unavailable. Restart the app.");
                }

                const electronResult = await window.electronAPI.createReportsByBatch(
                    batchId,
                    resolvedTabs
                );

                if (electronResult?.status === "SUCCESS") {
                    const countLabel = insertedCount ? `${insertedCount} report(s)` : "Reports";
                    setSuccess(`${countLabel} created successfully with ${resolvedTabs} tab(s).`);
                    resetPendingBatch();
                    resetReturnView();
                    await loadReports();
                    return;
                }

                const errMsg = electronResult?.error || "Failed to create reports in Taqeem";
                if (/no company selected/i.test(errMsg)) {
                    setError(errMsg);
                    setPendingBatch({
                        batchId,
                        tabsNum: resolvedTabs,
                        insertedCount,
                        resumeOnLoad: true,
                    });
                    setReturnView("multi-excel-upload");
                    onViewChange?.("get-companies");
                    return;
                }

                throw new Error(errMsg);
            } catch (err) {
                setError(err?.message || "Failed to create reports in Taqeem");
                resetPendingBatch();
                resetReturnView();
            } finally {
                setCreatingReports(false);
            }
        },
        [
            isTaqeemLoggedIn,
            loadReports,
            onViewChange,
            recommendedTabs,
            resetPendingBatch,
            resetReturnView,
            setPendingBatch,
            setReturnView,
            token,
        ]
    );

    const submitToTaqeem = useCallback(
        async (recordId, tabsNum, options = {}) => {
            const { withLoading = true, resume = false } = options;
            const resolvedTabs = Math.max(1, Number(tabsNum) || resolveTabsForAssets(0));

            if (withLoading) {
                setSubmitting(true);
            }

            try {
                if (!recordId) {
                    setActionStatus({ type: "error", message: "Missing report record id." });
                    return;
                }

                const ok = await ensureTaqeemAuthorized(token, onViewChange, isTaqeemLoggedIn);
                if (!ok) {
                    setActionStatus({
                        type: "info",
                        message: "Taqeem login required. Finish login and choose a company to continue.",
                    });
                    setPendingSubmit({ recordId, tabsNum: resolvedTabs, resumeOnLoad: true });
                    setReturnView("multi-excel-upload");
                    return;
                }

                setActionStatus({
                    type: "info",
                    message: resume ? "Resuming Taqeem submission..." : "Submitting report to Taqeem...",
                });

                if (!window?.electronAPI?.createReportById) {
                    throw new Error("Desktop integration unavailable. Restart the app.");
                }

                const result = await window.electronAPI.createReportById(recordId, resolvedTabs);

                if (result?.status === "SUCCESS") {
                    setActionStatus({
                        type: "success",
                        message: "Report submitted to Taqeem. Browser closed after completion.",
                    });
                    resetPendingSubmit();
                    resetReturnView();
                    await loadReports();
                    return;
                }

                const errMsg =
                    result?.error ||
                    "Upload to Taqeem failed. Make sure you selected a company.";
                if (/no company selected/i.test(errMsg)) {
                    setActionStatus({
                        type: "warning",
                        message: errMsg,
                    });
                    setPendingSubmit({ recordId, tabsNum: resolvedTabs, resumeOnLoad: true });
                    setReturnView("multi-excel-upload");
                    onViewChange?.("get-companies");
                    return;
                }

                setActionStatus({ type: "error", message: errMsg });
                resetPendingSubmit();
                resetReturnView();
            } catch (err) {
                setActionStatus({
                    type: "error",
                    message: err?.message || "Failed to submit report to Taqeem.",
                });
                resetPendingSubmit();
                resetReturnView();
            } finally {
                if (withLoading) {
                    setSubmitting(false);
                }
            }
        },
        [
            isTaqeemLoggedIn,
            loadReports,
            onViewChange,
            resolveTabsForAssets,
            resetPendingSubmit,
            resetReturnView,
            setPendingSubmit,
            setReturnView,
            token,
        ]
    );

    useEffect(() => {
        if (!pendingSubmit?.recordId || !pendingSubmit?.resumeOnLoad) return;
        if (submitting) return;
        submitToTaqeem(pendingSubmit.recordId, pendingSubmit.tabsNum, { resume: true });
    }, [pendingSubmit, submitToTaqeem, submitting]);

    useEffect(() => {
        if (creatingReports) return;
        if (!pendingBatch?.batchId || !pendingBatch?.resumeOnLoad) return;
        setPendingBatch((prev) => (prev ? { ...prev, resumeOnLoad: false } : prev));
        createReportsByBatch(
            pendingBatch.batchId,
            pendingBatch.tabsNum,
            pendingBatch.insertedCount,
            { resume: true }
        );
    }, [pendingBatch, creatingReports, createReportsByBatch, setPendingBatch]);

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

                const marketAssetCount = marketRows.filter((r) =>
                    hasValue(r.asset_name || r.assetName)
                ).length;
                const costAssetCount = costRows.filter((r) =>
                    hasValue(r.asset_name || r.assetName)
                ).length;
                if (marketAssetCount === 0 && costAssetCount === 0) {
                    addIssue(
                        "Assets",
                        "Sheets",
                        "No assets found in market or cost sheets."
                    );
                }

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
                        marketAssets: marketAssetCount,
                        costAssets: costAssetCount,
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
        runValidation(excelFiles, pdfMatchInfo.pdfMap);
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
            await loadReports();

            setLoading(false);
            await createReportsByBatch(batchIdFromApi, recommendedTabs, insertedCount);

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
        }
    };

    const requiredFields = useMemo(
        () => [
            "title",
            "purpose_id",
            "value_premise_id",
            "report_type",
            "valued_at",
            "submitted_at",
            "inspection_date",
            "value",
            "client_name",
            "telephone",
            "email",
        ],
        []
    );

    const orderedReports = useMemo(() => {
        return [...reports].sort(
            (a, b) => getReportSortTimestamp(a) - getReportSortTimestamp(b)
        );
    }, [reports]);

    const reportIndexMap = useMemo(() => {
        const map = new Map();
        orderedReports.forEach((report, idx) => {
            const id = getReportRecordId(report);
            if (id) {
                map.set(id, idx + 1);
            }
        });
        return map;
    }, [orderedReports]);

    const visibleReports = useMemo(() => {
        if (reportSelectFilter === "all") return orderedReports;
        return orderedReports.filter(
            (report) => getReportStatus(report) === reportSelectFilter
        );
    }, [orderedReports, reportSelectFilter]);

    useEffect(() => {
        if (reportSelectFilter === "all") {
            setSelectedReportIds([]);
            return;
        }
        const ids = visibleReports.map(getReportRecordId).filter(Boolean);
        setSelectedReportIds(ids);
    }, [reportSelectFilter, visibleReports]);

    const toggleReportExpansion = (reportId) => {
        setExpandedReports((prev) =>
            prev.includes(reportId)
                ? prev.filter((id) => id !== reportId)
                : [...prev, reportId]
        );
    };

    const toggleReportSelection = (reportId) => {
        setSelectedReportIds((prev) =>
            prev.includes(reportId)
                ? prev.filter((id) => id !== reportId)
                : [...prev, reportId]
        );
    };

    const toggleAssetSelection = (reportId, assetIndex) => {
        setSelectedAssetsByReport((prev) => {
            const selected = new Set(prev[reportId] || []);
            if (selected.has(assetIndex)) {
                selected.delete(assetIndex);
            } else {
                selected.add(assetIndex);
            }
            return { ...prev, [reportId]: Array.from(selected) };
        });
    };

    const handleEditReport = (report) => {
        const recordId = getReportRecordId(report);
        if (!recordId) return;
        const mapped = mapReportToForm(report);
        setFormData(mapped);
        setReportUsers(mapped.report_users || []);
        setValuers(normalizeValuers(report?.valuers || []));
        setErrors({});
        setEditingReportId(recordId);
    };

    const closeReportEdit = () => {
        setEditingReportId(null);
        setFormData(buildDefaultFormData());
        setReportUsers([]);
        setValuers(buildDefaultValuers());
        setErrors({});
    };

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const handleReportUserChange = (idx, value) => {
        setReportUsers((prev) => {
            const next = [...prev];
            next[idx] = value;
            return next;
        });
    };

    const handleAddReportUser = () => {
        setReportUsers((prev) => [...prev, ""]);
    };

    const handleRemoveReportUser = (idx) => {
        setReportUsers((prev) => prev.filter((_, index) => index !== idx));
    };

    const handleValuerChange = (idx, field, value) => {
        setValuers((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const handleAddValuer = () => {
        setValuers((prev) => [
            ...prev,
            { valuer_name: "", contribution_percentage: 0 },
        ]);
    };

    const handleRemoveValuer = (idx) => {
        setValuers((prev) => prev.filter((_, index) => index !== idx));
    };

    const validateReport = () => {
        const newErrors = {};
        requiredFields.forEach((field) => {
            if (!formData[field]) {
                newErrors[field] = "Required";
            }
        });
        if (!formData.value && !formData.final_value) {
            newErrors.final_value = "Required";
        }
        if (formData.email && !isValidEmail(formData.email)) {
            newErrors.email = "Invalid email";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveReportEdit = async () => {
        if (!editingReportId) return;
        const isValid = validateReport();
        if (!isValid) {
            setActionStatus({ type: "error", message: "Fix required fields before saving." });
            return;
        }

        try {
            setUpdatingReport(true);
            const normalizedFinal = formData.final_value || formData.value || "";
            const payload = {
                ...formData,
                value: formData.value || normalizedFinal,
                final_value: normalizedFinal,
                report_users: reportUsers || [],
                valuers,
            };

            const result = await updateMultiApproachReport(editingReportId, payload);
            if (result?.success) {
                setActionStatus({ type: "success", message: "Report updated." });
                closeReportEdit();
                await loadReports();
            } else {
                setActionStatus({
                    type: "error",
                    message: result?.message || "Could not update report.",
                });
            }
        } catch (err) {
            setActionStatus({
                type: "error",
                message:
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to update report.",
            });
        } finally {
            setUpdatingReport(false);
        }
    };

    const openAssetEdit = (reportId, assetIndex, asset) => {
        setAssetEdit({ reportId, assetIndex });
        setAssetDraft({
            asset_name: asset?.asset_name || "",
            asset_usage_id: asset?.asset_usage_id || "",
            final_value: asset?.final_value || "",
            region: asset?.region || "",
            city: asset?.city || "",
        });
    };

    const closeAssetEdit = () => {
        setAssetEdit(null);
        setAssetDraft({
            asset_name: "",
            asset_usage_id: "",
            final_value: "",
            region: "",
            city: "",
        });
    };

    const handleSaveAssetEdit = async () => {
        if (!assetEdit?.reportId && assetEdit?.reportId !== 0) return;
        const { reportId, assetIndex } = assetEdit;
        try {
            setAssetActionBusy((prev) => ({
                ...prev,
                [`${reportId}:${assetIndex}`]: "edit",
            }));
            const result = await updateMultiApproachAsset(reportId, assetIndex, assetDraft);
            if (!result?.success) {
                throw new Error(result?.message || "Failed to update asset.");
            }
            setActionStatus({ type: "success", message: "Asset updated." });
            closeAssetEdit();
            await loadReports();
        } catch (err) {
            setActionStatus({
                type: "error",
                message:
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to update asset.",
            });
        } finally {
            setAssetActionBusy((prev) => {
                const next = { ...prev };
                delete next[`${reportId}:${assetIndex}`];
                return next;
            });
        }
    };

    const downloadCertificatesForReports = async (reportList = []) => {
        if (!reportList.length) return;
        if (!window?.electronAPI?.downloadRegistrationCertificates) {
            setActionStatus({
                type: "error",
                message: "Desktop integration unavailable. Restart the app.",
            });
            return;
        }

        const targets = reportList
            .map((report) => ({
                reportId: report.report_id || report.reportId || "",
                assetName: report.client_name || report.title || "",
            }))
            .filter((item) => item.reportId);

        if (!targets.length) {
            setActionStatus({
                type: "warning",
                message: "No reports with IDs found to download certificates.",
            });
            return;
        }

        const folderResult = await window.electronAPI.selectFolder();
        if (!folderResult?.folderPath) {
            setActionStatus({ type: "info", message: "Folder selection canceled." });
            return;
        }

        setActionStatus({
            type: "info",
            message: `Downloading ${targets.length} certificate(s)...`,
        });

        try {
            const result = await window.electronAPI.downloadRegistrationCertificates({
                downloadPath: folderResult.folderPath,
                reports: targets,
                tabsNum: Math.max(1, Number(recommendedTabs) || 1),
            });
            if (result?.status !== "SUCCESS") {
                throw new Error(result?.error || "Certificate download failed");
            }
            const summary = result?.summary || {};
            const downloaded = summary.downloaded ?? 0;
            const failed = summary.failed ?? 0;
            setActionStatus({
                type: failed ? "warning" : "success",
                message: `Certificates downloaded: ${downloaded}. Failed: ${failed}.`,
            });
        } catch (err) {
            setActionStatus({
                type: "error",
                message: err?.message || "Failed to download certificates.",
            });
        }
    };

    const handleReportAction = async (report, action) => {
        if (!action) return;
        if (action === "edit") {
            handleEditReport(report);
            return;
        }

        const recordId = getReportRecordId(report);
        if (!recordId) {
            setActionStatus({ type: "error", message: "Missing report record id." });
            return;
        }

        if (action === "send-approver") {
            setActionStatus({ type: "info", message: "Report sent to approver." });
            return;
        }

        if (action === "delete") {
            const confirmed = window.confirm("Delete this report and its assets?");
            if (!confirmed) return;
        }

        setReportActionBusy((prev) => ({ ...prev, [recordId]: action }));

        try {
            if (action === "send" || action === "retry") {
                const assetCount = Array.isArray(report.asset_data)
                    ? report.asset_data.length
                    : 0;
                const tabsForAssets = resolveTabsForAssets(assetCount);
                await submitToTaqeem(recordId, tabsForAssets, { withLoading: false });
                await loadReports();
            } else if (action === "approve") {
                const result = await updateMultiApproachReport(recordId, { checked: true });
                if (!result?.success) {
                    throw new Error(result?.message || "Failed to approve report.");
                }
                setActionStatus({ type: "success", message: "Report approved." });
                await loadReports();
            } else if (action === "delete") {
                const result = await deleteMultiApproachReport(recordId);
                if (!result?.success) {
                    throw new Error(result?.message || "Failed to delete report.");
                }
                setActionStatus({ type: "success", message: "Report deleted." });
                await loadReports();
            } else if (action === "download") {
                await downloadCertificatesForReports([report]);
            }
        } catch (err) {
            setActionStatus({
                type: "error",
                message:
                    err?.response?.data?.message || err?.message || "Action failed.",
            });
        } finally {
            setReportActionBusy((prev) => {
                const next = { ...prev };
                delete next[recordId];
                return next;
            });
        }
    };

    const handleAssetAction = async (report, assetIndex, action) => {
        if (!action) return;
        const recordId = getReportRecordId(report);
        if (!recordId) return;
        if (action === "edit") {
            const asset = report?.asset_data?.[assetIndex];
            openAssetEdit(recordId, assetIndex, asset);
            return;
        }
        if (action === "delete") {
            const confirmed = window.confirm("Delete this asset from the report?");
            if (!confirmed) return;
        }

        setAssetActionBusy((prev) => ({
            ...prev,
            [`${recordId}:${assetIndex}`]: action,
        }));

        try {
            if (action === "retry") {
                const assetCount = Array.isArray(report.asset_data)
                    ? report.asset_data.length
                    : 0;
                const tabsForAssets = resolveTabsForAssets(assetCount);
                await submitToTaqeem(recordId, tabsForAssets, { withLoading: false });
                await loadReports();
            } else if (action === "delete") {
                const result = await deleteMultiApproachAsset(recordId, assetIndex);
                if (!result?.success) {
                    throw new Error(result?.message || "Failed to delete asset.");
                }
                setActionStatus({ type: "success", message: "Asset deleted." });
                await loadReports();
            }
        } catch (err) {
            setActionStatus({
                type: "error",
                message:
                    err?.response?.data?.message ||
                    err?.message ||
                    "Asset action failed.",
            });
        } finally {
            setAssetActionBusy((prev) => {
                const next = { ...prev };
                delete next[`${recordId}:${assetIndex}`];
                return next;
            });
        }
    };

    const handleBulkAssetAction = async (report, action) => {
        if (!action) return;
        const reportId = getReportRecordId(report);
        if (!reportId) return;
        const selectedAssets = selectedAssetsByReport[reportId] || [];
        if (!selectedAssets.length) {
            setActionStatus({
                type: "warning",
                message: "Select at least one asset first.",
            });
            return;
        }

        try {
            if (action === "retry") {
                const assetCount = Array.isArray(report.asset_data)
                    ? report.asset_data.length
                    : 0;
                const tabsForAssets = resolveTabsForAssets(assetCount);
                await submitToTaqeem(reportId, tabsForAssets, { withLoading: false });
                await loadReports();
                return;
            }

            if (action === "delete") {
                const confirmed = window.confirm("Delete selected assets?");
                if (!confirmed) return;
                const sorted = [...selectedAssets].sort((a, b) => b - a);
                for (const idx of sorted) {
                    await deleteMultiApproachAsset(reportId, idx);
                }
                setActionStatus({ type: "success", message: "Selected assets deleted." });
                await loadReports();
            }
        } catch (err) {
            setActionStatus({
                type: "error",
                message:
                    err?.response?.data?.message ||
                    err?.message ||
                    "Bulk asset action failed.",
            });
        }
    };

    const assetEditBusy = assetEdit
        ? assetActionBusy[`${assetEdit.reportId}:${assetEdit.assetIndex}`]
        : false;

    const actionAlert = actionStatus ? (
        <div
            className={`mb-3 rounded-2xl border px-3 py-2 flex items-start gap-2 text-[11px] ${actionStatus.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : actionStatus.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : actionStatus.type === "info"
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
        >
            {actionStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5" />
            ) : actionStatus.type === "info" ? (
                <Info className="w-4 h-4 mt-0.5" />
            ) : actionStatus.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 mt-0.5" />
            ) : (
                <AlertTriangle className="w-4 h-4 mt-0.5" />
            )}
            <div className="font-semibold">{actionStatus.message}</div>
        </div>
    ) : null;

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
            { label: "Market assets", value: counts ? String(counts.marketAssets) : "-" },
            { label: "Cost assets", value: counts ? String(counts.costAssets) : "-" },
            { label: "Market total", value: totals ? String(totals.marketTotal) : "-" },
            { label: "Cost total", value: totals ? String(totals.costTotal) : "-" },
            { label: "Assets total", value: totals ? String(totals.assetsTotalValue) : "-" },
            { label: "Report total", value: totals ? String(totals.reportTotalValue) : "-" },
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
                                    <p className="text-slate-700 break-words">{field.value || "-"}</p>
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
                                            <td className="px-3 py-2 text-rose-700">{issue.location || "-"}</td>
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
        <div className="relative p-3 space-y-3 page-animate">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-xl backdrop-blur">
                <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-sky-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
                <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-3">
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                            Batch Automation
                        </p>
                        <h2 className="text-xl md:text-2xl font-display text-compact text-slate-900">
                            Multi-Excel Upload
                        </h2>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-2.5 py-0.5 shadow-sm">
                                <Table className="h-3.5 w-3.5 text-emerald-600" />
                                {recommendedTabs} tab{recommendedTabs !== 1 ? "s" : ""} auto
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-2.5 py-0.5 shadow-sm">
                                <Files className="h-3.5 w-3.5 text-sky-600" />
                                {wantsPdfUpload ? "PDF upload on" : "PDF upload optional"}
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-2.5 py-0.5 shadow-sm">
                                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                                Validation enabled
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1.15fr_0.7fr]">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm card-animate">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-400" />
                    <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                                    <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                                </div>
                                <div>
                                    <h3 className="text-[12px] font-semibold text-slate-900">Excel sources</h3>
                                    <span className="text-xs text-slate-500">.xlsx / .xls</span>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">
                                {excelFiles.length} selected
                            </span>
                        </div>
                        <label className="group flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition">
                            <div className="flex items-center gap-2 text-[12px] text-slate-700">
                                <FolderOpen className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
                                <span className="font-medium">
                                    {excelFiles.length ? `${excelFiles.length} Excel file(s) selected` : "Choose Excel files"}
                                </span>
                            </div>
                            <input type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={handleExcelChange} />
                            <span className="text-xs font-semibold text-slate-600">Browse</span>
                        </label>

                        {excelFiles.length > 0 && (
                            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-2">
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
                    <div className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                    <Files className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-[12px] font-semibold text-slate-900">PDF attachments</h3>
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
                                <label className="group flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition">
                                    <div className="flex items-center gap-2 text-[12px] text-slate-700">
                                        <FolderOpen className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
                                        <span className="font-medium">
                                            {pdfFiles.length ? `${pdfFiles.length} PDF file(s) selected` : "Choose PDF files"}
                                        </span>
                                    </div>
                                    <input type="file" multiple accept=".pdf" className="hidden" onChange={handlePdfChange} />
                                    <span className="text-xs font-semibold text-slate-600">Browse</span>
                                </label>

                                {pdfFiles.length > 0 && (
                                    <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-2">
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
                    <div className="p-3 space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                <Table className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-[12px] font-semibold text-slate-900">Tabs runtime</h3>
                                <span className="text-xs text-slate-500">Auto based on RAM</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-white">
                            <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-emerald-300" />
                                <span className="text-[12px] font-semibold">
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
                    className={`rounded-2xl border px-3 py-2 flex items-start gap-3 shadow-sm card-animate ${error
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

            <div className="space-y-3">
                    <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm overflow-hidden card-animate">
                        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-900 px-2 py-2 text-white">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-1">
                                    <p className="text-[11px] font-semibold">Validation console</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => runValidation(excelFiles, pdfMatchInfo.pdfMap)}
                                    disabled={validating || !excelFiles.length}
                                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-white/20 disabled:opacity-60"
                                >
                                    {validating ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3 h-3" />
                                    )}
                                    {validating ? "Validating..." : "Re-validate"}
                                </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                                <div className="inline-flex rounded-full bg-white/10 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setValidationTableTab("report-info")}
                                        className={`px-3 py-1 rounded-full transition ${validationTableTab === "report-info"
                                            ? "bg-white text-blue-900 shadow-sm"
                                            : "text-blue-100 hover:text-white"
                                            }`}
                                    >
                                        Report Info validation
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setValidationTableTab("pdf-assets")}
                                        className={`px-3 py-1 rounded-full transition ${validationTableTab === "pdf-assets"
                                            ? "bg-white text-blue-900 shadow-sm"
                                            : "text-blue-100 hover:text-white"
                                            }`}
                                    >
                                        Validate PDFs &amp; assets data
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsValidationTableCollapsed((prev) => !prev)}
                                    className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white/90 shadow-sm backdrop-blur transition hover:bg-white/25 hover:text-white"
                                >
                                    {isValidationTableCollapsed ? (
                                        <ChevronDown className="w-3 h-3" />
                                    ) : (
                                        <ChevronUp className="w-3 h-3" />
                                    )}
                                    {isValidationTableCollapsed ? "Show table" : "Hide table"}
                                </button>
                            </div>
                        </div>
                        <div className="p-2 space-y-2">
                            {validationMessage && (
                                <div
                                    className={`rounded-lg border px-2 py-1 inline-flex items-start gap-1 text-[10px] ${validationMessage.type === "error"
                                        ? "bg-rose-50 text-rose-700 border-rose-100"
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
                                    <div className="text-[10px]">{validationMessage.text}</div>
                                </div>
                            )}

                            {validationTableTab === "report-info" ? (
                                validationItems.length ? (
                                    <div className="space-y-2">
                                        {validationItems.map((item) => {
                                            const reportIssues = (item.issues || []).filter(isReportInfoIssue);
                                            const reportInfoIssuesByField = reportIssues.reduce((acc, issue) => {
                                                const key = issue.field || "Issue";
                                                if (!acc[key]) acc[key] = [];
                                                acc[key].push(issue);
                                                return acc;
                                            }, {});
                                            const reportFields = [
                                                { label: "Purpose of Valuation", value: item.snapshot?.purpose },
                                                { label: "Value Attributes", value: item.snapshot?.valueAttributes },
                                                { label: "Report", value: item.snapshot?.reportType },
                                                { label: "Client Name", value: item.snapshot?.clientName },
                                                { label: "Client Telephone", value: item.snapshot?.telephone },
                                                { label: "Client Email", value: item.snapshot?.email },
                                                { label: "Date of Valuation", value: item.snapshot?.valuedAt ? formatDateForDisplay(item.snapshot.valuedAt) : "" },
                                                { label: "Report Issuing Date", value: item.snapshot?.submittedAt ? formatDateForDisplay(item.snapshot.submittedAt) : "" },
                                            ];
                                            const fieldLabels = new Set(reportFields.map((field) => field.label));
                                            const extraIssues = reportIssues.filter((issue) => !fieldLabels.has(issue.field));
                                            return (
                                                <div key={item.fileName} className="rounded-lg border border-blue-900/10 bg-white p-2">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-[10px] font-semibold text-blue-900">{item.fileName}</div>
                                                        <span
                                                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${reportIssues.length
                                                                ? "bg-rose-50 text-rose-700 border-rose-100"
                                                                : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                                }`}
                                                        >
                                                            {reportIssues.length ? `${reportIssues.length} issue(s)` : "All fields OK"}
                                                        </span>
                                                    </div>
                                                    {isValidationTableCollapsed ? (
                                                        <div className="flex items-center gap-1 text-[10px] text-blue-900/70 mt-1">
                                                            <ChevronDown className="w-3 h-3" />
                                                            Table hidden.
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto max-h-[260px] overflow-y-auto mt-2">
                                                            <table className="min-w-full text-[10px] leading-tight border-separate border-spacing-0">
                                                                <thead className="text-[10px] uppercase tracking-wide text-white/90">
                                                                    <tr>
                                                                        <th className="px-2 py-1 bg-blue-900/95 text-left rounded-l-lg">Field</th>
                                                                        <th className="px-2 py-1 bg-blue-900/95 text-left">Value</th>
                                                                        <th className="px-2 py-1 bg-blue-900/95 text-left">Status</th>
                                                                        <th className="px-2 py-1 bg-blue-900/95 text-left rounded-r-lg">Notes</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {reportFields.map((field) => {
                                                                        const fieldIssues = reportInfoIssuesByField[field.label] || [];
                                                                        const hasIssue = fieldIssues.length > 0;
                                                                        const hasFieldValue = hasValue(field.value);
                                                                        const statusLabel = hasIssue ? "Issue" : hasFieldValue ? "OK" : "Missing";
                                                                        const statusTone = hasIssue
                                                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                                                            : hasFieldValue
                                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                                : "bg-amber-50 text-amber-700 border-amber-200";
                                                                        const notesText = hasIssue
                                                                            ? fieldIssues.map((issue) => issue.message).join(" / ")
                                                                            : hasFieldValue
                                                                                ? "Looks good"
                                                                                : "Missing in Excel";
                                                                        return (
                                                                            <tr key={field.label}>
                                                                                <td className="px-2 py-1 bg-white border border-blue-900/10 rounded-l-lg font-semibold text-blue-900">
                                                                                    {field.label}
                                                                                </td>
                                                                                <td className="px-2 py-1 bg-white border border-blue-900/10 text-blue-900/90">
                                                                                    {hasFieldValue ? field.value : "N/A"}
                                                                                </td>
                                                                                <td className="px-2 py-1 bg-white border border-blue-900/10">
                                                                                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusTone}`}>
                                                                                        {statusLabel}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-2 py-1 bg-white border border-blue-900/10 rounded-r-lg text-blue-900/80">
                                                                                    {notesText}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    {extraIssues.map((issue, idx) => (
                                                                        <tr key={`issue-extra-${idx}`}>
                                                                            <td className="px-2 py-1 bg-white border border-blue-900/10 rounded-l-lg font-semibold text-blue-900">
                                                                                {issue.field || "Issue"}
                                                                            </td>
                                                                            <td className="px-2 py-1 bg-white border border-blue-900/10 text-blue-900/90">
                                                                                {issue.location || "Report Info"}
                                                                            </td>
                                                                            <td className="px-2 py-1 bg-white border border-blue-900/10">
                                                                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                                                                    Issue
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-2 py-1 bg-white border border-blue-900/10 rounded-r-lg text-blue-900/80">
                                                                                {issue.message || "Issue detected"}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-3 border border-dashed border-blue-900/20 rounded-2xl bg-white/70 text-[11px] text-blue-900/60 flex items-center justify-center">
                                        Validation results will appear here after reading the Excel.
                                    </div>
                                )
                            ) : (
                                <div className="space-y-2">
                                    {wantsPdfUpload && (pdfMatchInfo.excelsMissingPdf.length || pdfMatchInfo.unmatchedPdfs.length) && (
                                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] text-rose-700">
                                            <div className="font-semibold">File matching issues</div>
                                            <div className="mt-1 space-y-1">
                                                {pdfMatchInfo.excelsMissingPdf.length > 0 && (
                                                    <div>
                                                        Excel files missing PDF: {pdfMatchInfo.excelsMissingPdf.join(", ")}
                                                    </div>
                                                )}
                                                {pdfMatchInfo.unmatchedPdfs.length > 0 && (
                                                    <div>
                                                        Unmatched PDFs: {pdfMatchInfo.unmatchedPdfs.join(", ")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {validationItems.length ? (
                                        <div className="space-y-2">
                                            <div className="rounded-lg border border-blue-900/10 bg-white p-2">
                                                <div className="text-[10px] font-semibold text-blue-900 mb-2">Assets &amp; PDF summary</div>
                                                {isValidationTableCollapsed ? (
                                                    <div className="flex items-center gap-1 text-[10px] text-blue-900/70">
                                                        <ChevronDown className="w-3 h-3" />
                                                        Table hidden.
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                                                        <table className="min-w-full text-[10px] text-slate-700">
                                                            <thead className="bg-blue-900/10 text-blue-900">
                                                                <tr>
                                                                    <th className="px-2 py-1 text-left font-semibold">Excel</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">PDF</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Market</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Cost</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Market total</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Cost total</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Assets total</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Report total</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Issues</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {validationItems.map((item) => {
                                                                    const assetIssues = (item.issues || []).filter((issue) => !isReportInfoIssue(issue));
                                                                    return (
                                                                        <tr key={`summary-${item.fileName}`} className="border-t border-blue-900/10">
                                                                            <td className="px-2 py-1 text-blue-900/90">{item.fileName}</td>
                                                                            <td className="px-2 py-1">
                                                                                {item.pdfMatched ? (
                                                                                    <span className="text-emerald-700">Matched</span>
                                                                                ) : (
                                                                                    <span className="text-rose-700">Missing</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-2 py-1">{item.counts?.marketAssets ?? "-"}</td>
                                                                            <td className="px-2 py-1">{item.counts?.costAssets ?? "-"}</td>
                                                                            <td className="px-2 py-1">{item.totals?.marketTotal ?? "-"}</td>
                                                                            <td className="px-2 py-1">{item.totals?.costTotal ?? "-"}</td>
                                                                            <td className="px-2 py-1">{item.totals?.assetsTotalValue ?? "-"}</td>
                                                                            <td className="px-2 py-1">{item.totals?.reportTotalValue ?? "-"}</td>
                                                                            <td className="px-2 py-1">{assetIssues.length}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                            {!isValidationTableCollapsed && (
                                                <div className="rounded-lg border border-blue-900/10 bg-white p-2">
                                                    <div className="text-[10px] font-semibold text-blue-900 mb-2">Issues</div>
                                                    <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
                                                        <table className="min-w-full text-[10px] text-slate-700">
                                                            <thead className="bg-blue-900/10 text-blue-900">
                                                                <tr>
                                                                    <th className="px-2 py-1 text-left font-semibold">Excel</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Field</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Location</th>
                                                                    <th className="px-2 py-1 text-left font-semibold">Details</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {validationItems.flatMap((item) => {
                                                                    const assetIssues = (item.issues || []).filter((issue) => !isReportInfoIssue(issue));
                                                                    if (!assetIssues.length) {
                                                                        return [
                                                                            <tr key={`issue-none-${item.fileName}`} className="border-t border-blue-900/10">
                                                                                <td className="px-2 py-1 text-blue-900/90">{item.fileName}</td>
                                                                                <td className="px-2 py-1" colSpan={3}>
                                                                                    No issues
                                                                                </td>
                                                                            </tr>,
                                                                        ];
                                                                    }
                                                                    return assetIssues.map((issue, idx) => (
                                                                        <tr key={`issue-${item.fileName}-${idx}`} className="border-t border-blue-900/10">
                                                                            <td className="px-2 py-1 text-blue-900/90">{item.fileName}</td>
                                                                            <td className="px-2 py-1 font-semibold">{issue.field}</td>
                                                                            <td className="px-2 py-1">{issue.location || "-"}</td>
                                                                            <td className="px-2 py-1">{issue.message}</td>
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
                                        <div className="p-3 border border-dashed border-blue-900/20 rounded-2xl bg-white/70 text-[11px] text-blue-900/60 flex items-center justify-center">
                                            Validation results will appear here after reading the Excel.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={handleUploadAndCreate}
                    disabled={loading || creatingReports || !isReadyToUpload}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 text-white text-[12px] font-semibold shadow-lg hover:opacity-90 disabled:opacity-50"
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
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-[12px] font-semibold hover:bg-slate-50"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset All
                </button>
            </div>

            <Section title="Reports">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="text-[11px] text-blue-900/70">
                        Total reports: {reports.length}{batchId ? ` | Latest batch: ${batchId}` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadReports}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px] font-semibold text-blue-900 hover:bg-blue-50"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refresh
                        </button>
                        <span className="text-[10px] font-semibold text-blue-900/60">Filter status</span>
                        <select
                            value={reportSelectFilter}
                            onChange={(e) => setReportSelectFilter(e.target.value)}
                            className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px] font-semibold text-blue-900"
                        >
                            <option value="all">All statuses</option>
                            <option value="complete">Complete</option>
                            <option value="incomplete">Incomplete</option>
                            <option value="sent">Sent</option>
                            <option value="approved">Approved</option>
                        </select>
                    </div>
                </div>

                {actionAlert}

                {reportsLoading && (
                    <div className="flex items-center gap-2 text-[10px] text-blue-900/70">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading reports...
                    </div>
                )}

                {reportsError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] text-rose-700">
                        {reportsError}
                    </div>
                )}

                {!reportsLoading && !reports.length && (
                    <div className="text-[10px] text-blue-900/60">
                        No multi-approach reports found yet.
                    </div>
                )}

                {!reportsLoading && reports.length > 0 && !visibleReports.length && (
                    <div className="text-[10px] text-blue-900/60">
                        No reports match the selected status.
                    </div>
                )}

                {visibleReports.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-[10px] text-slate-700">
                            <thead className="bg-blue-900/10 text-blue-900">
                                <tr>
                                    <th className="px-2 py-1 text-left w-10">#</th>
                                    <th className="px-2 py-1 text-left w-8"></th>
                                    <th className="px-2 py-1 text-left">Report ID</th>
                                    <th className="px-2 py-1 text-left">Client</th>
                                    <th className="px-2 py-1 text-left">Final value</th>
                                    <th className="px-2 py-1 text-left">Status</th>
                                    <th className="px-2 py-1 text-left">Action</th>
                                    <th className="px-2 py-1 text-left">Select</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleReports.map((report, idx) => {
                                    const recordId = getReportRecordId(report);
                                    const reportIndex =
                                        (recordId && reportIndexMap.get(recordId)) || idx + 1;
                                    const statusKey = getReportStatus(report);
                                    const assetList = Array.isArray(report.asset_data) ? report.asset_data : [];
                                    const isExpanded = recordId ? expandedReports.includes(recordId) : false;
                                    const reportBusy = recordId ? reportActionBusy[recordId] : null;
                                    const selectedAssets = selectedAssetsByReport[recordId] || [];
                                    const selectedAssetSet = new Set(selectedAssets);
                                    const assetFilter = assetSelectFilters[recordId] || "all";
                                    const visibleAssets = assetList
                                        .map((asset, assetIndex) => ({ asset, assetIndex }))
                                        .filter(({ asset }) =>
                                            assetFilter === "all"
                                                ? true
                                                : getAssetStatus(asset, report) === assetFilter
                                        );

                                    return (
                                        <React.Fragment key={recordId || `report-${idx}`}>
                                            <tr className="border-t border-blue-900/10 bg-white">
                                                <td className="px-2 py-1 text-blue-900/70">
                                                    {reportIndex}
                                                </td>
                                                <td className="px-2 py-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => recordId && toggleReportExpansion(recordId)}
                                                        disabled={!recordId}
                                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-blue-900/20 text-blue-900 hover:bg-blue-50 disabled:opacity-50"
                                                        aria-label={isExpanded ? "Hide assets" : "Show assets"}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <ChevronRight className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <div className="text-[11px] font-semibold text-blue-950">
                                                        {report.report_id || "Not sent"}
                                                    </div>
                                                    <div className="text-[10px] text-blue-900/50">
                                                        {recordId || "-"}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1">
                                                    {report.client_name || "-"}
                                                </td>
                                                <td className="px-2 py-1">
                                                    {report.value || report.final_value || "-"}
                                                </td>
                                                <td className="px-2 py-1">
                                                    <span
                                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                            reportStatusClasses[statusKey] || "border-blue-200 bg-blue-50 text-blue-700"
                                                            }`}
                                                    >
                                                        {reportStatusLabels[statusKey] || statusKey}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <select
                                                            defaultValue=""
                                                            disabled={!recordId || submitting || !!reportBusy}
                                                            onChange={(e) => {
                                                                const action = e.target.value;
                                                                handleReportAction(report, action);
                                                                e.target.value = "";
                                                            }}
                                                            className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px]"
                                                        >
                                                            <option value="">Actions</option>
                                                            <option value="retry">Retry submit</option>
                                                            <option value="delete">Delete</option>
                                                            <option value="edit">Edit</option>
                                                            <option value="send-approver">Send to approver</option>
                                                            <option value="approve">Approve</option>
                                                            <option value="download">Download certificate</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            disabled={!recordId || submitting || !!reportBusy}
                                                            onClick={() => handleReportAction(report, "send")}
                                                            className="inline-flex items-center gap-1 rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px] font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
                                                        >
                                                            <Send className="w-3.5 h-3.5" />
                                                            Submit to Taqeem
                                                        </button>
                                                    </div>
                                                    {reportBusy && (
                                                        <div className="text-[10px] text-blue-900/60 mt-1">
                                                            Working...
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1">
                                                    <input
                                                        type="checkbox"
                                                        disabled={!recordId}
                                                        checked={!!recordId && selectedReportSet.has(recordId)}
                                                        onChange={() => recordId && toggleReportSelection(recordId)}
                                                        className="h-3.5 w-3.5 rounded border-blue-900/30 text-blue-900 focus:ring-blue-900/20"
                                                    />
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={8} className="bg-blue-50/40 border-t border-blue-900/10">
                                                        <div className="p-2 space-y-2">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="text-[10px] text-blue-900/70">
                                                                    Assets: {assetList.length}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <select
                                                                        defaultValue=""
                                                                        onChange={(e) => {
                                                                            const action = e.target.value;
                                                                            handleBulkAssetAction(report, action);
                                                                            e.target.value = "";
                                                                        }}
                                                                        className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px]"
                                                                    >
                                                                        <option value="">Asset actions</option>
                                                                        <option value="delete">Delete</option>
                                                                        <option value="retry">Retry submission</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-xl border border-blue-900/10 overflow-hidden">
                                                                <div className="max-h-64 overflow-auto">
                                                                    <table className="min-w-full text-[10px] text-slate-700">
                                                                        <thead className="bg-white text-blue-900">
                                                                            <tr>
                                                                                <th className="px-2 py-1 text-left font-semibold">Macro ID</th>
                                                                                <th className="px-2 py-1 text-left font-semibold">Asset name</th>
                                                                                <th className="px-2 py-1 text-left font-semibold">Final value</th>
                                                                                <th className="px-2 py-1 text-left font-semibold">Approach</th>
                                                                                <th className="px-2 py-1 text-left font-semibold">Status</th>
                                                                                <th className="px-2 py-1 text-left font-semibold">Actions</th>
                                                                                <th className="px-2 py-1 text-left font-semibold">
                                                                                    <div className="flex flex-col gap-1">
                                                                                        <select
                                                                                            value={assetFilter}
                                                                                            onChange={(e) => {
                                                                                                const nextFilter = e.target.value;
                                                                                                setAssetSelectFilters((prev) => ({
                                                                                                    ...prev,
                                                                                                    [recordId]: nextFilter,
                                                                                                }));
                                                                                                if (nextFilter === "all") {
                                                                                                    setSelectedAssetsByReport((prev) => ({
                                                                                                        ...prev,
                                                                                                        [recordId]: [],
                                                                                                    }));
                                                                                                    return;
                                                                                                } else {
                                                                                                    const nextSelection = assetList
                                                                                                        .map((asset, assetIndex) => ({ asset, assetIndex }))
                                                                                                        .filter(({ asset }) =>
                                                                                                            getAssetStatus(asset, report) === nextFilter
                                                                                                        )
                                                                                                        .map(({ assetIndex }) => assetIndex);
                                                                                                    setSelectedAssetsByReport((prev) => ({
                                                                                                        ...prev,
                                                                                                        [recordId]: nextSelection,
                                                                                                    }));
                                                                                                }
                                                                                            }}
                                                                                            className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px]"
                                                                                        >
                                                                                            <option value="all">All assets</option>
                                                                                            <option value="complete">Complete</option>
                                                                                            <option value="incomplete">Incomplete</option>
                                                                                        </select>
                                                                                    </div>
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {visibleAssets.length === 0 && (
                                                                                <tr>
                                                                                    <td colSpan={7} className="px-2 py-2 text-center text-blue-900/60">
                                                                                        {assetList.length
                                                                                            ? "No assets match the selected status."
                                                                                            : "No assets available for this report."}
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                            {visibleAssets.map(({ asset, assetIndex }) => {
                                                                                const assetStatus = getAssetStatus(asset, report);
                                                                                const assetBusy = assetActionBusy[`${recordId}:${assetIndex}`];
                                                                                const macroId = getAssetMacroId(asset, report);
                                                                                return (
                                                                                    <tr key={`${recordId}-${assetIndex}`} className="border-t border-blue-900/10">
                                                                                        <td className="px-2 py-1 text-blue-900/70">
                                                                                            {macroId || "Not created"}
                                                                                        </td>
                                                                                        <td className="px-2 py-1 text-blue-900/90">
                                                                                            {asset.asset_name || "-"}
                                                                                        </td>
                                                                                        <td className="px-2 py-1 text-blue-900/80">
                                                                                            {asset.final_value || "-"}
                                                                                        </td>
                                                                                        <td className="px-2 py-1 text-blue-900/80">
                                                                                            {getAssetApproach(asset)}
                                                                                        </td>
                                                                                        <td className="px-2 py-1">
                                                                                            <span
                                                                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                                                                    assetStatusClasses[assetStatus] || "border-blue-200 bg-blue-50 text-blue-700"
                                                                                                    }`}
                                                                                            >
                                                                                                {assetStatusLabels[assetStatus] || assetStatus}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="px-2 py-1">
                                                                                            <select
                                                                                                defaultValue=""
                                                                                                disabled={!!assetBusy}
                                                                                                onChange={(e) => {
                                                                                                    const action = e.target.value;
                                                                                                    handleAssetAction(report, assetIndex, action);
                                                                                                    e.target.value = "";
                                                                                                }}
                                                                                                className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px]"
                                                                                            >
                                                                                                <option value="">Actions</option>
                                                                                                <option value="delete">Delete</option>
                                                                                                <option value="retry">Retry submission</option>
                                                                                                <option value="edit">Edit</option>
                                                                                            </select>
                                                                                        </td>
                                                                                        <td className="px-2 py-1">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={selectedAssetSet.has(assetIndex)}
                                                                                                onChange={() => toggleAssetSelection(recordId, assetIndex)}
                                                                                                className="h-3.5 w-3.5 rounded border-blue-900/30 text-blue-900 focus:ring-blue-900/20"
                                                                                            />
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
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
                )}
            </Section>

            <Modal
                open={isEditing}
                onClose={closeReportEdit}
                title="Edit report"
            >
                {actionAlert}
                <div className="space-y-3">
                    <Section title="Report information">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <InputField
                                label="Report title"
                                required
                                value={formData.title}
                                onChange={(e) => handleFieldChange("title", e.target.value)}
                                error={errors.title}
                            />
                            <InputField
                                label="Report type"
                                required
                                value={formData.report_type}
                                onChange={(e) => handleFieldChange("report_type", e.target.value)}
                                error={errors.report_type}
                            />
                            <SelectField
                                label="Valuation purpose"
                                required
                                value={formData.purpose_id}
                                onChange={(e) => handleFieldChange("purpose_id", e.target.value)}
                                options={[
                                    { value: "to set", label: "Select" },
                                    { value: "1", label: "Selling" },
                                    { value: "2", label: "Buying" },
                                    { value: "5", label: "Rent value" },
                                    { value: "6", label: "Insurance" },
                                    { value: "8", label: "Accounting" },
                                    { value: "9", label: "Financing" },
                                    { value: "10", label: "Disputes" },
                                    { value: "12", label: "Tax" },
                                    { value: "14", label: "Other" },
                                ]}
                                error={errors.purpose_id}
                            />
                            <SelectField
                                label="Value premise"
                                required
                                value={formData.value_premise_id}
                                onChange={(e) => handleFieldChange("value_premise_id", e.target.value)}
                                options={[
                                    { value: "to set", label: "Select" },
                                    { value: "1", label: "Highest and Best Use" },
                                    { value: "2", label: "Current Use" },
                                    { value: "3", label: "Orderly Liquidation" },
                                    { value: "4", label: "Forced Sale" },
                                    { value: "5", label: "Other" },
                                ]}
                                error={errors.value_premise_id}
                            />
                            <InputField
                                label="Valued at"
                                required
                                type="date"
                                value={formData.valued_at}
                                onChange={(e) => handleFieldChange("valued_at", e.target.value)}
                                error={errors.valued_at}
                            />
                            <InputField
                                label="Submitted at"
                                required
                                type="date"
                                value={formData.submitted_at}
                                onChange={(e) => handleFieldChange("submitted_at", e.target.value)}
                                error={errors.submitted_at}
                            />
                            <InputField
                                label="Inspection date"
                                required
                                type="date"
                                value={formData.inspection_date}
                                onChange={(e) => handleFieldChange("inspection_date", e.target.value)}
                                error={errors.inspection_date}
                            />
                            <InputField
                                label="Report value"
                                required
                                value={formData.value}
                                onChange={(e) => handleFieldChange("value", e.target.value)}
                                error={errors.value}
                            />
                            <InputField
                                label="Final value"
                                value={formData.final_value}
                                onChange={(e) => handleFieldChange("final_value", e.target.value)}
                                error={errors.final_value}
                            />
                            <InputField
                                label="Valuation currency"
                                value={formData.valuation_currency}
                                onChange={(e) => handleFieldChange("valuation_currency", e.target.value)}
                            />
                        </div>
                    </Section>

                    <Section title="Client & contact">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <InputField
                                label="Client name"
                                required
                                value={formData.client_name}
                                onChange={(e) => handleFieldChange("client_name", e.target.value)}
                                error={errors.client_name}
                            />
                            <InputField
                                label="Owner name"
                                value={formData.owner_name}
                                onChange={(e) => handleFieldChange("owner_name", e.target.value)}
                            />
                            <InputField
                                label="Telephone"
                                required
                                value={formData.telephone}
                                onChange={(e) => handleFieldChange("telephone", e.target.value)}
                                error={errors.telephone}
                            />
                            <InputField
                                label="Email"
                                required
                                value={formData.email}
                                onChange={(e) => handleFieldChange("email", e.target.value)}
                                error={errors.email}
                            />
                            <InputField
                                label="Region"
                                value={formData.region}
                                onChange={(e) => handleFieldChange("region", e.target.value)}
                            />
                            <InputField
                                label="City"
                                value={formData.city}
                                onChange={(e) => handleFieldChange("city", e.target.value)}
                            />
                        </div>
                    </Section>

                    <Section title="Notes">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <TextAreaField
                                label="Assumptions"
                                rows={3}
                                value={formData.assumptions}
                                onChange={(e) => handleFieldChange("assumptions", e.target.value)}
                            />
                            <TextAreaField
                                label="Special assumptions"
                                rows={3}
                                value={formData.special_assumptions}
                                onChange={(e) => handleFieldChange("special_assumptions", e.target.value)}
                            />
                        </div>
                    </Section>

                    <Section title="Other users">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                checked={formData.has_other_users}
                                onChange={(e) => handleFieldChange("has_other_users", e.target.checked)}
                                className="h-4 w-4 text-blue-900 border-blue-900/30"
                            />
                            <span className="text-[11px] text-blue-900/70">Has other users</span>
                        </div>
                        {formData.has_other_users && (
                            <div className="space-y-2">
                                {reportUsers.map((userName, idx) => (
                                    <div key={`user-${idx}`} className="flex items-center gap-2">
                                        <InputField
                                            label={`User ${idx + 1}`}
                                            value={userName}
                                            onChange={(e) => handleReportUserChange(idx, e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveReportUser(idx)}
                                            className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px] font-semibold text-blue-900 hover:bg-blue-50"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddReportUser}
                                    className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px] font-semibold text-blue-900 hover:bg-blue-50"
                                >
                                    Add user
                                </button>
                            </div>
                        )}
                    </Section>

                    <Section title="Valuers">
                        <div className="space-y-2">
                            {valuers.map((valuer, idx) => (
                                <div key={`valuer-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                    <InputField
                                        label="Valuer name"
                                        value={valuer.valuer_name}
                                        onChange={(e) => handleValuerChange(idx, "valuer_name", e.target.value)}
                                    />
                                    <InputField
                                        label="Contribution %"
                                        type="number"
                                        value={valuer.contribution_percentage}
                                        onChange={(e) => handleValuerChange(idx, "contribution_percentage", e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveValuer(idx)}
                                        className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px] font-semibold text-blue-900 hover:bg-blue-50 h-8"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddValuer}
                                className="rounded-md border border-blue-900/20 bg-white px-2 py-1 text-[10px] font-semibold text-blue-900 hover:bg-blue-50"
                            >
                                Add valuer
                            </button>
                        </div>
                    </Section>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={closeReportEdit}
                            className="rounded-md border border-blue-900/20 bg-white px-4 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveReportEdit}
                            disabled={updatingReport}
                            className={`rounded-md px-4 py-2 text-[11px] font-semibold text-white ${
                                updatingReport ? "bg-blue-900/40" : "bg-blue-900 hover:bg-blue-800"
                                }`}
                        >
                            {updatingReport ? "Saving..." : "Save changes"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={!!assetEdit}
                onClose={closeAssetEdit}
                title="Edit asset"
                maxWidth="max-w-3xl"
            >
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <InputField
                            label="Asset name"
                            value={assetDraft.asset_name}
                            onChange={(e) =>
                                setAssetDraft((prev) => ({ ...prev, asset_name: e.target.value }))
                            }
                        />
                        <InputField
                            label="Asset usage id"
                            value={assetDraft.asset_usage_id}
                            onChange={(e) =>
                                setAssetDraft((prev) => ({
                                    ...prev,
                                    asset_usage_id: e.target.value,
                                }))
                            }
                        />
                        <InputField
                            label="Final value"
                            value={assetDraft.final_value}
                            onChange={(e) =>
                                setAssetDraft((prev) => ({
                                    ...prev,
                                    final_value: e.target.value,
                                }))
                            }
                        />
                        <InputField
                            label="Region"
                            value={assetDraft.region}
                            onChange={(e) =>
                                setAssetDraft((prev) => ({ ...prev, region: e.target.value }))
                            }
                        />
                        <InputField
                            label="City"
                            value={assetDraft.city}
                            onChange={(e) =>
                                setAssetDraft((prev) => ({ ...prev, city: e.target.value }))
                            }
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={closeAssetEdit}
                            className="rounded-md border border-blue-900/20 bg-white px-4 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveAssetEdit}
                            disabled={assetEditBusy}
                            className={`rounded-md px-4 py-2 text-[11px] font-semibold text-white ${
                                assetEditBusy ? "bg-blue-900/40" : "bg-blue-900 hover:bg-blue-800"
                                }`}
                        >
                            {assetEditBusy ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default MultiExcelUpload;
