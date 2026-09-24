const mongoose = require('mongoose');
const { parseIPDRCSV } = require('./utils/ipdrParser');

mongoose.connect('mongodb://localhost:27017/cdr_visualizer', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    
    const filePath = 'c:\\Users\\arshd\\Downloads\\Sih_Rk312_winterfell\\Sih_Rk312_winterfell\\server\\uploads\\1763614815711-whatsapp_correlation_ipdr.csv';
    const caseNumber = '2025-UT-000001';
    
    console.log('Testing parser with:', filePath);
    console.log('Case:', caseNumber);
    
    parseIPDRCSV(filePath, caseNumber, (err, result) => {
        if (err) {
            console.error('Parser error:', err);
        } else {
            console.log('Parser result:', result);
        }
        process.exit(0);
    });
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
