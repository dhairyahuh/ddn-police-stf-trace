const mongoose = require('mongoose');
const { parseIPDRCSV } = require('./utils/ipdrParser');
const env = require('./utils/env');

console.log('Testing IPDR parser with latest uploaded file...\n');

// Connect to MongoDB first
mongoose.connect(`mongodb://localhost:27017/${env.db_name}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB\n');
    
    const filePath = './uploads/1763577864611-ipdr (1).csv';
    const caseNumber = '2025-UT-000001';
    
    parseIPDRCSV(filePath, caseNumber, (error, result) => {
        if (error) {
            console.error('ERROR:', error);
            process.exit(1);
        } else {
            console.log('\n=== PARSING COMPLETE ===');
            console.log('Records added:', result.recordsAdded);
            console.log('Errors:', result.errors);
            process.exit(0);
        }
    });
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
