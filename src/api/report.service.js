const httpClient = require("./httpClient");

const getMyReports = async ({ page = 1, limit = 20 }) => {
  return await httpClient.get("/report-lookup/mine", {
    params: { page, limit },
  });
};

const searchReports = async ({ q, page = 1, limit = 20, source = "ALL" }) => {
  return await httpClient.get("/report-lookup/search", {
    params: { q, page, limit, source },
  });
};


module.exports = { getMyReports, searchReports };

// ✅ add this line so default-import works in webpack
module.exports.default = module.exports;
