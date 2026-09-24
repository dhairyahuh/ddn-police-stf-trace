const mongoose = require('mongoose');
const { CDR } = require('./models/callDetails');

// 127.0.0.1 is safer than localhost on some windows setups
mongoose.connect('mongodb://127.0.0.1:27017/CDR_Visualizer', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout after 5s
}).then(async () => {
    try {
        const count = await CDR.countDocuments({});
        console.log('CDR_RECORD_COUNT:', count);

        const testCount = await CDR.countDocuments({ caseNumber: 'TEST-CASE-UPLOAD-REAL' });
        console.log('TEST_CASE_COUNT:', testCount);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}).catch(err => {
    console.error('DB Connection Error:', err);
    process.exit(1);
});
