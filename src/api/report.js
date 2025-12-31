const httpClient = require("./httpClient")

const uploadAssetDataToDatabase = async (reportId, reportData) => {
    const url = `/report/createReport`;
    return await httpClient.post(url, { reportId, reportData });
};

const createReportWithCommonFields = async (reportId, reportData, commonFields) => {
    const url = `/report/createReportWithCommonFields`;
    return await httpClient.post(url, { reportId, reportData, commonFields });
};

const updateUrgentReport = async (reportId, reportData) => {
    const url = `/report/updateUrgentReport`;
    return await httpClient.put(url, { reportId, reportData });
};

const getAllReports = async (options = {}) => {
    const url = `/report/getAllReports`;

    const {
        page = 1,
        limit = 10,
        ...filters
    } = options;

    console.log("page", page);

    const params = new URLSearchParams({
        page: page,
        limit: limit
    });

    Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
            params.append(key, filters[key]);
        }
    });

    const fullUrl = `${url}?${params.toString()}`;
    const response = await httpClient.get(fullUrl);

    return response.data;
};


const reportExistenceCheck = async (reportId) => {
    const url = `/report/reportExistenceCheck/${reportId}`;
    return await httpClient.get(url);
}

const addCommonFields = async (reportId, inspectionDate, region, city, ownerName) => {
    const url = '/report/addCommonFields';
    return await httpClient.put(url, { reportId, inspectionDate, region, city, ownerName });
}

const checkMissingPages = async (reportId) => {
    const url = `/report/checkMissingPages/${reportId}`;
    return await httpClient.get(url);
}

const uploadElrajhiBatch = async (validationExcelFile, validationPdfFiles) => {
    const formData = new FormData();

    // field name MUST match Multer config: 'excel'
    formData.append("excel", validationExcelFile);

    // field name MUST match Multer config: 'pdfs'
    (validationPdfFiles || []).forEach((file) => {
        formData.append("pdfs", file);
    });

    const response = await httpClient.post(
        "/elrajhi-upload",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );

    return response.data;
};

const multiExcelUpload = async (validationExcelFiles, validationPdfFiles) => {
    const formData = new FormData();
    validationExcelFiles.forEach((file) => {
        formData.append("excels", file);
    });
    validationPdfFiles.forEach((file) => {
        formData.append("pdfs", file);
    });

    const response = await httpClient.post(
        "/multi-approach",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );
    return response.data;
};

const fetchMultiApproachReports = async () => {
    const response = await httpClient.get("/multi-approach");
    return response.data;
};

const updateMultiApproachReport = async (reportId, payload) => {
    const response = await httpClient.patch(`/multi-approach/${reportId}`, payload);
    return response.data;
};

const deleteMultiApproachReport = async (reportId) => {
    const response = await httpClient.delete(`/multi-approach/${reportId}`);
    return response.data;
};

const updateMultiApproachAsset = async (reportId, assetIndex, payload) => {
    const response = await httpClient.patch(`/multi-approach/${reportId}/assets/${assetIndex}`, payload);
    return response.data;
};

const deleteMultiApproachAsset = async (reportId, assetIndex) => {
    const response = await httpClient.delete(`/multi-approach/${reportId}/assets/${assetIndex}`);
    return response.data;
};

const fetchLatestUserReport = async () => {
    const url = `/duplicate-report/latest`;
    const response = await httpClient.get(url);
    return response.data;
};

const createDuplicateReport = async (payload) => {
    const url = `/duplicate-report`;
    const response = await httpClient.post(url, payload, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
}

const fetchDuplicateReports = async () => {
    const response = await httpClient.get("/duplicate-report");
    return response.data;
};

const updateDuplicateReport = async (reportId, payload) => {
    const response = await httpClient.patch(`/duplicate-report/${reportId}`, payload);
    return response.data;
};

const deleteDuplicateReport = async (reportId) => {
    const response = await httpClient.delete(`/duplicate-report/${reportId}`);
    return response.data;
};

const updateDuplicateReportAsset = async (reportId, assetIndex, payload) => {
    const response = await httpClient.patch(`/duplicate-report/${reportId}/assets/${assetIndex}`, payload);
    return response.data;
};

const deleteDuplicateReportAsset = async (reportId, assetIndex) => {
    const response = await httpClient.delete(`/duplicate-report/${reportId}/assets/${assetIndex}`);
    return response.data;
};

const fetchElrajhiBatches = async () => {
    const response = await httpClient.get("/elrajhi-upload/batches");
    return response.data;
};

const fetchElrajhiBatchReports = async (batchId) => {
    const response = await httpClient.get(`/elrajhi-upload/batches/${batchId}/reports`);
    return response.data;
};

const createManualMultiApproachReport = async (payload) => {
    const response = await httpClient.post("/multi-approach/manual", payload);
    return response.data;
};


module.exports = {
    uploadAssetDataToDatabase,
    createReportWithCommonFields,
    reportExistenceCheck,
    addCommonFields,
    checkMissingPages,
    uploadElrajhiBatch,
    multiExcelUpload,
    getAllReports,
    fetchLatestUserReport,
    createDuplicateReport,
    fetchDuplicateReports,
    updateDuplicateReport,
    deleteDuplicateReport,
    updateDuplicateReportAsset,
    deleteDuplicateReportAsset,
    updateUrgentReport,
    fetchElrajhiBatches,
    fetchElrajhiBatchReports,
    createManualMultiApproachReport,
    fetchMultiApproachReports,
    updateMultiApproachReport,
    deleteMultiApproachReport,
    updateMultiApproachAsset,
    deleteMultiApproachAsset
};
