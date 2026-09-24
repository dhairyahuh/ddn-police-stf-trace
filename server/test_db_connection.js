const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');

mongoose.connect('mongodb://localhost:27017/CDR_Visualizer', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('\n✅ MongoDB connection successful!');
    console.log('Database: CDR_Visualizer');
    console.log('Connection URL: mongodb://localhost:27017/CDR_Visualizer');
    console.log('Connection State:', mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected');
    
    // List all collections
    mongoose.connection.db.listCollections().toArray()
        .then(collections => {
            console.log('\nExisting collections:', collections.length > 0 ? collections.map(c => c.name).join(', ') : 'None (database is empty)');
            process.exit(0);
        })
        .catch(err => {
            console.log('\nCould not list collections:', err.message);
            process.exit(0);
        });
})
.catch(err => {
    console.error('\n❌ MongoDB connection failed!');
    console.error('Error:', err.message);
    console.error('\nPlease make sure MongoDB is running on localhost:27017');
    process.exit(1);
});
