const fs = require('fs');
const csv = require('csv-parser');

const filePath = './uploads/1763574598296-ipdr (1).csv';
let totalRows = 0;
let validRows = 0;
let invalidRows = 0;
const failureReasons = {};

// Helper to parse date
const parseDateTime = (dateStr) => {
    if (!dateStr) return null;
    const ddMMyyyyHHmmss = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/;
    const match = dateStr.match(ddMMyyyyHHmmss);
    if (match) {
        const [, day, month, year, hour, min, sec] = match;
        return new Date(year, month - 1, day, hour, min, sec);
    }
    return null;
};

// Helper to find column value
const findColumnValue = (row, possibleNames) => {
    for (const name of possibleNames) {
        for (const key in row) {
            if (key.toLowerCase().trim() === name.toLowerCase().trim()) {
                return row[key];
            }
        }
    }
    return null;
};

fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
        totalRows++;
        
        try {
            // Extract required fields
            const phoneNumber = findColumnValue(row, ['Landline/MSISDN/MDN/Leased Circuit ID for Internet Access', 'served_msisdn', 'msisdn']);
            const privateIP = findColumnValue(row, ['Source IP Address', 'served_ipv4_address', 'served_ipv6_address']);
            const publicIP = findColumnValue(row, ['Translated IP Address', 'pgw_address']);
            const imei = findColumnValue(row, ['Source MAC-ID Address/Other device Identification number', 'imei']);
            const imsi = findColumnValue(row, ['IMSI', 'served_imsi']);
            const originCellID = findColumnValue(row, ['First CELL ID', 'ecgi_id']);
            const startTime = findColumnValue(row, ['TIME1 (dd/MM/yyyy HH:mm:ss)', 'session_start']);
            
            const reasons = [];
            
            // Check required fields per schema
            if (!phoneNumber) reasons.push('Missing phoneNumber');
            if (!privateIP) reasons.push('Missing privateIP');
            if (!publicIP) reasons.push('Missing publicIP');
            if (!originCellID) reasons.push('Missing originCellID');
            if (!imei) reasons.push('Missing IMEI');
            if (!imsi) reasons.push('Missing IMSI');
            
            // Check IMEI length (must be exactly 15 digits after padding)
            if (imei) {
                const cleanIMEI = imei.toString().replace(/\D/g, '');
                if (cleanIMEI.length === 0) reasons.push('IMEI has no digits');
                // Note: Parser pads to 15, so this should pass
            }
            
            // Check IMSI length (must be exactly 15 digits after padding)
            if (imsi) {
                const cleanIMSI = imsi.toString().replace(/\D/g, '');
                if (cleanIMSI.length === 0) reasons.push('IMSI has no digits');
            }
            
            // Check startTime parsing
            const parsedStartTime = parseDateTime(startTime);
            if (!parsedStartTime || isNaN(parsedStartTime.getTime())) {
                reasons.push('Invalid startTime format');
            }
            
            if (reasons.length > 0) {
                invalidRows++;
                reasons.forEach(reason => {
                    failureReasons[reason] = (failureReasons[reason] || 0) + 1;
                });
                
                if (invalidRows <= 5) {
                    console.log(`\nInvalid Row ${totalRows}:`);
                    console.log(`  Reasons: ${reasons.join(', ')}`);
                    console.log(`  Phone: ${phoneNumber || 'NULL'}`);
                    console.log(`  Private IP: ${privateIP || 'NULL'}`);
                    console.log(`  Public IP: ${publicIP || 'NULL'}`);
                    console.log(`  IMEI: ${imei || 'NULL'}`);
                    console.log(`  IMSI: ${imsi || 'NULL'}`);
                    console.log(`  Cell ID: ${originCellID || 'NULL'}`);
                    console.log(`  Start Time: ${startTime || 'NULL'}`);
                }
            } else {
                validRows++;
            }
        } catch (error) {
            invalidRows++;
            failureReasons['Parse Error'] = (failureReasons['Parse Error'] || 0) + 1;
        }
    })
    .on('end', () => {
        console.log(`\n=== IPDR Parsing Analysis ===`);
        console.log(`Total rows: ${totalRows}`);
        console.log(`Valid rows: ${validRows}`);
        console.log(`Invalid rows: ${invalidRows}`);
        console.log(`\nFailure Reasons:`);
        Object.entries(failureReasons)
            .sort((a, b) => b[1] - a[1])
            .forEach(([reason, count]) => {
                console.log(`  ${reason}: ${count} records`);
            });
    });
