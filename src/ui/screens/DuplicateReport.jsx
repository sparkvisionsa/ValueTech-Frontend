import React, { useMemo, useState } from "react";
import { createDuplicateReport, fetchLatestUserReport } from "../../api/report";
import { useSession } from "../context/SessionContext";
import usePersistentState from "../hooks/usePersistentState";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload,
  FileDown,
  Send,
  RefreshCw,
} from "lucide-react";

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

const DuplicateReport = () => {
  const { user } = useSession();
  const [formData, setFormData, resetFormData] = usePersistentState("duplicate:formData", buildDefaultFormData());
  const [errors, setErrors] = useState({});
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus, resetStatus] = usePersistentState("duplicate:status", null);
  const [reportUsers, setReportUsers, resetReportUsers] = usePersistentState("duplicate:reportUsers", formData?.report_users || []);
  const [valuers, setValuers, resetValuers] = usePersistentState("duplicate:valuers", buildDefaultValuers());
  const [duplicates, setDuplicates] = useState([]);
  const [fileNotes, setFileNotes, resetFileNotes] = usePersistentState("duplicate:fileNotes", { excelName: null, pdfName: null });
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

  const clearSavedState = () => {
    setFormData(buildDefaultFormData());
    setReportUsers([]);
    setValuers(buildDefaultValuers());
    setExcelFile(null);
    setPdfFile(null);
    setErrors({});
    resetStatus();
    setFileNotes({ excelName: null, pdfName: null });
    setDuplicates([]);
  };

  const setExcelFileAndRemember = (file) => {
    setExcelFile(file);
    setFileNotes((prev) => ({ ...prev, excelName: file ? file.name : null }));
  };

  const setPdfFileAndRemember = (file) => {
    setPdfFile(file);
    setFileNotes((prev) => ({ ...prev, pdfName: file ? file.name : null }));
  };

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

  const handleFetchLatest = async () => {
    try {
      setLoadingReport(true);
      setStatus(null);
      const response = await fetchLatestUserReport();
      if (response?.success) {
        const incoming = response.data || {};
        setFormData((prev) => ({
          ...prev,
          ...incoming,
          report_type: "تقرير مفصل",
          value_premise_id: "1",
          valuation_currency: "1",
          has_other_users: !!incoming.has_other_users,
          report_users: incoming.report_users || [],
        }));
        setReportUsers(incoming.report_users || []);
        setStatus({
          type: "success",
          message: "Loaded latest report for your account.",
        });
      } else {
        setStatus({
          type: "error",
          message: response?.message || "No report found for this user.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.message ||
          err.message ||
          "Failed to load report data.",
      });
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      setStatus({ type: "error", message: "Please fill required fields." });
      return;
    }

    if (!excelFile) {
      setStatus({
        type: "error",
        message: "Excel file is required to duplicate report.",
      });
      return;
    }

    const payload = new FormData();
    payload.append(
      "formData",
      JSON.stringify({
        ...formData,
        report_users: formData.report_users || [],
        valuers,
      })
    );
    payload.append("excel", excelFile);
    if (pdfFile) {
      payload.append("pdf", pdfFile);
    }

    try {
      setSubmitting(true);
      setStatus(null);
      const result = await createDuplicateReport(payload);
      if (result?.success) {
        setStatus({
          type: "success",
          message: "Duplicate report saved. Launching Taqeem now...",
        });
        try {
          const recId = result?.data?.id || result?.data?._id;
          await window.electronAPI?.duplicateReportNavigate(recId);
        } catch (err) {
          setStatus({
            type: "warning",
            message:
              "Report saved, but failed to launch Taqeem. Open manually if needed.",
          });
        }
      } else {
        setStatus({
          type: "error",
          message: result?.message || "Could not save duplicate report.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.message ||
          err.message ||
          "Failed to save duplicate report.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const headerAlert = status ? (
    <div
      className={`mb-3 rounded-2xl border px-3 py-2 flex items-start gap-2 text-[11px] ${
        status.type === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : status.type === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {status.type === "success" ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5" />
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
      <div className="space-y-4">
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
                Duplicate report &amp; send new
              </h2>
              <p className="text-[11px] text-slate-600">
                Pull your latest report, update fields, attach new assets, and send.
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
              onClick={handleFetchLatest}
              disabled={loadingReport}
              className="inline-flex items-center gap-2 rounded-md bg-blue-900 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
            >
              {loadingReport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Show report data
            </button>
            <button
              type="button"
              onClick={clearSavedState}
              className="inline-flex items-center gap-2 rounded-md border border-blue-900/20 bg-white px-3 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
            >
              <RefreshCw className="w-4 h-4" />
              Clear saved form
            </button>
          </div>
        </div>

        {headerAlert}

        <Section title="Report Information">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px rounded-xl border border-blue-900/15 bg-blue-900/10 overflow-hidden">
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

            <div className="border border-dashed border-blue-900/20 rounded-xl p-2 flex items-center justify-between bg-blue-50/40">
              <div>
                <p className="text-[12px] font-semibold text-blue-950">
                  Upload PDF (mandatory)
                </p>
                <p className="text-[11px] text-blue-900/60">
                  Attach generated PDF if available.
                </p>
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
                  onChange={(e) => setPdfFileAndRemember(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={validate}
            className="rounded-md bg-blue-900 px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            Validate Data
          </button>
          <button
            onClick={() => {
              const newEntry = {
                formData: { ...formData },
                valuers: valuers.map((v) => ({ ...v })),
                report_users: formData.report_users || [],
                errors: {},
                excelFile: null,
                pdfFile: null,
                submitting: false,
                status: null,
              };
              setDuplicates((prev) => [...prev, newEntry]);
            }}
            className="rounded-md bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            Duplicate
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-4 py-2 rounded-md text-[11px] font-semibold shadow-sm transition-all ${
              submitting
                ? "bg-blue-900/10 text-blue-900/50 cursor-not-allowed"
                : "bg-blue-900 hover:bg-blue-800 text-white"
            }`}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send to Taqeem
              </span>
            )}
          </button>
        </div>
        {duplicates.map((dup, idx) => (
          <Section key={idx} title={`Duplicated Form #${idx + 1}`}>
            <div className="text-[10px] text-blue-900/60 mb-1">
              Editable copy of the main form.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px rounded-xl border border-blue-900/15 bg-blue-900/10 overflow-hidden">
              <InputField
                label="Report Title"
                required
                type="text"
                value={dup.formData.title}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? { ...d, formData: { ...d.formData, title: value } }
                        : d
                    )
                  );
                }}
                error={dup.errors?.title}
                placeholder="Enter a descriptive title for this report"
                className="bg-white p-1.5"
              />
              <SelectField
                label="Report Type"
                required
                value={dup.formData.report_type}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? { ...d, formData: { ...d.formData, report_type: value } }
                        : d
                    )
                  );
                }}
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
                error={dup.errors?.report_type}
                className="bg-white p-1.5"
              />
              <SelectField
                label="Valuation Purpose"
                required
                value={dup.formData.purpose_id}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: { ...d.formData, purpose_id: value },
                          }
                        : d
                    )
                  );
                }}
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
                error={dup.errors?.purpose_id}
                className="bg-white p-1.5"
              />
              <SelectField
                label="Value Premise"
                required
                value={dup.formData.value_premise_id}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: {
                              ...d.formData,
                              value_premise_id: value,
                            },
                          }
                        : d
                    )
                  );
                }}
                options={[
                  { value: "to set", label: "Select" },
                  { value: "1", label: "Highest and Best Use" },
                  { value: "2", label: "Current Use" },
                  { value: "3", label: "Orderly Liquidation" },
                  { value: "4", label: "Forced Sale" },
                  { value: "5", label: "Other" },
                ]}
                error={dup.errors?.value_premise_id}
                className="bg-white p-1.5"
              />
              <InputField
                label="Valued At"
                required
                type="date"
                value={dup.formData.valued_at}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: { ...d.formData, valued_at: value },
                          }
                        : d
                    )
                  );
                }}
                error={dup.errors?.valued_at}
                className="bg-white p-1.5"
              />
              <InputField
                label="Submitted At"
                required
                type="date"
                value={dup.formData.submitted_at}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: { ...d.formData, submitted_at: value },
                          }
                        : d
                    )
                  );
                }}
                error={dup.errors?.submitted_at}
                className="bg-white p-1.5"
              />
              <InputField
                label="Inspection Date"
                required
                type="date"
                value={dup.formData.inspection_date}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: { ...d.formData, inspection_date: value },
                          }
                        : d
                    )
                  );
                }}
                error={dup.errors?.inspection_date}
                className="bg-white p-1.5"
              />
              <InputField
                label="Value"
                required
                type="text"
                value={dup.formData.value}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? { ...d, formData: { ...d.formData, value: value } }
                        : d
                    )
                  );
                }}
                error={dup.errors?.value}
                placeholder="Enter final value"
                className="bg-white p-1.5"
              />
              <InputField
                label="Assumptions"
                value={dup.formData.assumptions}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: { ...d.formData, assumptions: value },
                          }
                        : d
                    )
                  );
                }}
                placeholder="Enter general assumptions for the valuation"
                className="bg-white p-1.5"
              />
              <InputField
                label="Special Assumptions"
                value={dup.formData.special_assumptions}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: {
                              ...d.formData,
                              special_assumptions: value,
                            },
                          }
                        : d
                    )
                  );
                }}
                placeholder="Enter any special assumptions or conditions"
                className="bg-white p-1.5"
              />
            </div>

            <Section title="Client Information">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-px rounded-xl border border-blue-900/15 bg-blue-900/10 overflow-hidden">
                <InputField
                  label="Client Name"
                  required
                  type="text"
                  value={dup.formData.client_name || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDuplicates((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? {
                              ...d,
                              formData: { ...d.formData, client_name: value, owner_name: value },
                            }
                          : d
                      )
                    );
                  }}
                  error={dup.errors?.client_name}
                  placeholder="Enter client name"
                  className="bg-white p-1.5"
                />
                <InputField
                  label="Telephone"
                  required
                  type="tel"
                  value={dup.formData.telephone || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDuplicates((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? {
                              ...d,
                              formData: { ...d.formData, telephone: value },
                            }
                          : d
                      )
                    );
                  }}
                  error={dup.errors?.telephone}
                  placeholder="e.g. +966500000000"
                  className="bg-white p-1.5"
                />
                <InputField
                  label="Email"
                  required
                  type="email"
                  value={dup.formData.email || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDuplicates((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? { ...d, formData: { ...d.formData, email: value } }
                          : d
                      )
                    );
                  }}
                  error={dup.errors?.email}
                  placeholder="e.g. example@domain.com"
                  className="bg-white p-1.5"
                />
                <div className="bg-white p-1.5 flex items-center">
                  <label
                    htmlFor={`has-other-users-${idx}`}
                    className="flex items-center gap-2 text-[10px] font-semibold text-blue-900/70"
                  >
                    <input
                      id={`has-other-users-${idx}`}
                      type="checkbox"
                      checked={!!dup.formData.has_other_users}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDuplicates((prev) =>
                          prev.map((d, i) =>
                            i === idx
                              ? {
                                  ...d,
                                  formData: {
                                    ...d.formData,
                                    has_other_users: checked,
                                    report_users: checked
                                      ? d.formData.report_users &&
                                        d.formData.report_users.length
                                        ? d.formData.report_users
                                        : [""]
                                      : [],
                                  },
                                }
                              : d
                          )
                        );
                      }}
                      className="h-4 w-4 rounded border-blue-900/30 text-blue-900 focus:ring-blue-900/20"
                    />
                    Has other users
                  </label>
                </div>
              </div>

              {dup.formData.has_other_users && (
                <Section title="المستخدمون الآخرون للتقرير">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[12px] font-semibold text-blue-950">
                      المستخدمون الآخرون للتقرير
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicates((prev) =>
                            prev.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    formData: {
                                      ...d.formData,
                                      report_users: [
                                        ...(d.formData.report_users || []),
                                        "",
                                      ],
                                    },
                                  }
                                : d
                            )
                          );
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        اضافة مستخدم اخر
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicates((prev) =>
                            prev.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    formData: {
                                      ...d.formData,
                                      report_users:
                                        (d.formData.report_users || []).length >
                                        1
                                          ? d.formData.report_users.slice(0, -1)
                                          : [],
                                    },
                                  }
                                : d
                            )
                          );
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                      >
                        حذف اخر مستخدم
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(dup.formData.report_users || []).map((userName, uIdx) => (
                      <div key={uIdx} className="w-full">
                        <label className="block text-[10px] font-semibold text-blue-900/70 mb-1">
                          اسم مستخدم التقرير *
                        </label>
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDuplicates((prev) =>
                              prev.map((d, i) =>
                                i === idx
                                  ? {
                                      ...d,
                                      formData: {
                                        ...d.formData,
                                        report_users: (
                                          d.formData.report_users || []
                                        ).map((u, j) =>
                                          j === uIdx ? value : u
                                        ),
                                      },
                                    }
                                  : d
                              )
                            );
                          }}
                          className="w-full px-2.5 py-1.5 border border-blue-900/20 rounded-md bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                          placeholder="اسم مستخدم التقرير"
                        />
                      </div>
                    ))}
                    {(dup.formData.report_users || []).length === 0 && (
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
                    onClick={() => {
                      setDuplicates((prev) =>
                        prev.map((d, i) =>
                          i === idx
                            ? {
                                ...d,
                                valuers: [
                                  ...d.valuers,
                                  {
                                    valuer_name:
                                      "4210000296 - فالح مفلح فالح الشهراني",
                                    contribution_percentage: 100,
                                  },
                                ],
                              }
                            : d
                        )
                      );
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    اضافة مقيم اخر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicates((prev) =>
                        prev.map((d, i) =>
                          i === idx
                            ? {
                                ...d,
                                valuers:
                                  d.valuers.length > 1
                                    ? d.valuers.slice(0, -1)
                                    : d.valuers,
                              }
                            : d
                        )
                      );
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                  >
                    حذف اخر مقيم
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {dup.valuers.map((valuer, vIdx) => (
                  <div
                    key={vIdx}
                    className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-blue-900/15 rounded-xl p-2"
                  >
                    <div>
                      <label className="block text-[10px] font-semibold text-blue-900/70 mb-1">
                        اسم المقيم *
                      </label>
                      <select
                        className="w-full px-2.5 py-1.5 border border-blue-900/20 rounded-md bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                        value={valuer.valuer_name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDuplicates((prev) =>
                            prev.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    valuers: d.valuers.map((val, j) =>
                                      j === vIdx
                                        ? { ...val, valuer_name: value }
                                        : val
                                    ),
                                  }
                                : d
                            )
                          );
                        }}
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
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setDuplicates((prev) =>
                            prev.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    valuers: d.valuers.map((val, j) =>
                                      j === vIdx
                                        ? {
                                            ...val,
                                            contribution_percentage: value,
                                          }
                                        : val
                                    ),
                                  }
                                : d
                            )
                          );
                        }}
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
                    {dup.excelFile && (
                      <p className="text-xs text-green-700 mt-1">
                        {dup.excelFile.name}
                      </p>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer text-[10px] font-semibold text-blue-900">
                    <Upload className="w-4 h-4" />
                    <span>Select file</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDuplicates((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, excelFile: file } : d
                          )
                        );
                      }}
                    />
                  </label>
                </div>

                <div className="border border-dashed border-blue-900/20 rounded-xl p-2 flex items-center justify-between bg-blue-50/40">
                  <div>
                    <p className="text-[12px] font-semibold text-blue-950">
                      Upload PDF (optional)
                    </p>
                    <p className="text-[11px] text-blue-900/60">
                      Attach generated PDF if available.
                    </p>
                    {dup.pdfFile && (
                      <p className="text-xs text-green-700 mt-1">
                        {dup.pdfFile.name}
                      </p>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer text-[10px] font-semibold text-blue-900">
                    <Upload className="w-4 h-4" />
                    <span>Select file</span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDuplicates((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, pdfFile: file } : d
                          )
                        );
                      }}
                    />
                  </label>
                </div>
              </div>
            </Section>

            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  const errs = {};
                  [
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
                  ].forEach((field) => {
                    if (!dup.formData[field]) errs[field] = "Required";
                  });
                  setDuplicates((prev) =>
                    prev.map((d, i) => (i === idx ? { ...d, errors: errs } : d))
                  );
                }}
                className="rounded-md bg-blue-900 px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                Validate Data
              </button>
              <button
                type="button"
                onClick={() => {
                  const newEntry = {
                    formData: { ...dup.formData },
                    valuers: dup.valuers.map((v) => ({ ...v })),
                    report_users: dup.formData.report_users || [],
                    errors: {},
                    excelFile: null,
                    pdfFile: null,
                    submitting: false,
                    status: null,
                  };
                  setDuplicates((prev) => [...prev, newEntry]);
                }}
                className="rounded-md bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                Duplicate
              </button>
              <button
                onClick={async () => {
                  const errs = {};
                  [
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
                  ].forEach((field) => {
                    if (!dup.formData[field]) errs[field] = "Required";
                  });
                  if (!dup.excelFile) {
                    setDuplicates((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? {
                              ...d,
                              errors: errs,
                              status: {
                                type: "error",
                                message: "Excel file is required.",
                              },
                            }
                          : d
                      )
                    );
                    return;
                  }

                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? { ...d, errors: errs, submitting: true, status: null }
                        : d
                    )
                  );
                  const payload = new FormData();
                  payload.append(
                    "formData",
                    JSON.stringify({
                      ...dup.formData,
                      report_users: dup.formData.report_users || [],
                      valuers: dup.valuers,
                    })
                  );
                  payload.append("excel", dup.excelFile);
                  if (dup.pdfFile) payload.append("pdf", dup.pdfFile);

                  try {
                    const result = await createDuplicateReport(payload);
                    setDuplicates((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? {
                              ...d,
                              submitting: false,
                              status: result?.success
                                ? {
                                    type: "success",
                                    message: "Duplicate report saved. Launching Taqeem now...",
                                  }
                                : {
                                    type: "error",
                                    message:
                                      result?.message || "Failed to save.",
                                  },
                            }
                          : d
                      )
                    );
                    if (result?.success) {
                      try {
                        const recId = result?.data?.id || result?.data?._id;
                        await window.electronAPI?.duplicateReportNavigate(recId);
                      } catch (err) {
                        setDuplicates((prev) =>
                          prev.map((d, i) =>
                            i === idx
                              ? {
                                  ...d,
                                  status: {
                                    type: "warning",
                                    message:
                                      "Report saved, but failed to launch Taqeem. Open manually if needed.",
                                  },
                                }
                              : d
                          )
                        );
                      }
                    }
                  } catch (err) {
                    setDuplicates((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? {
                              ...d,
                              submitting: false,
                              status: {
                                type: "error",
                                message:
                                  err?.response?.data?.message ||
                                  err.message ||
                                  "Failed to save duplicate.",
                              },
                            }
                          : d
                      )
                    );
                  }
                }}
                disabled={dup.submitting}
                className={`px-4 py-2 rounded-md text-[11px] font-semibold shadow-sm transition-all ${
                  dup.submitting
                    ? "bg-blue-900/10 text-blue-900/50 cursor-not-allowed"
                    : "bg-blue-900 hover:bg-blue-800 text-white"
                }`}
              >
                {dup.submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send to Taqeem
                  </span>
                )}
              </button>
            </div>

            {dup.status && (
              <div
                className={`mt-3 rounded-2xl border px-3 py-2 text-[11px] ${
                  dup.status.type === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : dup.status.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {dup.status.message}
              </div>
            )}
          </Section>
        ))}
      </div>
    </div>
  );
};

export default DuplicateReport;
