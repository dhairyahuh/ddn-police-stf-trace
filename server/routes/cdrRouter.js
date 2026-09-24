const express = require("express")
const cdrController = require("./../controllers/cdr.controller")
const utils = require("./../utils/utils")
const cdrRouter = express.Router()

// Returns all records in the db
cdrRouter.get('/getAllRecords',
    cdrController.getAllRecords
)

// A route to add cdr record registration
cdrRouter.post('/addRecord',
    utils.initializeLocal,
    cdrController.validateRecord,
    cdrController.addRecord
)

// Getting a specific phone number's records
cdrRouter.post('/getCallerRecords',
    cdrController.getCallerRecords
)

// Getting all the records for a time duration with respect to a specific location
cdrRouter.post('/getRecords',
    cdrController.getRecords
)

// Getting the adjacency list for given phone numbers
cdrRouter.post('/getAdjacency',
    cdrController.getAdjacency
)

//Gets list of 5 locations connected to location search string
cdrRouter.post('/getLocationsList',
    cdrController.getLocationsList
)

// Getting the latitude, longitude and country for a given location (address) in string form
cdrRouter.post('/getLatLong',
    cdrController.getLatLong
)

// Getting the logs between 2 callers
cdrRouter.post('/getLogs',
    cdrController.getLogs
)

// Getting the number of calls for each month
cdrRouter.get('/getStatistics',
    cdrController.getStatistics
)

// Getting the heatmap locations
cdrRouter.post('/getHeatmapLocations',
    cdrController.getHeatmapLocations
)
// Getting the number of calls for a single user for each month
cdrRouter.post('/getSinglePhoneStatistics',
    cdrController.getSinglePhoneStatistics
)

// New endpoints for advanced features
// Get movement data for phone number
cdrRouter.post('/getMovementData',
    cdrController.getMovementData
)

// Get SIM swap detection results
cdrRouter.post('/getSIMSwapDetection',
    cdrController.getSIMSwapDetection
)

// Get call pattern anomalies
cdrRouter.post('/getCallPatternAnomalies',
    cdrController.getCallPatternAnomalies
)

// Get calendar activity
cdrRouter.post('/getCalendarActivity',
    cdrController.getCalendarActivity
)

// Get unique target numbers grouped by case
cdrRouter.get('/getUniqueTargets',
    cdrController.getUniqueTargets
)

// Get filtered CDR records by case/number
cdrRouter.get('/getFilteredRecords',
    cdrController.getFilteredRecords
)

// Delete all CDR records
cdrRouter.delete('/delete/all',
    cdrController.deleteAllRecords
)

// Delete CDR records by case number
cdrRouter.delete('/delete/:caseNumber',
    cdrController.deleteRecordsByCase
)

module.exports = {
    cdrRouter: cdrRouter
}
