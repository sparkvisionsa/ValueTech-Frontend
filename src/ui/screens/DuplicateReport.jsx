import React, { useMemo, useState } from "react";
import { createDuplicateReport, fetchLatestUserReport } from "../../api/report";
import { useSession } from "../context/SessionContext";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload,
  FileDown,
  Send,
} from "lucide-react";

const InputField = ({
  label,
  required = false,
  error,
  className = "",
  ...props
}) => (
  <div className={`mb-3 ${className}`}>
    <label className="block text-xs font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all ${
        error ? "border-red-400 bg-red-50" : "border-gray-300"
      }`}
    />
    {error && <p className="text-red-500 text-sm mt-1.5">{error}</p>}
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
  <div className={`mb-3 ${className}`}>
    <label className="block text-xs font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      {...props}
      className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all ${
        error ? "border-red-400 bg-red-50" : "border-gray-300"
      }`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-red-500 text-sm mt-1.5">{error}</p>}
  </div>
);

const TextAreaField = ({
  label,
  required = false,
  error,
  className = "",
  ...props
}) => (
  <div className={`mb-3 ${className}`}>
    <label className="block text-xs font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      {...props}
      className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none ${
        error ? "border-red-400 bg-red-50" : "border-gray-300"
      }`}
    />
    {error && <p className="text-red-500 text-sm mt-1.5">{error}</p>}
  </div>
);

const RadioGroup = ({ label, options, value, onChange }) => (
  <div className="mb-3">
    <label className="block text-xs font-medium text-gray-700 mb-2">
      {label} <span className="text-red-500">*</span>
    </label>
    <div className="grid grid-cols-4 gap-2 w-full">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-center cursor-pointer group w-full"
        >
          <input
            type="radio"
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <div
            className={`flex items-center justify-start gap-2 px-3 py-2 rounded border transition-all text-sm w-full ${
              value === option.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                value === option.value ? "border-blue-500" : "border-gray-400"
              }`}
            >
              {value === option.value && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </div>
            <span
              className={`${
                value === option.value
                  ? "text-blue-700 font-semibold"
                  : "text-gray-700"
              }`}
            >
              {option.label}
            </span>
          </div>
        </label>
      ))}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2">
    <h3 className="text-lg font-semibold text-gray-800 mb-2 pb-2 border-b border-gray-200">
      {title}
    </h3>
    {children}
  </div>
);

const defaultFormData = {
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
};

const DuplicateReport = () => {
  const { user } = useSession();
  const [formData, setFormData] = useState(defaultFormData);
  const [errors, setErrors] = useState({});
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [reportUsers, setReportUsers] = useState([]);
  const [valuers, setValuers] = useState([
    {
      valuer_name: "4210000296 - فالح مفلح فالح الشهراني",
      contribution_percentage: 100,
    },
  ]);
  const [duplicates, setDuplicates] = useState([]);
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
      "valuation_currency",
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
      className={`mb-6 rounded-lg border px-4 py-3 flex items-start gap-3 ${
        status.type === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : status.type === "warning"
          ? "border-yellow-200 bg-yellow-50 text-yellow-800"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {status.type === "success" ? (
        <CheckCircle2 className="w-5 h-5 mt-0.5" />
      ) : status.type === "warning" ? (
        <AlertTriangle className="w-5 h-5 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 mt-0.5" />
      )}
      <div>
        <p className="font-semibold">{status.message}</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-3 px-2">
      <div className="w-full max-w-full mx-auto px-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              Duplicate report &amp; send new
            </h1>
            <p className="text-gray-600 text-sm">
              Pull your latest report, update fields, attach new assets, and
              send.
            </p>
            {user?.phone && (
              <p className="text-[11px] text-gray-500 mt-1">
                Signed in as {user.phone}
              </p>
            )}
          </div>
          <button
            onClick={handleFetchLatest}
            disabled={loadingReport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {loadingReport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Show report data
          </button>
        </div>

        {headerAlert}

        <Section title="Report Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <div className="md:col-span-3">
              <InputField
                label="Report Title"
                required
                type="text"
                value={formData.title}
                onChange={(e) => handleFieldChange("title", e.target.value)}
                error={errors.title}
                placeholder="Enter a descriptive title for this report"
              />
            </div>

            <div className="md:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
              <SelectField
                label="Valuation Purpose"
                required
                value={formData.purpose_id}
                onChange={(e) =>
                  handleFieldChange("purpose_id", e.target.value)
                }
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
              />
            </div>
          </div>

          <div className="mb-3">
            <RadioGroup
              label="Report Type"
              value={formData.report_type}
              onChange={(value) => handleFieldChange("report_type", value)}
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
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <InputField
              label="Valued At"
              required
              type="date"
              value={formData.valued_at}
              onChange={(e) => handleFieldChange("valued_at", e.target.value)}
              error={errors.valued_at}
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
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
            <InputField
              label="Assumptions"
              value={formData.assumptions}
              onChange={(e) => handleFieldChange("assumptions", e.target.value)}
              placeholder="Enter general assumptions for the valuation"
            />

            <InputField
              label="Special Assumptions"
              value={formData.special_assumptions}
              onChange={(e) =>
                handleFieldChange("special_assumptions", e.target.value)
              }
              placeholder="Enter any special assumptions or conditions"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <InputField
              label="Value"
              required
              type="text"
              value={formData.value}
              onChange={(e) => handleFieldChange("value", e.target.value)}
              error={errors.value}
              placeholder="Enter final value"
            />

            <SelectField
              label="Valuation Currency"
              required
              value={formData.valuation_currency}
              onChange={(e) =>
                handleFieldChange("valuation_currency", e.target.value)
              }
              options={[
                { value: "to set", label: "Select" },
                { value: "1", label: "Saudi Riyal" },
                { value: "2", label: "US Dollars" },
                { value: "3", label: "UA Dirhams" },
                { value: "4", label: "Euro" },
                { value: "5", label: "Pound Sterling" },
                { value: "6", label: "Sudanese Pound" },
              ]}
              error={errors.valuation_currency}
            />
          </div>
        </Section>

        <Section title="Client Information">
          <div className="mb-2">
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
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <InputField
              label="Telephone"
              required
              type="tel"
              value={formData.telephone || ""}
              onChange={(e) => handleFieldChange("telephone", e.target.value)}
              error={errors["telephone"]}
              placeholder="e.g. +966500000000"
            />

            <InputField
              label="Email"
              required
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              error={errors["email"]}
              placeholder="e.g. example@domain.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            <div className="flex items-center gap-3">
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
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="has-other-users"
                className="text-sm font-medium text-gray-700"
              >
                Has other users
              </label>
            </div>
          </div>

          {formData.has_other_users && (
            <Section title="المستخدمون الآخرون للتقرير">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-800">
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      اسم مستخدم التقرير *
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => updateReportUser(idx, e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="اسم مستخدم التقرير"
                    />
                  </div>
                ))}
                {reportUsers.length === 0 && (
                  <div className="text-xs text-gray-500">
                    اضغط على "اضافة مستخدم اخر" لإضافة مستخدمين.
                  </div>
                )}
              </div>
            </Section>
          )}
        </Section>

        <Section title="Valuers">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-base font-semibold text-gray-800">
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
                className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-gray-200 rounded-md p-2"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    اسم المقيم *
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    نسبة المساهمة *
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
        <Section title=" Assets Data ">
          <div className="grid grid-cols-1 gap-2">
            <InputField
              label="Inspection Date"
              required
              type="date"
              value={formData.inspection_date}
              onChange={(e) =>
                handleFieldChange("inspection_date", e.target.value)
              }
              error={errors.inspection_date}
            />
          </div>
        </Section>

        <Section title="Assets attachments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="border border-dashed border-gray-300 rounded-md p-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Upload Excel (market &amp; cost)
                </p>
                <p className="text-[11px] text-gray-500">
                  Must include sheets: market, cost.
                </p>
                {excelFile && (
                  <p className="text-xs text-green-700 mt-1">
                    {excelFile.name}
                  </p>
                )}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer text-xs font-semibold">
                <Upload className="w-4 h-4" />
                <span>Select file</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="border border-dashed border-gray-300 rounded-md p-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Upload PDF (mandatory)
                </p>
                <p className="text-[11px] text-gray-500">
                  Attach generated PDF if available.
                </p>
                {pdfFile && (
                  <p className="text-xs text-green-700 mt-1">{pdfFile.name}</p>
                )}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer text-xs font-semibold">
                <Upload className="w-4 h-4" />
                <span>Select file</span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={validate}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md text-sm font-semibold shadow"
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-md text-sm font-semibold shadow"
          >
            Duplicate
          </button>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-6 py-3 rounded-md text-sm font-semibold shadow transition-all ${
              submitting
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Send className="w-5 h-5" />
                Send to Taqeem
              </span>
            )}
          </button>
        </div>
        {duplicates.map((dup, idx) => (
          <Section key={idx} title={`Duplicated Form #${idx + 1}`}>
            <div className="text-xs text-gray-600 mb-2">
              Editable copy of the main form.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <div className="md:col-span-3">
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
                />
              </div>

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
              />
            </div>

            <div className="mb-2">
              <RadioGroup
                label="Report Type"
                value={dup.formData.report_type}
                onChange={(value) => {
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: { ...d.formData, report_type: value },
                          }
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
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
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
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
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
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
              />

              <SelectField
                label="Valuation Currency"
                required
                value={dup.formData.valuation_currency}
                onChange={(e) => {
                  const value = e.target.value;
                  setDuplicates((prev) =>
                    prev.map((d, i) =>
                      i === idx
                        ? {
                            ...d,
                            formData: {
                              ...d.formData,
                              valuation_currency: value,
                            },
                          }
                        : d
                    )
                  );
                }}
                options={[
                  { value: "to set", label: "Select" },
                  { value: "1", label: "Saudi Riyal" },
                  { value: "2", label: "US Dollars" },
                  { value: "3", label: "UA Dirhams" },
                  { value: "4", label: "Euro" },
                  { value: "5", label: "Pound Sterling" },
                  { value: "6", label: "Sudanese Pound" },
                ]}
                error={dup.errors?.valuation_currency}
              />
            </div>

            <Section title="Client Information">
              <div className="mb-2">
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
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                <div className="flex items-center gap-3">
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
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor={`has-other-users-${idx}`}
                    className="text-xs font-medium text-gray-700"
                  >
                    Has other users
                  </label>
                </div>
              </div>

              {dup.formData.has_other_users && (
                <Section title="المستخدمون الآخرون للتقرير">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800">
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
                        <label className="block text-xs font-medium text-gray-700 mb-1">
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
                          className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="اسم مستخدم التقرير"
                        />
                      </div>
                    ))}
                    {(dup.formData.report_users || []).length === 0 && (
                      <div className="text-xs text-gray-500">
                        اضغط على "اضافة مستخدم اخر" لإضافة مستخدمين.
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </Section>

            <Section title="Valuers">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-semibold text-gray-800">
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
                    className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-gray-200 rounded-md p-2"
                  >
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        اسم المقيم *
                      </label>
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        نسبة المساهمة *
                      </label>
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

            <Section title="Assets Data ">
              <div className="grid grid-cols-1 gap-2">
                <InputField
                  label="Inspection Date"
                  required
                  type="date"
                  value={dup.formData.inspection_date || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDuplicates((prev) =>
                      prev.map((d, i) =>
                        i === idx
                          ? {
                              ...d,
                              formData: {
                                ...d.formData,
                                inspection_date: value,
                              },
                            }
                          : d
                      )
                    );
                  }}
                  error={dup.errors?.inspection_date}
                />
              </div>
            </Section>

            <Section title="Assets attachments">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="border border-dashed border-gray-300 rounded-md p-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Upload Excel (market &amp; cost)
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Must include sheets: market, cost.
                    </p>
                    {dup.excelFile && (
                      <p className="text-xs text-green-700 mt-1">
                        {dup.excelFile.name}
                      </p>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer text-xs font-semibold">
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

                <div className="border border-dashed border-gray-300 rounded-md p-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Upload PDF (optional)
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Attach generated PDF if available.
                    </p>
                    {dup.pdfFile && (
                      <p className="text-xs text-green-700 mt-1">
                        {dup.pdfFile.name}
                      </p>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer text-xs font-semibold">
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

            <div className="flex justify-end gap-3 mt-4">
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
                    "valuation_currency",
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
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md text-sm font-semibold shadow"
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-md text-sm font-semibold shadow"
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
                    "valuation_currency",
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
                className={`px-6 py-3 rounded-md text-sm font-semibold shadow transition-all ${
                  dup.submitting
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {dup.submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Send to Taqeem
                  </span>
                )}
              </button>
            </div>

            {dup.status && (
              <div
                className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                  dup.status.type === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : dup.status.type === "warning"
                    ? "border-yellow-200 bg-yellow-50 text-yellow-800"
                    : "border-green-200 bg-green-50 text-green-800"
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
