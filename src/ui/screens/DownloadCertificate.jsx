import React, { useState } from "react";
import { Download, FolderOpen, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useRam } from "../context/RAMContext";

const statusMessages = {
    NOT_CONFIRMED: "Report status is not Confirmed/\u0645\u0639\u062a\u0645\u062f.",
    NO_BUTTON: "Registration Certificate button not found.",
    DOWNLOAD_FAILED: "Download did not complete in time.",
    FAILED: "Download failed.",
    SKIPPED: "Report ID is missing.",
};

const parseReportIds = (input = "") => {
    const tokens = String(input)
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean);
    const blocked = new Set(["report_id", "reportid", "report id"]);
    const uniqueIds = [];
    const seen = new Set();

    tokens.forEach((token) => {
        if (blocked.has(token.toLowerCase())) return;
        if (seen.has(token)) return;
        seen.add(token);
        uniqueIds.push(token);
    });

    return uniqueIds;
};

const DownloadCertificate = () => {
    const [reportIdsInput, setReportIdsInput] = useState("");
    const [isDownloading, setIsDownloading] = useState(false);
    const [message, setMessage] = useState(null);
    const { ramInfo } = useRam();
    const recommendedTabs = ramInfo?.recommendedTabs || 1;

    const setInfo = (text, details = []) => setMessage({ type: "info", text, details });
    const setError = (text, details = []) => setMessage({ type: "error", text, details });
    const setSuccess = (text, details = []) => setMessage({ type: "success", text, details });

    const handleDownload = async () => {
        const reportIds = parseReportIds(reportIdsInput);
        if (!reportIds.length) {
            setError("At least one report ID is required.");
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

            setInfo(`Downloading ${reportIds.length} certificate(s)...`);
            const result = await window.electronAPI.downloadRegistrationCertificates({
                downloadPath: folderResult.folderPath,
                reports: reportIds.map((reportId) => ({ reportId })),
                tabsNum: Number(recommendedTabs) || 1,
            });

            if (result?.status !== "SUCCESS") {
                throw new Error(result?.error || "Download failed.");
            }

            const results = Array.isArray(result?.results) ? result.results : [];
            const summary = result?.summary || {};
            const downloaded =
                summary.downloaded ??
                results.filter((item) => item?.status === "DOWNLOADED").length;
            const failed =
                summary.failed ??
                results.filter((item) => item?.status === "FAILED").length;
            const skipped =
                summary.skipped ??
                results.filter((item) => ["SKIPPED", "NOT_CONFIRMED"].includes(item?.status)).length;

            const details = results
                .filter((item) => item?.status && item.status !== "DOWNLOADED")
                .map((item) => {
                    const reportLabel = item?.reportId ? String(item.reportId) : "Unknown report";
                    const statusLabel = statusMessages[item.status] || item.status || "Unknown status";
                    return `${reportLabel}: ${statusLabel}`;
                });

            const summaryText = `Certificates downloaded: ${downloaded}. Skipped: ${skipped}. Failed: ${failed}.`;

            if (failed > 0) {
                setError(summaryText, details);
            } else if (skipped > 0) {
                setInfo(summaryText, details);
            } else {
                setSuccess(summaryText);
            }
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

    const parsedReportIds = parseReportIds(reportIdsInput);

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Download className="w-5 h-5 text-blue-600" />
                        <h1 className="text-xl font-semibold text-slate-900">Download Certificate with ID</h1>
                    </div>
                    <p className="text-sm text-slate-600 mb-6">
                        Paste one or more report IDs, choose a save folder, and download the registration certificates.
                    </p>

                    <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="reportIdInput">
                        Report IDs
                    </label>
                    <div className="space-y-3">
                        <textarea
                            id="reportIdInput"
                            value={reportIdsInput}
                            onChange={(e) => setReportIdsInput(e.target.value)}
                            placeholder="Paste report IDs, one per line (Excel column works)"
                            rows={7}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isDownloading}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-500">
                                Detected {parsedReportIds.length} unique ID(s).
                            </p>
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
                                {isDownloading ? "Downloading..." : "Download Registration Certificates"}
                            </button>
                        </div>
                    </div>

                    {message && (
                        <div className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${messageStyle}`}>
                            <MessageIcon className="w-4 h-4 mt-0.5" />
                            <div>
                                <div>{message.text}</div>
                                {message.details?.length ? (
                                    <div className="mt-1 text-xs text-current space-y-1">
                                        {message.details.map((detail, idx) => (
                                            <div key={`${detail}-${idx}`}>{detail}</div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DownloadCertificate;
