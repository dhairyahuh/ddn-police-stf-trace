const mongoose = require('mongoose');
const IPDR = require('./models/ipDetails').IPDR;

mongoose.connect('mongodb://localhost:27017/CDR_Visualizer')
    .then(async () => {
        console.log('Connected to CDR_Visualizer database');
        
        const totalRecords = await IPDR.countDocuments();
        console.log(`\nTotal IPDR records: ${totalRecords}`);
        
        // Check for WhatsApp records
        const whatsappRecords = await IPDR.countDocuments({ application: 'WhatsApp' });
        console.log(`WhatsApp records: ${whatsappRecords}`);
        
        // Check for VPN records
        const vpnRecords = await IPDR.countDocuments({ isVPN: true });
        console.log(`VPN records: ${vpnRecords}`);
        
        // Check for Tor records
        const torRecords = await IPDR.countDocuments({ isTor: true });
        console.log(`Tor records: ${torRecords}`);
        
        // Check for suspicious records
        const suspiciousRecords = await IPDR.countDocuments({ isSuspicious: true });
        console.log(`Suspicious records: ${suspiciousRecords}`);
        
        // Get sample records
        const sample = await IPDR.find().limit(3).lean();
        console.log('\n=== Sample Records ===');
        sample.forEach((r, i) => {
            console.log(`\nRecord ${i + 1}:`);
            console.log(`  Phone: ${r.phoneNumber}`);
            console.log(`  Start: ${r.startTime}`);
            console.log(`  Dest IP: ${r.destIP}`);
            console.log(`  Dest Port: ${r.destPort}`);
            console.log(`  Service: ${r.serviceType || 'N/A'}`);
            console.log(`  Application: ${r.application || 'N/A'}`);
            console.log(`  VPN: ${r.isVPN}`);
            console.log(`  Tor: ${r.isTor}`);
            console.log(`  Suspicious: ${r.isSuspicious}`);
        });
        
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
