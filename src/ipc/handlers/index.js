const workerHandlers = require('./workerHandlers');

const authHandlers = require('./authHandlers');
const reportHandlers = require('./reportHandlers');
const healthHandlers = require('./healthHandlers');
const packageHandlers = require('./packageHandlers');

module.exports = {
    authHandlers,
    workerHandlers,
    reportHandlers,
    healthHandlers,
    packageHandlers
};
