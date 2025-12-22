
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Table,
  Trash2,
} from "lucide-react";
import { createManualMultiApproachReport } from "../../api/report";
const {
  contributionOptions,
  currencyOptions,
  purposeOptions,
  reportTypeOptions,
  valuerOptions,
  valuePremiseOptions,
  buildDefaultValuers,
} = require("../constants/reportFormOptions");

const defaultAssetRow = () => ({
  asset_name: "",
  asset_usage_id: "",
  final_value: "",
  source_sheet: "market",
});

const buildDefaultFormData = (totalValue = 0) => ({
  excel_name: "",
  batchId: "",
  title: "",
  purpose_id: "to set",
  value_premise_id: "1",
  report_type: reportTypeOptions[0]?.value || "",
  valued_at: "",
  submitted_at: "",
  inspection_date: "",
  assumptions: "",
  special_assumptions: "",
  value: totalValue ? String(totalValue) : "",
  final_value: totalValue ? String(totalValue) : "",
  valuation_currency: "1",
  client_name: "",
  owner_name: "",
  region: "",
  city: "",
  telephone: "",
  email: "",
  pdf_path: "",
  has_other_users: false,
});
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
    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
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
    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
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
    {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
  </div>
);

const Section = ({ title, children, className = "" }) => (
  <div
    className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 ${className}`}
  >
    <h3 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
      {title}
    </h3>
    {children}
  </div>
);

const InfoBanner = ({ tone = "info", message }) => {
  if (!message) return null;
  const toneClasses = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "error"
      ? AlertTriangle
      : tone === "warning"
      ? AlertTriangle
      : Table;
  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 flex items-start gap-3 ${toneClasses[tone]}`}
    >
      <Icon className="w-4 h-4 mt-0.5" />
      <div className="text-sm">{message}</div>
    </div>
  );
};
const ManualMultiReport = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [assets, setAssets] = useState([defaultAssetRow()]);
  const [assetErrors, setAssetErrors] = useState({});
  const [pasteBuffer, setPasteBuffer] = useState("");
  const [formData, setFormData] = useState(buildDefaultFormData());
  const [errors, setErrors] = useState({});
  const [reportUsers, setReportUsers] = useState([]);
  const [valuers, setValuers] = useState(buildDefaultValuers());
  const [valuerError, setValuerError] = useState(null);
  const [status, setStatus] = useState(null);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [tabsNum, setTabsNum] = useState(3);
  const [createdBatchId, setCreatedBatchId] = useState("");
  const [createdReports, setCreatedReports] = useState([]);

  const assetsTotal = useMemo(
    () =>
      assets.reduce((sum, row) => {
        const value = Number(row.final_value);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [assets]
  );

  const steps = [
    { id: 1, title: "المرحلة 1", description: "نسخ بيانات الأصول من الأكسيل" },
    {
      id: 2,
      title: "المرحلة 2",
      description: "تفاصيل التقرير (مطابقة لشاشة Duplicate report)",
    },
    {
      id: 3,
      title: "المرحلة 3",
      description: "عدد التابات ورفع التقرير إلى تقييم",
    },
  ];
  const resetWizard = () => {
    setAssets([defaultAssetRow()]);
    setAssetErrors({});
    setPasteBuffer("");
    setFormData(buildDefaultFormData());
    setErrors({});
    setReportUsers([]);
    setValuers(buildDefaultValuers());
    setValuerError(null);
    setStatus(null);
    setAutomationStatus(null);
    setCurrentStep(1);
    setCreatedBatchId("");
    setCreatedReports([]);
    setTabsNum(3);
  };

  const handleAssetChange = (index, field, value) => {
    setAssets((prev) =>
      prev.map((row, idx) =>
        idx === index ? { ...row, [field]: value } : row
      )
    );
  };

  const addAssetRow = () => setAssets((prev) => [...prev, defaultAssetRow()]);

  const removeAssetRow = (index) =>
    setAssets((prev) => prev.filter((_, idx) => idx !== index));
  const parsePastedRows = () => {
    if (!pasteBuffer.trim()) {
      setStatus({
        type: "warning",
        message: "لم يتم العثور على بيانات للصق.",
      });
      return;
    }
    const lines = pasteBuffer
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      setStatus({
        type: "warning",
        message: "الصق أسطر تتضمن asset_name | asset_usage_id | final_value",
      });
      return;
    }

    const nextAssets = [];
    lines.forEach((line) => {
      const cells = line.split(/\t|\|/).map((cell) => cell.trim());
      if (!cells[0]) return;
      nextAssets.push({
        asset_name: cells[0] || "",
        asset_usage_id: cells[1] || "",
        final_value: cells[2] || "",
        source_sheet:
          cells[3] && cells[3].toLowerCase().includes("cost") ? "cost" : "market",
      });
    });

    if (!nextAssets.length) {
      setStatus({
        type: "warning",
        message: "لم يتم تحويل أي أسطر. تأكد من ترتيب الأعمدة بشكل صحيح.",
      });
      return;
    }

    setAssets(nextAssets);
    setPasteBuffer("");
    setStatus({
      type: "success",
      message: `تم لصق ${nextAssets.length} أصل بنجاح.`,
    });
  };

  const validateAssets = () => {
    const nextErrors = {};
    assets.forEach((row, index) => {
      const rowErrors = {};
      if (!row.asset_name || !row.asset_name.trim()) {
        rowErrors.asset_name = "اسم الأصل مطلوب.";
      }
      const usageId = Number(row.asset_usage_id);
      if (!Number.isInteger(usageId)) {
        rowErrors.asset_usage_id = "asset_usage_id يجب أن يكون رقمًا صحيحًا.";
      }
      const finalValue = Number(row.final_value);
      if (!Number.isInteger(finalValue) || finalValue < 0) {
        rowErrors.final_value = "final_value يجب أن يكون رقمًا صحيحًا غير سالب.";
      }
      if (Object.keys(rowErrors).length) {
        nextErrors[index] = rowErrors;
      }
    });
    setAssetErrors(nextErrors);
    if (!assets.length) {
      setStatus({
        type: "error",
        message: "أضف أصلًا واحدًا على الأقل قبل المتابعة.",
      });
      return false;
    }
    if (Object.keys(nextErrors).length) {
      setStatus({
        type: "error",
        message: "تحقق من كل الحقول في الجدول (اسم، استخدام، قيمة).",
      });
      return false;
    }
    if (!assetsTotal) {
      setStatus({
        type: "error",
        message: "لا يمكن أن يكون الإجمالي صفرًا.",
      });
      return false;
    }
    return true;
  };

  const handleAssetsContinue = () => {
    if (!validateAssets()) return;
    setStatus({
      type: "success",
      message:
        "تم حفظ بيانات الأصول مبدئيًا. انتقل إلى تبويب Report details لملء باقي الحقول.",
    });
    setCurrentStep(2);
  };
  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addReportUser = () => setReportUsers((prev) => [...prev, ""]);
  const deleteLastReportUser = () =>
    setReportUsers((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  const updateReportUser = (index, value) =>
    setReportUsers((prev) =>
      prev.map((user, idx) => (idx === index ? value : user))
    );

  const addValuer = () =>
    setValuers((prev) => [
      ...prev,
      { valuer_name: "", contribution_percentage: 0 },
    ]);
  const deleteLastValuer = () =>
    setValuers((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  const handleValuerChange = (index, field, value) =>
    setValuers((prev) =>
      prev.map((valuer, idx) =>
        idx === index ? { ...valuer, [field]: value } : valuer
      )
    );

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      value: assetsTotal ? String(assetsTotal) : "",
      final_value: assetsTotal ? String(assetsTotal) : "",
    }));
  }, [assetsTotal]);
  const validateReportDetails = () => {
    const nextErrors = {};
    const requiredFields = [
      { field: "title", message: "عنوان التقرير مطلوب." },
      { field: "purpose_id", message: "حدد Purpose of Valuation." },
      { field: "value_premise_id", message: "حدد Value Premise." },
      { field: "report_type", message: "حدد نوع التقرير." },
      { field: "valued_at", message: "تاريخ التقييم مطلوب." },
      { field: "submitted_at", message: "تاريخ التسليم مطلوب." },
      { field: "inspection_date", message: "تاريخ المعاينة مطلوب." },
      { field: "client_name", message: "اسم العميل مطلوب." },
      { field: "telephone", message: "هاتف العميل مطلوب." },
      { field: "email", message: "البريد الإلكتروني مطلوب." },
    ];
    requiredFields.forEach(({ field, message }) => {
      const value = formData[field];
      if (!value || !String(value).trim()) {
        nextErrors[field] = message;
      }
    });

    if (formData.purpose_id === "to set") {
      nextErrors.purpose_id = "اختر Purpose واضح.";
    }
    if (formData.value_premise_id === "to set") {
      nextErrors.value_premise_id = "اختر Value Premise.";
    }
    if (formData.valuation_currency === "to set") {
      nextErrors.valuation_currency = "اختر عملة التقييم.";
    }

    const phone = (formData.telephone || "").replace(/\s+/g, "");
    if (phone.length < 8) {
      nextErrors.telephone = "رقم الهاتف يجب أن يتكون من 8 أرقام أو أكثر.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      nextErrors.email = "صيغة البريد الإلكتروني غير صحيحة.";
    }

    if (reportUsers.length && reportUsers.some((user) => !user.trim())) {
      nextErrors.report_users = "أزل الحقول الفارغة أو أكمل أسماء المستخدمين.";
    }
    if (formData.has_other_users && !reportUsers.length) {
      nextErrors.report_users = "أضف مستخدمًا واحدًا على الأقل أو ألغ التحديد.";
    }

    const sanitizedValuers = valuers.filter(
      (valuer) =>
        valuer.valuer_name && valuer.contribution_percentage !== undefined
    );
    const totalPct = sanitizedValuers.reduce(
      (sum, valuer) => sum + Number(valuer.contribution_percentage || 0),
      0
    );
    if (!sanitizedValuers.length) {
      setValuerError("أضف مقيمًا واحدًا على الأقل.");
    } else if (totalPct !== 100) {
      setValuerError("يجب أن يكون مجموع نسب المقيمين 100% بالضبط.");
    } else {
      setValuerError(null);
    }

    if (Number(formData.value || 0) !== assetsTotal) {
      nextErrors.value =
        "الإجمالي يجب أن يساوي مجموع الأصول في الخطوة الأولى.";
    }

    setErrors(nextErrors);
    return (
      Object.keys(nextErrors).length === 0 &&
      !valuerError &&
      sanitizedValuers.length > 0 &&
      totalPct === 100
    );
  };
  const buildPayload = () => {
    const normalizedAssets = assets.map((row, index) => ({
      asset_id: index + 1,
      asset_name: row.asset_name.trim(),
      asset_usage_id: Number(row.asset_usage_id),
      final_value: Number(row.final_value),
      source_sheet: row.source_sheet || "market",
    }));

    const filteredUsers = reportUsers
      .map((user) => user.trim())
      .filter(Boolean);
    const hasOtherUsers = formData.has_other_users && filteredUsers.length > 0;

    const sanitizedValuers = valuers
      .map((valuer) => ({
        valuer_name: valuer.valuer_name,
        contribution_percentage: Number(valuer.contribution_percentage || 0),
      }))
      .filter((valuer) => valuer.valuer_name);

    return {
      assets: normalizedAssets,
      reportInfo: {
        ...formData,
        value: assetsTotal,
        final_value: assetsTotal,
        report_users: filteredUsers,
        has_other_users: hasOtherUsers,
        valuers: sanitizedValuers,
      },
    };
  };

  const handleSaveReport = async () => {
    if (!validateAssets() || !validateReportDetails()) {
      setStatus({
        type: "error",
        message: "تحقق من البيانات في التابين الأول والثاني قبل الحفظ.",
      });
      return;
    }
    try {
      setIsSaving(true);
      setStatus(null);
      const payload = buildPayload();
      const response = await createManualMultiApproachReport(payload);
      if (response?.status !== "success") {
        throw new Error(response?.error || "فشل حفظ التقرير.");
      }
      setCreatedBatchId(response.batchId);
      setCreatedReports(response.reports || []);
      setStatus({
        type: "success",
        message:
          "تم حفظ التقرير وإرساله لقاعدة البيانات. يمكنك الآن رفعه إلى تقييم.",
      });
      setCurrentStep(3);
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.response?.data?.error ||
          err?.message ||
          "تعذر حفظ التقرير اليدوي.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToTaqeem = async () => {
    if (!createdBatchId) {
      setAutomationStatus({
        type: "error",
        message: "Batch ID مفقود. احفظ التقرير أولًا.",
      });
      return;
    }
    if (!tabsNum || Number(tabsNum) < 1) {
      setAutomationStatus({
        type: "error",
        message: "عدد التابات يجب أن يكون 1 على الأقل.",
      });
      return;
    }

    try {
      setSending(true);
      setAutomationStatus(null);
      if (!window?.electronAPI?.createReportsByBatch) {
        throw new Error(
          "مكتبة Electron غير متاحة. تأكد أن التطبيق يعمل داخل الحاوية الصحيحة."
        );
      }
      const result = await window.electronAPI.createReportsByBatch(
        createdBatchId,
        Number(tabsNum)
      );
      if (result?.status === "SUCCESS") {
        setAutomationStatus({
          type: "success",
          message:
            "تم إرسال التقرير إلى تقييم باستخدام نفس لوجيك Upload Report Elrajhi.",
        });
      } else {
        throw new Error(result?.error || "فشل رفع التقرير إلى تقييم.");
      }
    } catch (err) {
      setAutomationStatus({
        type: "error",
        message:
          err?.message ||
          "تعذر التواصل مع متصفح تقييم. حاول بعد التحقق من الإعدادات.",
      });
    } finally {
      setSending(false);
    }
  };
  const renderStepOne = () => (
    <>
      <Section title="لصق بيانات الأصول من ملف الأكسيل">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              الصق الأسطر من الأكسيل (asset_name | usage_id | final_value)
            </label>
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="مثال: انسخ الصفوف من الأكسيل وافصل الأعمدة بـ Tab أو |"
                value={pasteBuffer}
                onChange={(e) => setPasteBuffer(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={parsePastedRows}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white shadow hover:bg-blue-700"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  تطبيق البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setPasteBuffer("")}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  مسح الحقل
                </button>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm leading-relaxed">
            <p className="font-semibold text-gray-800">تعليمات سريعة:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-gray-600">
              <li>انسخ الأعمدة الثلاثة (الاسم، الاستخدام، القيمة).</li>
              <li>الفواصل يمكن أن تكون Tabs أو Pipes. كل سطر = أصل واحد.</li>
              <li>راجع الجدول لتحديد نوع الورقة market أو cost.</li>
            </ul>
            <div className="mt-3 text-xs text-gray-500">
              عدد الأصول: {assets.length} — مجموع القيم: {assetsTotal.toLocaleString()}
            </div>
          </div>
        </div>
      </Section>

      <Section title="جدول الأصول">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Asset Name</th>
                <th className="px-3 py-2 text-left">Usage ID</th>
                <th className="px-3 py-2 text-left">Final Value</th>
                <th className="px-3 py-2 text-left">Sheet</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((row, index) => {
                const rowError = assetErrors[index] || {};
                return (
                  <tr key={`asset-row-${index}`} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.asset_name}
                        onChange={(e) => handleAssetChange(index, "asset_name", e.target.value)}
                        className={`w-full rounded-md border px-2 py-1 text-sm ${
                          rowError.asset_name ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                        placeholder="اسم الأصل"
                      />
                      {rowError.asset_name && (
                        <p className="text-xs text-red-500 mt-1">{rowError.asset_name}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.asset_usage_id}
                        onChange={(e) => handleAssetChange(index, "asset_usage_id", e.target.value)}
                        className={`w-full rounded-md border px-2 py-1 text-sm ${
                          rowError.asset_usage_id ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                        placeholder="مثال: 101"
                      />
                      {rowError.asset_usage_id && (
                        <p className="text-xs text-red-500 mt-1">{rowError.asset_usage_id}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.final_value}
                        onChange={(e) => handleAssetChange(index, "final_value", e.target.value)}
                        className={`w-full rounded-md border px-2 py-1 text-sm ${
                          rowError.final_value ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                        placeholder="القيمة النهائية"
                      />
                      {rowError.final_value && (
                        <p className="text-xs text-red-500 mt-1">{rowError.final_value}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.source_sheet || "market"}
                        onChange={(e) => handleAssetChange(index, "source_sheet", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                      >
                        <option value="market">market</option>
                        <option value="cost">cost</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeAssetRow(index)}
                        className="inline-flex items-center justify-center text-red-600 hover:text-red-800"
                        title="حذف السطر"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div className="text-sm text-gray-600">
            عدد الأصول: <span className="font-semibold text-gray-900">{assets.length}</span> — إجمالي القيمة:
            <span className="font-semibold text-gray-900"> {assetsTotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addAssetRow}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-800 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
              إضافة سطر
            </button>
            <button
              type="button"
              onClick={handleAssetsContinue}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white shadow hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              حفظ و استمرار
            </button>
          </div>
        </div>
      </Section>
    </>
  );
  const renderReportUsersSection = () =>
    formData.has_other_users && (
      <Section title="المستخدمون الآخرون للتقرير">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-800">المستخدمون الآخرين</h4>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addReportUser}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              اضافة مستخدم
            </button>
            <button
              type="button"
              onClick={deleteLastReportUser}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
            >
              حذف المستخدم الأخير
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {reportUsers.map((value, idx) => (
            <div key={`report-user-${idx}`}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                اسم مستخدم التقرير #{idx + 1}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => updateReportUser(idx, e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="اكتب اسم المستخدم"
              />
            </div>
          ))}
          {errors.report_users && (
            <p className="text-xs text-red-500">{errors.report_users}</p>
          )}
        </div>
      </Section>
    );
  const renderValuersSection = () => (
    <Section title="Valuers">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-base font-semibold text-gray-800">بيانات المقيمين</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addValuer}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
          >
            إضافة مقيم
          </button>
          <button
            type="button"
            onClick={deleteLastValuer}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
          >
            حذف آخر مقيم
          </button>
        </div>
      </div>
      {valuerError && <p className="text-xs text-red-500 mb-2">{valuerError}</p>}
      <div className="space-y-2">
        {valuers.map((valuer, idx) => (
          <div
            key={`valuer-${idx}`}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-gray-200 rounded-md p-3"
          >
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">اسم المقيم *</label>
              <select
                value={valuer.valuer_name}
                onChange={(e) => handleValuerChange(idx, "valuer_name", e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">تحديد</option>
                {valuerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">نسبة المساهمة *</label>
              <select
                value={valuer.contribution_percentage}
                onChange={(e) =>
                  handleValuerChange(idx, "contribution_percentage", Number(e.target.value))
                }
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
  );
  const renderStepTwo = () => (
    <>
      <Section title="Report information">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <InputField
            label="Report Title"
            required
            value={formData.title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            error={errors.title}
            className="lg:col-span-3"
            placeholder="اكتب عنوانًا واضحًا للتقرير"
          />
          <SelectField
            label="Valuation Purpose"
            required
            value={formData.purpose_id}
            onChange={(e) => handleFieldChange("purpose_id", e.target.value)}
            options={purposeOptions}
            error={errors.purpose_id}
          />
          <SelectField
            label="Value Premise"
            required
            value={formData.value_premise_id}
            onChange={(e) => handleFieldChange("value_premise_id", e.target.value)}
            options={valuePremiseOptions}
            error={errors.value_premise_id}
          />
          <SelectField
            label="Report Type"
            required
            value={formData.report_type}
            onChange={(e) => handleFieldChange("report_type", e.target.value)}
            options={reportTypeOptions}
            error={errors.report_type}
          />
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
            onChange={(e) => handleFieldChange("submitted_at", e.target.value)}
            error={errors.submitted_at}
          />
          <InputField
            label="Inspection Date"
            required
            type="date"
            value={formData.inspection_date}
            onChange={(e) => handleFieldChange("inspection_date", e.target.value)}
            error={errors.inspection_date}
          />
          <InputField
            label="Value (auto from assets)"
            required
            type="text"
            value={formData.value}
            readOnly
            error={errors.value}
          />
          <SelectField
            label="Valuation Currency"
            required
            value={formData.valuation_currency}
            onChange={(e) => handleFieldChange("valuation_currency", e.target.value)}
            options={currencyOptions}
            error={errors.valuation_currency}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <TextAreaField
            label="Assumptions"
            rows={3}
            value={formData.assumptions}
            onChange={(e) => handleFieldChange("assumptions", e.target.value)}
          />
          <TextAreaField
            label="Special Assumptions"
            rows={3}
            value={formData.special_assumptions}
            onChange={(e) => handleFieldChange("special_assumptions", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <InputField
            label="Excel Name (اختياري)"
            value={formData.excel_name}
            onChange={(e) => handleFieldChange("excel_name", e.target.value)}
            placeholder="manual-report.xlsx"
          />
          <InputField
            label="Batch ID (اختياري)"
            value={formData.batchId}
            onChange={(e) => handleFieldChange("batchId", e.target.value)}
            placeholder="MAN-xxxx"
          />
          <InputField
            label="PDF Path"
            value={formData.pdf_path}
            onChange={(e) => handleFieldChange("pdf_path", e.target.value)}
            placeholder="C:\\Reports\\final.pdf"
          />
        </div>
      </Section>

      <Section title="Client information">
        <InputField
          label="Client Name"
          required
          value={formData.client_name}
          onChange={(e) => {
            handleFieldChange("client_name", e.target.value);
            if (!formData.owner_name) {
              handleFieldChange("owner_name", e.target.value);
            }
          }}
          error={errors.client_name}
          placeholder="اسم العميل"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <InputField
            label="Telephone"
            required
            value={formData.telephone}
            onChange={(e) => handleFieldChange("telephone", e.target.value)}
            error={errors.telephone}
            placeholder="+9665xxxxxxxx"
          />
          <InputField
            label="Email"
            required
            type="email"
            value={formData.email}
            onChange={(e) => handleFieldChange("email", e.target.value)}
            error={errors.email}
            placeholder="example@domain.com"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
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
          <InputField
            label="Owner Name"
            value={formData.owner_name}
            onChange={(e) => handleFieldChange("owner_name", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <input
            id="has-other-users"
            type="checkbox"
            checked={!!formData.has_other_users}
            onChange={(e) => {
              const checked = e.target.checked;
              handleFieldChange("has_other_users", checked);
              if (!checked) {
                setReportUsers([]);
              } else if (!reportUsers.length) {
                addReportUser();
              }
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="has-other-users" className="text-sm font-medium text-gray-700">
            Has other users
          </label>
        </div>
        {renderReportUsersSection()}
      </Section>

      {renderValuersSection()}

      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          العودة إلى خطوة الأصول
        </button>
        <button
          type="button"
          onClick={handleSaveReport}
          disabled={isSaving}
          className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-md shadow ${
            isSaving ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              حفظ و استمرار
            </>
          )}
        </button>
      </div>
    </>
  );
  const renderReportSummary = () => (
    <>
      <Section title="معلومات عامة عن الحفظ">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <InputField label="Batch ID" value={createdBatchId} readOnly placeholder="سيظهر بعد الحفظ" />
          <InputField
            label="عدد التابات (Tabs)"
            type="number"
            min={1}
            value={tabsNum}
            onChange={(e) => setTabsNum(e.target.value)}
          />
          <InputField label="عدد التقارير" value={createdReports.length} readOnly />
        </div>
      </Section>

      <Section title="التقارير المحفوظة">
        {!createdReports.length && (
          <p className="text-sm text-gray-600">لم يتم إنشاء أي تقرير بعد. ارجع للخطوة السابقة واضغط حفظ.</p>
        )}
        {createdReports.map((report) => (
          <div key={report._id || report.excel_name || report.title} className="border border-gray-200 rounded-lg mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">اسم التقرير: {report.title || report.excel_name}</p>
                <p className="text-xs text-gray-600">
                  إجمالي الأصول: {report.asset_data?.length || 0} — القيمة النهائية: {
                    report.final_value?.toLocaleString?.() || 0
                  }
                </p>
              </div>
              <span className="text-xs text-gray-500">Batch: {createdBatchId}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-white text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Asset Name</th>
                    <th className="px-3 py-2 text-left">Usage ID</th>
                    <th className="px-3 py-2 text-left">Value</th>
                    <th className="px-3 py-2 text-left">Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.asset_data || []).map((asset, idx) => (
                    <tr key={`created-asset-${idx}`} className="border-t">
                      <td className="px-3 py-1.5 text-gray-800">{asset.asset_name}</td>
                      <td className="px-3 py-1.5 text-gray-600">{asset.asset_usage_id}</td>
                      <td className="px-3 py-1.5 text-gray-800">{Number(asset.final_value).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-gray-600">{asset.source_sheet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Section>

      <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            العودة لتعديل البيانات
          </button>
          <button
            type="button"
            onClick={resetWizard}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md border border-red-200 text-red-700 hover:bg-red-50"
          >
            <RefreshCw className="w-4 h-4" />
            إنشاء تقرير جديد
          </button>
        </div>
        <button
          type="button"
          onClick={handleSendToTaqeem}
          disabled={sending}
          className={`inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-md shadow ${
            sending ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الإرسال...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              رفع التقرير إلى تقييم
            </>
          )}
        </button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-gray-50 py-4 px-3">
      <div className="max-w-6xl mx-auto flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">نسخ بيانات الأكسيل للتقارير</h1>
            <p className="text-sm text-gray-600">
              أنشئ تقرير Multi-Approach يدويًا بنفس تجربة Duplicate report & send new، ثم ارفع البيانات إلى نظام تقييم.
            </p>
          </div>
          <button
            type="button"
            onClick={resetWizard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة ضبط المعالج
          </button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`rounded-lg border px-4 py-3 ${
                  currentStep === step.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-xs uppercase text-gray-500">الخطوة {step.id}</p>
                <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-600 mt-1">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <InfoBanner tone={status?.type || "info"} message={status?.message} />
        <InfoBanner tone={automationStatus?.type || "info"} message={automationStatus?.message} />

        {currentStep === 1 && renderStepOne()}
        {currentStep === 2 && renderStepTwo()}
        {currentStep === 3 && renderReportSummary()}
      </div>
    </div>
  );
};

export default ManualMultiReport;
