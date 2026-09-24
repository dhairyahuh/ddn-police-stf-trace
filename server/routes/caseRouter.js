const express = require('express');
const router = express.Router();
const {
    createCase,
    getAllCases,
    getCaseByNumber,
    updateCase,
    deleteCase,
    getCaseCDRs,
    crossCaseNumberSearch,
    crossCaseIMEISearch,
    getCaseStatistics
} = require('../controllers/case.controller');

// Case CRUD operations
router.post('/create', createCase);
router.get('/all', getAllCases);
router.get('/statistics', getCaseStatistics);
router.get('/:caseNumber', getCaseByNumber);
router.put('/:caseNumber', updateCase);
router.delete('/:caseNumber', deleteCase);

// Case CDR operations
router.get('/:caseNumber/cdrs', getCaseCDRs);

// Cross-case analysis
router.get('/cross-case/phone/:phoneNumber', crossCaseNumberSearch);
router.get('/cross-case/imei/:imei', crossCaseIMEISearch);

module.exports = {
    caseRouter: router
};
