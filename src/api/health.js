const httpClient = require("./httpClient")

const getHealth = async () => {
    const url = `/health`;
    return await httpClient.get(url);
};

module.exports = {
    getHealth
};