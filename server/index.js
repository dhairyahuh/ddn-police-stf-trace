const express = require("express")
const fs = require('fs');

function logDebug(msg) {
    try {
        fs.appendFileSync('server_debug.log', new Date().toISOString() + ': ' + msg + '\n');
    } catch (e) { console.error(e); }
}

logDebug('Index.js execution started');
const mongoose = require("mongoose")
const bodyParser = require("body-parser")
const app = express()
const env = require("./utils/env")
const { rootRouter } = require("./routes/rootRouter")
const { ipdrRouter } = require("./routes/ipdrRouter")
const { cdrRouter } = require("./routes/cdrRouter")
const { noteRouter } = require("./routes/noteRouter")
const { profileRouter } = require("./routes/profileRouter")
const { caseRouter } = require("./routes/caseRouter")
const cors = require('cors')
const multer = require('multer')
const csv = require('csv-parser')

const { Transform } = require('stream')
const { CDR } = require("./models/callDetails")
const { IPDR } = require("./models/ipDetails")
const { Profile } = require("./models/profileDetails.js")

// Connecting to the database
const mongoUri = env.mongo_uri || `mongodb://127.0.0.1:27017/${env.db_name}`;
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
    serverSelectionTimeoutMS: 5000
});
const db = mongoose.connection
db.on("error", console.error.bind(console, "Connection error"))
db.once("open", () => {
    console.log("Successfully connected to the db")
})

app.use(cors())
// To support JSON encoded bodies urls
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
    extended: true
}))

let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
})

let upload = multer({ storage: storage }).single('file')


app.post('/cdr/uploadCSV', function (req, res) {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json({ message: "File upload error", error: err.message })
        } else if (err) {
            return res.status(500).json({ message: "File upload error", error: err.message })
        }

        // Get case number from request body
        const caseNumber = req.body.caseNumber;

        // Validate case number is provided
        if (!caseNumber) {
            return res.status(400).json({
                message: "Case number is required. Please select a case before uploading CDR data.",
                error: "Missing caseNumber"
            });
        }

        let recordCount = 0;
        let errorCount = 0;
        let validationPassCount = 0;
        let validationFailCount = 0;
        let isFirstRow = true; // Skip the header row itself
        let savePromises = []; // Collect all database save promises

        try {
            // Read entire file to find header row and process
            const fileContent = fs.readFileSync(req.file.path, 'utf8');
            const allLines = fileContent.split('\n');
            let headerLineIndex = -1;

            // Find the line that contains "Target No" and "Date" - that's our header row
            for (let i = 0; i < Math.min(20, allLines.length); i++) {
                if (allLines[i].includes('Target No') && allLines[i].includes('Date')) {
                    headerLineIndex = i;
                    break;
                }
            }

            if (headerLineIndex === -1) {
                return res.status(400).json({ message: "Could not find header row in CSV file. Expected columns: Target No, Date" });
            }

            // Determine separator from header line
            const headerLine = allLines[headerLineIndex];
            const isTabSeparated = headerLine.includes('\t');
            const separator = isTabSeparated ? '\t' : ',';

            // Extract data lines (header + data rows)
            const dataLines = allLines.slice(headerLineIndex).join('\n');

            // Create a readable stream from the data
            const { Readable } = require('stream');
            const dataStream = new Readable();
            dataStream.push(dataLines);
            dataStream.push(null); // End the stream

            let rowIndex = 0;  // Add row counter

            dataStream
                .pipe(csv({
                    skipEmptyLines: true,
                    skipLinesWithError: false,
                    separator: separator,
                    mapHeaders: ({ header }) => header.trim()  // Trim whitespace from headers
                }))
                .on('data', (row) => {
                    try {
                        rowIndex++; // Increment row counter
                        // Skip metadata rows and detect the actual header row
                        const rowKeys = Object.keys(row);
                        const rowValues = Object.values(row);

                        // Comprehensive CDR column detection for multiple carriers
                        const cdrColumnPatterns = [
                            // Phone number patterns
                            'calling party', 'called party', 'caller', 'called', 'target', 'a party', 'b party',
                            'msisdn', 'source', 'destination', 'originating', 'terminating', 'from', 'to',
                            'subscriber', 'mobile', 'number', 'phone',

                            // Date/time patterns  
                            'call date', 'date', 'time', 'start', 'end', 'timestamp', 'call time',
                            'date time', 'call start', 'call end', 'duration',

                            // Location patterns
                            'cell', 'tower', 'location', 'lat', 'long', 'coordinates', 'position',
                            'cgi', 'lac', 'site', 'sector', 'base station',

                            // Call type patterns
                            'call type', 'service', 'type', 'direction', 'in', 'out', 'sms', 'voice', 'data',

                            // Device patterns
                            'imei', 'imsi', 'device', 'equipment'
                        ];

                        const hasCDRColumns = rowKeys.some(key =>
                            cdrColumnPatterns.some(pattern =>
                                key.toLowerCase().includes(pattern.toLowerCase())
                            )
                        );

                        // Skip if this row doesn't have CDR structure
                        if (!hasCDRColumns) {
                            console.log('Skipping metadata row:', rowKeys.slice(0, 3));
                            return;
                        }

                        // Log detected column names and carrier format for debugging (only first time)
                        if (recordCount === 0 && validationPassCount === 0 && validationFailCount === 0) {
                            console.log('Detected CDR columns:', rowKeys);
                            console.log('Sample row object:', row);

                            // Try to detect carrier/format
                            const allColumns = rowKeys.join(' ').toLowerCase();
                            let carrierHint = 'Unknown';

                            if (allColumns.includes('calling party telephone number')) {
                                carrierHint = 'Standard Telecom Format';
                            } else if (allColumns.includes('target no')) {
                                carrierHint = 'LEA/Investigation Format';
                            } else if (allColumns.includes('msisdn')) {
                                carrierHint = 'GSM/3GPP Format';
                            } else if (allColumns.includes('source') && allColumns.includes('destination')) {
                                carrierHint = 'Network Equipment Format';
                            }

                            console.log(`Detected carrier format: ${carrierHint}`);
                            console.log('Sample row values:', Object.values(row).slice(0, 5));
                        }

                        // Universal column mapping function for different carrier formats
                        const findColumnValue = (row, patterns) => {
                            for (const pattern of patterns) {
                                const key = Object.keys(row).find(k => {
                                    const cleanKey = k.toLowerCase().trim().replace(/[\s_-]/g, '');
                                    const cleanPattern = pattern.toLowerCase().replace(/[\s_-]/g, '');
                                    return cleanKey.includes(cleanPattern) ||
                                        cleanKey === cleanPattern ||
                                        k.toLowerCase().trim() === pattern.toLowerCase();
                                });
                                if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') {
                                    return row[key];
                                }
                            }
                            return '';
                        };

                        // Add debug field extraction after findColumnValue is defined
                        if (rowIndex < 5) {
                            console.log('CallerNumber extraction test:', row['Target No'], findColumnValue(row, ['target no']));
                            console.log('CalledNumber extraction test:', row['B Party No'], findColumnValue(row, ['b party no']));
                        }

                        // Skip the header row itself when it appears as data
                        if (isFirstRow) {
                            isFirstRow = false;
                            // Check if this is actually the header row (first value contains header-like text)
                            const firstValue = rowValues[0] || '';
                            if (firstValue.toString().toLowerCase().includes('target') ||
                                firstValue.toString().toLowerCase().includes('calling')) {
                                return; // This is the header row appearing as data, skip it
                            }
                        }



                        // Normalize row keys (remove trailing tabs/spaces and handle case)
                        const normalizeKey = (key) => {
                            return Object.keys(row).find(k =>
                                k.trim().toLowerCase() === key.toLowerCase()
                            ) || key;
                        };

                        // Check if this looks like a data row (has Target No or Date field)
                        const targetNoKey = normalizeKey('Target No');
                        const dateKey = normalizeKey('Date');
                        const targetNo = row[targetNoKey] || '';
                        const dateField = row[dateKey] || '';

                        // Skip rows that are clearly headers or empty
                        if (!targetNo || !dateField || targetNo.trim() === '' || dateField.trim() === '' ||
                            targetNo.toLowerCase().includes('target') || dateField.toLowerCase().includes('date')) {
                            return;
                        }

                        // Enhanced phone number extraction for multiple carrier formats
                        const extractPhoneNumber = (phoneStr) => {
                            if (!phoneStr) return '';
                            const cleaned = phoneStr.toString().replace(/['"]/g, '').replace(/\s/g, '').replace(/[-()]/g, '');

                            // If it looks like a service code (contains letters), return as-is for SMS
                            if (/[A-Za-z]/.test(cleaned)) {
                                return cleaned;
                            }

                            // Extract digits for phone numbers (accept 3+ digits for service codes)
                            const digits = cleaned.match(/\d/g);
                            if (!digits || digits.length < 3) return '';

                            const allDigits = digits.join('');

                            // Handle different international and carrier formats
                            if (allDigits.length >= 12) {
                                // International format like 917XXXXXXXXX or 919XXXXXXXXX
                                if (allDigits.startsWith('91')) {
                                    return allDigits.slice(2, 12); // Extract Indian number (10 digits)
                                } else if (allDigits.startsWith('1')) {
                                    return allDigits.slice(1, 11); // Extract US number (10 digits)
                                } else {
                                    return allDigits.slice(-10); // Take last 10 digits
                                }
                            } else if (allDigits.length === 11) {
                                // Format like 09XXXXXXXXX or 07XXXXXXXX
                                if (allDigits.startsWith('0')) {
                                    return allDigits.slice(1); // Remove leading 0
                                } else {
                                    return allDigits.slice(-10);
                                }
                            } else if (allDigits.length === 10) {
                                return allDigits; // Perfect 10-digit number
                            } else if (allDigits.length >= 8) {
                                // 8-9 digit numbers - return as-is
                                return allDigits;
                            } else if (allDigits.length >= 3) {
                                // Accept any 3-7 digit number as-is (service codes, short codes)
                                return allDigits;
                            }

                            return allDigits || cleaned;
                        };

                        // Enhanced lat/long parsing for multiple coordinate formats
                        const parseLatLong = (latLongStr) => {
                            if (!latLongStr || latLongStr.trim() === '' || latLongStr === '-' || latLongStr === 'N/A') {
                                return { lat: null, long: null };
                            }

                            const cleaned = latLongStr.toString().replace(/['"]/g, '').trim();

                            // Try different separators: /, |, ,, ;, space
                            const separators = ['/', '|', ',', ';', ' '];
                            for (const sep of separators) {
                                if (cleaned.includes(sep)) {
                                    const parts = cleaned.split(sep);
                                    if (parts.length >= 2) {
                                        const lat = parseFloat(parts[0].trim());
                                        const long = parseFloat(parts[1].trim());
                                        if (!isNaN(lat) && !isNaN(long)) {
                                            return { lat, long };
                                        }
                                    }
                                }
                            }

                            // Try to extract coordinates from patterns like "Lat: 28.123 Long: 77.456"
                            const latMatch = cleaned.match(/lat[:\s]*([0-9.-]+)/i);
                            const longMatch = cleaned.match(/long?[:\s]*([0-9.-]+)/i);
                            if (latMatch && longMatch) {
                                const lat = parseFloat(latMatch[1]);
                                const long = parseFloat(longMatch[1]);
                                if (!isNaN(lat) && !isNaN(long)) {
                                    return { lat, long };
                                }
                            }

                            return { lat: null, long: null };
                        };

                        // Helper function to clean IMEI/IMSI (remove quotes)
                        const cleanDeviceId = (idStr) => {
                            if (!idStr) return '';
                            return idStr.toString().replace(/['"]/g, '').trim();
                        };

                        // Enhanced datetime parsing for multiple carrier formats
                        const parseDateTime = (dateStr, timeStr) => {
                            try {
                                const cleanDate = dateStr.toString().replace(/['"]/g, '').trim();
                                const cleanTime = timeStr.toString().replace(/['"]/g, '').trim();

                                // If no time provided, extract from date if it contains time
                                let finalDate = cleanDate;
                                let finalTime = cleanTime;

                                if (!cleanTime && cleanDate.includes(' ')) {
                                    const parts = cleanDate.split(' ');
                                    finalDate = parts[0];
                                    finalTime = parts[1] || '';
                                }

                                // Handle various date formats
                                const dateFormats = [
                                    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
                                    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
                                    /(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY or MM-DD-YYYY
                                    /(\d{2})(\d{2})(\d{4})/, // DDMMYYYY or MMDDYYYY
                                ];

                                let year, month, day;
                                let matched = false;

                                for (const format of dateFormats) {
                                    const match = finalDate.match(format);
                                    if (match) {
                                        matched = true;
                                        if (format.source.includes('(\\d{4})-(\\d{1,2})-(\\d{1,2})')) {
                                            // YYYY-MM-DD format
                                            [, year, month, day] = match;
                                        } else {
                                            // For other formats, detect MM/DD vs DD/MM
                                            const part1 = parseInt(match[1]);
                                            const part2 = parseInt(match[2]);
                                            const part3 = parseInt(match[3]);

                                            if (part3 > 1000) {
                                                // Third part is year
                                                year = part3;
                                                if (part1 > 12) {
                                                    day = part1; month = part2; // DD/MM
                                                } else if (part2 > 12) {
                                                    month = part1; day = part2; // MM/DD
                                                } else {
                                                    // Ambiguous - use MM/DD for telecom
                                                    month = part1; day = part2;
                                                }
                                            } else {
                                                // First part might be year (YYYY)
                                                year = part1; month = part2; day = part3;
                                            }
                                        }
                                        break;
                                    }
                                }

                                if (!matched) {
                                    console.warn('Could not parse date format:', finalDate);
                                    return new Date();
                                }

                                // Parse time
                                const timeParts = finalTime.split(':');
                                const hours = parseInt(timeParts[0]) || 0;
                                const minutes = parseInt(timeParts[1]) || 0;
                                const seconds = parseInt(timeParts[2]) || 0;

                                // Create date in UTC
                                const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
                                return date;
                            } catch (e) {
                                console.error('Error parsing datetime:', dateStr, timeStr, e);
                                return new Date();
                            }
                        };

                        // Universal field extraction using pattern matching
                        // Direct extraction for caller number
                        const targetValue = row['Target No'] || Object.values(row)[0] || '';
                        const callerNumber = extractPhoneNumber(targetValue);

                        // Direct extraction with debugging
                        const bPartyValue = row['B Party No'] || Object.values(row)[3] || '';
                        console.log('B Party extraction debug:', {
                            'B Party No direct': row['B Party No'],
                            'Position 3': Object.values(row)[3],
                            'Final value': bPartyValue,
                            'All row values': Object.values(row).slice(0, 6)
                        });

                        const calledNumber = extractPhoneNumber(bPartyValue);

                        const callTypeRaw = findColumnValue(row, [
                            'call type', 'service type', 'type', 'direction', 'call direction',
                            'traffic type', 'service', 'call category'
                        ]).toString().trim().toUpperCase();

                        // Enhanced call type mapping for multiple carrier formats
                        let callType;
                        const callTypeUpper = callTypeRaw.toUpperCase();

                        // Incoming call patterns
                        if (['IN', 'INCOMING', 'CALL_IN', 'CALL-IN', 'A_IN', 'V_IN', 'INBOUND', 'RECEIVED', 'MT', 'MTC'].includes(callTypeUpper)) {
                            callType = 'CALL-IN';
                        }
                        // Outgoing call patterns  
                        else if (['OUT', 'OUTGOING', 'CALL_OUT', 'CALL-OUT', 'A_OUT', 'V_OUT', 'OUTBOUND', 'MADE', 'MO', 'MOC'].includes(callTypeUpper)) {
                            callType = 'CALL-OUT';
                        }
                        // SMS patterns
                        else if (['SMS', 'SMT', 'SMO', 'SMS_IN', 'SMS_OUT', 'SMS_MT', 'SMS_MO', 'MESSAGE', 'TEXT', 'SHORT_MESSAGE'].includes(callTypeUpper)) {
                            callType = 'SMS';
                        }
                        // Data patterns
                        else if (['DATA', 'GPRS', 'INTERNET', 'DATA_SESSION', 'PDP', 'PACKET'].includes(callTypeUpper)) {
                            callType = 'DATA';
                        }
                        // Default fallback
                        else {
                            // Try to detect from other indicators
                            const allRowText = Object.values(row).join(' ').toUpperCase();
                            if (allRowText.includes('SMS') || allRowText.includes('MESSAGE')) {
                                callType = 'SMS';
                            } else if (allRowText.includes('DATA') || allRowText.includes('INTERNET')) {
                                callType = 'DATA';
                            } else {
                                callType = 'CALL-IN'; // safe default
                            }
                        }

                        // Universal location field parsing
                        const originLocationStr = findColumnValue(row, [
                            'first cgi lat/long', 'origin lat/long', 'source location', 'start location',
                            'first location', 'origin coordinates', 'source coordinates', 'caller location',
                            'start lat/long', 'origin position', 'first cell location'
                        ]);

                        const destLocationStr = findColumnValue(row, [
                            'last cgi lat/long', 'dest lat/long', 'destination location', 'end location',
                            'last location', 'dest coordinates', 'destination coordinates', 'called location',
                            'end lat/long', 'dest position', 'last cell location'
                        ]);

                        let originLatLong = parseLatLong(originLocationStr);
                        let destLatLong = parseLatLong(destLocationStr);

                        // Fallback strategies for missing location data
                        if ((!originLatLong.lat || !originLatLong.long || isNaN(originLatLong.lat) || isNaN(originLatLong.long)) && destLocationStr) {
                            originLatLong = parseLatLong(destLocationStr);
                        }

                        if ((!destLatLong.lat || !destLatLong.long || isNaN(destLatLong.lat) || isNaN(destLatLong.long)) && originLocationStr) {
                            destLatLong = parseLatLong(originLocationStr);
                        }

                        // If still no location data, try to generate from cell IDs (implement cell ID to location lookup if needed)
                        if ((!originLatLong.lat || !originLatLong.long) && (!destLatLong.lat || !destLatLong.long)) {
                            // For now, set default location (could be enhanced with cell tower database)
                            originLatLong = { lat: 28.6139, long: 77.2090 }; // Delhi default
                            destLatLong = { lat: 28.6139, long: 77.2090 };
                        }

                        // Universal date/time field extraction
                        const dateFieldValue = findColumnValue(row, [
                            'call date', 'date', 'start date', 'event date', 'timestamp date',
                            'call start date', 'transaction date', 'record date'
                        ]);

                        const timeField = findColumnValue(row, [
                            'call time', 'time', 'start time', 'event time', 'timestamp time',
                            'call start time', 'transaction time', 'record time'
                        ]);

                        // Try to handle combined date-time fields
                        const dateTimeField = findColumnValue(row, [
                            'datetime', 'timestamp', 'call datetime', 'start datetime', 'event datetime'
                        ]);

                        let startTime;
                        if (dateTimeField && !dateFieldValue && !timeField) {
                            // Handle combined datetime field
                            startTime = new Date(dateTimeField);
                            if (isNaN(startTime.getTime())) {
                                startTime = parseDateTime(dateTimeField.split(' ')[0] || '', dateTimeField.split(' ')[1] || '');
                            }
                        } else {
                            startTime = parseDateTime(dateFieldValue, timeField);
                        }

                        // Universal duration field extraction
                        const durationStr = findColumnValue(row, [
                            'call duration', 'duration', 'dur(s)', 'dur', 'call length', 'length',
                            'call time', 'elapsed time', 'session duration', 'talk time'
                        ]);

                        // Enhanced duration parsing - handle different formats (seconds, mm:ss, hh:mm:ss)
                        let duration = 0;
                        if (durationStr) {
                            const cleanDuration = durationStr.toString().replace(/['"]/g, '').trim();
                            if (cleanDuration.includes(':')) {
                                // Handle mm:ss or hh:mm:ss format
                                const parts = cleanDuration.split(':');
                                if (parts.length === 2) {
                                    duration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                                } else if (parts.length === 3) {
                                    duration = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                                }
                            } else {
                                duration = parseInt(cleanDuration);
                            }
                            if (isNaN(duration) || duration < 0) {
                                duration = 0;
                            }
                        }
                        const endTime = new Date(startTime.getTime() + duration * 1000);

                        // Universal cell ID extraction
                        let originCellID = findColumnValue(row, [
                            'first cell id', 'origin cell id', 'source cell id', 'start cell id', 'first cgi',
                            'origin cgi', 'source cgi', 'caller cell id', 'first tower', 'origin tower'
                        ]).toString().trim();

                        let destCellID = findColumnValue(row, [
                            'last cell id', 'dest cell id', 'destination cell id', 'end cell id', 'last cgi',
                            'dest cgi', 'destination cgi', 'called cell id', 'last tower', 'dest tower'
                        ]).toString().trim();

                        // Clean up malformed cell IDs (like "404-97--")
                        const cleanCellID = (cellId) => {
                            if (!cellId || cellId === '' || cellId === '---' || cellId.endsWith('--')) {
                                return '';
                            }
                            return cellId;
                        };

                        originCellID = cleanCellID(originCellID);
                        destCellID = cleanCellID(destCellID);

                        // If origin is empty, try to use dest
                        if (!originCellID && destCellID) {
                            originCellID = destCellID;
                        }

                        // If dest is empty, use origin as fallback
                        if (!destCellID && originCellID) {
                            destCellID = originCellID;
                        }

                        // If both are still empty, generate a placeholder
                        if (!originCellID) {
                            originCellID = 'UNKNOWN-CELL';
                        }
                        if (!destCellID) {
                            destCellID = originCellID;
                        }

                        // Universal device ID extraction
                        const imei = cleanDeviceId(findColumnValue(row, [
                            'imei', 'equipment id', 'device id', 'terminal id', 'mobile equipment id',
                            'handset id', 'equipment identifier', 'mobile station id'
                        ]));

                        const imsi = cleanDeviceId(findColumnValue(row, [
                            'imsi', 'subscriber id', 'international mobile subscriber identity',
                            'mobile subscriber id', 'sim id', 'subscriber identity'
                        ]));

                        // Debug extracted values before validation
                        console.log('Extracted values debug:', {
                            callerNumber,
                            calledNumber,
                            callType,
                            callTypeRaw
                        });

                        // Validate required fields (relaxed validation for multi-carrier support)
                        const validationErrors = [];

                        // Accept caller numbers with 5+ digits (service codes can be short)
                        if (!callerNumber || callerNumber.length < 5) {
                            validationErrors.push(`Invalid callerNumber: ${callerNumber}`);
                        }
                        // Handle SMS records with service codes and voice calls differently
                        const serviceType = (findColumnValue(row, ['service type', 'type']) || '').toString().trim().toUpperCase();
                        if (callType === 'SMS' || callType === 'SMS-IN' || callType === 'SMS-OUT') {
                            // For SMS, B Party can be service codes like "56321", "52263", so be more lenient
                            if (!calledNumber || calledNumber.trim() === '') {
                                validationErrors.push(`Missing calledNumber for SMS`);
                            }
                            // Accept any non-empty called number for SMS
                        } else {
                            // For voice calls, accept phone numbers with minimum 5 digits (some carriers use shorter codes)
                            if (!calledNumber || calledNumber.length < 5) {
                                validationErrors.push(`Invalid calledNumber: ${calledNumber}`);
                            }
                        }
                        if (!originCellID || originCellID.trim() === '') {
                            validationErrors.push(`Missing originCellID`);
                        }
                        if (!destCellID || destCellID.trim() === '') {
                            validationErrors.push(`Missing destCellID`);
                        }
                        // More lenient IMEI/IMSI validation - allow 10-20 digits to accommodate all carrier formats
                        if (!imei || imei.length < 10 || imei.length > 20) {
                            validationErrors.push(`Invalid IMEI: ${imei} (length: ${imei ? imei.length : 0})`);
                        }
                        if (!imsi || imsi.length < 10 || imsi.length > 20) {
                            validationErrors.push(`Invalid IMSI: ${imsi} (length: ${imsi ? imsi.length : 0})`);
                        }
                        // If we still don't have valid origin coordinates, use default location (Delhi)
                        if (!originLatLong.lat || !originLatLong.long || isNaN(originLatLong.lat) || isNaN(originLatLong.long)) {
                            console.warn(`Using default location for record with missing originLatLong: ${originLocationStr}`);
                            originLatLong = { lat: 28.7041, long: 77.1025 }; // Default to Delhi coordinates
                        }

                        // If we still don't have valid dest coordinates, use origin coordinates
                        if (!destLatLong.lat || !destLatLong.long || isNaN(destLatLong.lat) || isNaN(destLatLong.long)) {
                            destLatLong = { lat: originLatLong.lat, long: originLatLong.long };
                        }

                        if (validationErrors.length > 0) {
                            validationFailCount++;
                            // Log detailed errors for debugging
                            if (errorCount < 10) {
                                console.warn(`Row ${recordCount + 1} validation errors:`, validationErrors.join(', '), {
                                    callerNumber: `"${callerNumber}"`,
                                    calledNumber: `"${calledNumber}"`,
                                    originCellID: `"${originCellID}"`,
                                    destCellID: `"${destCellID}"`,
                                    imei: `"${imei}" (len: ${imei?.length})`,
                                    imsi: `"${imsi}" (len: ${imsi?.length})`,
                                    serviceType,
                                    callTypeRaw,
                                    originLocationStr: `"${originLocationStr}"`,
                                    destLocationStr: `"${destLocationStr}"`,
                                    originLatLong,
                                    destLatLong
                                });
                            }
                            errorCount++;
                            return;
                        }

                        // Record passed validation
                        validationPassCount++;

                        // Normalize phone numbers - preserve original length, just clean them
                        const normalizedCallerNumber = callerNumber.replace(/\D/g, '').slice(-15) || callerNumber;
                        // For SMS service codes, don't modify; for phone numbers, clean digits
                        const normalizedCalledNumber = /[A-Za-z]/.test(calledNumber) ? calledNumber : (calledNumber.replace(/\D/g, '').slice(-15) || calledNumber);

                        // Build the data object matching the schema
                        const cdrData = {
                            caseNumber: caseNumber, // Add case number from upload
                            callerNumber: normalizedCallerNumber,
                            calledNumber: normalizedCalledNumber,
                            startTime: startTime,
                            endTime: endTime,
                            callDuration: duration,
                            originCellID: originCellID,
                            destCellID: destCellID,
                            originLatLong: {
                                lat: originLatLong.lat,
                                long: originLatLong.long
                            },
                            destLatLong: {
                                lat: destLatLong.lat,
                                long: destLatLong.long
                            },
                            callType: callType,
                            imei: imei,
                            imsi: imsi,
                            connectionType: row[normalizeKey('Connection Type')] || '',
                            accessType: row[normalizeKey('Access Type')] || '4G',
                            networkCircle: findColumnValue(row, ['lrn tsp-lsa', 'lrn tsp lsa', 'network circle', 'operator']) || ''
                        };

                        // Save to database using promises
                        const savePromise = CDR.findOneAndUpdate(
                            {
                                callerNumber: cdrData.callerNumber,
                                calledNumber: cdrData.calledNumber,
                                startTime: cdrData.startTime,
                                callDuration: cdrData.callDuration
                            },
                            cdrData,
                            { upsert: true, useFindAndModify: false }
                        ).exec()
                            .then(() => {
                                recordCount++;
                            })
                            .catch((err) => {
                                console.error('Error saving CDR record:', err);
                                errorCount++;
                            });

                        savePromises.push(savePromise);

                    } catch (error) {
                        console.error('Error processing CDR row:', error, row);
                        errorCount++;
                    }
                })
                .on('end', async () => {
                    // Wait for all database operations to complete
                    await Promise.all(savePromises);

                    console.log(`CDR CSV file processed: ${recordCount} records added, ${errorCount} errors`);
                    console.log(`Validation stats: ${validationPassCount} records passed validation, ${validationFailCount} failed`);
                    return res.status(200).json({
                        message: 'CDR file processed successfully',
                        recordsAdded: recordCount,
                        errors: errorCount,
                        validationPassed: validationPassCount,
                        validationFailed: validationFailCount
                    });
                })
                .on('error', (error) => {
                    console.error('Error reading CSV file:', error);
                    if (!res.headersSent) {
                        return res.status(500).json({ message: "Error processing CSV file", error: error.message, stack: error.stack });
                    }
                });

        } catch (uploadError) {
            console.error('Error in upload handler:', uploadError);
            if (!res.headersSent) {
                return res.status(500).json({
                    message: "Error processing upload",
                    error: uploadError.message,
                    stack: uploadError.stack
                });
            }
        }
    }); // Close upload callback
});

app.post('/profile/uploadCSV', function (req, res) {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err)
        } else if (err) {
            return res.status(500).json(err)
        }
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (row) => {

                data = row
                Profile.findOneAndUpdate({ phoneNumber: data.phoneNumber }, data, { upsert: true, useFindAndModify: false }, function () {

                })
            })
            .on('end', () => {
                console.log('CSV file successfully processed and records added');
            });
        return res.status(200).send(req.file)
    })

});

app.post('/ipdr/uploadCSV', function (req, res) {
    // Check MongoDB connection first
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: "Database not connected. Please try again in a moment.",
            code: 503
        });
    }

    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err);
        } else if (err) {
            return res.status(500).json(err);
        }

        // Check if caseNumber is provided
        const caseNumber = req.body.caseNumber;
        if (!caseNumber) {
            return res.status(400).json({
                message: "Case number is required. Please select a case before uploading IPDR file.",
                code: 400
            });
        }

        // Use the new intelligent IPDR parser
        const { parseIPDRCSV } = require('./utils/ipdrParser');

        parseIPDRCSV(req.file.path, caseNumber, (err, result) => {
            if (err) {
                console.error('Error processing IPDR CSV:', err);
                return res.status(500).json({
                    message: "Error processing IPDR file",
                    error: err.message,
                    stack: err.stack
                });
            }

            return res.status(200).json({
                message: 'IPDR file processed successfully with intelligent analysis',
                recordsAdded: result.recordsAdded,
                errors: result.errors,
                file: req.file
            });
        });
    });
});

// Connecting all routers
app.use('/', rootRouter);
app.use("/api/cdr", cdrRouter);
app.use("/api/ipdr", ipdrRouter);
// Add new intelligent IPDR routes
const { ipdrRouter: ipdrRouterNew } = require("./routes/ipdrRouter.new");
app.use("/api/ipdr/v2", ipdrRouterNew);
// Add WhatsApp correlation routes
const correlationRouter = require("./routes/correlationRouter");
app.use("/api/correlation", correlationRouter);
app.use("/api/note", noteRouter)
app.use("/api/profile", profileRouter)
app.use("/api/case", caseRouter)

// Movement reconstruction endpoint
app.get('/api/analytics/movement/:phoneNumber', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        const { startDate, endDate } = req.query;

        const query = { callerNumber: phoneNumber };
        if (startDate && endDate) {
            query.startTime = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const records = await CDR.find(query)
            .sort({ startTime: 1 })
            .select('startTime originLatLong destLatLong originCellID destCellID callerNumber imei')
            .lean();

        // Process movement data
        const movements = [];
        for (let i = 0; i < records.length - 1; i++) {
            const current = records[i];
            const next = records[i + 1];

            if (current.originLatLong && next.originLatLong) {
                const timeDiff = (next.startTime - current.startTime) / (1000 * 60); // minutes
                const distance = calculateDistance(
                    current.originLatLong.lat, current.originLatLong.long,
                    next.originLatLong.lat, next.originLatLong.long
                );
                const speed = distance / (timeDiff / 60); // km/h

                movements.push({
                    from: {
                        lat: current.originLatLong.lat,
                        lng: current.originLatLong.long,
                        timestamp: current.startTime,
                        cellId: current.originCellID
                    },
                    to: {
                        lat: next.originLatLong.lat,
                        lng: next.originLatLong.long,
                        timestamp: next.startTime,
                        cellId: next.originCellID
                    },
                    distance: distance,
                    speed: speed,
                    confidence: speed <= 150 ? 'high' : speed <= 300 ? 'medium' : 'low'
                });
            }
        }

        res.json({ movements, totalRecords: records.length });
    } catch (error) {
        console.error('Movement reconstruction error:', error);
        res.status(500).json({ error: error.message });
    }
});

// SIM swap detection endpoint
app.get('/api/analytics/simswap/:phoneNumber', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;

        const records = await CDR.find({ callerNumber: phoneNumber })
            .sort({ startTime: 1 })
            .select('startTime imei originLatLong calledNumber callDuration')
            .lean();

        const imeiChanges = [];
        let currentImei = null;
        let imeiStartTime = null;

        for (const record of records) {
            if (record.imei && record.imei !== currentImei) {
                if (currentImei) {
                    const timeSinceLastChange = (record.startTime - imeiStartTime) / (1000 * 60 * 60); // hours

                    let riskLevel = 'info';
                    if (timeSinceLastChange < 24) riskLevel = 'critical';
                    else if (timeSinceLastChange < 168) riskLevel = 'warning'; // 7 days

                    imeiChanges.push({
                        oldImei: currentImei,
                        newImei: record.imei,
                        changeTime: record.startTime,
                        hoursSinceLastChange: timeSinceLastChange,
                        riskLevel: riskLevel
                    });
                }
                currentImei = record.imei;
                imeiStartTime = record.startTime;
            }
        }

        res.json({ imeiChanges, totalRecords: records.length });
    } catch (error) {
        console.error('SIM swap detection error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Call pattern anomaly detection
app.get('/api/analytics/patterns/:phoneNumber', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;

        const records = await CDR.find({ callerNumber: phoneNumber })
            .sort({ startTime: 1 })
            .lean();

        // Analyze call patterns
        const hourlyDistribution = new Array(24).fill(0);
        const dailyCallCounts = {};
        const calledNumberStats = {};
        const anomalies = [];

        records.forEach(record => {
            const hour = new Date(record.startTime).getHours();
            const date = new Date(record.startTime).toDateString();

            hourlyDistribution[hour]++;
            dailyCallCounts[date] = (dailyCallCounts[date] || 0) + 1;

            // Track called numbers
            if (record.calledNumber && record.calledNumber.length >= 8) {
                if (!calledNumberStats[record.calledNumber]) {
                    calledNumberStats[record.calledNumber] = {
                        totalCalls: 0,
                        totalDuration: 0,
                        firstCall: record.startTime,
                        lastCall: record.startTime,
                        hourlyDistribution: new Array(24).fill(0)
                    };
                }

                const stats = calledNumberStats[record.calledNumber];
                stats.totalCalls++;
                stats.totalDuration += record.callDuration || 0;
                stats.lastCall = record.startTime;
                stats.hourlyDistribution[hour]++;

                // Check for unusual hours (2 AM - 5 AM)
                if (hour >= 2 && hour <= 5) {
                    anomalies.push({
                        type: 'unusual_hour',
                        timestamp: record.startTime,
                        description: `Call at ${hour}:00 - unusual hour`,
                        severity: 'medium'
                    });
                }
            }
        });

        // Calculate most called numbers
        const mostCalledNumbers = Object.entries(calledNumberStats)
            .sort((a, b) => b[1].totalCalls - a[1].totalCalls)
            .slice(0, 10)
            .map(([number, stats]) => ({
                number,
                ...stats,
                avgCallDuration: stats.totalDuration / stats.totalCalls
            }));

        res.json({
            hourlyDistribution,
            dailyCallCounts,
            mostCalledNumbers,
            anomalies,
            totalRecords: records.length
        });
    } catch (error) {
        console.error('Pattern analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Port intelligence endpoint
app.get('/api/analytics/ports', async (req, res) => {
    try {
        const records = await IPDR.find({})
            .select('sourcePort destPort protocol sourceIP destIP timestamp')
            .lean();

        const portDatabase = {
            80: { name: "HTTP", risk: "low", category: "Web" },
            443: { name: "HTTPS", risk: "low", category: "Secure Web" },
            22: { name: "SSH", risk: "medium", category: "Remote Access" },
            3389: { name: "RDP", risk: "high", category: "Remote Desktop" },
            4444: { name: "Metasploit", risk: "critical", category: "Potential Backdoor" },
            21: { name: "FTP", risk: "medium", category: "File Transfer" },
            23: { name: "Telnet", risk: "high", category: "Remote Access" },
            25: { name: "SMTP", risk: "low", category: "Email" },
            53: { name: "DNS", risk: "low", category: "Name Resolution" },
            110: { name: "POP3", risk: "low", category: "Email" },
            143: { name: "IMAP", risk: "low", category: "Email" },
            993: { name: "IMAPS", risk: "low", category: "Secure Email" },
            995: { name: "POP3S", risk: "low", category: "Secure Email" },
            1433: { name: "SQL Server", risk: "high", category: "Database" },
            3306: { name: "MySQL", risk: "high", category: "Database" },
            5432: { name: "PostgreSQL", risk: "high", category: "Database" },
            6379: { name: "Redis", risk: "medium", category: "Database" },
            8080: { name: "HTTP Alt", risk: "low", category: "Web" },
            8443: { name: "HTTPS Alt", risk: "low", category: "Secure Web" },
            9999: { name: "Unknown Service", risk: "critical", category: "Unknown" }
        };

        const portStats = {};
        const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 };

        records.forEach(record => {
            const port = record.destPort;
            const portInfo = portDatabase[port] || {
                name: "Unknown",
                risk: "unknown",
                category: "Unknown"
            };

            if (!portStats[port]) {
                portStats[port] = {
                    port: port,
                    count: 0,
                    ...portInfo
                };
            }

            portStats[port].count++;
            riskDistribution[portInfo.risk]++;
        });

        const sortedPorts = Object.values(portStats)
            .sort((a, b) => b.count - a.count);

        res.json({
            portStats: sortedPorts,
            riskDistribution,
            totalConnections: records.length
        });
    } catch (error) {
        console.error('Port intelligence error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// IMEI Information Lookup Proxy Endpoint
// Proxies requests to external IMEI API to avoid CORS issues
app.get('/imei-info/:imei', async (req, res) => {
    try {
        const imei = req.params.imei;

        // Validate IMEI format (should be 15 digits)
        if (!imei || !/^\d{15}$/.test(imei)) {
            return res.status(400).json({
                error: 'Invalid IMEI format. IMEI must be 15 digits.',
                imei: imei
            });
        }

        const apiUrl = `https://lmnx9.appletolha.com/imei/info.php?imei=${imei}`;

        https.get(apiUrl, (apiRes) => {
            let data = '';

            apiRes.on('data', (chunk) => {
                data += chunk;
            });

            apiRes.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    res.status(200).json(response);
                } catch (error) {
                    console.error('Error parsing IMEI API response:', error);
                    res.status(500).json({
                        error: 'Failed to parse IMEI information',
                        details: error.message
                    });
                }
            });
        }).on('error', (error) => {
            console.error('Error calling IMEI API:', error);
            res.status(500).json({
                error: 'Failed to fetch IMEI information',
                details: error.message
            });
        });

    } catch (error) {
        console.error('Error in IMEI lookup endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Starting the server - wait for MongoDB connection
logDebug('Waiting for MongoDB connection...');
db.once("open", () => {
    logDebug('MongoDB Open event received');
    app.listen(env.port, () => {
        console.log(`Backend is running on port ${env.port}!`);
        console.log(`MongoDB connected to database: ${env.db_name}`);
        logDebug(`Server listening on port ${env.port}`);
    });
});

db.on("error", (err) => {
    console.error("DB Error:", err);
    logDebug("DB Connection Error: " + err);
});

