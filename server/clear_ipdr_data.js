const mongoose = require('mongoose');
const { IPDR } = require('./models/ipDetails');
const env = require('./utils/env');

mongoose.connect(`mongodb://localhost:27017/${env.db_name}`).then(async () => {
    const result = await IPDR.deleteMany({});
    console.log(`Deleted ${result.deletedCount} IPDR records`);
    process.exit(0);
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
