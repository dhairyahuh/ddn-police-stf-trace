const port = process.env.PORT || 8080
const db_name = process.env.DB_NAME || "CDR_Visualizer"
const base_url = process.env.BASE_URL || `http://localhost:${port}`
const private_key = process.env.JWT_SECRET || process.env.PRIVATE_KEY || "secret"
const mongo_uri = process.env.MONGO_URI || process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${db_name}`
const leak_osint_api_token = process.env.LEAK_OSINT_API_TOKEN || ""

module.exports = {
    port : port,
    db_name : db_name,
    base_url : base_url,
    private_key : private_key,
    mongo_uri: mongo_uri,
    leak_osint_api_token: leak_osint_api_token
}

