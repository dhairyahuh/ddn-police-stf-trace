const mongoose = require('mongoose');
const { CDR } = require('./models/callDetails');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cdr-analysis';

async function verify() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    const count = await CDR.countDocuments();
    console.log(`\nTotal CDR records in database: ${count}`);
    
    if (count > 0) {
      const sample = await CDR.findOne();
      console.log('\nSample record:', JSON.stringify(sample, null, 2));
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verify();
