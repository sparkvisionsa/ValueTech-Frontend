const hasExtension = (fileName = "") => /\.[^.]+$/.test(fileName);

const buildCandidates = (fileName = "") => {
    if (!fileName) return [];
    if (hasExtension(fileName)) return [fileName];
    return [`${fileName}.xlsx`, `${fileName}.xls`, fileName];
};

const extractFilenameFromDisposition = (disposition = "") => {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    return match && match[1] ? match[1].replace(/['"]/g, "") : "";
};

const triggerDownload = (blob, name) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const downloadTemplateFile = async (fileName, options = {}) => {
    const candidates = buildCandidates(fileName);
    if (!candidates.length) {
        throw new Error("Template file name is required.");
    }

    const explicitDownloadName = options.downloadName || "";
    const fallbackDownloadName = hasExtension(fileName) ? fileName : `${fileName}.xlsx`;
    let lastError = null;

    if (window?.electronAPI?.readTemplateFile) {
        for (const candidate of candidates) {
            try {
                const result = await window.electronAPI.readTemplateFile(candidate);
                if (!result?.success) {
                    throw new Error(result?.error || "Failed to read template file");
                }

                const buffer = new Uint8Array(result.arrayBuffer);
                const blob = new Blob([buffer], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
                triggerDownload(blob, explicitDownloadName || candidate || fallbackDownloadName);
                return;
            } catch (err) {
                lastError = err;
            }
        }
    }

    for (const candidate of candidates) {
        try {
            const templatePath = `/${candidate}`;
            const response = await fetch(encodeURI(templatePath));
            if (!response.ok) {
                if (response.status === 404) {
                    lastError = new Error(`File ${candidate} not found`);
                    continue;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const headerName = extractFilenameFromDisposition(
                response.headers.get("content-disposition") || ""
            );
            triggerDownload(blob, explicitDownloadName || headerName || candidate || fallbackDownloadName);
            return;
        } catch (err) {
            lastError = err;
        }
    }

    throw (
        lastError ||
        new Error(
            "Template file not found. Please ensure the template exists in the public folder."
        )
    );
};
