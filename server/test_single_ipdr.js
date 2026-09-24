const mongoose = require('mongoose');
const { IPDR } = require('./models/ipDetails');
const env = require('./utils/env');

const testRecord = {
    "caseNumber": "2025-UT-000001",
    "phoneNumber": "9191032334",
    "privateIP": "2409:40d5:103c:953d:8000:0000:0000:0000",
    "privatePort": 41155,
    "publicIP": "157.48.8.108",
    "publicPort": 41155,
    "destIP": "49.44.255.161",
    "destPort": 3478,
    "protocol": "IP",
    "startTime": "2025-09-14T09:58:06.000Z",
    "endTime": "2025-09-14T09:59:51.000Z",
    "uplinkVolume": 43529,
    "downlinkVolume": 80428,
    "totalVolume": 123957,
    "imei": "000000086084514",
    "imsi": "000000405860000",
    "originCellID": "405860005c630",
    "accessType": "4G",
    "roamingIndicator": null,
    "roamingCircle": null,
    "duration": 105,
    "originLatLong": {
        "lat": 28.7041,
        "long": 77.1025
    }
};

mongoose.connect(`mongodb://localhost:27017/${env.db_name}`).then(async () => {
    console.log('Testing single record insertion...\n');
    
    try {
        const doc = new IPDR(testRecord);
        const validation = doc.validateSync();
        
        if (validation) {
            console.log('VALIDATION ERRORS:');
            Object.keys(validation.errors).forEach(key => {
                console.log(`  ${key}:`, validation.errors[key].message);
            });
        } else {
            console.log('No validation errors - attempting save...');
            const saved = await doc.save();
            console.log('Successfully saved! ID:', saved._id);
        }
    } catch (err) {
        console.error('Error:', err.message);
        if (err.errors) {
            console.log('\nValidation errors:');
            Object.keys(err.errors).forEach(key => {
                console.log(`  ${key}:`, err.errors[key].message);
            });
        }
    }
    
    process.exit(0);
}).catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
});
