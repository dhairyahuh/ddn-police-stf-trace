/**
 * Breach Intelligence Controller
 * 
 * Read-only search API for data breach intelligence.
 * Sensitive fields (passwordHash, rawRow) are never exposed.
 */

const { Breach } = require("../models/breachDetails");

// Fields to return in search results (explicitly exclude sensitive data)
// Include all available fields for comprehensive suspect profiling
const SAFE_PROJECTION = {
    _id: 0,
    breachName: 1,
    sourceType: 1,
    platform: 1,        // Instagram, Facebook, etc.
    recordId: 1,
    matchedField: 1,

    // Identity fields
    name: 1,
    phone: 1,
    email: 1,
    username: 1,
    fatherName: 1,

    // Social media fields
    instagramId: 1,

    // Location fields (CSV)
    address: 1,
    district: 1,
    town: 1,
    latitude: 1,
    longitude: 1,

    // Utility fields (CSV)
    connectionType: 1,
    connectionStatus: 1,
    loadAmount: 1,
    loadUnit: 1,

    // Account metadata (TXT)
    isStaff: 1,
    isActive: 1,
    isSuperuser: 1,
    buId: 1,
    joiningDate: 1,
    addedOn: 1,
    modifiedOn: 1,
    objectStatus: 1,

    // Full data storage
    csvData: 1,
    jsonData: 1,

    createdAt: 1
};

/**
 * Search breach records by phone, email, or username
 * 
 * GET /api/profiling/breach-search?phone=9319466221
 * GET /api/profiling/breach-search?email=test@example.com
 * GET /api/profiling/breach-search?username=lourdes_cpt
 */
let searchBreach = async (req, res) => {
    try {
        const { phone, email, username } = req.query;

        // Validate input
        if (!phone && !email && !username) {
            return res.status(400).json({
                success: false,
                message: "Please provide 'phone', 'email', or 'username' query parameter",
                found: false
            });
        }

        // Build search query
        let query = {};
        let searchType = "";
        let searchValue = "";

        if (phone) {
            // Normalize phone: remove non-digits, get last 10
            const normalizedPhone = phone.toString().replace(/\D/g, "").slice(-10);
            if (normalizedPhone.length < 10) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number must be at least 10 digits",
                    found: false
                });
            }
            query.phone = { $regex: normalizedPhone + "$" }; // Match end of phone for international formats
            searchType = "phone";
            searchValue = phone;
        } else if (email) {
            // Normalize email: lowercase, trim
            query.email = email.toString().toLowerCase().trim();
            searchType = "email";
            searchValue = email;
        } else if (username) {
            // Normalize username: lowercase, trim
            query.username = username.toString().toLowerCase().trim();
            searchType = "username";
            searchValue = username;
        }

        // Execute search with safe projection
        const results = await Breach.find(query, SAFE_PROJECTION).limit(50).lean();

        if (results.length === 0) {
            return res.json({
                success: true,
                found: false,
                count: 0,
                searchType: searchType,
                searchValue: searchValue,
                breaches: [],
                dataTypesExposed: []
            });
        }

        // Determine which data types are exposed (dynamically detect)
        const dataTypesExposed = new Set();

        for (const record of results) {
            if (record.name) dataTypesExposed.add("Name");
            if (record.phone) dataTypesExposed.add("Mobile Number");
            if (record.email) dataTypesExposed.add("Email");
            if (record.username) dataTypesExposed.add("Username");
            if (record.fatherName) dataTypesExposed.add("Father Name");
            if (record.address) dataTypesExposed.add("Address");
            if (record.district) dataTypesExposed.add("District");
            if (record.town) dataTypesExposed.add("Town");
            if (record.latitude || record.longitude) dataTypesExposed.add("Geolocation");
            if (record.connectionType) dataTypesExposed.add("Connection Type");
            if (record.connectionStatus) dataTypesExposed.add("Connection Status");
            if (record.loadAmount) dataTypesExposed.add("Load");
            if (record.isStaff !== undefined || record.isActive !== undefined) {
                dataTypesExposed.add("Account Status");
            }
            if (record.joiningDate) dataTypesExposed.add("Joining Date");

            // Social media specific
            if (record.instagramId) dataTypesExposed.add("Instagram ID");
            if (record.platform) dataTypesExposed.add("Social Platform");

            // For CSV records, add csvData fields
            if (record.csvData) {
                const csvKeys = Object.keys(record.csvData);
                if (csvKeys.length > 10) {
                    dataTypesExposed.add(`+${csvKeys.length} CSV fields`);
                }
            }

            // For JSON records (Instagram, etc.)
            if (record.jsonData) {
                const jsonKeys = Object.keys(record.jsonData);
                if (jsonKeys.length > 0) {
                    dataTypesExposed.add(`+${jsonKeys.length} profile fields`);
                }
            }

            // TXT breaches typically have password hash
            if (record.sourceType === 'txt') {
                dataTypesExposed.add("Password Hash");
            }
        }

        // Get unique breach sources
        const breachSources = [...new Set(results.map(r => r.breachName))];

        // Get unique platforms
        const platforms = [...new Set(results.filter(r => r.platform).map(r => r.platform))];

        // Count by source type
        const txtBreachCount = results.filter(r => r.sourceType === 'txt').length;
        const csvBreachCount = results.filter(r => r.sourceType === 'csv').length;
        const jsonBreachCount = results.filter(r => r.sourceType === 'json').length;

        return res.json({
            success: true,
            found: true,
            count: results.length,
            searchType: searchType,
            searchValue: searchValue,
            breachSources: breachSources,
            platforms: platforms,
            dataTypesExposed: Array.from(dataTypesExposed),
            breaches: results,
            txtBreachCount: txtBreachCount,
            csvBreachCount: csvBreachCount,
            jsonBreachCount: jsonBreachCount
        });

    } catch (err) {
        console.error("Error in searchBreach:", err);
        return res.status(500).json({
            success: false,
            message: "Error searching breach database",
            error: err.message,
            found: false
        });
    }
};

/**
 * Get breach statistics (admin only - for future use)
 * 
 * GET /api/profiling/breach-stats
 */
let getBreachStats = async (req, res) => {
    try {
        const stats = await Breach.aggregate([
            {
                $group: {
                    _id: "$breachName",
                    count: { $sum: 1 },
                    firstImport: { $min: "$createdAt" },
                    lastImport: { $max: "$createdAt" }
                }
            },
            {
                $project: {
                    breachName: "$_id",
                    count: 1,
                    firstImport: 1,
                    lastImport: 1,
                    _id: 0
                }
            }
        ]);

        const totalRecords = await Breach.countDocuments();

        return res.json({
            success: true,
            totalRecords: totalRecords,
            breaches: stats
        });

    } catch (err) {
        console.error("Error in getBreachStats:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching breach statistics",
            error: err.message
        });
    }
};

module.exports = {
    searchBreach: searchBreach,
    getBreachStats: getBreachStats
};
