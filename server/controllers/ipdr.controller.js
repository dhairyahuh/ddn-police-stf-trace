const { CustomError } = require("../utils/utils")
const { IPDR } = require("./../models/ipDetails")
const { CDR } = require("./../models/callDetails")
//const {Notes} = require("./../models/noteDetails")
const { calculateDistance } = require("./../utils/utils")
const nodeGeocoder = require('node-geocoder')
const { 
    analyzeIPDRRecord, 
    correlateWhatsAppCalls, 
    correlateIPDRWithCDR,
    detectMessagingPatterns 
} = require('./../utils/ipdrAnalyzer')

// Return all the CDR Records
let getAllIPDRRecords = async (req, res) => {
    let records = await IPDR.find({})
    return res.json(records);
}

// Returns the number of IPDR records each month
let getStatistics = async (req, res) => {
    // Getting the current year
    let currentDate = new Date(Date.now())
    let currentYear = currentDate.getFullYear()

    // Getting the number of records for each month
    let allRecords = await IPDR.find({})
    let monthCounts = []
    for (let i = 1; i <= 12; ++i) {
        monthCounts.push(0)
    }

    for (let record of allRecords) {
        let startTime = record.startTime
        let month = startTime.getMonth()
        let year = startTime.getFullYear()
        if (year == currentYear) {
            monthCounts[month - 1] += 1
        }
    }

    return res.json({
        ipdrCounts: monthCounts,
        code: 200
    })
}

// Checks if the call data record is valid 
let validateIPDRRecord = async (req, res, next) => {
    let ipdrRecord = req.body

    try {
        if (!ipdrRecord) {
            return res.status(400).send({
                message: "No ipdr data received",
                code: 400
            })
        }

        // Validating all required fields
        let required_fields = ["privateIP", "privatePort", "publicIP", "publicPort", "destIP", "destPort", "phoneNumber", "startTime", "endTime", "uplinkVolume", "downlinkVolume", "totalVolume", "imei", "imsi", "originLatLong", "accessType"]

        // Checking whether fields exist
        for (let req_field of required_fields) {
            if (!ipdrRecord.hasOwnProperty(req_field)) {
                let error_msg = "Didn't receive the property " + req_field
                return res.json({
                    message: error_msg,
                    code: 400
                })
            }
        }

        req.locals.record = ipdrRecord
        return next()
    } catch (err) {
        res.json({
            message: "Error trying to validate cdr record",
            error: err,
            code: 500
        })
        return new CustomError(err)
    }
}

// Returning the records for one phone number
let getIPDRRecordsgivenNumber = async (req, res) => {
    // Get the specific user id
    let phoneNumber = req.body.phoneNumber
    if (!phoneNumber) {
        return res.json({
            message: "No phone number received",
            code: 200
        })
    }

    let IPDetails = await IPDR.find({ phoneNumber: phoneNumber });

    return res.json({
        message: IPDetails,
        code: 200
    });
}

// Adds the new call data record
let addIPDRRecord = async (req, res) => {
    let IPRecord = req.locals.record
    let startTime = new Date(IPRecord.startTime)
    IPRecord.startTime = startTime
    let endTime = new Date(IPRecord.endTime)
    IPRecord.endTime = endTime
    IPDR.findOneAndUpdate(IPRecord, IPRecord, { upsert: true, useFindAndModify: false }, function () {

    })
    return res.json({
        message: "Record successfully added",
        code: 201
    });
}

// Get all records within a given time duration and location range
let getIPDRRecords = async (req, res) => {
    let refTime = new Date(req.body.refTime)
    let duration = req.body.duration
    let location = req.body.location
    let radius = req.body.radius ? req.body.radius : 5

    if (!refTime || !duration || !location) {
        return res.json({
            message: "Missing atleast one of the required fields : refTime, duration, location",
            code: 404
        })
    }

    let startTimeReq = new Date(refTime.getTime())
    let endTimeReq = new Date(refTime.getTime())

    // Setting startTime as refTime - duration and endTime as refTime + duration
    startTimeReq.setMinutes(refTime.getMinutes() - duration)
    endTimeReq.setMinutes(refTime.getMinutes() + duration)

    // Getting all records between start time and end time
    let records = await IPDR.find({ startTime: { $gte: startTimeReq, $lte: endTimeReq } })

    // Getting all the records within a radius of radius from location
    let refLat = location.lat
    let refLong = location.long
    let ans = []
    for (let record of records) {
        let destLat = record.originLatLong.lat
        let destLong = record.originLatLong.long
        let distance = calculateDistance(refLat, refLong, destLat, destLong)
        if (distance <= radius) {
            ans.push(record)
        }
    }

    return res.json({
        message: ans,
        code: 200
    })
}

let getIPDRLatLong = async (req, res) => {
    location = req.body.data
    let options = {
        provider: 'openstreetmap'
    };
    let geoCoder = nodeGeocoder(options);
    const result = (await geoCoder.geocode(location))[0]

    return res.json({
        message: { "latitude": result.latitude, "longitude": result.longitude, "country": result.country },
        code: 200
    })
}

let getIPDRLocationsList = async (req, res) => {
    location = req.body.data
    let options = {
        provider: 'openstreetmap'
    };
    let geoCoder = nodeGeocoder(options);
    const result = await geoCoder.geocode(location)
    return res.json({
        message: result.map(a => a.formattedAddress).slice(0, 5),
        code: 200
    })
}

// New controller methods for advanced features
// Get port intelligence - returns records for processing on frontend
let getPortIntelligence = async (req, res) => {
    let filters = req.body || {}
    let query = {}

    if (filters.phoneNumber) {
        let phoneNumber = filters.phoneNumber.replace(/^91/, '').replace(/^\+91/, '')
        query.phoneNumber = { $in: [phoneNumber, `91${phoneNumber}`] }
    }

    let records = await IPDR.find(query)
    return res.json(records)
}

// Check IP quality - proxy for external API (actual checking done on frontend)
let checkIPQuality = async (req, res) => {
    // This is a placeholder - actual IP quality checking is done on frontend
    // using the IPQualityScore API directly to avoid exposing API keys
    return res.json({
        message: "IP quality checking should be done on frontend with API key",
        code: 200
    })
}

// Get VoIP detection - returns records for processing on frontend
let getVoIPDetection = async (req, res) => {
    let filters = req.body || {}
    let query = {}

    if (filters.phoneNumber) {
        let phoneNumber = filters.phoneNumber.replace(/^91/, '').replace(/^\+91/, '')
        query.phoneNumber = { $in: [phoneNumber, `91${phoneNumber}`] }
    }

    let records = await IPDR.find(query)
    return res.json(records)
}

// Delete all IPDR records
let deleteAllIPDRRecords = async (req, res) => {
    try {
        await IPDR.deleteMany({});
        return res.json({
            message: "All IPDR records deleted successfully",
            code: 200
        });
    } catch (err) {
        return res.status(500).json({
            message: "Error deleting IPDR records",
            error: err.message,
            code: 500
        });
    }
}

// Delete IPDR records by case number
let deleteIPDRRecordsByCase = async (req, res) => {
    let caseNumber = req.params.caseNumber;
    if (!caseNumber) {
        return res.status(400).json({
            message: "Case number is required",
            code: 400
        });
    }

    try {
        const result = await IPDR.deleteMany({ caseNumber: caseNumber });
        return res.json({
            message: `Deleted ${result.deletedCount} records for case ${caseNumber}`,
            deletedCount: result.deletedCount,
            code: 200
        });
    } catch (err) {
        return res.status(500).json({
            message: "Error deleting IPDR records",
            error: err.message,
            code: 500
        });
    }
}

// ========== IPDR ANALYZER INTEGRATION ==========

/**
 * Analyze IPDR records and classify them (WhatsApp, Telegram, VPN, etc.)
 * POST /api/ipdr/analyze
 * Body: { phoneNumber?: string } - optional filter by phone number
 */
let analyzeIPDRRecords = async (req, res) => {
    try {
        let filters = req.body || {}
        let query = {}

        if (filters.phoneNumber) {
            let phoneNumber = filters.phoneNumber.replace(/^91/, '').replace(/^\+91/, '')
            query.phoneNumber = { $in: [phoneNumber, `91${phoneNumber}`] }
        }

        let records = await IPDR.find(query)
        
        if (records.length === 0) {
            return res.json({
                message: "No IPDR records found",
                analyzed: [],
                code: 200
            })
        }

        // Analyze each record
        const analyzed = records.map(record => {
            const recordObj = record.toObject()
            const analysis = analyzeIPDRRecord({
                destPort: recordObj.publicPort || recordObj.destPort,
                destIP: recordObj.publicIP || recordObj.destIP,
                protocol: recordObj.protocol,
                uplinkVolume: recordObj.uplinkVolume,
                downlinkVolume: recordObj.downlinkVolume,
                duration: recordObj.duration
            })
            
            return {
                ...recordObj,
                analysis
            }
        })

        return res.json({
            message: "IPDR analysis complete",
            analyzed,
            totalRecords: analyzed.length,
            code: 200
        })
    } catch (err) {
        console.error('Error analyzing IPDR:', err)
        return res.status(500).json({
            message: "Error analyzing IPDR records",
            error: err.message,
            code: 500
        })
    }
}

/**
 * Correlate WhatsApp calls between two parties using bidirectional verification
 * POST /api/ipdr/correlate-whatsapp
 * Body: { phoneNumber1?: string, phoneNumber2?: string }
 */
let correlateWhatsAppCallsEndpoint = async (req, res) => {
    try {
        let { phoneNumber1, phoneNumber2 } = req.body || {}
        
        // Get all IPDR records (or filtered by phone numbers)
        let query = {}
        if (phoneNumber1 || phoneNumber2) {
            let numbers = []
            if (phoneNumber1) {
                let num1 = phoneNumber1.replace(/^91/, '').replace(/^\+91/, '')
                numbers.push(num1, `91${num1}`)
            }
            if (phoneNumber2) {
                let num2 = phoneNumber2.replace(/^91/, '').replace(/^\+91/, '')
                numbers.push(num2, `91${num2}`)
            }
            query.phoneNumber = { $in: numbers }
        }

        let ipdrRecords = await IPDR.find(query)
        
        if (ipdrRecords.length === 0) {
            return res.json({
                message: "No IPDR records found",
                correlatedCalls: [],
                individualActivity: [],
                code: 200
            })
        }

        // Convert to plain objects
        const recordsArray = ipdrRecords.map(r => r.toObject())
        
        // Perform correlation
        const correlation = correlateWhatsAppCalls(recordsArray)

        return res.json({
            message: "WhatsApp call correlation complete",
            correlatedCalls: correlation.correlatedCalls,
            individualActivity: correlation.individualActivity,
            uniqueIMSIs: correlation.uniqueIMSIs,
            totalIPDRRecords: recordsArray.length,
            code: 200
        })
    } catch (err) {
        console.error('Error correlating WhatsApp calls:', err)
        return res.status(500).json({
            message: "Error correlating WhatsApp calls",
            error: err.message,
            code: 500
        })
    }
}

/**
 * Correlate IPDR with CDR records to match phone calls with data sessions
 * POST /api/ipdr/correlate-with-cdr
 * Body: { phoneNumber?: string }
 */
let correlateIPDRWithCDREndpoint = async (req, res) => {
    try {
        let filters = req.body || {}
        let query = {}

        if (filters.phoneNumber) {
            let phoneNumber = filters.phoneNumber.replace(/^91/, '').replace(/^\+91/, '')
            query.$or = [
                { phoneNumber: phoneNumber },
                { phoneNumber: `91${phoneNumber}` },
                { callerNumber: phoneNumber },
                { callerNumber: `91${phoneNumber}` },
                { calledNumber: phoneNumber },
                { calledNumber: `91${phoneNumber}` }
            ]
        }

        let ipdrRecords = await IPDR.find(filters.phoneNumber ? { 
            phoneNumber: { $in: [
                filters.phoneNumber.replace(/^91/, '').replace(/^\+91/, ''),
                `91${filters.phoneNumber.replace(/^91/, '').replace(/^\+91/, '')}`
            ]}
        } : {})
        
        let cdrRecords = await CDR.find(query)

        if (ipdrRecords.length === 0 || cdrRecords.length === 0) {
            return res.json({
                message: ipdrRecords.length === 0 ? "No IPDR records found" : "No CDR records found",
                matches: [],
                code: 200
            })
        }

        // Convert to plain objects
        const ipdrArray = ipdrRecords.map(r => r.toObject())
        const cdrArray = cdrRecords.map(r => r.toObject())

        // Perform correlation
        const matches = correlateIPDRWithCDR(ipdrArray, cdrArray)

        return res.json({
            message: "IPDR-CDR correlation complete",
            matches,
            totalIPDR: ipdrArray.length,
            totalCDR: cdrArray.length,
            matchedCalls: matches.length,
            code: 200
        })
    } catch (err) {
        console.error('Error correlating IPDR with CDR:', err)
        return res.status(500).json({
            message: "Error correlating IPDR with CDR",
            error: err.message,
            code: 500
        })
    }
}

/**
 * Detect messaging patterns across IPDR data
 * POST /api/ipdr/messaging-patterns
 * Body: { phoneNumber?: string }
 */
let detectMessagingPatternsEndpoint = async (req, res) => {
    try {
        let filters = req.body || {}
        let query = {}

        if (filters.phoneNumber) {
            let phoneNumber = filters.phoneNumber.replace(/^91/, '').replace(/^\+91/, '')
            query.phoneNumber = { $in: [phoneNumber, `91${phoneNumber}`] }
        }

        let records = await IPDR.find(query)
        
        if (records.length === 0) {
            return res.json({
                message: "No IPDR records found",
                patterns: [],
                code: 200
            })
        }

        // Convert to plain objects
        const recordsArray = records.map(r => r.toObject())
        
        // Detect patterns
        const patterns = detectMessagingPatterns(recordsArray)

        return res.json({
            message: "Messaging pattern detection complete",
            patterns,
            totalRecords: recordsArray.length,
            code: 200
        })
    } catch (err) {
        console.error('Error detecting messaging patterns:', err)
        return res.status(500).json({
            message: "Error detecting messaging patterns",
            error: err.message,
            code: 500
        })
    }
}

module.exports = {
    validateIPDRRecord: validateIPDRRecord,
    getAllIPDRRecords: getAllIPDRRecords,
    getIPDRRecordsgivenNumber: getIPDRRecordsgivenNumber,
    addIPDRRecord: addIPDRRecord,
    getIPDRRecords: getIPDRRecords,
    getIPDRLocationsList: getIPDRLocationsList,
    getIPDRLatLong: getIPDRLatLong,
    getStatistics: getStatistics,
    getPortIntelligence: getPortIntelligence,
    checkIPQuality: checkIPQuality,
    getVoIPDetection: getVoIPDetection,
    deleteAllIPDRRecords: deleteAllIPDRRecords,
    deleteIPDRRecordsByCase: deleteIPDRRecordsByCase,
    // IPDR Analyzer endpoints
    analyzeIPDRRecords: analyzeIPDRRecords,
    correlateWhatsAppCalls: correlateWhatsAppCallsEndpoint,
    correlateIPDRWithCDR: correlateIPDRWithCDREndpoint,
    detectMessagingPatterns: detectMessagingPatternsEndpoint
}
