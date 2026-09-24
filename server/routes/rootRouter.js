const express = require('express')
const rootRouter = express.Router()
const rootController = require("./../controllers/root.controller")
const breachController = require("./../controllers/breach.controller")

rootRouter.get('/',
    rootController.backendTest
)

rootRouter.get('/test',
    rootController.logServerDetails
)

rootRouter.get('/db-status',
    rootController.checkDbStatus
)

// Phone profiling endpoints
rootRouter.post('/phone-profiling',
    rootController.getPhoneProfiling
)

rootRouter.get('/phone-profiling',
    rootController.getPhoneProfiling
)

// Email profiling endpoints
rootRouter.post('/email-profiling',
    rootController.getEmailProfiling
)

rootRouter.get('/email-profiling',
    rootController.getEmailProfiling
)

// Breach intelligence endpoints (read-only)
rootRouter.get('/profiling/breach-search',
    breachController.searchBreach
)

rootRouter.get('/profiling/breach-stats',
    breachController.getBreachStats
)

module.exports = {
    rootRouter: rootRouter
};
