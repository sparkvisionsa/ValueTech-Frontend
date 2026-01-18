const httpClient = require("./httpClient")

const registerUser = async (userData) => {
    const url = `/users/register`;
    return await httpClient.post(url, userData);
};

const getMyReports = async ({ page = 1, limit = 20 }) => {
  return await httpClient.get("/report-lookup/mine", {
    params: { page, limit },
  });
};


const lookupReportById = async (report_id) => {
  return await httpClient.get("/report-lookup/lookup", {
    params: { report_id },
  });
};

module.exports = {
    registerUser,
    getMyReports,
    lookupReportById
};


module.exports.default = module.exports;