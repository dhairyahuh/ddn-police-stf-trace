const express = require("express")
const app = express()
const cors = require('cors')

app.use(cors())
app.use(express.json())

// Test route
app.get('/api/cdr/getAllRecords', (req, res) => {
    res.json([]);
});

app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

const PORT = 8081;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});