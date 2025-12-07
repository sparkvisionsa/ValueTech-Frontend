import React, { useState } from "react";
import axios from "axios";

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

    // --- existing helpers (not used in new flow, but kept as requested) ---
    const uploadExcelOnly = async () => {
        throw new Error("uploadExcelOnly is deprecated in this flow.");
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

            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromApi, 1);

            if (electronResult?.status === "SUCCESS") {
                setSuccess(
                    `Upload succeeded. ${insertedCount} assets saved and sent to Taqeem browser.`
                );
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
        <div className="bg-white border rounded-lg p-6 shadow-sm text-sm text-gray-600">
            <p className="font-semibold text-gray-800 mb-2">Validation tab</p>
            <p>
                This space is reserved for the upcoming validation workflow. For now,
                use the "No validation" tab to exercise the new backend endpoints.
            </p>
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
                        Test the no-validation flow: Excel ingestion and PDF linking.
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