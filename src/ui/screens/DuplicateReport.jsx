import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import {
  createDuplicateReport,
  fetchDuplicateReports,
  updateDuplicateReport,
  deleteDuplicateReport,
  updateDuplicateReportAsset,
  deleteDuplicateReportAsset,
} from "../../api/report";
import { useSession } from "../context/SessionContext";
import { useRam } from "../context/RAMContext";
import { useNavStatus } from "../context/NavStatusContext";
import usePersistentState from "../hooks/usePersistentState";
import { ensureTaqeemAuthorized } from "../../shared/helper/taqeemAuthWrap";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Table,
  Upload,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Plus,
  Download,
} from "lucide-react";
import { downloadTemplateFile } from "../utils/templateDownload";

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
      className={`w-full px-2.5 py-1.5 border rounded-md text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900/40 transition-all ${
        error ? "border-rose-300 bg-rose-50" : "border-blue-900/20 bg-white/90"
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
      className={`w-full px-2.5 py-1.5 border rounded-md text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900/40 transition-all ${
        error ? "border-rose-300 bg-rose-50" : "border-blue-900/20 bg-white/90"
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
      className={`w-full px-2.5 py-1.5 border rounded-md text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900/40 transition-all resize-none ${
        error ? "border-rose-300 bg-rose-50" : "border-blue-900/20 bg-white/90"
      }`}
    />
    {error && <p className="text-rose-600 text-[10px] mt-1">{error}</p>}
  </div>
);


const Section = ({ title, children }) => (
  <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-2.5 mb-2">
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

const buildAssetPreview = (rows = [], sheetLabel) =>
  rows
    .filter((row) =>
      Object.values(row).some((value) => String(value ?? "").trim() !== "")
    )
    .map((row) => ({
      sheet: sheetLabel,
      assetName: pickFieldValue(row, [
        "asset_name",
        "asset name",
        "asset",
        "name",
      ]),
      assetUsageId: pickFieldValue(row, [
        "asset_usage_id",
        "asset usage id",
        "asset usage",
      ]),
      finalValue: pickFieldValue(row, [
        "final_value",
        "final value",
        "value",
        "amount",
      ]),
      region: pickFieldValue(row, ["region", "region name", "region_name"]),
      city: pickFieldValue(row, ["city", "city name", "city_name"]),
    }));

const parseExcelValidation = async (file) => {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const marketSheet = workbook.getWorksheet("market");
  const costSheet = workbook.getWorksheet("cost");
  const issues = [];

  if (!marketSheet) {
    issues.push({ sheet: "market", message: "Missing sheet \"market\"." });
  }

  if (!costSheet) {
    issues.push({ sheet: "cost", message: "Missing sheet \"cost\"." });
  }

  const marketRows = marketSheet ? worksheetToObjects(marketSheet) : [];
  const costRows = costSheet ? worksheetToObjects(costSheet) : [];
  const marketAssets = marketSheet ? buildAssetPreview(marketRows, "market") : [];
  const costAssets = costSheet ? buildAssetPreview(costRows, "cost") : [];

  if (marketSheet && marketAssets.length === 0) {
    issues.push({ sheet: "market", message: "No assets found in \"market\" sheet." });
  }
  if (costSheet && costAssets.length === 0) {
    issues.push({ sheet: "cost", message: "No assets found in \"cost\" sheet." });
  }

  const assets = [...marketAssets, ...costAssets];
  return {
    issues,
    assets,
    counts: {
      market: marketAssets.length,
      cost: costAssets.length,
      total: assets.length,
    },
  };
};

const buildDefaultFormData = () => ({
  report_id: "",
  title: "",
  purpose_id: "to set",
  value_premise_id: "1",
  report_type: "تقرير مفصل",
  valued_at: "",
  submitted_at: "",
  inspection_date: "",
  assumptions: "",
  special_assumptions: "",
  value: "",
  valuation_currency: "1",
  client_name: "",
  owner_name: "",
  telephone: "",
  email: "",
  has_other_users: false,
  report_users: [],
});

const buildDefaultValuers = () => ([
  {
    valuer_name: "4210000296 - فالح مفلح فالح الشهراني",
    contribution_percentage: 100,
  },
]);

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
  if (asset?.sheet) return String(asset.sheet);
  return "-";
};

const DuplicateReport = ({ onViewChange }) => {
  const { user, token, isLoading } = useSession();
  const { ramInfo } = useRam();
  const { taqeemStatus } = useNavStatus();
  const [formData, setFormData, resetFormData] = usePersistentState("duplicate:formData", buildDefaultFormData());
  const [errors, setErrors] = useState({});
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [wantsPdfUpload, setWantsPdfUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [reportUsers, setReportUsers, resetReportUsers] = usePersistentState("duplicate:reportUsers", formData?.report_users || []);
  const [valuers, setValuers, resetValuers] = usePersistentState("duplicate:valuers", buildDefaultValuers());
  const [fileNotes, setFileNotes, resetFileNotes] = usePersistentState("duplicate:fileNotes", { excelName: null, pdfName: null });
  const [excelValidation, setExcelValidation] = useState({
    status: "idle",
    issues: [],
    assets: [],
    counts: { market: 0, cost: 0, total: 0 },
  });
  const [excelValidationLoading, setExcelValidationLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReportId, setEditingReportId] = useState(null);
  const [updatingReport, setUpdatingReport] = useState(false);
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
  const [assetEdit, setAssetEdit] = useState(null);
  const [assetDraft, setAssetDraft] = useState({
    asset_name: "",
    asset_usage_id: "",
    final_value: "",
    region: "",
    city: "",
  });
  const [isValidationCollapsed, setIsValidationCollapsed] = useState(false);
  const [pendingSubmit, setPendingSubmit, resetPendingSubmit] = usePersistentState("duplicate:pendingSubmit", null, { storage: "session" });
  const [, setReturnView, resetReturnView] = usePersistentState("taqeem:returnView", null, { storage: "session" });
  const pdfInputRef = useRef(null);
  const recommendedTabs = ramInfo?.recommendedTabs || 1;
  const isTaqeemLoggedIn = taqeemStatus?.state === "success";
  const previewLimit = 200;
  const isEditing = Boolean(editingReportId);
  const selectedReportSet = useMemo(() => new Set(selectedReportIds), [selectedReportIds]);
  const valuerOptions = useMemo(
    () => [
      "4210000352 - حسام سعيد علي الاسمري",
      "4210000088 - أحمد محمد عبدالله ابابطين",
      "4210000102 - خالد عبدالكريم بن عبدالعزيز الجاسر",
      "4210000091 - هاني ابراهيم محمد رواس",
      "4210000334 - سعيد بن علي بن سعيد الزهراني",
      "4210000375 - احمد زبن دبيان الروقي",
      "4210000059 - عبدالله بن عبدالرحمن بن عبدالله الصعب",
      "4210000096 - سيف مساعد بن فالح الحربي",
      "4210000258 - فايز عويض ساير الحربي",
      "4210000010 - حمزه مشبب فهد العاصمي",
      "4210000364 - أسامه محمد بن قائد هزازي",
      "4210000113 - مالك انس سليمان حافظ",
      "4210000078 - رائد ناصر عبدالله العميره",
      "4210000183 - فيصل عايض جربوع الرويلي",
      "4210000170 - عبدالله نجيب بن خالد الحليبي",
      "4210000193 - محمد حمود عبدالرحمن العايد",
      "4210000282 - عبيد مناحي سياف الشهراني",
      "4210000356 - بندر عبدالله ابن سعد الهويمل",
      "4210000374 - لميس حسن جميل ثقه",
      "4210000210 - عبدالرحمن مساعد محمدراشد الصبحي",
      "4210000382 - ناصر عبدالله ابراهيم البصيص",
      "4210000201 - فهد محمد عيد الرشيدي",
      "4210000285 - تركي محمد عبدالمحسن الحربي",
      "4220000293 - عمر سالم عثمان على",
      "4210000277 - حسين علي بن احمد ابوحسون",
      "4210000323 - علي بن معتوق بن ابراهيم الحسين",
      "4210000347 - عبدالله محمد عبدالله العجاجى",
      "4210000296 - فالح مفلح فالح الشهراني",
      "4210000335 - خالد محمد ابراهيم العضيبى",
      "4210000346 - عبدالله احمد عبدالله الغامدي",
      "4210000340 - شريفة سعيد عوض القحطاني",
      "4210000381 - آحمد ابراهيم عبدالعزيز اللهيب",
      "4210000369 - سعود حسين بن علي آل فطيح",
      "4210000366 - حسام موسى سعد السويري",
      "4210000008 - حمد عبدالله ناصر الحمد",
    ],
    []
  );
  const contributionOptions = useMemo(
    () => [
      5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
      100,
    ],
    []
  );

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

  const validate = () => {
    const newErrors = {};
    requiredFields.forEach((field) => {
      if (!formData[field]) {
        newErrors[field] = "Required";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const purgePersistedState = useCallback(() => {
    if (typeof window === "undefined") return;
    const localKeys = [
      "duplicate:formData",
      "duplicate:status",
      "duplicate:reportUsers",
      "duplicate:valuers",
      "duplicate:fileNotes",
    ];
    localKeys.forEach((key) => window.localStorage?.removeItem(key));
    const sessionKeys = ["duplicate:pendingSubmit", "taqeem:returnView"];
    sessionKeys.forEach((key) => window.sessionStorage?.removeItem(key));
  }, []);

  const clearSavedState = useCallback(
    (options = {}) => {
      const { purgeStorage = false, closeModal = false, clearTableState = false } = options;
      setFormData(buildDefaultFormData());
      setReportUsers([]);
      setValuers(buildDefaultValuers());
      setExcelFile(null);
      setPdfFile(null);
      setWantsPdfUpload(false);
      setErrors({});
      setEditingReportId(null);
      if (closeModal) {
        setShowCreateModal(false);
      }
      setStatus(null);
      setFileNotes({ excelName: null, pdfName: null });
      setExcelValidation({
        status: "idle",
        issues: [],
        assets: [],
        counts: { market: 0, cost: 0, total: 0 },
      });
      setExcelValidationLoading(false);
      if (clearTableState) {
        setSelectedReportIds([]);
        setSelectedAssetsByReport({});
        setAssetSelectFilters({});
        setReportSelectFilter("all");
        setExpandedReports([]);
        setAssetEdit(null);
        setAssetDraft({
          asset_name: "",
          asset_usage_id: "",
          final_value: "",
          region: "",
          city: "",
        });
      }
      resetPendingSubmit();
      resetReturnView();
      if (purgeStorage) {
        setTimeout(() => {
          purgePersistedState();
        }, 0);
      }
    },
    [
      purgePersistedState,
      resetPendingSubmit,
      resetReturnView,
      setStatus,
      setAssetDraft,
      setAssetEdit,
      setAssetSelectFilters,
      setEditingReportId,
      setErrors,
      setExcelFile,
      setExcelValidation,
      setExcelValidationLoading,
      setExpandedReports,
      setFileNotes,
      setFormData,
      setPdfFile,
      setReportSelectFilter,
      setReportUsers,
      setSelectedAssetsByReport,
      setSelectedReportIds,
      setShowCreateModal,
      setValuers,
      setWantsPdfUpload,
    ]
  );

  const getReportRecordId = useCallback((report) => report?._id || report?.id, []);

  const normalizeReportsResponse = useCallback((payload) => {
    if (Array.isArray(payload?.reports)) return payload.reports;
    if (Array.isArray(payload?.data?.reports)) return payload.data.reports;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
  }, []);

  const loadReports = useCallback(async () => {
    try {
      setReportsLoading(true);
      setReportsError(null);
      const result = await fetchDuplicateReports();
      setReports(normalizeReportsResponse(result));
    } catch (err) {
      setReportsError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load duplicate reports."
      );
    } finally {
      setReportsLoading(false);
    }
  }, [normalizeReportsResponse]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!isLoading && !user) {
      clearSavedState({ purgeStorage: true, closeModal: true, clearTableState: true });
    }
  }, [clearSavedState, isLoading, user]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      purgePersistedState();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [purgePersistedState]);

  useEffect(() => {
    if (!reports.length) {
      setSelectedReportIds([]);
      setSelectedAssetsByReport({});
      return;
    }

    const reportIds = new Set(reports.map(getReportRecordId));
    setSelectedReportIds((prev) => prev.filter((id) => reportIds.has(id)));
    setSelectedAssetsByReport((prev) => {
      const next = {};
      reports.forEach((report) => {
        const id = getReportRecordId(report);
        if (!id) return;
        const selected = prev[id] || [];
        if (!selected.length) return;
        const assetCount = Array.isArray(report.asset_data) ? report.asset_data.length : 0;
        const filtered = selected.filter(
          (idx) => Number.isInteger(idx) && idx >= 0 && idx < assetCount
        );
        if (filtered.length) {
          next[id] = filtered;
        }
      });
      return next;
    });
  }, [reports, getReportRecordId]);

  const handleOpenCreateModal = () => {
    setEditingReportId(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setEditingReportId(null);
  };

  const applyReportToForm = useCallback((report) => {
    if (!report) return;
    const base = buildDefaultFormData();
    setFormData({
      ...base,
      report_id: report.report_id || "",
      title: report.title || "",
      purpose_id: report.purpose_id || base.purpose_id,
      value_premise_id: report.value_premise_id || base.value_premise_id,
      report_type: report.report_type || base.report_type,
      valued_at: report.valued_at || "",
      submitted_at: report.submitted_at || "",
      inspection_date: report.inspection_date || "",
      assumptions: report.assumptions || "",
      special_assumptions: report.special_assumptions || "",
      value: report.value || "",
      valuation_currency: report.valuation_currency || base.valuation_currency,
      client_name: report.client_name || "",
      owner_name: report.owner_name || report.client_name || "",
      telephone: report.telephone || "",
      email: report.email || "",
      has_other_users: !!report.has_other_users,
      report_users: report.report_users || [],
    });
    setReportUsers(report.report_users || []);
    setValuers(report.valuers?.length ? report.valuers : buildDefaultValuers());
    setErrors({});
  }, [setFormData, setReportUsers, setValuers]);

  const handleEditReport = (report) => {
    const reportId = getReportRecordId(report);
    if (!reportId) return;
    setEditingReportId(reportId);
    setShowCreateModal(true);
    setExcelFile(null);
    setPdfFile(null);
    setWantsPdfUpload(false);
    setFileNotes({ excelName: null, pdfName: report?.pdf_path || null });
    setExcelValidation({
      status: "idle",
      issues: [],
      assets: [],
      counts: { market: 0, cost: 0, total: 0 },
    });
    setExcelValidationLoading(false);
    applyReportToForm(report);
  };

  const setExcelFileAndRemember = async (file) => {
    setExcelFile(file);
    setFileNotes((prev) => ({ ...prev, excelName: file ? file.name : null }));
    if (!file) {
      setExcelValidation({
        status: "idle",
        issues: [],
        assets: [],
        counts: { market: 0, cost: 0, total: 0 },
      });
      setExcelValidationLoading(false);
      return;
    }

    setExcelValidationLoading(true);
    setExcelValidation({
      status: "loading",
      issues: [],
      assets: [],
      counts: { market: 0, cost: 0, total: 0 },
    });
    try {
      const result = await parseExcelValidation(file);
      setExcelValidation({
        status: result.issues.length ? "error" : "success",
        issues: result.issues,
        assets: result.assets,
        counts: result.counts,
      });
    } catch (err) {
      setExcelValidation({
        status: "error",
        issues: [
          {
            sheet: "workbook",
            message: err?.message || "Failed to read Excel file.",
          },
        ],
        assets: [],
        counts: { market: 0, cost: 0, total: 0 },
      });
    } finally {
      setExcelValidationLoading(false);
    }
  };

  const setPdfFileAndRemember = (file) => {
    setPdfFile(file);
    setFileNotes((prev) => ({ ...prev, pdfName: file ? file.name : null }));
  };

  const handlePdfToggle = (checked) => {
    setWantsPdfUpload(checked);
    if (!checked) {
      setPdfFile(null);
    }
  };

  useEffect(() => {
    if (wantsPdfUpload && pdfInputRef.current) {
      pdfInputRef.current.value = null;
      pdfInputRef.current.click();
    }
  }, [wantsPdfUpload]);

  const resolveTabsForAssets = useCallback(
    (assetCount) => {
      const fallbackTabs = Math.max(1, Number(recommendedTabs) || 1);
      if (!assetCount || assetCount < 1) return fallbackTabs;
      return Math.max(1, Math.min(fallbackTabs, assetCount));
    },
    [recommendedTabs]
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
          setStatus({ type: "error", message: "Missing record id for submission." });
          return;
        }

        const ok = await ensureTaqeemAuthorized(token, onViewChange, isTaqeemLoggedIn);
        if (!ok) {
          setStatus({
            type: "info",
            message: "Taqeem login required. Finish login and choose a company to continue.",
          });
          setPendingSubmit({ recordId, tabsNum: resolvedTabs, resumeOnLoad: true });
          setReturnView("duplicate-report");
          return;
        }

        setStatus({
          type: "info",
          message: resume ? "Resuming Taqeem submission..." : "Submitting report to Taqeem...",
        });

        if (!window?.electronAPI?.duplicateReportNavigate) {
          throw new Error("Desktop integration unavailable. Restart the app.");
        }

        const result = await window.electronAPI.duplicateReportNavigate(
          recordId,
          undefined,
          resolvedTabs
        );

        if (result?.status === "SUCCESS") {
          setStatus({
            type: "success",
            message: "Report submitted to Taqeem. Browser closed after completion.",
          });
          resetPendingSubmit();
          resetReturnView();
          return;
        }

        const errMsg =
          result?.error ||
          "Upload to Taqeem failed. Make sure you selected a company.";
        if (/no company selected/i.test(errMsg)) {
          setStatus({
            type: "warning",
            message: errMsg,
          });
          setPendingSubmit({ recordId, tabsNum: resolvedTabs, resumeOnLoad: true });
          setReturnView("duplicate-report");
          onViewChange?.("get-companies");
          return;
        }

        setStatus({ type: "error", message: errMsg });
        resetPendingSubmit();
        resetReturnView();
      } catch (err) {
        setStatus({
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
      onViewChange,
      resetPendingSubmit,
      resetReturnView,
      resolveTabsForAssets,
      setPendingSubmit,
      setReturnView,
      token,
    ]
  );

  useEffect(() => {
    if (submitting) return;
    if (!pendingSubmit?.recordId || !pendingSubmit?.resumeOnLoad) return;
    setPendingSubmit((prev) => (prev ? { ...prev, resumeOnLoad: false } : prev));
    submitToTaqeem(pendingSubmit.recordId, pendingSubmit.tabsNum, { resume: true });
  }, [pendingSubmit, setPendingSubmit, submitToTaqeem, submitting]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addReportUser = () => {
    setReportUsers((prev) => {
      const next = [...prev, ""];
      setFormData((p) => ({ ...p, report_users: next }));
      return next;
    });
  };

  const deleteLastReportUser = () => {
    setReportUsers((prev) => {
      const next = prev.length > 1 ? prev.slice(0, -1) : [];
      setFormData((p) => ({ ...p, report_users: next }));
      return next;
    });
  };

  const updateReportUser = (index, value) => {
    setReportUsers((prev) => {
      const next = prev.map((u, i) => (i === index ? value : u));
      setFormData((p) => ({ ...p, report_users: next }));
      return next;
    });
  };

  const handleValuerChange = (index, field, value) => {
    setValuers((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const addValuer = () => {
    setValuers((prev) => [
      ...prev,
      {
        valuer_name: "4210000296 - فالح مفلح فالح الشهراني",
        contribution_percentage: 100,
      },
    ]);
  };

  const deleteLastValuer = () => {
    setValuers((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const handleCreateReport = async () => {
    if (!validate()) {
      setStatus({ type: "error", message: "Please fill required fields." });
      return;
    }

    if (!excelFile) {
      setStatus({
        type: "error",
        message: "Excel file is required to add the report.",
      });
      return;
    }

    if (excelValidationLoading) {
      setStatus({
        type: "error",
        message: "Wait for Excel validation to finish before adding.",
      });
      return;
    }

    if (excelValidation.issues.length) {
      setStatus({
        type: "error",
        message: "Fix Excel validation issues before adding.",
      });
      return;
    }

    if (wantsPdfUpload && !pdfFile) {
      setStatus({
        type: "error",
        message: "PDF file is required when PDF upload is enabled.",
      });
      return;
    }

    const payload = new FormData();
    payload.append(
      "formData",
      JSON.stringify({
        ...formData,
        report_users: reportUsers || [],
        valuers,
      })
    );
    payload.append("excel", excelFile);
    if (wantsPdfUpload && pdfFile) {
      payload.append("pdf", pdfFile);
    }

    try {
      setSubmitting(true);
      setStatus(null);
      const result = await createDuplicateReport(payload);
      if (result?.success) {
        setStatus({ type: "success", message: "Report added successfully." });
        setIsValidationCollapsed(false);
        await loadReports();
        setShowCreateModal(false);
      } else {
        setStatus({
          type: "error",
          message: result?.message || "Could not save report.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.message ||
          err.message ||
          "Failed to save report.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateReport = async () => {
    if (!editingReportId) {
      setStatus({ type: "error", message: "No report selected to update." });
      return;
    }
    if (!validate()) {
      setStatus({ type: "error", message: "Please fill required fields." });
      return;
    }

    try {
      setUpdatingReport(true);
      setStatus(null);
      const payload = {
        ...formData,
        report_users: reportUsers || [],
        valuers,
      };
      const result = await updateDuplicateReport(editingReportId, payload);
      if (result?.success) {
        setStatus({ type: "success", message: "Report updated successfully." });
        setShowCreateModal(false);
        setEditingReportId(null);
        await loadReports();
      } else {
        setStatus({
          type: "error",
          message: result?.message || "Could not update report.",
        });
      }
    } catch (err) {
      setStatus({
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
  }, [orderedReports, getReportRecordId]);

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
  }, [getReportRecordId, reportSelectFilter, visibleReports]);

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
  };

  const handleSaveAssetEdit = async () => {
    if (!assetEdit?.reportId && assetEdit?.reportId !== 0) return;
    const { reportId, assetIndex } = assetEdit;
    try {
      setAssetActionBusy((prev) => ({
        ...prev,
        [`${reportId}:${assetIndex}`]: "edit",
      }));
      const result = await updateDuplicateReportAsset(reportId, assetIndex, assetDraft);
      if (result?.success) {
        setStatus({ type: "success", message: "Asset updated successfully." });
        closeAssetEdit();
        await loadReports();
      } else {
        setStatus({
          type: "error",
          message: result?.message || "Failed to update asset.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.message || err?.message || "Failed to update asset.",
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
    if (
      !window?.electronAPI?.downloadRegistrationCertificates ||
      !window?.electronAPI?.selectFolder
    ) {
      setStatus({
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
      setStatus({
        type: "warning",
        message: "No reports with IDs found to download certificates.",
      });
      return;
    }

    const folderResult = await window.electronAPI.selectFolder();
    if (!folderResult?.folderPath) {
      setStatus({ type: "info", message: "Folder selection canceled." });
      return;
    }

    setStatus({
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
      setStatus({
        type: failed ? "warning" : "success",
        message: `Certificates downloaded: ${downloaded}. Failed: ${failed}.`,
      });
    } catch (err) {
      setStatus({
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
      setStatus({ type: "error", message: "Missing report record id." });
      return;
    }

    if (action === "send-approver") {
      setStatus({ type: "info", message: "Report sent to approver." });
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
        const result = await updateDuplicateReport(recordId, { checked: true });
        if (!result?.success) {
          throw new Error(result?.message || "Failed to approve report.");
        }
        setStatus({ type: "success", message: "Report approved." });
        await loadReports();
      } else if (action === "delete") {
        const result = await deleteDuplicateReport(recordId);
        if (!result?.success) {
          throw new Error(result?.message || "Failed to delete report.");
        }
        setStatus({ type: "success", message: "Report deleted." });
        await loadReports();
      } else if (action === "download") {
        await downloadCertificatesForReports([report]);
      }
    } catch (err) {
      setStatus({
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

  const handleBulkReportAction = async (action) => {
    if (!action) return;
    const selectedReports = reports.filter((report) =>
      selectedReportSet.has(getReportRecordId(report))
    );
    if (!selectedReports.length) {
      setStatus({
        type: "warning",
        message: "Select at least one report first.",
      });
      return;
    }

    if (action === "download") {
      await downloadCertificatesForReports(selectedReports);
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Delete selected reports and their assets?");
      if (!confirmed) return;
    }

    try {
      if (action === "send" || action === "retry") {
        if (!isTaqeemLoggedIn) {
          const firstReport = selectedReports[0];
          if (firstReport) {
            const assetCount = Array.isArray(firstReport.asset_data)
              ? firstReport.asset_data.length
              : 0;
            const tabsForAssets = resolveTabsForAssets(assetCount);
            await submitToTaqeem(getReportRecordId(firstReport), tabsForAssets, {
              withLoading: false,
            });
          }
          return;
        }
        for (const report of selectedReports) {
          const assetCount = Array.isArray(report.asset_data)
            ? report.asset_data.length
            : 0;
          const tabsForAssets = resolveTabsForAssets(assetCount);
          await submitToTaqeem(getReportRecordId(report), tabsForAssets, {
            withLoading: false,
          });
        }
        await loadReports();
        return;
      }

      if (action === "approve") {
        for (const report of selectedReports) {
          await updateDuplicateReport(getReportRecordId(report), { checked: true });
        }
        setStatus({ type: "success", message: "Selected reports approved." });
        await loadReports();
        return;
      }

      if (action === "delete") {
        for (const report of selectedReports) {
          await deleteDuplicateReport(getReportRecordId(report));
        }
        setStatus({ type: "success", message: "Selected reports deleted." });
        await loadReports();
      }
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Bulk action failed.",
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
        const result = await deleteDuplicateReportAsset(recordId, assetIndex);
        if (!result?.success) {
          throw new Error(result?.message || "Failed to delete asset.");
        }
        setStatus({ type: "success", message: "Asset deleted." });
        await loadReports();
      }
    } catch (err) {
      setStatus({
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
      setStatus({
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
          await deleteDuplicateReportAsset(reportId, idx);
        }
        setStatus({ type: "success", message: "Selected assets deleted." });
        await loadReports();
      }
    } catch (err) {
      setStatus({
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

  const handleDownloadTemplate = async () => {
    if (downloadingTemplate) return;
    setStatus({ type: "info", message: "Downloading Excel template..." });
    setDownloadingTemplate(true);
    try {
      await downloadTemplateFile("upload-manual-report-template.xlsx");
      setStatus({
        type: "success",
        message: "Excel template downloaded successfully.",
      });
    } catch (err) {
      const message = err?.message || "Failed to download Excel template. Please try again.";
      setStatus({
        type: "error",
        message: message.includes("not found")
          ? "Template file not found. Please contact administrator to ensure the template file exists in the public folder."
          : message,
      });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const headerAlert = status ? (
    <div
      className={`mb-3 rounded-2xl border px-3 py-2 flex items-start gap-2 text-[11px] ${
        status.type === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : status.type === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : status.type === "info"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {status.type === "success" ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5" />
      ) : status.type === "info" ? (
        <Info className="w-4 h-4 mt-0.5" />
      ) : status.type === "warning" ? (
        <AlertTriangle className="w-4 h-4 mt-0.5" />
      ) : (
        <AlertTriangle className="w-4 h-4 mt-0.5" />
      )}
      <div className="font-semibold">{status.message}</div>
    </div>
  ) : null;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900/15 bg-gradient-to-r from-white via-blue-50 to-white px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-blue-900/60 font-semibold">
                Reports
              </div>
              <h2 className="text-lg font-bold text-blue-950">
                Upload Manual Report
              </h2>
              <p className="text-[11px] text-slate-600">
                Fill report info, attach the Excel, and add the report to the list.
              </p>
              {user?.phone && (
                <p className="text-[10px] text-blue-900/60 mt-1">
                  Signed in as {user.phone}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="inline-flex items-center gap-2 rounded-md border border-blue-900/20 bg-white px-3 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
            >
              {downloadingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloadingTemplate ? "Downloading..." : "Export Excel Template"}
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 rounded-md bg-blue-900 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              <Plus className="w-4 h-4" />
              Create new report
            </button>
            <button
              type="button"
              onClick={loadReports}
              className="inline-flex items-center gap-2 rounded-md border border-blue-900/20 bg-white px-3 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
      </div>

      {!showCreateModal && headerAlert}

      <Section title="Excel validation (market & cost)">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-900/10 bg-blue-50/40 px-2.5 py-2">
            <div className="flex items-center gap-2 text-[10px] text-blue-900">
              <Table className="w-4 h-4" />
              <span className="font-semibold">Market &amp; cost sheets</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-blue-900/70">
                {excelValidationLoading
                  ? "Reading Excel..."
                  : excelValidation.counts.total
                  ? `Assets: ${excelValidation.counts.total} (market ${excelValidation.counts.market}, cost ${excelValidation.counts.cost})`
                  : "Upload an Excel file to validate"}
              </div>
              <button
                type="button"
                onClick={() => setIsValidationCollapsed((prev) => !prev)}
                className="text-[10px] font-semibold text-blue-700 hover:text-blue-900"
              >
                {isValidationCollapsed ? "Show table" : "Hide table"}
              </button>
            </div>
          </div>

          {excelValidationLoading && (
            <div className="flex items-center gap-2 text-[10px] text-blue-900/70">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Validating Excel sheets...
            </div>
          )}

          {excelValidation.issues.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] text-rose-700">
              <div className="font-semibold">Validation issues</div>
              <div className="mt-1 space-y-1">
                {excelValidation.issues.map((issue, idx) => (
                  <div key={`${issue.sheet || "issue"}-${idx}`}>
                    {issue.sheet ? `[${issue.sheet}] ` : ""}
                    {issue.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isValidationCollapsed && excelValidation.assets.length > 0 && (
            <div className="rounded-xl border border-blue-900/10 overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="min-w-full text-[10px] text-slate-700">
                  <thead className="bg-blue-900/10 text-blue-900 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold">Sheet</th>
                      <th className="px-2 py-1 text-left font-semibold">Asset name</th>
                      <th className="px-2 py-1 text-left font-semibold">Asset usage id</th>
                      <th className="px-2 py-1 text-left font-semibold">Region</th>
                      <th className="px-2 py-1 text-left font-semibold">City</th>
                      <th className="px-2 py-1 text-left font-semibold">Final value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelValidation.assets.slice(0, previewLimit).map((row, idx) => (
                      <tr key={`${row.sheet}-${idx}`} className="border-t border-blue-900/10">
                        <td className="px-2 py-1">{row.sheet}</td>
                        <td className="px-2 py-1">{row.assetName || "-"}</td>
                        <td className="px-2 py-1">{row.assetUsageId || "-"}</td>
                        <td className="px-2 py-1">{row.region || "-"}</td>
                        <td className="px-2 py-1">{row.city || "-"}</td>
                        <td className="px-2 py-1">{row.finalValue || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelValidation.assets.length > previewLimit && (
                <div className="px-2.5 py-1 text-[10px] text-blue-900/60 border-t border-blue-900/10">
                  Showing first {previewLimit} of {excelValidation.assets.length} assets.
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section title="Reports">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-[11px] text-blue-900/70">
            Total reports: {reports.length}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-blue-900/60">
              Filter status
            </span>
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
            No manual reports found yet.
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
                                                }
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
                                        const macroId = getAssetMacroId(asset, report);
                                        const assetStatus = getAssetStatus(asset, report);
                                        const assetBusy = assetActionBusy[`${recordId}:${assetIndex}`];
                                        return (
                                          <tr key={`${recordId}-${assetIndex}`} className="border-t border-blue-900/10">
                                            <td className="px-2 py-1">
                                              {macroId || "Not created"}
                                            </td>
                                            <td className="px-2 py-1">{asset.asset_name || "-"}</td>
                                            <td className="px-2 py-1">{asset.final_value || "-"}</td>
                                            <td className="px-2 py-1">{getAssetApproach(asset)}</td>
                                            <td className="px-2 py-1">
                                              <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                  assetStatusClasses[assetStatus] || "border-rose-200 bg-rose-50 text-rose-700"
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
        open={showCreateModal}
        onClose={handleCloseCreateModal}
        title={isEditing ? "Edit report" : "Create new report"}
      >
        {headerAlert}
        <div className="space-y-4">
      <Section title="Report Information">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-px rounded-xl border border-blue-900/15 bg-blue-900/10 overflow-hidden">
            <InputField
              label="Report Title"
              required
              type="text"
              value={formData.title}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              error={errors.title}
              placeholder="Enter a descriptive title for this report"
              className="bg-white p-1.5"
            />
            <SelectField
              label="Report Type"
              required
              value={formData.report_type}
              onChange={(e) => handleFieldChange("report_type", e.target.value)}
              options={[
                  { value: "تقرير مفصل", label: "Detailed Report" },
                  { value: "ملخص التقرير", label: "Report Summary" },
                  {
                    value: "مراجعة مع قيمة جديدة",
                    label: "Review with New Value",
                  },
                  {
                    value: "مراجعة بدون قيمة جديدة",
                    label: "Review without New Value",
                  },
                ]}
              error={errors.report_type}
              className="bg-white p-1.5"
            />
            <SelectField
              label="Valuation Purpose"
              required
              value={formData.purpose_id}
              onChange={(e) => handleFieldChange("purpose_id", e.target.value)}
              options={[
                { value: "to set", label: "Select" },
                { value: "1", label: "Selling" },
                { value: "2", label: "Buying" },
                { value: "5", label: "Rent Value" },
                { value: "6", label: "Insurance" },
                { value: "8", label: "Accounting Purposes" },
                { value: "9", label: "Financing" },
                { value: "10", label: "Disputes and Litigation" },
                { value: "12", label: "Tax Related Valuations" },
                { value: "14", label: "Other" },
              ]}
              error={errors.purpose_id}
              className="bg-white p-1.5"
            />
            <SelectField
              label="Value Premise"
              required
              value={formData.value_premise_id}
              onChange={(e) =>
                handleFieldChange("value_premise_id", e.target.value)
              }
              options={[
                { value: "to set", label: "Select" },
                { value: "1", label: "Highest and Best Use" },
                { value: "2", label: "Current Use" },
                { value: "3", label: "Orderly Liquidation" },
                { value: "4", label: "Forced Sale" },
                { value: "5", label: "Other" },
              ]}
              error={errors.value_premise_id}
              className="bg-white p-1.5"
            />
            <InputField
              label="Valued At"
              required
              type="date"
              value={formData.valued_at}
              onChange={(e) => handleFieldChange("valued_at", e.target.value)}
              error={errors.valued_at}
              className="bg-white p-1.5"
            />
            <InputField
              label="Submitted At"
              required
              type="date"
              value={formData.submitted_at}
              onChange={(e) =>
                handleFieldChange("submitted_at", e.target.value)
              }
              error={errors.submitted_at}
              className="bg-white p-1.5"
            />
            <InputField
              label="Inspection Date"
              required
              type="date"
              value={formData.inspection_date}
              onChange={(e) =>
                handleFieldChange("inspection_date", e.target.value)
              }
              error={errors.inspection_date}
              className="bg-white p-1.5"
            />
            <InputField
              label="Value"
              required
              type="text"
              value={formData.value}
              onChange={(e) => handleFieldChange("value", e.target.value)}
              error={errors.value}
              placeholder="Enter final value"
              className="bg-white p-1.5"
            />
            <InputField
              label="Assumptions"
              value={formData.assumptions}
              onChange={(e) => handleFieldChange("assumptions", e.target.value)}
              placeholder="Enter general assumptions for the valuation"
              className="bg-white p-1.5"
            />
            <InputField
              label="Special Assumptions"
              value={formData.special_assumptions}
              onChange={(e) =>
                handleFieldChange("special_assumptions", e.target.value)
              }
              placeholder="Enter any special assumptions or conditions"
              className="bg-white p-1.5"
            />
          </div>
        </Section>

        <Section title="Client Information">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px rounded-xl border border-blue-900/15 bg-blue-900/10 overflow-hidden">
            <InputField
              label="Client Name"
              required
              type="text"
              value={formData.client_name || ""}
              onChange={(e) => {
                const value = e.target.value;
                handleFieldChange("client_name", value);
                handleFieldChange("owner_name", value);
              }}
              error={errors["client_name"]}
              placeholder="Enter client name"
              className="bg-white p-1.5"
            />
            <InputField
              label="Telephone"
              required
              type="tel"
              value={formData.telephone || ""}
              onChange={(e) => handleFieldChange("telephone", e.target.value)}
              error={errors["telephone"]}
              placeholder="e.g. +966500000000"
              className="bg-white p-1.5"
            />
            <InputField
              label="Email"
              required
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              error={errors["email"]}
              placeholder="e.g. example@domain.com"
              className="bg-white p-1.5"
            />
            <div className="bg-white p-1.5 flex items-center">
              <label
                htmlFor="has-other-users"
                className="flex items-center gap-2 text-[10px] font-semibold text-blue-900/70"
              >
                <input
                  id="has-other-users"
                  type="checkbox"
                  checked={!!formData.has_other_users}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    handleFieldChange("has_other_users", checked);
                    if (checked && reportUsers.length === 0) {
                      addReportUser();
                    }
                    if (!checked) {
                      setReportUsers([]);
                      setFormData((prev) => ({ ...prev, report_users: [] }));
                    }
                  }}
                  className="h-4 w-4 rounded border-blue-900/30 text-blue-900 focus:ring-blue-900/20"
                />
                Has other users
              </label>
            </div>
          </div>

          {formData.has_other_users && (
            <Section title="المستخدمون الآخرون للتقرير">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12px] font-semibold text-blue-950">
                  المستخدمون الآخرون للتقرير
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addReportUser}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    اضافة مستخدم اخر
                  </button>
                  <button
                    type="button"
                    onClick={deleteLastReportUser}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                  >
                    حذف اخر مستخدم
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {reportUsers.map((userName, idx) => (
                  <div key={idx} className="w-full">
                    <label className="block text-[10px] font-semibold text-blue-900/70 mb-1">
                      اسم مستخدم التقرير *
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => updateReportUser(idx, e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-blue-900/20 rounded-md bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                      placeholder="اسم مستخدم التقرير"
                    />
                  </div>
                ))}
                {reportUsers.length === 0 && (
                  <div className="text-[10px] text-blue-900/60">
                    اضغط على "اضافة مستخدم اخر" لإضافة مستخدمين.
                  </div>
                )}
              </div>
            </Section>
          )}
        </Section>

        <Section title="Valuers">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-semibold text-blue-950">
              بيانات المقيمين
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addValuer}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                اضافة مقيم اخر
              </button>
              <button
                type="button"
                onClick={deleteLastValuer}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
              >
                حذف اخر مقيم
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {valuers.map((valuer, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-blue-900/15 rounded-xl p-2"
              >
                <div>
                  <label className="block text-[10px] font-semibold text-blue-900/70 mb-1">
                    اسم المقيم *
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 border border-blue-900/20 rounded-md bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                    value={valuer.valuer_name}
                    onChange={(e) =>
                      handleValuerChange(idx, "valuer_name", e.target.value)
                    }
                  >
                    <option value="">تحديد</option>
                    {valuerOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-blue-900/70 mb-1">
                    نسبة المساهمة *
                  </label>
                  <select
                    className="w-full px-2.5 py-1.5 border border-blue-900/20 rounded-md bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                    value={valuer.contribution_percentage}
                    onChange={(e) =>
                      handleValuerChange(
                        idx,
                        "contribution_percentage",
                        Number(e.target.value)
                      )
                    }
                  >
                    {contributionOptions.map((pct) => (
                      <option key={pct} value={pct}>
                        {pct}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Section>
        {!isEditing ? (
        <Section title="Assets attachments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="border border-dashed border-blue-900/20 rounded-xl p-2 flex items-center justify-between bg-blue-50/40">
              <div>
                <p className="text-[12px] font-semibold text-blue-950">
                  Upload Excel (market &amp; cost)
                </p>
                <p className="text-[11px] text-blue-900/60">
                  Must include sheets: market, cost.
                </p>
                {excelFile ? (
                  <p className="text-xs text-green-700 mt-1">
                    {excelFile.name}
                  </p>
                ) : (
                  fileNotes.excelName && (
                    <p className="text-xs text-blue-700 mt-1">
                      Last selected: {fileNotes.excelName}
                    </p>
                  )
                )}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer text-[10px] font-semibold text-blue-900">
                <Upload className="w-4 h-4" />
                <span>Select file</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setExcelFileAndRemember(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="border border-dashed border-blue-900/20 rounded-xl p-2 bg-blue-50/40 space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-semibold text-blue-900/70">
                <input
                  type="checkbox"
                  checked={wantsPdfUpload}
                  onChange={(e) => handlePdfToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-blue-900/30 text-blue-900 focus:ring-blue-900/20"
                />
                Upload PDF (optional)
              </label>
              <p className="text-[11px] text-blue-900/60">
                Attach a single PDF file for this report.
              </p>
              {wantsPdfUpload ? (
                <div className="flex items-center justify-between">
                  <div>
                    {pdfFile ? (
                      <p className="text-xs text-green-700 mt-1">{pdfFile.name}</p>
                    ) : (
                      fileNotes.pdfName && (
                        <p className="text-xs text-blue-700 mt-1">
                          Last selected: {fileNotes.pdfName}
                        </p>
                      )
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer text-[10px] font-semibold text-blue-900">
                    <Upload className="w-4 h-4" />
                    <span>Select file</span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      ref={pdfInputRef}
                      onChange={(e) => setPdfFileAndRemember(e.target.files?.[0] || null)}
                      onClick={(e) => {
                        e.currentTarget.value = null;
                      }}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-[10px] text-blue-900/60">PDF upload is disabled.</p>
              )}
            </div>
          </div>
        </Section>
        ) : (
          <div className="rounded-xl border border-blue-900/10 bg-blue-50/40 px-3 py-2 text-[10px] text-blue-900/70">
            Attachments are locked while editing. Create a new report to upload Excel or PDF files.
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={clearSavedState}
            className="rounded-md border border-blue-900/20 bg-white px-4 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
          >
            Reset Form
          </button>
          {isEditing ? (
            <button
              onClick={handleUpdateReport}
              disabled={updatingReport}
              className={`px-4 py-2 rounded-md text-[11px] font-semibold shadow-sm transition-all ${
                updatingReport
                  ? "bg-blue-900/10 text-blue-900/50 cursor-not-allowed"
                  : "bg-blue-900 hover:bg-blue-800 text-white"
              }`}
            >
              {updatingReport ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save changes"
              )}
            </button>
          ) : (
            <button
              onClick={handleCreateReport}
              disabled={submitting || excelValidationLoading}
              className={`px-4 py-2 rounded-md text-[11px] font-semibold shadow-sm transition-all ${
                submitting
                  ? "bg-blue-900/10 text-blue-900/50 cursor-not-allowed"
                  : "bg-blue-900 hover:bg-blue-800 text-white"
              }`}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add report
                </span>
              )}
            </button>
          )}
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

export default DuplicateReport;
