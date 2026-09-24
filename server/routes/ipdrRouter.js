const express = require("express")
const ipdrController = require("./../controllers/ipdr.controller")
const utils = require("./../utils/utils")
const ipdrRouter = express.Router()

// Returns all records in the db
ipdrRouter.get('/getAllIPDRRecords',
    ipdrController.getAllIPDRRecords
)

// A route to add ipdr record registration
ipdrRouter.post('/addIPDRRecord',
    utils.initializeLocal,
    ipdrController.validateIPDRRecord,
    ipdrController.addIPDRRecord
)

// Getting a specific phone number's records
ipdrRouter.post('/getIPDRRecordsgivenNumber',
    ipdrController.getIPDRRecordsgivenNumber
)

// Getting all the records for a time duration with respect to a specific location
ipdrRouter.post('/getIPDRRecords',
    ipdrController.getIPDRRecords
)

//Gets list of 5 locations connected to location search string
ipdrRouter.post('/getIPDRLocationsList',
    ipdrController.getIPDRLocationsList
)

// Getting the latitude, longitude and country for a given location (address) in string form
ipdrRouter.post('/getIPDRLatLong',
    ipdrController.getIPDRLatLong
)

// Returns the month wise count of all IPDR records
ipdrRouter.get('/getStatistics',
    ipdrController.getStatistics
)

// New endpoints for advanced features
// Get all IPDR records (alias for getAllIPDRRecords)
ipdrRouter.get('/getAllRecords',
    ipdrController.getAllIPDRRecords
)

// Get port intelligence
ipdrRouter.post('/getPortIntelligence',
    ipdrController.getPortIntelligence
)

// Check IP quality (proxy for external API)
ipdrRouter.post('/checkIPQuality',
    ipdrController.checkIPQuality
)

// Get VoIP detection results
ipdrRouter.post('/getVoIPDetection',
    ipdrController.getVoIPDetection
)

// Delete all IPDR records
ipdrRouter.delete('/delete/all',
    ipdrController.deleteAllIPDRRecords
)

// Delete IPDR records by case number
ipdrRouter.delete('/delete/:caseNumber',
    ipdrController.deleteIPDRRecordsByCase
)

// ========== IPDR ANALYZER ROUTES ==========

// Analyze IPDR records and classify them
ipdrRouter.post('/analyze',
    ipdrController.analyzeIPDRRecords
)

// Correlate WhatsApp calls with bidirectional verification
ipdrRouter.post('/correlate-whatsapp',
    ipdrController.correlateWhatsAppCalls
)

// Correlate IPDR with CDR records
ipdrRouter.post('/correlate-with-cdr',
    ipdrController.correlateIPDRWithCDR
)

// Detect messaging patterns
ipdrRouter.post('/messaging-patterns',
    ipdrController.detectMessagingPatterns
)

module.exports = {
    ipdrRouter: ipdrRouter
}
