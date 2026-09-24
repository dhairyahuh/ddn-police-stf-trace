/**
 * WhatsApp VoIP Correlation Routes
 * 
 * Endpoints:
 * - GET /api/correlation/whatsapp - Find WhatsApp correlations for a phone number
 * - GET /api/correlation/case/:caseNumber - Get all correlations for a case
 */

const express = require('express');
const router = express.Router();
const {
    listWhatsAppCalls,
    correlateWithPartyB,
    getAllCorrelations
} = require('../controllers/correlation.controller');

/**
 * Stage 1: GET /api/correlation/whatsapp-calls?imsi=XXX&caseNumber=YYY
 * List all WhatsApp VoIP calls (5-digit UDP ports) with destination IPs
 */
router.get('/whatsapp-calls', listWhatsAppCalls);

// Alias for frontend compatibility
router.get('/whatsapp', listWhatsAppCalls);

/**
 * Stage 2: GET /api/correlation/correlate?ipdrId=XXX&caseNumber=YYY
 * Correlate selected call with uploaded Party B IPDR (matching port + timing)
 */
router.get('/correlate', correlateWithPartyB);

/**
 * GET /api/correlation/case/:caseNumber
 * Get all WhatsApp correlations for a case
 */
router.get('/case/:caseNumber', getAllCorrelations);

module.exports = router;
