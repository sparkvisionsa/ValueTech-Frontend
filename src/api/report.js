const httpClient = require("./httpClient")

const uploadAssetDataToDatabase = async (reportId, reportData) => {
    const url = `/report/createReport`;
    return await httpClient.post(url, { reportId, reportData });
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

const fetchElrajhiBatches = async () => {
    const response = await httpClient.get("/elrajhi-upload/batches");
    return response.data;
};

const fetchElrajhiBatchReports = async (batchId) => {
    const response = await httpClient.get(`/elrajhi-upload/batches/${batchId}/reports`);
    return response.data;
};


module.exports = {
    uploadAssetDataToDatabase,
    reportExistenceCheck,
    addCommonFields,
    checkMissingPages,
    uploadElrajhiBatch,
    multiExcelUpload,
    fetchLatestUserReport,
    createDuplicateReport,
    fetchElrajhiBatches,
    fetchElrajhiBatchReports
};
