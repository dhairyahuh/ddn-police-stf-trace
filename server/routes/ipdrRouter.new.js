const express = require("express");
const ipdrController = require("../controllers/ipdr.controller.new");
const ipdrRouter = express.Router();

// ===== BASIC ROUTES =====
// Get all IPDR records
ipdrRouter.get('/all', ipdrController.getAllIPDRRecords);

// Get IPDR records for a specific case
ipdrRouter.get('/case/:caseNumber', ipdrController.getCaseIPDRs);

// Get IPDR statistics
ipdrRouter.get('/statistics', ipdrController.getIPDRStatistics);

// ===== ANALYSIS ROUTES =====
// Analyze suspicious activity
ipdrRouter.get('/analyze/suspicious/:caseNumber', ipdrController.analyzeSuspiciousActivity);

// Filter by service type
ipdrRouter.get('/filter/service/:caseNumber/:serviceType', ipdrController.filterByService);

// Port distribution analysis
ipdrRouter.get('/analyze/ports/:caseNumber', ipdrController.getPortAnalysis);

// Timeline analysis
ipdrRouter.get('/analyze/timeline/:caseNumber', ipdrController.getTimelineAnalysis);

// ===== PARTY B DETECTION =====
// Detect WhatsApp calls and correlate Party B
ipdrRouter.get('/whatsapp/:caseNumber', ipdrController.detectWhatsAppCalls);

// ===== CROSS-CASE ANALYSIS =====
// Search IP address across all cases
ipdrRouter.get('/cross-case/ip/:ipAddress', ipdrController.crossCaseIPSearch);

// ===== VERIFICATION =====
// Verify detection accuracy for a specific record
ipdrRouter.post('/verify-detection', ipdrController.verifyDetection);

module.exports = {
    ipdrRouter
};
