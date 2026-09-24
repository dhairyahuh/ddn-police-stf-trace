// Comprehensive CDR Data Verification Script
const mongoose = require('mongoose');
const {CDR} = require('./server/models/callDetails');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const db_name = "CDR_Visualizer";
const csvFile = path.join(__dirname, 'resources', '74578827_7.csv');

// Helper functions
const extractPhoneNumber = (phoneStr) => {
    if (!phoneStr) return '';
    const cleaned = phoneStr.toString().replace(/['"]/g, '').replace(/\s/g, '');
    const digits = cleaned.match(/\d/g);
    if (digits && digits.length >= 8) {
        const numDigits = digits.length;
        if (numDigits >= 10) {
            return digits.slice(-10).join('');
        } else {
            return digits.join('').padStart(10, '0');
        }
    }
    return cleaned.replace(/\D/g, '').padStart(10, '0').slice(-10);
};

const parseLatLong = (latLongStr) => {
    if (!latLongStr || latLongStr.trim() === '' || latLongStr === '-') {
        return { lat: null, long: null };
    }
    const parts = latLongStr.toString().split('/');
    if (parts.length === 2) {
        return {
            lat: parseFloat(parts[0].trim()),
            long: parseFloat(parts[1].trim())
        };
    }
    return { lat: null, long: null };
};

const parseDateTime = (dateStr, timeStr) => {
    try {
        const cleanDate = dateStr.toString().replace(/['"]/g, '').trim();
        const cleanTime = timeStr.toString().replace(/['"]/g, '').trim();
        const [day, month, year] = cleanDate.split('/');
        const [hours, minutes, seconds] = cleanTime.split(':');
        return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
    } catch (e) {
        return null;
    }
};

const cleanDeviceId = (idStr) => {
    if (!idStr) return '';
    return idStr.toString().replace(/['"]/g, '').trim();
};

// Connect to MongoDB
mongoose.connect(`mongodb://localhost:27017/${db_name}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB\n');
    console.log('='.repeat(60));
    console.log('CDR DATA VERIFICATION: CSV vs DATABASE');
    console.log('='.repeat(60));
    console.log('');
    
    // Read CSV file
    const fileContent = fs.readFileSync(csvFile, 'utf8');
    const lines = fileContent.split('\n');
    let headerLineIndex = -1;
    
    // Find header row
    for (let i = 0; i < Math.min(20, lines.length); i++) {
        if (lines[i].includes('Target No') && lines[i].includes('Date')) {
            headerLineIndex = i;
            break;
        }
    }
    
    if (headerLineIndex === -1) {
        console.error('❌ Could not find header row in CSV');
        process.exit(1);
    }
    
    const headerLine = lines[headerLineIndex];
    const isTabSeparated = headerLine.includes('\t');
    const separator = isTabSeparated ? '\t' : ',';
    const dataLines = lines.slice(headerLineIndex).join('\n');
    
    const { Readable } = require('stream');
    const dataStream = new Readable();
    dataStream.push(dataLines);
    dataStream.push(null);
    
    const csvRecords = [];
    let csvRowCount = 0;
    
    // Parse CSV
    dataStream
        .pipe(csv({ 
            skipEmptyLines: true, 
            skipLinesWithError: false,
            separator: separator,
            mapHeaders: ({ header }) => header.trim()
        }))
        .on('data', (row) => {
            csvRowCount++;
            if (csvRowCount === 1) {
                // Skip header row
                return;
            }
            
            const normalizeKey = (key) => {
                return Object.keys(row).find(k => 
                    k.trim().toLowerCase() === key.toLowerCase()
                ) || key;
            };
            
            const targetNo = row[normalizeKey('Target No')] || '';
            const dateField = row[normalizeKey('Date')] || '';
            
            if (!targetNo || !dateField || targetNo.trim() === '' || dateField.trim() === '' || 
                targetNo.toLowerCase().includes('target') || dateField.toLowerCase().includes('date')) {
                return;
            }
            
            // Parse CSV row
            const callerNumber = extractPhoneNumber(row[normalizeKey('Target No')] || '');
            const calledNumber = extractPhoneNumber(row[normalizeKey('B Party No')] || '');
            const dateFieldValue = row[normalizeKey('Date')] || '';
            const timeField = row[normalizeKey('Time')] || '';
            const startTime = parseDateTime(dateFieldValue, timeField);
            const durationStr = row[normalizeKey('Dur(s)')] || '0';
            const duration = parseInt(durationStr.toString().replace(/['"]/g, '')) || 0;
            const endTime = startTime ? new Date(startTime.getTime() + duration * 1000) : null;
            
            const firstCGILatLong = row[normalizeKey('First CGI Lat/Long')] || '';
            let lastCGILatLong = row[normalizeKey('Last CGI Lat/Long')] || '';
            if (!lastCGILatLong || lastCGILatLong.trim() === '' || lastCGILatLong === '---') {
                lastCGILatLong = firstCGILatLong;
            }
            const originLatLong = parseLatLong(firstCGILatLong);
            const destLatLong = parseLatLong(lastCGILatLong);
            
            const originCellID = (row[normalizeKey('First CGI')] || '').toString().trim();
            let destCellID = (row[normalizeKey('Last CGI')] || '').toString().trim();
            if (!destCellID || destCellID === '' || destCellID === '---') {
                destCellID = originCellID;
            }
            
            const callTypeRaw = (row[normalizeKey('Call Type')] || '').toString().trim().toUpperCase();
            const callType = callTypeRaw === 'IN' ? 'CALL-IN' : callTypeRaw === 'OUT' ? 'CALL-OUT' : 'CALL-IN';
            const imei = cleanDeviceId(row[normalizeKey('IMEI')] || '');
            const imsi = cleanDeviceId(row[normalizeKey('IMSI')] || '');
            
            // Only add valid records
            if (callerNumber && calledNumber && startTime && originCellID && destCellID &&
                imei && imei.length === 15 && imsi && imsi.length === 15 &&
                originLatLong.lat && originLatLong.long && destLatLong.lat && destLatLong.long) {
                
                const normalizedCallerNumber = callerNumber.padStart(10, '0').slice(-10);
                const normalizedCalledNumber = calledNumber.padStart(10, '0').slice(-10);
                
                csvRecords.push({
                    callerNumber: normalizedCallerNumber,
                    calledNumber: normalizedCalledNumber,
                    startTime: startTime,
                    endTime: endTime,
                    callDuration: duration,
                    originCellID: originCellID,
                    destCellID: destCellID,
                    originLatLong: originLatLong,
                    destLatLong: destLatLong,
                    callType: callType,
                    imei: imei,
                    imsi: imsi
                });
            }
        })
        .on('end', async () => {
            console.log(`📄 CSV Records Parsed: ${csvRecords.length}`);
            
            // Get database records
            const dbRecords = await CDR.find({});
            console.log(`💾 Database Records: ${dbRecords.length}`);
            console.log('');
            
            // Create a map of database records for quick lookup
            const dbMap = new Map();
            dbRecords.forEach(record => {
                const key = `${record.callerNumber}_${record.calledNumber}_${record.startTime.getTime()}`;
                dbMap.set(key, record);
            });
            
            // Compare records
            let matched = 0;
            let mismatched = 0;
            let missingInDB = 0;
            const mismatches = [];
            const missingRecords = [];
            
            console.log('🔍 Comparing records...\n');
            
            for (const csvRecord of csvRecords) {
                const key = `${csvRecord.callerNumber}_${csvRecord.calledNumber}_${csvRecord.startTime.getTime()}`;
                const dbRecord = dbMap.get(key);
                
                if (!dbRecord) {
                    missingInDB++;
                    if (missingRecords.length < 10) {
                        missingRecords.push({
                            caller: csvRecord.callerNumber,
                            called: csvRecord.calledNumber,
                            time: csvRecord.startTime.toISOString()
                        });
                    }
                    continue;
                }
                
                // Compare fields
                const differences = [];
                
                if (dbRecord.callerNumber !== csvRecord.callerNumber) {
                    differences.push(`callerNumber: DB=${dbRecord.callerNumber}, CSV=${csvRecord.callerNumber}`);
                }
                if (dbRecord.calledNumber !== csvRecord.calledNumber) {
                    differences.push(`calledNumber: DB=${dbRecord.calledNumber}, CSV=${csvRecord.calledNumber}`);
                }
                if (Math.abs(dbRecord.callDuration - csvRecord.callDuration) > 0) {
                    differences.push(`callDuration: DB=${dbRecord.callDuration}, CSV=${csvRecord.callDuration}`);
                }
                if (dbRecord.callType !== csvRecord.callType) {
                    differences.push(`callType: DB=${dbRecord.callType}, CSV=${csvRecord.callType}`);
                }
                if (dbRecord.originCellID !== csvRecord.originCellID) {
                    differences.push(`originCellID: DB=${dbRecord.originCellID}, CSV=${csvRecord.originCellID}`);
                }
                if (dbRecord.destCellID !== csvRecord.destCellID) {
                    differences.push(`destCellID: DB=${dbRecord.destCellID}, CSV=${csvRecord.destCellID}`);
                }
                
                // Compare coordinates (with small tolerance for floating point)
                const originLatDiff = Math.abs(parseFloat(dbRecord.originLatLong.lat) - csvRecord.originLatLong.lat);
                const originLongDiff = Math.abs(parseFloat(dbRecord.originLatLong.long) - csvRecord.originLatLong.long);
                if (originLatDiff > 0.00001 || originLongDiff > 0.00001) {
                    differences.push(`originLatLong: DB=${dbRecord.originLatLong.lat}/${dbRecord.originLatLong.long}, CSV=${csvRecord.originLatLong.lat}/${csvRecord.originLatLong.long}`);
                }
                
                const destLatDiff = Math.abs(parseFloat(dbRecord.destLatLong.lat) - csvRecord.destLatLong.lat);
                const destLongDiff = Math.abs(parseFloat(dbRecord.destLatLong.long) - csvRecord.destLatLong.long);
                if (destLatDiff > 0.00001 || destLongDiff > 0.00001) {
                    differences.push(`destLatLong: DB=${dbRecord.destLatLong.lat}/${dbRecord.destLatLong.long}, CSV=${csvRecord.destLatLong.lat}/${csvRecord.destLatLong.long}`);
                }
                
                if (dbRecord.imei !== csvRecord.imei) {
                    differences.push(`imei: DB=${dbRecord.imei}, CSV=${csvRecord.imei}`);
                }
                if (dbRecord.imsi !== csvRecord.imsi) {
                    differences.push(`imsi: DB=${dbRecord.imsi}, CSV=${csvRecord.imsi}`);
                }
                
                if (differences.length > 0) {
                    mismatched++;
                    if (mismatches.length < 10) {
                        mismatches.push({
                            caller: csvRecord.callerNumber,
                            called: csvRecord.calledNumber,
                            time: csvRecord.startTime.toISOString(),
                            differences: differences
                        });
                    }
                } else {
                    matched++;
                }
            }
            
            // Check for extra records in DB
            const csvMap = new Map();
            csvRecords.forEach(record => {
                const key = `${record.callerNumber}_${record.calledNumber}_${record.startTime.getTime()}`;
                csvMap.set(key, record);
            });
            
            let extraInDB = 0;
            const extraRecords = [];
            dbRecords.forEach(record => {
                const key = `${record.callerNumber}_${record.calledNumber}_${record.startTime.getTime()}`;
                if (!csvMap.has(key)) {
                    extraInDB++;
                    if (extraRecords.length < 10) {
                        extraRecords.push({
                            caller: record.callerNumber,
                            called: record.calledNumber,
                            time: record.startTime.toISOString()
                        });
                    }
                }
            });
            
            // Print results
            console.log('='.repeat(60));
            console.log('VERIFICATION RESULTS');
            console.log('='.repeat(60));
            console.log('');
            console.log(`✅ Matched Records:     ${matched}`);
            console.log(`❌ Mismatched Records:  ${mismatched}`);
            console.log(`⚠️  Missing in DB:       ${missingInDB}`);
            console.log(`➕ Extra in DB:          ${extraInDB}`);
            console.log('');
            console.log(`📊 Total CSV Records:    ${csvRecords.length}`);
            console.log(`📊 Total DB Records:     ${dbRecords.length}`);
            console.log(`📈 Match Rate:           ${((matched / csvRecords.length) * 100).toFixed(2)}%`);
            console.log('');
            
            if (mismatches.length > 0) {
                console.log('❌ MISMATCHES (first 10):');
                console.log('-'.repeat(60));
                mismatches.forEach((mismatch, idx) => {
                    console.log(`\n${idx + 1}. Caller: ${mismatch.caller}, Called: ${mismatch.called}, Time: ${mismatch.time}`);
                    mismatch.differences.forEach(diff => {
                        console.log(`   - ${diff}`);
                    });
                });
                console.log('');
            }
            
            if (missingRecords.length > 0) {
                console.log('⚠️  MISSING IN DATABASE (first 10):');
                console.log('-'.repeat(60));
                missingRecords.forEach((record, idx) => {
                    console.log(`${idx + 1}. Caller: ${record.caller}, Called: ${record.called}, Time: ${record.time}`);
                });
                console.log('');
            }
            
            if (extraRecords.length > 0) {
                console.log('➕ EXTRA IN DATABASE (first 10):');
                console.log('-'.repeat(60));
                extraRecords.forEach((record, idx) => {
                    console.log(`${idx + 1}. Caller: ${record.caller}, Called: ${record.called}, Time: ${record.time}`);
                });
                console.log('');
            }
            
            if (matched === csvRecords.length && missingInDB === 0 && extraInDB === 0 && mismatched === 0) {
                console.log('🎉 PERFECT MATCH! All CSV records match database records exactly!');
            }
            
            console.log('='.repeat(60));
            process.exit(0);
        });
});
