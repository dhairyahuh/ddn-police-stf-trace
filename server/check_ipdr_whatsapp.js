const mongoose = require('mongoose');
const { IPDR } = require('./models/ipDetails');

mongoose.connect('mongodb://localhost:27017/cdr_visualizer', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB');
    
    // Check total IPDR records
    const totalCount = await IPDR.countDocuments();
    console.log(`Total IPDR records: ${totalCount}`);
    
    // Check records with IMSI 404452991936654
    const imsiCount = await IPDR.countDocuments({ imsi: '404452991936654' });
    console.log(`Records with IMSI 404452991936654: ${imsiCount}`);
    
    // Check records with 5-digit ports
    const whatsappCount = await IPDR.countDocuments({ 
        privatePort: { $gte: 50000, $lte: 59999 }
    });
    console.log(`Records with 5-digit ports (50000-59999): ${whatsappCount}`);
    
    // Check records matching both criteria
    const matchingCount = await IPDR.countDocuments({ 
        imsi: '404452991936654',
        privatePort: { $gte: 50000, $lte: 59999 },
        duration: { $gte: 10 }
    });
    console.log(`Records matching IMSI + 5-digit port + duration >= 10s: ${matchingCount}`);
    
    // Get one sample record
    const sample = await IPDR.findOne({ imsi: '404452991936654' }).lean();
    console.log('\nSample record:');
    console.log(JSON.stringify(sample, null, 2));
    
    process.exit(0);
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
