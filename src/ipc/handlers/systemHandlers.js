const os = require('os');

const systemHandlers = {
    async handleReadRam() {
        try {
            const total = os.totalmem(); // bytes
            const free = os.freemem();
            const used = total - free;
            const toGb = (bytes) => Number((bytes / (1024 ** 3)).toFixed(2));
            const toMb = (bytes) => Number((bytes / (1024 ** 2)).toFixed(2));

            return {
                ok: true,
                totalGb: toGb(total),
                usedGb: toGb(used),
                freeGb: toGb(free),
                freeMb: toMb(free),
            };
        } catch (error) {
            console.error('[MAIN] Failed to read RAM stats:', error);
            return {
                ok: false,
                error: error?.message || 'Unable to read RAM'
            };
        }
    }
};

module.exports = systemHandlers;
