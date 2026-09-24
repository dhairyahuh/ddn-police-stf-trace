const mongoose = require("mongoose");

/**
 * Schema for storing data breach intelligence records.
 * Supports TXT, CSV, and JSON source types.
 * Completely isolated from CDR/IPDR/Case collections.
 * Used for read-only profiling intelligence.
 */
const BreachSchema = new mongoose.Schema({
    // Breach metadata
    breachName: {
        type: String,
        required: true,
        index: true
    },
    sourceType: {
        type: String,
        enum: ["txt", "csv", "json"],
        default: "txt"
    },

    // Platform identifier (for social media breaches)
    platform: {
        type: String,
        index: true  // e.g., "Instagram", "Facebook", "Twitter"
    },

    // Original record ID from breach file
    recordId: {
        type: Number,
        sparse: true
    },

    // User identity fields (searchable)
    name: {
        type: String,
        index: true
    },
    phone: {
        type: String,
        index: true
    },
    email: {
        type: String,
        index: true
    },
    username: {
        type: String,
        index: true
    },
    fatherName: String,

    // Social media specific fields
    instagramId: {
        type: String,
        index: true
    },

    // Location fields (for CSV utility data)
    address: String,
    district: {
        type: String,
        index: true
    },
    town: String,
    latitude: Number,
    longitude: Number,

    // Utility-specific fields
    connectionType: String,
    connectionStatus: String,
    loadAmount: String,
    loadUnit: String,

    // Account metadata (TXT breaches)
    isStaff: Boolean,
    isActive: Boolean,
    isSuperuser: Boolean,
    buId: Number,
    joiningDate: Date,
    addedOn: Date,
    modifiedOn: Date,
    objectStatus: Number,

    // CSV FULL ROW STORAGE - stores all columns exactly as-is
    csvData: {
        type: Object,
        default: null
    },

    // JSON FULL RECORD STORAGE - for JSON breaches (Instagram, etc.)
    jsonData: {
        type: Object,
        default: null
    },

    // Which field matched the search
    matchedField: String,

    // Sensitive fields - NEVER expose to frontend
    passwordHash: {
        type: String,
        select: false  // Excluded by default in queries
    },
    rawRow: {
        type: String,
        select: false  // Excluded by default in queries
    },

    // Import metadata
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'breaches'
});

// Compound indexes for efficient searching
BreachSchema.index({ phone: 1, breachName: 1 });
BreachSchema.index({ email: 1, breachName: 1 });
BreachSchema.index({ username: 1, breachName: 1 });
BreachSchema.index({ district: 1, breachName: 1 });
BreachSchema.index({ platform: 1, breachName: 1 });

const Breach = mongoose.model("Breach", BreachSchema);

module.exports = { Breach };
