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



module.exports = {
    uploadAssetDataToDatabase,
    reportExistenceCheck,
    addCommonFields,
    checkMissingPages,
    uploadElrajhiBatch
};