const httpClient = require("./httpClient");

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

module.exports = { getMyReports, lookupReportById };

// ✅ add this line so default-import works in webpack
module.exports.default = module.exports;
