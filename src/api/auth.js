const httpClient = require("./httpClient")

const registerUser = async (userData) => {
    const url = `/users/register`;
    return await httpClient.post(url, userData);
};

module.exports = {
    registerUser
};
