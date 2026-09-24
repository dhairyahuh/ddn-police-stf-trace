const mongoose = require('mongoose');
const { CDR } = require('./models/callDetails');

// MongoDB connection - using same database as server
const MONGODB_URI = 'mongodb://localhost:27017/CDR_Visualizer';

async function clearCDRData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Count records before deletion
    const countBefore = await CDR.countDocuments();
    console.log(`Found ${countBefore} CDR records`);
    
    // Delete all CDR records
    const result = await CDR.deleteMany({});
    console.log(`Successfully deleted ${result.deletedCount} CDR records`);
    
    // Verify deletion
    const countAfter = await CDR.countDocuments();
    console.log(`Remaining records: ${countAfter}`);
    
    console.log('\n✅ All CDR data has been cleared from MongoDB');
    
    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('Error clearing CDR data:', error);
    process.exit(1);
  }
}

clearCDRData();
