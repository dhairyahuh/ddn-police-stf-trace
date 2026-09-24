const { Case } = require("../models/caseDetails");
const { CDR } = require("../models/callDetails");
const { CustomError } = require("../utils/utils");

// Create a new case
let createCase = async (req, res) => {
    try {
        const caseData = req.body;
        
        console.log('Received case data:', caseData);
        
        // Validate required fields (caseId not required anymore as it will be auto-generated)
        const requiredFields = ['caseName', 'firNumber', 'year', 'policeStation', 'state', 'district'];
        for (let field of requiredFields) {
            if (!caseData[field]) {
                console.log(`Missing field: ${field}`);
                return res.status(400).json({
                    message: `Missing required field: ${field}`,
                    code: 400
                });
            }
        }

        // Auto-generate caseId based on FIR number and year
        const caseId = `CASE-${caseData.year}-${caseData.firNumber}`;
        caseData.caseId = caseId;
        
        console.log('Creating case with ID:', caseId);

        const newCase = new Case(caseData);
        await newCase.save();
        
        console.log('Case created successfully:', newCase.caseNumber);

        return res.json({
            message: "Case created successfully",
            case: newCase,
            code: 200
        });
    } catch (err) {
        console.error('Error creating case:', err);
        console.error('Error stack:', err.stack);
        return res.status(500).json({
            message: "Error creating case",
            error: err.message,
            stack: err.stack,
            code: 500
        });
    }
};

// Get all cases
let getAllCases = async (req, res) => {
    try {
        const cases = await Case.find({}).sort({ createdDate: -1 });
        return res.json(cases);
    } catch (err) {
        console.error('Error fetching cases:', err);
        return res.status(500).json({
            message: "Error fetching cases",
            error: err.message,
            code: 500
        });
    }
};

// Get case by case number
let getCaseByNumber = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const caseData = await Case.findOne({ caseNumber });

        if (!caseData) {
            return res.status(404).json({
                message: "Case not found",
                code: 404
            });
        }

        // Get CDR count for this case
        const cdrCount = await CDR.countDocuments({ caseNumber });

        return res.json({
            ...caseData.toObject(),
            cdrCount
        });
    } catch (err) {
        console.error('Error fetching case:', err);
        return res.status(500).json({
            message: "Error fetching case",
            error: err.message,
            code: 500
        });
    }
};

// Update case
let updateCase = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const updates = req.body;

        const caseData = await Case.findOneAndUpdate(
            { caseNumber },
            { ...updates, updatedDate: Date.now() },
            { new: true }
        );

        if (!caseData) {
            return res.status(404).json({
                message: "Case not found",
                code: 404
            });
        }

        return res.json({
            message: "Case updated successfully",
            case: caseData,
            code: 200
        });
    } catch (err) {
        console.error('Error updating case:', err);
        return res.status(500).json({
            message: "Error updating case",
            error: err.message,
            code: 500
        });
    }
};

// Delete case
let deleteCase = async (req, res) => {
    try {
        const { caseNumber } = req.params;

        // Check if case has CDR data
        const cdrCount = await CDR.countDocuments({ caseNumber });
        
        if (cdrCount > 0) {
            return res.status(400).json({
                message: `Cannot delete case. It has ${cdrCount} CDR records. Delete CDR data first.`,
                code: 400
            });
        }

        const caseData = await Case.findOneAndDelete({ caseNumber });

        if (!caseData) {
            return res.status(404).json({
                message: "Case not found",
                code: 404
            });
        }

        return res.json({
            message: "Case deleted successfully",
            code: 200
        });
    } catch (err) {
        console.error('Error deleting case:', err);
        return res.status(500).json({
            message: "Error deleting case",
            error: err.message,
            code: 500
        });
    }
};

// Get CDR records for a case
let getCaseCDRs = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const cdrs = await CDR.find({ caseNumber });
        return res.json(cdrs);
    } catch (err) {
        console.error('Error fetching case CDRs:', err);
        return res.status(500).json({
            message: "Error fetching case CDR data",
            error: err.message,
            code: 500
        });
    }
};

// Cross-case analysis - Search for a phone number across all cases
let crossCaseNumberSearch = async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        // Find all CDR records with this number (as caller or called)
        const cdrs = await CDR.find({
            $or: [
                { callerNumber: phoneNumber },
                { calledNumber: phoneNumber }
            ]
        }).sort({ startTime: -1 });

        // Get unique case numbers
        const caseNumbers = [...new Set(cdrs.map(cdr => cdr.caseNumber))];

        // Get case details
        const cases = await Case.find({ caseNumber: { $in: caseNumbers } });

        // Group CDRs by case
        const caseAnalysis = cases.map(caseData => {
            const caseCDRs = cdrs.filter(cdr => cdr.caseNumber === caseData.caseNumber);
            return {
                caseDetails: caseData,
                cdrCount: caseCDRs.length,
                firstActivity: caseCDRs[caseCDRs.length - 1]?.startTime,
                lastActivity: caseCDRs[0]?.startTime,
                cdrs: caseCDRs
            };
        });

        return res.json({
            phoneNumber,
            totalCases: caseNumbers.length,
            totalCDRs: cdrs.length,
            caseAnalysis
        });
    } catch (err) {
        console.error('Error in cross-case search:', err);
        return res.status(500).json({
            message: "Error performing cross-case analysis",
            error: err.message,
            code: 500
        });
    }
};

// Cross-case IMEI search
let crossCaseIMEISearch = async (req, res) => {
    try {
        const { imei } = req.params;

        const cdrs = await CDR.find({ imei }).sort({ startTime: -1 });
        const caseNumbers = [...new Set(cdrs.map(cdr => cdr.caseNumber))];
        const cases = await Case.find({ caseNumber: { $in: caseNumbers } });

        // Get all phone numbers associated with this IMEI
        const phoneNumbers = [...new Set(cdrs.map(cdr => cdr.callerNumber))];

        const caseAnalysis = cases.map(caseData => {
            const caseCDRs = cdrs.filter(cdr => cdr.caseNumber === caseData.caseNumber);
            const caseNumbers = [...new Set(caseCDRs.map(cdr => cdr.callerNumber))];
            
            return {
                caseDetails: caseData,
                cdrCount: caseCDRs.length,
                phoneNumbers: caseNumbers,
                firstActivity: caseCDRs[caseCDRs.length - 1]?.startTime,
                lastActivity: caseCDRs[0]?.startTime,
                cdrs: caseCDRs
            };
        });

        return res.json({
            imei,
            totalCases: caseNumbers.length,
            totalCDRs: cdrs.length,
            phoneNumbers,
            caseAnalysis
        });
    } catch (err) {
        console.error('Error in cross-case IMEI search:', err);
        return res.status(500).json({
            message: "Error performing cross-case IMEI analysis",
            error: err.message,
            code: 500
        });
    }
};

// Get case statistics
let getCaseStatistics = async (req, res) => {
    try {
        const totalCases = await Case.countDocuments();
        const openCases = await Case.countDocuments({ status: 'Open' });
        const underInvestigation = await Case.countDocuments({ status: 'Under Investigation' });
        const closedCases = await Case.countDocuments({ status: 'Closed' });

        // Cases by year
        const casesByYear = await Case.aggregate([
            { $group: { _id: '$year', count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ]);

        // Cases by state
        const casesByState = await Case.aggregate([
            { $group: { _id: '$state', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        return res.json({
            totalCases,
            openCases,
            underInvestigation,
            closedCases,
            casesByYear,
            casesByState
        });
    } catch (err) {
        console.error('Error getting case statistics:', err);
        return res.status(500).json({
            message: "Error fetching statistics",
            error: err.message,
            code: 500
        });
    }
};

module.exports = {
    createCase,
    getAllCases,
    getCaseByNumber,
    updateCase,
    deleteCase,
    getCaseCDRs,
    crossCaseNumberSearch,
    crossCaseIMEISearch,
    getCaseStatistics
};
