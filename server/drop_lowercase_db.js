const mongoose = require('mongoose');

// Connect to the lowercase database and drop it
mongoose.connect('mongodb://localhost:27017/cdr_visualizer', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to cdr_visualizer (lowercase)');
    
    await mongoose.connection.dropDatabase();
    console.log('Dropped cdr_visualizer database');
    
    console.log('Now the uppercase CDR_Visualizer database will be used');
    process.exit(0);
}).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
