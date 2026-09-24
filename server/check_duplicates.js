const fs = require('fs');
const csv = require('csv-parser');

const filePath = './uploads/1763574598296-ipdr (1).csv';
const seenRecords = new Set();
let totalRows = 0;
let duplicates = 0;

fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
        totalRows++;
        
        // Create a unique key from critical fields
        const phoneKey = row['Landline/MSISDN/MDN/Leased Circuit ID for Internet Access'] || '';
        const timeKey = row['TIME1 (dd/MM/yyyy HH:mm:ss)'] || '';
        const destIPKey = row['Destination IP Address'] || '';
        const destPortKey = row['Destination Port'] || '';
        
        const uniqueKey = `${phoneKey}|${timeKey}|${destIPKey}|${destPortKey}`;
        
        if (seenRecords.has(uniqueKey)) {
            duplicates++;
        } else {
            seenRecords.add(uniqueKey);
        }
    })
    .on('end', () => {
        console.log(`\n=== IPDR File Analysis ===`);
        console.log(`Total rows in CSV: ${totalRows}`);
        console.log(`Unique records: ${seenRecords.size}`);
        console.log(`Duplicate records: ${duplicates}`);
        console.log(`\nDuplication rate: ${((duplicates / totalRows) * 100).toFixed(2)}%`);
    });
