const mongoose = require("mongoose")
const Schema = mongoose.Schema
const Model = mongoose.model

const caseSchema = Schema({
    // Case Number - Auto-generated primary key
    caseNumber: {
        type: String,
        required: false,  // Generated in pre-save hook
        unique: true,
        index: true
    },

    // Case Name
    caseName: {
        type: String,
        required: true,
        index: true
    },

    // Case ID
    caseId: {
        type: String,
        required: false,  // Changed to false since it's auto-generated
        index: true
    },

    // FIR Number
    firNumber: {
        type: String,
        required: true,
        index: true
    },

    // Year
    year: {
        type: Number,
        required: true,
        index: true
    },

    // Police Station Name
    policeStation: {
        type: String,
        required: true,
        index: true
    },

    // State
    state: {
        type: String,
        required: true,
        index: true
    },

    // District
    district: {
        type: String,
        required: true,
        index: true
    },

    // Case Description
    description: {
        type: String
    },

    // Case Status
    status: {
        type: String,
        enum: ['Open', 'Under Investigation', 'Closed', 'Pending'],
        default: 'Open'
    },

    // Created Date
    createdDate: {
        type: Date,
        default: Date.now
    },

    // Updated Date
    updatedDate: {
        type: Date,
        default: Date.now
    },

    // Investigating Officer
    investigatingOfficer: {
        type: String
    },

    // Case Type
    caseType: {
        type: String
    }
});

// Pre-save hook to generate case number
caseSchema.pre('save', async function(next) {
    if (!this.caseNumber) {
        // Generate case number: YEAR-STATE-XXXX
        const count = await this.constructor.countDocuments();
        const caseNum = String(count + 1).padStart(6, '0');
        this.caseNumber = `${this.year}-${this.state.substring(0, 2).toUpperCase()}-${caseNum}`;
    }
    this.updatedDate = Date.now();
    next();
});

module.exports = {
    Case: Model('Case', caseSchema)
}
