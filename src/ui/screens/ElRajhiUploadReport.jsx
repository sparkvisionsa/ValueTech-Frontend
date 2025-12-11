import React, { useState } from "react";
import axios from "axios";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { uploadElrajhiBatch } from "../../api/report";
import httpClient from "../../api/httpClient";
import { useElrajhiUpload } from "../context/ElrajhiUploadContext";

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
    Download,
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

const convertArabicDigits = (value) => {
    if (typeof value !== "string") return value;
    const map = {
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9",
    };
    return value.replace(/[٠-٩]/g, (d) => map[d] ?? d);
};

const detectValuerColumnsOrThrow = (exampleRow) => {
    const keys = Object.keys(exampleRow || {});
    const idKeys = [];
    const nameKeys = [];
    const pctKeys = [];

    const pushIfUnique = (arr, key) => {
        if (!arr.includes(key)) arr.push(key);
    };

    const extractIndex = (normalizedKey, base) => {
        const num = normalizedKey.slice(base.length).match(/^(\d+)/);
        return num ? Number(num[1]) : 0;
    };

    keys.forEach((originalKey) => {
        const normalized = normalizeKey(originalKey);

        const isIdKey =
            normalized.startsWith("valuerid") ||
            /^valuer\d+id/.test(normalized);
        const isNameKey =
            normalized.startsWith("valuername") ||
            /^valuer\d+name/.test(normalized);
        const isPctKey =
            normalized.startsWith("percentage") ||
            normalized.startsWith("percent") ||
            /^valuer\d+(percentage|percent)/.test(normalized);

        if (isIdKey) {
            pushIfUnique(idKeys, originalKey);
        } else if (isNameKey) {
            pushIfUnique(nameKeys, originalKey);
        } else if (isPctKey) {
            pushIfUnique(pctKeys, originalKey);
        }
    });

    const sortValuerKeys = (arr, base) =>
        arr.sort((a, b) => {
            const aIdx = extractIndex(normalizeKey(a), base);
            const bIdx = extractIndex(normalizeKey(b), base);
            return aIdx - bIdx || a.localeCompare(b);
        });

    sortValuerKeys(idKeys, "valuerid");
    sortValuerKeys(nameKeys, "valuername");
    sortValuerKeys(pctKeys, "percentage");

    const hasBaseName = nameKeys.length > 0;
    const hasBasePct = pctKeys.length > 0;

    if (!hasBaseName || !hasBasePct) {
        throw new Error(
            "Market sheet must contain headers 'valuerName' and 'percentage' (with optional 1, 2, etc.)."
        );
    }

    return { idKeys, nameKeys, pctKeys };
};

const buildValuersForAsset = (assetRow, valuerCols) => {
    const { idKeys, nameKeys, pctKeys } = valuerCols;
    const maxLen = Math.max(idKeys.length, nameKeys.length, pctKeys.length);
    const valuers = [];

    for (let i = 0; i < maxLen; i++) {
        const idKey = idKeys[i];
        const nameKey = nameKeys[i];
        const pctKey = pctKeys[i];

        const rawId = idKey ? assetRow[idKey] : null;
        const rawName = nameKey ? assetRow[nameKey] : null;
        const rawPct = pctKey ? assetRow[pctKey] : null;

        const allEmpty =
            (rawId === null || rawId === "" || rawId === undefined) &&
            (rawName === null || rawName === "" || rawName === undefined) &&
            (rawPct === null || rawPct === "" || rawPct === undefined);

        if (allEmpty) continue;

        let pctValue = normalizeCellValue(rawPct);
        if (typeof pctValue === "string") {
            pctValue = convertArabicDigits(pctValue)
                .replace(/[%٪]/g, "")
                .replace(/,/g, ".")
                .trim();
        }

        const hasPct =
            rawPct !== null &&
            rawPct !== undefined &&
            String(rawPct).toString().trim() !== "";

        if (!hasPct) {
            // Skip valuers that don't provide a percentage
            continue;
        }

        const pctNum = Number(pctValue);
        let percentage = 0;

        if (!Number.isNaN(pctNum)) {
            percentage = pctNum >= 0 && pctNum <= 1 ? pctNum * 100 : pctNum;
        } else {
            // Skip valuers with invalid/non-numeric percentages
            continue;
        }

        valuers.push({
            valuerId: rawId != null && rawId !== "" ? String(rawId) : "",
            valuerName: rawName != null ? String(rawName) : "",
            percentage,
        });
    }

    return valuers;
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

const UploadReportElrajhi = () => {
    const {
        activeTab,
        setActiveTab,
        numTabs,
        setNumTabs,
        excelFile,
        setExcelFile,
        pdfFiles,
        setPdfFiles,
        validationFolderFiles,
        setValidationFolderFiles,
        validationExcelFile,
        setValidationExcelFile,
        validationPdfFiles,
        setValidationPdfFiles,
        resetAllFiles,
        batchId,
        setBatchId,
        excelResult,
        setExcelResult,
        downloadPath,
        setDownloadPath,
        error,
        setError,
        success,
        setSuccess,
        validationReports,
        setValidationReports,
        marketAssets,
        setMarketAssets,
        validationMessage,
        setValidationMessage,
        validationDownloadPath,
        setValidationDownloadPath,
        rememberedFiles,
        setRememberedFiles,
        resetMainFlow,
        resetValidationFlow,
        sendingTaqeem,
        setSendingTaqeem,
        sendingValidation,
        setSendingValidation,
        pdfOnlySending,
        setPdfOnlySending,
        loadingValuers,
        setLoadingValuers,
    } = useElrajhiUpload();

    const [downloadingExcel, setDownloadingExcel] = useState(false);
    const [loadingExcel, setLoadingExcel] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [savingValidation, setSavingValidation] = useState(false);
    const [downloadingValidationExcel, setDownloadingValidationExcel] = useState(false);
    const [sendToConfirmerMain, setSendToConfirmerMain] = useState(false);
    const [sendToConfirmerValidation, setSendToConfirmerValidation] = useState(false);

    // --- existing helpers (not used in new flow, but kept as requested) ---
    const uploadExcelOnly = async () => {
        throw new Error("uploadExcelOnly is deprecated in this flow.");
    };

    const handleSubmitElrajhi = async () => {
        try {
            setSendingValidation(true);
            setValidationMessage({
                type: "info",
                text: "Saving reports to database..."
            });

            if (!validationExcelFile) {
                throw new Error("Select a folder with Excel file before sending.");
            }
            // Upload to backend
            const data = await uploadElrajhiBatch(
                validationExcelFile,
                validationPdfFiles
            );

            console.log("ELRAJHI BATCH:", data);

            const batchIdFromData = data.batchId;
            const insertedCount = data.inserted || 0;
            const reportsFromApi = Array.isArray(data.reports) ? data.reports : [];
            if (reportsFromApi.length) {
                setValidationReports((prev) => {
                    // Map incoming _id to existing rows by order or asset name
                    const byAsset = new Map();
                    reportsFromApi.forEach((r) => {
                        const key = (r.asset_name || "").toLowerCase();
                        if (!byAsset.has(key)) byAsset.set(key, []);
                        byAsset.get(key).push(r);
                    });
                    return prev.map((r) => {
                        const list = byAsset.get((r.asset_name || "").toLowerCase()) || [];
                        const next = list.shift();
                        if (next) {
                            return {
                                ...r,
                                record_id: next._id || next.id || next.record_id,
                                report_id: next.report_id || r.report_id,
                            };
                        }
                        return r;
                    });
                });
            }
            setValidationDownloadPath(`/elrajhi-upload/export/${batchIdFromData}`);

            // Update UI
            setValidationMessage({
                type: "success",
                text: `Reports saved (${insertedCount} assets). ${sendToConfirmerValidation ? "Sending to Taqeem..." : "Final submission skipped."}`
            });

            // Send to Electron with pdfOnly = false (send all)
            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromData, numTabs, false, sendToConfirmerValidation);

            if (electronResult?.status === "SUCCESS") {
                const resultMap = (electronResult.results || []).reduce((acc, res) => {
                    const key = res.record_id || res.recordId;
                    const reportId = res.report_id || res.reportId;
                    if (key && reportId) acc[key] = reportId;
                    return acc;
                }, {});

                if (Object.keys(resultMap).length || (electronResult.results || []).length) {
                    setValidationReports((prev) =>
                        prev.map((r, idx) => {
                            const key = r.record_id || r.recordId || r._id;
                            const fallback = (electronResult.results || [])[idx]?.report_id
                                || (electronResult.results || [])[idx]?.reportId;
                            const reportId = resultMap[key] || r.report_id || fallback;
                            return { ...r, report_id: reportId };
                        })
                    );
                }

                setValidationMessage({
                    type: "success",
                    text: `Upload succeeded. ${insertedCount} assets saved and sent to Taqeem browser.`
                });
            } else {
                setValidationMessage({
                    type: "error",
                    text: electronResult?.error || "Upload to Taqeem failed. Make sure you selected a company."
                });
            }
        } catch (err) {
            console.error("Upload failed", err);
            setValidationMessage({
                type: "error",
                text: err.message || "Failed to upload reports"
            });
        } finally {
            setSendingValidation(false);
        }
    };

    // New function for sending only reports with PDFs
    const handleSubmitPdfOnly = async () => {
        try {
            setPdfOnlySending(true);
            setValidationMessage({
                type: "info",
                text: "Saving PDF reports to database..."
            });

            if (!validationExcelFile) {
                throw new Error("Select a folder with Excel file before sending.");
            }
            // Upload to backend
            const data = await uploadElrajhiBatch(
                validationExcelFile,
                validationPdfFiles
            );

            console.log("ELRAJHI BATCH (PDF Only):", data);

            const batchIdFromData = data.batchId;
            const insertedCount = data.inserted || 0;
            const reportsFromApi = Array.isArray(data.reports) ? data.reports : [];
            if (reportsFromApi.length) {
                setValidationReports((prev) => {
                    const byAsset = new Map();
                    reportsFromApi.forEach((r) => {
                        const key = (r.asset_name || "").toLowerCase();
                        if (!byAsset.has(key)) byAsset.set(key, []);
                        byAsset.get(key).push(r);
                    });
                    return prev.map((r) => {
                        const list = byAsset.get((r.asset_name || "").toLowerCase()) || [];
                        const next = list.shift();
                        if (next) {
                            return {
                                ...r,
                                record_id: next._id || next.id || next.record_id,
                                report_id: next.report_id || r.report_id,
                            };
                        }
                        return r;
                    });
                });
            }
            setValidationDownloadPath(`/elrajhi-upload/export/${batchIdFromData}`);

            // Filter reports to only include those with PDFs
            const pdfReports = validationReports.filter(report => report.pdf_name);
            const pdfCount = pdfReports.length;

            // Update UI
            setValidationMessage({
                type: "success",
                text: `PDF reports saved (${pdfCount} assets with PDFs). ${sendToConfirmerValidation ? "Sending to Taqeem..." : "Final submission skipped."}`
            });

            // Send to Electron with pdfOnly = true
            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromData, numTabs, true, sendToConfirmerValidation);

            if (electronResult?.status === "SUCCESS") {
                const resultMap = (electronResult.results || []).reduce((acc, res) => {
                    const key = res.record_id || res.recordId;
                    const reportId = res.report_id || res.reportId;
                    if (key && reportId) acc[key] = reportId;
                    return acc;
                }, {});

                if (Object.keys(resultMap).length || (electronResult.results || []).length) {
                    setValidationReports((prev) =>
                        prev.map((r, idx) => {
                            const key = r.record_id || r.recordId || r._id;
                            const fallback = (electronResult.results || [])[idx]?.report_id
                                || (electronResult.results || [])[idx]?.reportId;
                            const reportId = resultMap[key] || r.report_id || fallback;
                            return { ...r, report_id: reportId };
                        })
                    );
                }

                setValidationMessage({
                    type: "success",
                    text: `PDF-only upload succeeded. ${pdfCount} assets with PDFs sent to Taqeem browser.`
                });
            } else {
                setValidationMessage({
                    type: "error",
                    text: electronResult?.error || "PDF-only upload to Taqeem failed. Make sure you selected a company."
                });
            }
        } catch (err) {
            console.error("PDF-only upload failed", err);
            setValidationMessage({
                type: "error",
                text: err.message || "Failed to upload PDF reports"
            });
        } finally {
            setPdfOnlySending(false);
        }
    };

    const uploadPdfsOnly = async () => {
        throw new Error("uploadPdfsOnly is deprecated in this flow.");
    };

    const resetMessages = () => {
        setError("");
        setSuccess("");
    };

    const downloadExcelFile = async (path, setBusy, setMessage) => {
        if (!path) return;
        try {
            setBusy(true);
            const response = await httpClient.get(path, { responseType: "blob" });
            const disposition = response.headers["content-disposition"] || "";
            const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
            const filename = match && match[1] ? match[1] : "updated.xlsx";
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to download Excel", err);
            if (setMessage) {
                setMessage({
                    type: "error",
                    text: "Failed to download updated Excel. Please try again.",
                });
            } else {
                setError("Failed to download updated Excel");
            }
        } finally {
            setBusy(false);
        }
    };

    const handleExcelChange = (e) => {
        resetMessages();
        const file = e.target.files?.[0];
        setExcelFile(file || null);
        setRememberedFiles((prev) => ({
            ...prev,
            mainExcel: file ? file.name : null,
        }));
    };

    const handlePdfsChange = (e) => {
        resetMessages();
        const files = Array.from(e.target.files || []);
        setPdfFiles(files);
        setRememberedFiles((prev) => ({
            ...prev,
            mainPdfs: files.map((f) => f.name),
        }));
    };

    const resetValidationBanner = () => setValidationMessage(null);

    const parseExcelForValidation = async (excel, pdfList = [], options = {}) => {
        const { silent = false } = options;

        if (!excel) {
            setMarketAssets([]);
            setValidationReports([]);
            if (!silent) {
                setValidationMessage({
                    type: "error",
                    text: "Select an Excel file before saving.",
                });
            }
            return null;
        }

        if (!silent) resetValidationBanner();
        setLoadingValuers(true);
        try {
            const buffer = await excel.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const marketSheet = workbook.getWorksheet("market");
            if (!marketSheet) {
                throw new Error("Excel must include a sheet named 'market'.");
            }

            const marketRows = worksheetToObjects(marketSheet);
            if (!marketRows.length) {
                throw new Error("Sheet 'market' has no rows to read valuers from.");
            }

            const valuerCols = detectValuerColumnsOrThrow(marketRows[0]);

            const pdfMap = {};
            pdfList.forEach((file) => {
                const base = file.name.replace(/\.pdf$/i, "");
                pdfMap[normalizeKey(base)] = file.name;
            });

            const assets = [];
            const invalidTotals = [];

            for (let i = 0; i < marketRows.length; i++) {
                const row = marketRows[i];
                if (!row.asset_name) continue;

                const valuers = buildValuersForAsset(row, valuerCols);
                if (!valuers.length) {
                    throw new Error(
                        `Asset "${row.asset_name}" (row ${i + 2}) has no valuers.`
                    );
                }

                const total = valuers.reduce(
                    (sum, v) => sum + Number(v.percentage || 0),
                    0
                );
                const roundedTotal = Math.round(total * 100) / 100;

                if (Math.abs(roundedTotal - 100) > 0.001) {
                    invalidTotals.push({
                        assetName: row.asset_name,
                        rowNumber: i + 2,
                        total: roundedTotal,
                    });
                }

                const pdf_name = pdfMap[normalizeKey(row.asset_name)] || null;

                assets.push({
                    asset_name: row.asset_name,
                    client_name: row.client_name || row.owner_name || "",
                    pdf_name,
                    valuers,
                    totalPercentage: roundedTotal,
                });
            }

            if (!assets.length) {
                throw new Error("No assets with asset_name found in 'market' sheet.");
            }

            const reports = assets.map((asset, idx) => ({
                id: `${asset.asset_name}-${idx}`,
                asset_name: asset.asset_name,
                client_name: asset.client_name || "Pending client",
                pdf_name: asset.pdf_name,
                valuers: asset.valuers,
                totalPercentage: asset.totalPercentage,
            }));

            setMarketAssets(assets);
            setValidationReports(reports);

            const matchedCount = reports.filter((r) => !!r.pdf_name).length;

            if (!silent) {
                if (invalidTotals.length) {
                    const firstInvalid = invalidTotals[0];
                    setValidationMessage({
                        type: "error",
                        text: `Found ${invalidTotals.length} asset(s) with invalid totals. Example: Asset "${firstInvalid.assetName}" (row ${firstInvalid.rowNumber}) totals ${firstInvalid.total}%. Must be 100%.`,
                    });
                } else {
                    setValidationMessage({
                        type: "success",
                        text: `Loaded ${assets.length} asset(s). Matched ${matchedCount} PDF(s) by asset name.`,
                    });
                }
            }

            return { assets, matchedCount, invalidTotals };
        } catch (err) {
            setMarketAssets([]);
            setValidationReports([]);
            if (!silent) {
                setValidationMessage({
                    type: "error",
                    text: err.message || "Failed to read valuers from Excel.",
                });
            }
            return null;
        } finally {
            setLoadingValuers(false);
        }
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
                    record_id: d._id || d.id || d.record_id || null,
                })),
                source: "system",
            });
            setDownloadPath(`/elrajhi-upload/export/${batchIdFromApi}`);

            setSuccess(
                `Upload complete. Inserted ${insertedCount} urgent assets into DB. ${sendToConfirmerMain ? "Sending to Taqeem..." : "Final submission skipped."}`
            );
            setDownloadPath(`/elrajhi-upload/export/${batchIdFromApi}`);

            const electronResult = await window.electronAPI.elrajhiUploadReport(batchIdFromApi, numTabs, false, sendToConfirmerMain);

            if (electronResult?.status === "SUCCESS") {
                // Attach report IDs returned from Taqeem to the table rows
                const resultMap = (electronResult.results || []).reduce((acc, res) => {
                    const key = res.record_id || res.recordId;
                    const reportId = res.report_id || res.reportId;
                    if (key && reportId) {
                        acc[key] = reportId;
                    }
                    return acc;
                }, {});

                if (Object.keys(resultMap).length || (electronResult.results || []).length) {
                    setExcelResult((prev) => {
                        if (!prev) return prev;
                        const reports = (prev.reports || []).map((r, idx) => {
                            const key = r.record_id || r.recordId || r._id;
                            const fallbackFromOrder = (electronResult.results || [])[idx]?.report_id
                                || (electronResult.results || [])[idx]?.reportId;
                            const reportId = resultMap[key] || r.report_id || fallbackFromOrder;
                            return { ...r, report_id: reportId };
                        });
                        return { ...prev, reports };
                    });
                }

                setSuccess(
                    `Upload succeeded. ${insertedCount} assets saved and dispatched to Taqeem tabs${sendToConfirmerMain ? "" : " (final submit skipped)"}.`
                );
            } else {
                const errMsg = electronResult?.error || "Upload to Taqeem failed. Make sure you selected a company.";
                setError(errMsg);
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

    const handleValidationFolderChange = (e) => {
        resetValidationBanner();
        const incomingFiles = Array.from(e.target.files || []);
        setValidationFolderFiles(incomingFiles);
        const excel = incomingFiles.find((file) => /\.(xlsx|xls)$/i.test(file.name));
        const pdfList = incomingFiles.filter((file) => /\.pdf$/i.test(file.name));
        setValidationExcelFile(excel || null);
        setValidationPdfFiles(pdfList);
        setRememberedFiles((prev) => ({
            ...prev,
            validationExcel: excel ? excel.name : null,
            validationPdfs: pdfList.map((p) => p.name),
        }));
    };

    const allAssetsTotalsValid = marketAssets.every(
        (a) => Math.abs((a.totalPercentage || 0) - 100) < 0.001
    );
    const canSendReports = marketAssets.length > 0 && allAssetsTotalsValid && !loadingValuers;
    const maxValuerSlots = Math.max(
        1,
        marketAssets.reduce(
            (max, asset) => Math.max(max, (asset.valuers || []).length),
            0
        )
    );

    const calculateAssetTotal = (asset) => {
        const total = (asset?.valuers || []).reduce(
            (sum, member) =>
                sum + Number(member.percentage ?? member.contribution ?? 0),
            0
        );
        return Math.round(total * 100) / 100;
    };

    const resetValidationSection = () => {
        resetValidationFlow();
        setValidationFolderFiles([]);
        setValidationExcelFile(null);
        setValidationPdfFiles([]);
        setSendToConfirmerValidation(false);
    };

    const registerValidationFolder = async () => {
        resetValidationBanner();

        if (!validationFolderFiles.length) {
            setValidationMessage({
                type: "error",
                text: "Select a folder that includes Excel and PDF files.",
            });
            return;
        }
        if (!validationExcelFile) {
            setValidationMessage({
                type: "error",
                text: "The folder must include at least one Excel file for report info.",
            });
            return;
        }
        if (!validationPdfFiles.length) {
            setValidationMessage({
                type: "error",
                text: "Add at least one PDF in the folder to continue.",
            });
            return;
        }

        setSavingValidation(true);
        try {
            const parseResult = await parseExcelForValidation(
                validationExcelFile,
                validationPdfFiles,
                { silent: false }
            );

            if (!parseResult) return;

            const { assets, matchedCount } = parseResult;

            if (!assets.length) {
                setValidationMessage({
                    type: "error",
                    text: "No assets found in the Excel file.",
                });
                return;
            }

            const totalsValid = assets.every(
                (asset) => Math.abs((asset.totalPercentage || 0) - 100) < 0.001
            );

            if (!totalsValid) {
                setValidationMessage({
                    type: "error",
                    text: "Valuer percentages must total 100% for every asset before saving.",
                });
                return;
            }

            setValidationMessage({
                type: "success",
                text: `Folder staged. Found ${assets.length} asset(s) and ${validationPdfFiles.length} PDF(s). Matched ${matchedCount} PDF(s) by asset name.`,
            });
        } finally {
            setSavingValidation(false);
        }
    };

    const clearAll = () => {
        resetAllFiles();
        resetMainFlow();
        setSendToConfirmerMain(false);
        resetMessages();
    };

    const noValidationContent = (
        <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <Info className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Quick upload without validation</p>
                    <p className="text-xs text-slate-600">
                        Step 1: Add Excel and PDFs. Step 2: Choose tabs and optionally send to confirmer. We create reports and
                        fill assets; final send depends on your checkbox.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">Step 1</span>
                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                            Upload Excel (Report Info + market)
                        </h3>
                    </div>
                    <p className="text-xs text-gray-600">
                        Only sheets &quot;Report Info&quot; and &quot;market&quot; are read. One report is created per market row.
                    </p>
                    <label className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2 text-sm text-gray-800">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {excelFile
                                    ? excelFile.name
                                    : rememberedFiles.mainExcel
                                        ? `Last: ${rememberedFiles.mainExcel}`
                                        : "Choose Excel file"}
                            </span>
                        </div>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleExcelChange}
                        />
                        <span className="text-xs text-blue-600 font-semibold">Browse</span>
                    </label>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Excel uploads when you click &quot;Send to Taqeem&quot;.</span>
                        <button
                            onClick={clearAll}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-100 text-gray-700 text-xs font-semibold hover:bg-slate-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-[11px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-100">Step 2</span>
                        <Files className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                            Upload PDFs (match by asset_name)
                        </h3>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                        <p>Filenames should equal asset_name + &quot;.pdf&quot;</p>
                        <p>Current Batch ID: <span className="font-mono text-gray-800">{batchId || "—"}</span></p>
                    </div>
                    <label className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2 text-sm text-gray-800">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {pdfFiles.length
                                    ? `${pdfFiles.length} file(s) selected`
                                    : rememberedFiles.mainPdfs.length
                                        ? `Last: ${rememberedFiles.mainPdfs.length} PDF(s)`
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
                        <span className="text-xs text-blue-600 font-semibold">Browse</span>
                    </label>

                    <div className="grid grid-cols-[auto,1fr] gap-y-2 gap-x-3 items-center">
                        <label className="text-xs font-semibold text-gray-700 col-span-2">
                            Number of tabs to open in Taqeem
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setNumTabs(prev => Math.max(1, prev - 1))}
                                disabled={numTabs <= 1}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={numTabs}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value >= 1 && value <= 10) {
                                        setNumTabs(value);
                                    }
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setNumTabs(prev => Math.min(10, prev + 1))}
                                disabled={numTabs >= 10}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                +
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-500 col-span-2">
                            Each tab will process a portion of the reports.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setPdfFiles([]);
                                resetMessages();
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100 text-gray-700 text-sm hover:bg-slate-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Clear PDFs
                        </button>
                    </div>
                </div>
            </div>

            {(error || success) && (
                <div
                    className={`rounded-xl p-3 flex items-start gap-2 border ${error
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-emerald-50 text-emerald-700 border-emerald-100"
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

            <div className="mt-3 space-y-3">
                <label className="inline-flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-amber-600 border-amber-400 focus:ring-amber-500"
                        checked={sendToConfirmerMain}
                        onChange={(e) => setSendToConfirmerMain(e.target.checked)}
                    />
                    <span className="text-sm text-gray-800 font-semibold leading-5">
                        Do you want to send the report to the confirmer? / هل تريد ارسال التقرير الي المعتمد ؟
                    </span>
                </label>
                <button
                    type="button"
                    onClick={sendToTaqeem}
                    disabled={sendingTaqeem || !excelFile || !pdfFiles.length}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                    {sendingTaqeem ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    Send to Taqeem
                </button>
                {!batchId && (
                    <p className="text-xs text-gray-500">
                        Upload Excel and PDFs, then click &quot;Send to Taqeem&quot;. Toggle the checkbox if you want to finalize.
                    </p>
                )}
            </div>

            {excelResult?.reports?.length ? (
                <div className="bg-white border rounded-lg shadow-sm">
                    <div className="px-4 py-3 border-b flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-600" />
                            <div>
                                <p className="text-sm font-semibold text-gray-800">
                                    Created Reports
                                </p>
                                <p className="text-xs text-gray-500">
                                    Batch: {excelResult.batchId}
                                </p>
                                {excelResult.source === "system" && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Reports created from system upload
                                    </p>
                                )}
                            </div>
                        </div>
                        {downloadPath && (
                            <button
                                type="button"
                                onClick={async () => {
                                    if (downloadingExcel) return;
                                    try {
                                        setDownloadingExcel(true);
                                        const response = await httpClient.get(downloadPath, {
                                            responseType: "blob",
                                        });

                                        const disposition = response.headers["content-disposition"] || "";
                                        const match = disposition.match(/filename="?([^"]+)"?/);
                                        const filename = match && match[1] ? match[1] : "updated.xlsx";

                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                        const link = document.createElement("a");
                                        link.href = url;
                                        link.setAttribute("download", filename);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error("Failed to download updated Excel", err);
                                        setError("Failed to download updated Excel");
                                    } finally {
                                        setDownloadingExcel(false);
                                    }
                                }}
                                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                                disabled={downloadingExcel}
                            >
                                {downloadingExcel ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                {downloadingExcel ? "Preparing..." : "Download updated Excel"}
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr className="text-left text-gray-600">
                                    <th className="px-4 py-2">#</th>
                                    <th className="px-4 py-2">Asset Name</th>
                                    <th className="px-4 py-2">Client Name</th>
                                    <th className="px-4 py-2">PDF Path</th>
                                    <th className="px-4 py-2">Report ID</th>
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
                                        <td className="px-4 py-2 text-gray-700">
                                            {r.report_id ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-800 border border-emerald-100">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {r.report_id}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">Pending from Taqeem</span>
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
        <div className="space-y-5">
            {validationMessage && (
                <div
                    className={`rounded-xl p-3 flex items-start gap-2 border ${validationMessage.type === "error"
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

            <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <Info className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Validated folder flow</p>
                    <p className="text-xs text-slate-600">
                        Add a folder, review valuers, choose tabs, then decide if you want to send to confirmer. PDFs can be sent selectively.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">Step 1</span>
                        <Upload className="w-5 h-5 text-blue-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                Upload folder (Excel + PDFs)
                            </p>
                            <p className="text-xs text-gray-600">
                                Choose the folder that contains the Excel report file and all related PDFs.
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                        <div className="flex items-center gap-2 text-sm text-gray-800">
                            <FolderOpen className="w-4 h-4" />
                            <span>
                                {validationFolderFiles.length
                                    ? `${validationFolderFiles.length} file(s) in folder`
                                    : "Pick a folder"}
                            </span>
                        </div>
                        <input
                            type="file"
                            multiple
                            webkitdirectory="true"
                            className="hidden"
                            onChange={handleValidationFolderChange}
                        />
                        <span className="text-xs text-blue-600 font-semibold">Browse</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <p className="font-semibold text-gray-900">Excel detected</p>
                            <p>
                                {validationExcelFile
                                    ? validationExcelFile.name
                                    : rememberedFiles.validationExcel
                                        ? `Last: ${rememberedFiles.validationExcel}`
                                        : "—"}
                            </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <p className="font-semibold text-gray-900">PDFs detected</p>
                            <p>
                                {validationPdfFiles.length
                                    ? `${validationPdfFiles.length} file(s)`
                                    : rememberedFiles.validationPdfs.length
                                        ? `Last: ${rememberedFiles.validationPdfs.length} file(s)`
                                        : "0 file(s)"}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={registerValidationFolder}
                            disabled={savingValidation || loadingValuers}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {(savingValidation || loadingValuers) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            Save folder for validation
                        </button>
                        <button
                            type="button"
                            onClick={resetValidationSection}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-emerald-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                Valuer contributions
                            </p>
                            <p className="text-xs text-gray-500">
                                Pulled from the Excel &quot;market&quot; sheet. Each asset row must have valuers totaling 100%. Listing all assets and their valuers below.
                            </p>
                            {marketAssets.length > 1 && (
                                <p className="text-[11px] text-gray-500">
                                    All {marketAssets.length} assets were validated for valuers and totals.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="px-3 py-2 text-left">Asset</th>
                                    {Array.from({ length: maxValuerSlots }).map((_, idx) => (
                                        <th key={`valuer-col-${idx}`} className="px-3 py-2 text-left">
                                            Valuer {idx + 1}
                                        </th>
                                    ))}
                                    <th className="px-3 py-2 text-left">Total (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {marketAssets.map((asset, assetIdx) => {
                                    const assetTotal = calculateAssetTotal(asset);
                                    const isComplete = Math.abs(assetTotal - 100) < 0.001;

                                    return (
                                        <tr
                                            key={`${asset.asset_name || "asset"}-${assetIdx}`}
                                            className="border-t align-top"
                                        >
                                            <td className="px-3 py-2 text-gray-900 font-medium">
                                                {asset.asset_name || `Asset ${assetIdx + 1}`}
                                            </td>
                                            {Array.from({ length: maxValuerSlots }).map((_, valIdx) => {
                                                const valuer = (asset.valuers || [])[valIdx];

                                                return (
                                                    <td
                                                        key={`asset-${assetIdx}-valuer-${valIdx}`}
                                                        className="px-3 py-2 text-gray-800"
                                                    >
                                                        {valuer ? (
                                                            <div className="space-y-0.5">
                                                                <div className="text-xs text-gray-500">
                                                                    ID: {valuer.valuerId || "—"}
                                                                </div>
                                                                <div className="text-sm font-semibold text-gray-800">
                                                                    {valuer.valuerName || "—"}
                                                                </div>
                                                                <div className="text-sm text-gray-700">
                                                                    {Number(valuer.percentage ?? valuer.contribution ?? 0)}%
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-2 font-semibold text-right">
                                                <span className={isComplete ? "text-emerald-600" : "text-red-600"}>
                                                    {assetTotal}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {loadingValuers && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Reading valuers from Excel...
                        </div>
                    )}
                    {!loadingValuers && !marketAssets.length && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Info className="w-4 h-4" />
                            Select a folder with an Excel file to load valuers.
                        </div>
                    )}
                    {!loadingValuers && marketAssets.length > 0 && !allAssetsTotalsValid && (
                        <div className="flex items-center gap-2 text-xs text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                            Every asset row must total 100% to enable sending to Taqeem.
                        </div>
                    )}
                    {!loadingValuers && marketAssets.length > 0 && allAssetsTotalsValid && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            Contributions are balanced. You can proceed to send.
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="px-4 py-3 border-b flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <Files className="w-5 h-5 text-blue-600" />
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                Reports staged from folder
                            </p>
                            <p className="text-xs text-gray-500">
                                After the folder is saved to the database, PDFs will appear here with asset and client info.
                            </p>
                        </div>
                    </div>
                    {validationDownloadPath && (
                        <button
                            type="button"
                            onClick={() => downloadExcelFile(validationDownloadPath, setDownloadingValidationExcel, setValidationMessage)}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                            disabled={downloadingValidationExcel}
                        >
                            {downloadingValidationExcel ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {downloadingValidationExcel ? "Preparing..." : "Download updated Excel"}
                        </button>
                    )}
                </div>
                {validationReports.length ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="px-4 py-2 text-left">#</th>
                                    <th className="px-4 py-2 text-left">PDF file</th>
                                    <th className="px-4 py-2 text-left">Asset name</th>
                                    <th className="px-4 py-2 text-left">Client name</th>
                                    <th className="px-4 py-2 text-left">Valuers (ID / Name / %)</th>
                                    <th className="px-4 py-2 text-left">Total %</th>
                                    <th className="px-4 py-2 text-left">Report ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {validationReports.map((report, idx) => (
                                    <tr key={report.id} className="border-t">
                                        <td className="px-4 py-2 text-gray-700">
                                            {idx + 1}
                                        </td>
                                        <td className="px-4 py-2 text-gray-900 font-medium">
                                            {report.pdf_name ? (
                                                <span className="inline-flex items-center gap-2 text-emerald-700">
                                                    <FileIcon className="w-4 h-4" />
                                                    {report.pdf_name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-500">
                                                    No matching PDF
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">
                                            {report.asset_name}
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">
                                            {report.client_name}
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">
                                            <div className="flex flex-wrap gap-1 text-xs">
                                                {(report.valuers || []).map((v, vIdx) => (
                                                    <span
                                                        key={`${report.id}-valuer-${vIdx}`}
                                                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 border border-gray-200"
                                                    >
                                                        <span className="font-semibold text-gray-700">
                                                            {v.valuerId || "—"}
                                                        </span>
                                                        <span className="text-gray-600">
                                                            {v.valuerName || "—"}
                                                        </span>
                                                        <span className="text-gray-700">
                                                            ({Number(v.percentage ?? 0)}%)
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-gray-900 font-semibold">
                                            {report.totalPercentage ?? 0}%
                                        </td>
                                        <td className="px-4 py-2 text-gray-800">
                                            {report.report_id ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-800 border border-emerald-100 text-xs">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {report.report_id}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Pending</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Save a folder to preview the PDF files, assets, and client names.
                    </div>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-emerald-600" />
                    <div>
                        <p className="text-sm font-semibold text-gray-900">Send to Taqeem</p>
                        <p className="text-xs text-gray-500">
                            Total contributions must equal 100%. Hook the buttons to the Taqeem integration when ready.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-start gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">
                            Number of tabs to open in Taqeem:
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setNumTabs((prev) => Math.max(1, prev - 1))}
                                disabled={numTabs <= 1}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                -
                            </button>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={numTabs}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!Number.isNaN(value) && value >= 1 && value <= 10) {
                                        setNumTabs(value);
                                    }
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 rounded-md text-center text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setNumTabs((prev) => Math.min(10, prev + 1))}
                                disabled={numTabs >= 10}
                                className="px-3 py-1 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                +
                            </button>
                            <span className="text-xs text-gray-500 ml-1">
                                (1-10)
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">
                            Each tab will process a portion of the reports.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded">
                            <input
                                type="checkbox"
                                className="h-4 w-4 text-amber-600 border-amber-400 focus:ring-amber-500"
                                checked={sendToConfirmerValidation}
                                onChange={(e) => setSendToConfirmerValidation(e.target.checked)}
                            />
                            <span className="text-sm text-gray-800 font-semibold">
                                Do you want to send the report to the confirmer? / هل تريد ارسال التقرير الي المعتمد ؟
                            </span>
                        </label>
                        <button
                            type="button"
                            onClick={handleSubmitElrajhi}
                            disabled={sendingValidation || !canSendReports}
                            className="inline-flex items-center gap-2 
                            px-3 py-2 rounded-md bg-emerald-600 
                            text-white text-sm font-semibold 
                            hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {sendingValidation ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        Send all reports ({numTabs} tab{numTabs !== 1 ? "s" : ""})
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitPdfOnly}
                            disabled={pdfOnlySending || !canSendReports}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {pdfOnlySending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Files className="w-4 h-4" />
                            )}
                            Send only reports with PDFs ({numTabs} tab{numTabs !== 1 ? "s" : ""})
                        </button>
                    </div>
                </div>
            </div>
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
                        Choose a flow: quick upload without validation or the new validation tab with folder upload, valuers, and Taqeem actions.
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
