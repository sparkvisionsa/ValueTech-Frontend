import React, { useState } from "react";
import { Download, FolderOpen, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";

const statusMessages = {
    NOT_CONFIRMED: "Report status is not Confirmed/\u0645\u0639\u062a\u0645\u062f.",
    NO_BUTTON: "Registration Certificate button not found.",
    DOWNLOAD_FAILED: "Download did not complete in time.",
    FAILED: "Download failed.",
    SKIPPED: "Report ID is missing.",
};

const DownloadCertificate = () => {
    const [reportId, setReportId] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [message, setMessage] = useState(null);

    const setInfo = (text) => setMessage({ type: "info", text });
    const setError = (text) => setMessage({ type: "error", text });
    const setSuccess = (text) => setMessage({ type: "success", text });

    const handleDownload = async () => {
        const trimmedId = reportId.trim();
        if (!trimmedId) {
            setError("Report ID is required.");
            return;
        }

        if (!window?.electronAPI?.downloadRegistrationCertificates || !window?.electronAPI?.selectFolder) {
            setError("Desktop integration unavailable. Restart the app.");
            return;
        }

        setIsDownloading(true);
        setInfo("Select a folder to save the certificate.");

        try {
            const folderResult = await window.electronAPI.selectFolder();
            if (!folderResult?.folderPath) {
                setInfo("Folder selection canceled.");
                return;
            }

            setInfo(`Downloading certificate for report ${trimmedId}...`);
            const result = await window.electronAPI.downloadRegistrationCertificates({
                downloadPath: folderResult.folderPath,
                reports: [{ reportId: trimmedId, assetName: trimmedId }],
                tabsNum: 1,
            });

            if (result?.status !== "SUCCESS") {
                throw new Error(result?.error || "Download failed.");
            }

            const match = Array.isArray(result?.results)
                ? result.results.find((item) => String(item?.reportId) === trimmedId)
                : null;

            if (match?.status === "DOWNLOADED") {
                const fileName = match?.fileName ? ` (${match.fileName})` : "";
                setSuccess(`Certificate downloaded${fileName}.`);
                return;
            }

            if (match?.status && statusMessages[match.status]) {
                setError(statusMessages[match.status]);
                return;
            }

            setError("No certificate downloaded for this report.");
        } catch (err) {
            setError(err?.message || "Failed to download certificate.");
        } finally {
            setIsDownloading(false);
        }
    };

    const messageStyle =
        message?.type === "error"
            ? "bg-red-50 border-red-100 text-red-700"
            : message?.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                : "bg-blue-50 border-blue-100 text-blue-700";

    const MessageIcon = message?.type === "error"
        ? AlertTriangle
        : message?.type === "success"
            ? CheckCircle2
            : Info;

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Download className="w-5 h-5 text-blue-600" />
                        <h1 className="text-xl font-semibold text-slate-900">Download Certificate with ID</h1>
                    </div>
                    <p className="text-sm text-slate-600 mb-6">
                        Enter a report ID, choose a save folder, and download the registration certificate.
                    </p>

                    <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="reportIdInput">
                        Report ID
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                            id="reportIdInput"
                            type="text"
                            value={reportId}
                            onChange={(e) => setReportId(e.target.value)}
                            placeholder="Enter report ID"
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isDownloading}
                        />
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {isDownloading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <FolderOpen className="w-4 h-4" />
                            )}
                            {isDownloading ? "Downloading..." : "Download Registration Certificate"}
                        </button>
                    </div>

                    {message && (
                        <div className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${messageStyle}`}>
                            <MessageIcon className="w-4 h-4 mt-0.5" />
                            <span>{message.text}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DownloadCertificate;
