const { IPDR } = require("../models/ipDetails");
const { CDR } = require("../models/callDetails");
const { Case } = require("../models/caseDetails");
const {
    detectServiceFromPort,
    detectVPN,
    detectTor,
    detectDatacenter,
    analyzeTrafficPattern,
    correlateIPDRwithCDR,
    detectWhatsAppCall
} = require("../utils/ipdrAnalysis");

/**
 * Get all IPDR records
 */
let getAllIPDRRecords = async (req, res) => {
    try {
        const records = await IPDR.find({}).sort({ startTime: -1 });
        return res.json(records);
    } catch (err) {
        console.error('Error fetching IPDR records:', err);
        return res.status(500).json({
            message: "Error fetching IPDR records",
            error: err.message
        });
    }
};

/**
 * Get IPDR records for a specific case
 */
let getCaseIPDRs = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        const records = await IPDR.find({ caseNumber }).sort({ startTime: -1 });
        return res.json(records);
    } catch (err) {
        console.error('Error fetching case IPDRs:', err);
        return res.status(500).json({
            message: "Error fetching case IPDR records",
            error: err.message
        });
    }
};

/**
 * Get IPDR statistics
 */
let getIPDRStatistics = async (req, res) => {
    try {
        const totalRecords = await IPDR.countDocuments();
        const vpnRecords = await IPDR.countDocuments({ isVPN: true });
        const torRecords = await IPDR.countDocuments({ isTor: true });
        const voipRecords = await IPDR.countDocuments({ isVoIP: true });
        const suspiciousRecords = await IPDR.countDocuments({ isSuspicious: true });
        
        // Top services
        const topServices = await IPDR.aggregate([
            { $group: { _id: '$serviceType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        // Top applications
        const topApplications = await IPDR.aggregate([
            { $group: { _id: '$application', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        // Top destination IPs
        const topDestIPs = await IPDR.aggregate([
            { $group: { _id: '$destIP', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);
        
        // VPN providers
        const vpnProviders = await IPDR.aggregate([
            { $match: { isVPN: true } },
            { $group: { _id: '$vpnProvider', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        return res.json({
            totalRecords,
            vpnRecords,
            torRecords,
            voipRecords,
            suspiciousRecords,
            topServices,
            topApplications,
            topDestIPs,
            vpnProviders
        });
    } catch (err) {
        console.error('Error fetching IPDR statistics:', err);
        return res.status(500).json({
            message: "Error fetching statistics",
            error: err.message
        });
    }
};

/**
 * Analyze IPDR for suspicious activity
 */
let analyzeSuspiciousActivity = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        const suspiciousRecords = await IPDR.find({
            caseNumber,
            $or: [
                { isVPN: true },
                { isTor: true },
                { isSuspicious: true },
                { isProxy: true }
            ]
        }).sort({ startTime: -1 });
        
        // Group by suspicion type
        const analysis = {
            vpnUsage: suspiciousRecords.filter(r => r.isVPN),
            torUsage: suspiciousRecords.filter(r => r.isTor),
            proxyUsage: suspiciousRecords.filter(r => r.isProxy),
            otherSuspicious: suspiciousRecords.filter(r => r.isSuspicious && !r.isVPN && !r.isTor && !r.isProxy),
            timeline: suspiciousRecords.map(r => ({
                time: r.startTime,
                type: r.isVPN ? 'VPN' : r.isTor ? 'Tor' : r.isProxy ? 'Proxy' : 'Other',
                destIP: r.destIP,
                service: r.serviceType,
                reason: r.suspicionReason
            }))
        };
        
        return res.json(analysis);
    } catch (err) {
        console.error('Error analyzing suspicious activity:', err);
        return res.status(500).json({
            message: "Error analyzing suspicious activity",
            error: err.message
        });
    }
};

/**
 * Filter IPDR by service type
 */
let filterByService = async (req, res) => {
    try {
        const { caseNumber, serviceType } = req.params;
        
        const records = await IPDR.find({
            caseNumber,
            serviceType
        }).sort({ startTime: -1 });
        
        return res.json(records);
    } catch (err) {
        console.error('Error filtering by service:', err);
        return res.status(500).json({
            message: "Error filtering records",
            error: err.message
        });
    }
};

/**
 * Detect WhatsApp calls and correlate with Party B
 */
let detectWhatsAppCalls = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        // Get all IPDR records for this case
        const ipdrRecords = await IPDR.find({
            caseNumber,
            isVoIP: true
        }).sort({ startTime: 1 });
        
        // Get CDR records for correlation
        const cdrRecords = await CDR.find({ caseNumber }).sort({ startTime: 1 });
        
        const whatsappCalls = [];
        
        for (const ipdr of ipdrRecords) {
            // Correlate with CDR
            const correlation = correlateIPDRwithCDR(ipdr, cdrRecords);
            
            whatsappCalls.push({
                ipdr: ipdr,
                correlatedPartyB: correlation.partyB,
                confidence: correlation.confidence,
                method: correlation.method
            });
        }
        
        return res.json({
            totalWhatsAppCalls: whatsappCalls.length,
            calls: whatsappCalls
        });
    } catch (err) {
        console.error('Error detecting WhatsApp calls:', err);
        return res.status(500).json({
            message: "Error detecting WhatsApp calls",
            error: err.message
        });
    }
};

/**
 * Cross-case analysis for IP address
 */
let crossCaseIPSearch = async (req, res) => {
    try {
        const { ipAddress } = req.params;
        
        // Find all IPDR records with this IP
        const ipdrRecords = await IPDR.find({
            $or: [
                { publicIP: ipAddress },
                { destIP: ipAddress }
            ]
        }).sort({ startTime: -1 });
        
        // Get unique case numbers
        const caseNumbers = [...new Set(ipdrRecords.map(r => r.caseNumber))];
        
        // Get case details
        const cases = await Case.find({ caseNumber: { $in: caseNumbers } });
        
        // Group by case
        const caseAnalysis = cases.map(caseData => {
            const caseRecords = ipdrRecords.filter(r => r.caseNumber === caseData.caseNumber);
            const phoneNumbers = [...new Set(caseRecords.map(r => r.phoneNumber))];
            
            return {
                caseDetails: caseData,
                recordCount: caseRecords.length,
                phoneNumbers: phoneNumbers,
                firstSeen: caseRecords[caseRecords.length - 1]?.startTime,
                lastSeen: caseRecords[0]?.startTime,
                records: caseRecords
            };
        });
        
        return res.json({
            ipAddress,
            totalCases: caseNumbers.length,
            totalRecords: ipdrRecords.length,
            caseAnalysis
        });
    } catch (err) {
        console.error('Error in cross-case IP search:', err);
        return res.status(500).json({
            message: "Error performing cross-case IP analysis",
            error: err.message
        });
    }
};

/**
 * Get port distribution analysis
 */
let getPortAnalysis = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        const portStats = await IPDR.aggregate([
            { $match: { caseNumber } },
            { $group: {
                _id: {
                    port: '$destPort',
                    service: '$serviceType',
                    app: '$application'
                },
                count: { $sum: 1 },
                totalData: { $sum: '$totalVolume' }
            }},
            { $sort: { count: -1 } },
            { $limit: 50 }
        ]);
        
        return res.json(portStats);
    } catch (err) {
        console.error('Error analyzing ports:', err);
        return res.status(500).json({
            message: "Error analyzing port distribution",
            error: err.message
        });
    }
};

/**
 * Timeline analysis - show activity patterns over time
 */
let getTimelineAnalysis = async (req, res) => {
    try {
        const { caseNumber } = req.params;
        
        const timeline = await IPDR.aggregate([
            { $match: { caseNumber } },
            { $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d %H:00", date: "$startTime" } },
                    serviceType: '$serviceType'
                },
                count: { $sum: 1 },
                totalData: { $sum: '$totalVolume' }
            }},
            { $sort: { '_id.date': 1 } }
        ]);
        
        return res.json(timeline);
    } catch (err) {
        console.error('Error analyzing timeline:', err);
        return res.status(500).json({
            message: "Error analyzing timeline",
            error: err.message
        });
    }
};

/**
 * Verify detection accuracy for a specific record
 */
let verifyDetection = async (req, res) => {
    try {
        const { destIP, destPort, protocol, vpnProvider, isVPN, isTor, application, serviceType, uplinkVolume, downlinkVolume, duration } = req.body;
        
        const {
            detectVPN,
            detectTor,
            isWhatsAppPort,
            isWhatsAppIP
        } = require('../utils/ipdrAnalysisAccurate');
        
        const http = require('http');
        
        const verificationResult = {
            ip: destIP,
            port: destPort,
            protocol: protocol
        };
        
        // Fetch WHOIS data
        try {
            const whoisData = await new Promise((resolve, reject) => {
                http.get(`http://ip-api.com/json/${destIP}`, (resp) => {
                    let data = '';
                    resp.on('data', chunk => data += chunk);
                    resp.on('end', () => resolve(JSON.parse(data)));
                }).on('error', reject);
            });
            
            verificationResult.whois = {
                isp: whoisData.isp,
                org: whoisData.org,
                as: whoisData.as,
                country: whoisData.country
            };
        } catch (error) {
            verificationResult.whois = { error: 'WHOIS lookup failed' };
        }
        
        // Verify VPN detection
        if (isVPN && vpnProvider) {
            const vpnCheck = await detectVPN(destIP);
            
            // Find the specific range that matched
            let matchedRange = 'Not found';
            if (vpnCheck.isVPN) {
                const VPN_PROVIDERS_ACCURATE = require('../utils/ipdrAnalysisAccurate').VPN_PROVIDERS_ACCURATE || {};
                const providerData = VPN_PROVIDERS_ACCURATE[vpnProvider];
                if (providerData) {
                    // Use the isIPInCIDR function to find which range matched
                    const { isIPInCIDR } = require('../utils/ipdrAnalysisAccurate');
                    for (const range of providerData.ranges) {
                        if (isIPInCIDR(destIP, range)) {
                            matchedRange = range;
                            break;
                        }
                    }
                }
            }
            
            verificationResult.vpnDetection = {
                verified: vpnCheck.isVPN && vpnCheck.provider === vpnProvider,
                provider: vpnProvider,
                rangeMatched: matchedRange,
                confidence: vpnCheck.confidence
            };
        }
        
        // Verify Tor detection
        if (isTor) {
            const torCheck = await detectTor(destIP);
            verificationResult.torDetection = {
                verified: torCheck.isTor,
                source: 'Official Tor Project API (https://check.torproject.org/)',
                confidence: torCheck.confidence
            };
        }
        
        // Verify WhatsApp/VoIP detection
        if (application === 'WhatsApp' || serviceType?.includes('WhatsApp')) {
            const portCheck = isWhatsAppPort(destPort, protocol);
            const ipCheck = isWhatsAppIP(destIP);
            const dataRatio = downlinkVolume > 0 ? uplinkVolume / downlinkVolume : 0;
            
            const reasons = [];
            if (portCheck.isWhatsAppVoIP) {
                reasons.push(`Port ${destPort} is a known WhatsApp ${portCheck.type} port`);
            }
            if (ipCheck.isWhatsApp) {
                reasons.push(`IP belongs to Meta/Facebook infrastructure (WhatsApp servers)`);
            }
            if (destPort === 443 || destPort === 80) {
                reasons.push(`Port ${destPort} used as WhatsApp backup/fallback (common when VPN tunneling)`);
            }
            if (dataRatio >= 0.3 && dataRatio <= 0.8) {
                reasons.push(`Data ratio (${dataRatio.toFixed(2)}) matches VoIP call pattern`);
            }
            if (duration && duration > 30 && duration < 7200) {
                reasons.push(`Session duration (${Math.floor(duration/60)} min) typical for VoIP call`);
            }
            
            verificationResult.whatsappDetection = {
                portType: portCheck.type || (destPort === 443 ? 'backup' : 'unknown'),
                portConfidence: portCheck.confidence,
                ipInWhatsAppRange: ipCheck.isWhatsApp,
                uploadMB: (uplinkVolume / 1024 / 1024).toFixed(2),
                downloadMB: (downlinkVolume / 1024 / 1024).toFixed(2),
                dataRatio: dataRatio,
                serviceType: serviceType || application,
                reasons: reasons
            };
        }
        
        return res.json(verificationResult);
    } catch (err) {
        console.error('Error verifying detection:', err);
        return res.status(500).json({
            message: "Error verifying detection",
            error: err.message
        });
    }
};

module.exports = {
    getAllIPDRRecords,
    getCaseIPDRs,
    getIPDRStatistics,
    analyzeSuspiciousActivity,
    filterByService,
    detectWhatsAppCalls,
    crossCaseIPSearch,
    getPortAnalysis,
    getTimelineAnalysis,
    verifyDetection
};
