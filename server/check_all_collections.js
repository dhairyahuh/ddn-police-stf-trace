const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cdr-analysis';

async function checkAllCollections() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    console.log('Database:', mongoose.connection.name);
    
    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nAll collections in database:');
    
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
      
      if (count > 0 && count < 5) {
        const sample = await mongoose.connection.db.collection(collection.name).findOne();
        console.log(`  Sample:`, JSON.stringify(sample, null, 2));
      }
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllCollections();
