/**
 * WhatsApp VoIP Call Correlation Controller
 * 
 * WORKFLOW:
 * 
 * Stage 1: Identify WhatsApp Calls (5-digit UDP ports)
 * 1. Search IPDR for entries with 5-digit UDP ports (50000-59999)
 * 2. These ports are characteristic of WhatsApp VoIP calls
 * 3. Display all matching calls with their destination IPs
 * 4. User selects which call/destination IP to analyze
 * 
 * Stage 2: Upload Party B IPDR & Correlate
 * 1. User uploads IPDR data for one of the destination IPs
 * 2. System searches for matching sessions by:
 *    - Same destination IP (relay server)
 *    - Overlapping time window (±10 seconds)
 *    - 5-digit UDP port (WhatsApp signature)
 *    - Different phone number (Party B)
 * 3. Calculate correlation confidence based on:
 *    - Time match precision (0-40 points)
 *    - Duration similarity (0-30 points)
 *    - Destination IP match (30 points)
 * 4. Return ranked correlations with Party B details
 */

const { IPDR } = require('../models/ipDetails');
const { CDR } = require('../models/callDetails');

/**
 * Calculate the overlap percentage between two time periods
 */
function calculateOverlapPercentage(start1, end1, start2, end2) {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();
    
    const overlapStart = Math.max(s1, s2);
    const overlapEnd = Math.min(e1, e2);
    
    if (overlapStart >= overlapEnd) {
        return 0; // No overlap
    }
    
    const overlapDuration = overlapEnd - overlapStart;
    const totalDuration = Math.max(e1 - s1, e2 - s2);
    
    return Math.round((overlapDuration / totalDuration) * 100);
}

/**
 * Stage 1: List all WhatsApp VoIP calls with optional filters
 * IPDR data contains IMSI/IMEI, not phone numbers
 * Filters by IMSI, IMEI, destination IP, port, and time
 */
async function listWhatsAppCalls(req, res) {
    try {
        const { imsi, imei, caseNumber, destinationIP } = req.query;
        
        if (!caseNumber) {
            return res.status(400).json({
                success: false,
                error: 'caseNumber is required'
            });
        }
        
        // Build query for WhatsApp VoIP IPDR records
        // Criteria: privatePort in 50000-59999 (5-digit UDP media ports)
        const query = {
            caseNumber,
            privatePort: { $gte: 50000, $lte: 59999 },
            duration: { $gte: 10 } // At least 10 seconds to be a real call
        };
        
        // Optional filters - IPDR uses IMSI/IMEI only
        if (imsi) {
            query.imsi = imsi;
        }
        
        if (imei) {
            query.imei = imei;
        }
        
        if (destinationIP) {
            query.destIP = destinationIP;
        }
        
        const whatsappIPDRs = await IPDR.find(query).sort({ startTime: 1 }).lean();
        
        console.log(`Found ${whatsappIPDRs.length} WhatsApp VoIP sessions (IMSI: ${imsi || 'any'}, IMEI: ${imei || 'any'}, destIP: ${destinationIP || 'any'})`);
        
        if (whatsappIPDRs.length === 0) {
            return res.json({
                success: true,
                message: 'No WhatsApp VoIP calls found with the given filters (looking for 5-digit UDP ports: 50000-59999)',
                whatsappCalls: [],
                correlations: []
            });
        }
        
        // Format WhatsApp calls and find Party B correlations
        const whatsappCallsWithCorrelations = [];
        
        for (const ipdr of whatsappIPDRs) {
            // Find potential Party B matches: same destIP, overlapping time, different IMSI
            const partyBMatches = await IPDR.find({
                caseNumber,
                destIP: ipdr.destIP,
                privatePort: { $gte: 50000, $lte: 59999 },
                imsi: { $ne: ipdr.imsi }, // Different IMSI (Party B)
                startTime: { 
                    $gte: new Date(ipdr.startTime.getTime() - 30000), // Within 30 seconds before
                    $lte: new Date(ipdr.endTime.getTime() + 30000)    // Within 30 seconds after
                }
            }).lean();
            
            // Calculate correlation confidence for each match
            const correlations = partyBMatches.map(partyB => {
                const timeOverlap = calculateOverlapPercentage(
                    ipdr.startTime,
                    ipdr.endTime,
                    partyB.startTime,
                    partyB.endTime
                );
                
                const durationDiff = Math.abs(ipdr.duration - partyB.duration);
                const durationMatch = Math.max(0, 100 - (durationDiff / Math.max(ipdr.duration, partyB.duration) * 100));
                
                const confidence = Math.round(
                    (timeOverlap * 0.4) +      // 40% weight on timing
                    (durationMatch * 0.3) +    // 30% weight on duration
                    (30)                       // 30% for same IP
                );
                
                return {
                    partyBImsi: partyB.imsi,
                    partyBImei: partyB.imei,
                    partyBStartTime: partyB.startTime,
                    partyBEndTime: partyB.endTime,
                    partyBDuration: partyB.duration,
                    partyBPort: partyB.privatePort,
                    timeOverlap,
                    durationMatch: Math.round(durationMatch),
                    confidence
                };
            });
            
            // Sort by confidence
            correlations.sort((a, b) => b.confidence - a.confidence);
            
            whatsappCallsWithCorrelations.push({
                id: whatsappCallsWithCorrelations.length + 1,
                ipdrId: ipdr._id,
                imei: ipdr.imei,
                imsi: ipdr.imsi,
                startTime: ipdr.startTime,
                endTime: ipdr.endTime,
                duration: ipdr.duration,
                destinationIP: ipdr.destIP,
                destinationPort: ipdr.destPort,
                sourcePort: ipdr.privatePort,
                uplinkBytes: ipdr.uplinkVolume,
                downlinkBytes: ipdr.downlinkVolume,
                totalBytes: ipdr.totalVolume,
                location: {
                    cellID: ipdr.originCellID,
                    lat: ipdr.originLat,
                    long: ipdr.originLong
                },
                partyBCorrelations: correlations
            });
        }
        
        // Count total Party B matches found
        const totalPartyBFound = whatsappCallsWithCorrelations.reduce(
            (sum, call) => sum + call.partyBCorrelations.length, 
            0
        );
        
        res.json({
            success: true,
            totalWhatsAppCalls: whatsappCallsWithCorrelations.length,
            totalPartyBFound,
            whatsappCalls: whatsappCallsWithCorrelations
        });
        
    } catch (error) {
        console.error('Error finding WhatsApp correlations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Stage 2: Correlate selected WhatsApp call with Party B IPDR
 * Matches by destination IP, time window, and port - uses IMSI/IMEI not phone numbers
 */
async function correlateWithPartyB(req, res) {
    try {
        const { ipdrId, caseNumber } = req.query;
        
        if (!ipdrId || !caseNumber) {
            return res.status(400).json({
                success: false,
                error: 'ipdrId and caseNumber are required'
            });
        }
        
        // Get the original WhatsApp call IPDR (Party A)
        const partyAIPDR = await IPDR.findById(ipdrId).lean();
        
        if (!partyAIPDR) {
            return res.status(404).json({
                success: false,
                error: 'WhatsApp call not found'
            });
        }
        
        // Look for Party B's IPDR session to the same destination IP
        // within the call timeframe (±10 seconds)
        // Match by IMSI/IMEI since IPDR doesn't have phone numbers
        const partyBSessions = await IPDR.find({
            caseNumber,
            destIP: partyAIPDR.destIP,
            imsi: { $ne: partyAIPDR.imsi }, // Different IMSI (different user)
            privatePort: { $gte: 50000, $lte: 59999 }, // WhatsApp media port
            startTime: {
                $gte: new Date(new Date(partyAIPDR.startTime).getTime() - 10000),
                $lte: new Date(new Date(partyAIPDR.startTime).getTime() + 10000)
            }
        }).lean();
        
        console.log(`Found ${partyBSessions.length} potential Party B sessions (different IMSI, same destination IP)`);
        
        // Calculate correlation for each Party B session
        const correlations = partyBSessions.map(partyBIPDR => {
            const timeDiff = Math.abs(new Date(partyBIPDR.startTime) - new Date(partyAIPDR.startTime));
            const durationDiff = Math.abs(partyBIPDR.duration - partyAIPDR.duration);
            const endTimeDiff = Math.abs(new Date(partyBIPDR.endTime) - new Date(partyAIPDR.endTime));
            
            // Calculate confidence score
            let confidence = 0;
            
            // Timing match (0-40 points)
            if (timeDiff <= 1000) confidence += 40; // Within 1 second
            else if (timeDiff <= 3000) confidence += 30; // Within 3 seconds
            else if (timeDiff <= 5000) confidence += 20; // Within 5 seconds
            else if (timeDiff <= 10000) confidence += 10; // Within 10 seconds
            
            // Duration match (0-30 points)
            if (durationDiff <= 5) confidence += 30; // Within 5 seconds
            else if (durationDiff <= 10) confidence += 20; // Within 10 seconds
            else if (durationDiff <= 20) confidence += 10; // Within 20 seconds
            
            // Same destination IP (30 points - guaranteed since we filtered by it)
            confidence += 30;
            
            // Port analysis - detailed breakdown
            const portAnalysis = {
                partyASourcePort: partyAIPDR.privatePort,
                partyBSourcePort: partyBIPDR.privatePort,
                bothIn5DigitRange: (partyAIPDR.privatePort >= 50000 && partyAIPDR.privatePort <= 59999) &&
                                   (partyBIPDR.privatePort >= 50000 && partyBIPDR.privatePort <= 59999),
                destPortMatch: partyAIPDR.destPort === partyBIPDR.destPort,
                portDifference: Math.abs(partyAIPDR.privatePort - partyBIPDR.privatePort)
            };
            
            // Time analysis - detailed breakdown
            const timeAnalysis = {
                startTimeDifferenceMs: timeDiff,
                startTimeDifferenceSeconds: (timeDiff / 1000).toFixed(2),
                endTimeDifferenceMs: endTimeDiff,
                endTimeDifferenceSeconds: (endTimeDiff / 1000).toFixed(2),
                durationDifferenceSeconds: durationDiff,
                overlapPercentage: calculateOverlapPercentage(
                    partyAIPDR.startTime, partyAIPDR.endTime,
                    partyBIPDR.startTime, partyBIPDR.endTime
                )
            };
            
            return {
                partyA: {
                    phoneNumber: partyAIPDR.phoneNumber,
                    imei: partyAIPDR.imei,
                    imsi: partyAIPDR.imsi,
                    startTime: partyAIPDR.startTime,
                    endTime: partyAIPDR.endTime,
                    duration: partyAIPDR.duration,
                    sourcePort: partyAIPDR.privatePort,
                    destPort: partyAIPDR.destPort,
                    location: {
                        cellID: partyAIPDR.originCellID,
                        lat: partyAIPDR.originLat,
                        long: partyAIPDR.originLong
                    }
                },
                partyB: {
                    phoneNumber: partyBIPDR.phoneNumber,
                    expectedPhoneNumber: matchingCDR ? matchingCDR.calledParty : 'Unknown',
                    phoneNumberMatch: matchingCDR && partyBIPDR.phoneNumber === matchingCDR.calledParty,
                    imei: partyBIPDR.imei,
                    imsi: partyBIPDR.imsi,
                    startTime: partyBIPDR.startTime,
                    endTime: partyBIPDR.endTime,
                    duration: partyBIPDR.duration,
                    sourcePort: partyBIPDR.privatePort,
                    destPort: partyBIPDR.destPort,
                    location: {
                        cellID: partyBIPDR.originCellID,
                        lat: partyBIPDR.originLat,
                        long: partyBIPDR.originLong
                    }
                },
                destination: {
                    ip: partyAIPDR.destIP,
                    port: partyAIPDR.destPort
                },
                matchDetails: {
                    timeDifference: timeDiff,
                    durationDifference: durationDiff,
                    timingMatch: timeDiff <= 5000,
                    durationMatch: durationDiff <= 10,
                    sameDestinationIP: true
                },
                portAnalysis,
                timeAnalysis,
                dataTransfer: {
                    partyA: {
                        upload: partyAIPDR.uplinkVolume,
                        download: partyAIPDR.downlinkVolume,
                        total: partyAIPDR.totalVolume
                    },
                    partyB: {
                        upload: partyBIPDR.uplinkVolume,
                        download: partyBIPDR.downlinkVolume,
                        total: partyBIPDR.totalVolume
                    }
                },
                confidence
            };
        });
        
        // Sort by confidence (highest first)
        correlations.sort((a, b) => b.confidence - a.confidence);
        
        res.json({
            success: true,
            partyACall: {
                phoneNumber: partyAIPDR.phoneNumber,
                startTime: partyAIPDR.startTime,
                duration: partyAIPDR.duration,
                destinationIP: partyAIPDR.destIP
            },
            expectedPartyB: matchingCDR ? matchingCDR.calledParty : null,
            totalMatches: correlations.length,
            correlations
        });
        
    } catch (error) {
        console.error('Error correlating with Party B:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Find Party B's IPDR session based on destination IP and timing
 */
async function findPartyBIPDRSession(destIP, destPort, startTime, endTime, caseNumber, excludePhoneNumber) {
    try {
        // Look for IPDR records where:
        // 1. The destination IP matches (could be relay server)
        // 2. Timing overlaps
        // 3. Is also a WhatsApp VoIP session
        // 4. Different phone number (not Party A)
        
        const partyBSessions = await IPDR.find({
            caseNumber,
            phoneNumber: { $ne: excludePhoneNumber }, // Different phone number
            destIP: destIP, // Same destination (relay server)
            privatePort: { $gte: 50000, $lte: 59999 }, // WhatsApp media port
            startTime: {
                $gte: new Date(new Date(startTime).getTime() - 10000), // Within 10 seconds
                $lte: new Date(new Date(endTime).getTime() + 10000)
            }
        }).limit(5).lean();
        
        if (partyBSessions.length > 0) {
            // Return the best match (closest timing)
            partyBSessions.sort((a, b) => {
                const diffA = Math.abs(new Date(a.startTime) - new Date(startTime));
                const diffB = Math.abs(new Date(b.startTime) - new Date(startTime));
                return diffA - diffB;
            });
            
            return {
                phoneNumber: partyBSessions[0].phoneNumber,
                imei: partyBSessions[0].imei,
                imsi: partyBSessions[0].imsi,
                sourcePort: partyBSessions[0].privatePort,
                startTime: partyBSessions[0].startTime,
                duration: partyBSessions[0].duration,
                timeDifference: Math.abs(new Date(partyBSessions[0].startTime) - new Date(startTime))
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error finding Party B IPDR:', error);
        return null;
    }
}

/**
 * Calculate correlation confidence score (0-100)
 */
function calculateCorrelationConfidence(ipdr, cdr, partyBIPDR) {
    let confidence = 0;
    
    // Timing match (0-40 points)
    if (cdr) {
        const timeDiff = Math.abs(new Date(cdr.callStartTime) - new Date(ipdr.startTime));
        if (timeDiff <= 1000) confidence += 40; // Within 1 second
        else if (timeDiff <= 3000) confidence += 30; // Within 3 seconds
        else if (timeDiff <= 5000) confidence += 20; // Within 5 seconds
        else confidence += 10; // Within 10 seconds
    }
    
    // Duration match (0-20 points)
    if (cdr) {
        const durationDiff = Math.abs(ipdr.duration - cdr.callDuration);
        if (durationDiff <= 5) confidence += 20; // Within 5 seconds
        else if (durationDiff <= 10) confidence += 15;
        else if (durationDiff <= 30) confidence += 10;
        else confidence += 5;
    }
    
    // WhatsApp media port (0-20 points)
    if (ipdr.privatePort >= 50000 && ipdr.privatePort <= 59999) {
        confidence += 20;
    }
    
    // Party B IPDR found (0-20 points)
    if (partyBIPDR) {
        confidence += 15;
        
        // Additional points if Party B timing is very close
        if (partyBIPDR.timeDifference <= 2000) {
            confidence += 5;
        }
    }
    
    return Math.min(confidence, 100);
}

/**
 * Get all WhatsApp correlations for a case
 */
async function getAllCorrelations(req, res) {
    try {
        const { caseNumber } = req.params;
        
        if (!caseNumber) {
            return res.status(400).json({
                success: false,
                error: 'caseNumber is required'
            });
        }
        
        // Find all unique phone numbers with WhatsApp VoIP calls
        const uniquePhones = await IPDR.distinct('phoneNumber', {
            caseNumber,
            privatePort: { $gte: 50000, $lte: 59999 },
            isVoIP: true,
            duration: { $gte: 10 }
        });
        
        console.log(`Found ${uniquePhones.length} unique phone numbers with WhatsApp calls`);
        
        // Get correlations for each
        const allCorrelations = {};
        
        for (const phone of uniquePhones) {
            // Reuse the findWhatsAppCorrelations logic
            const result = await getCorrelationsForPhone(phone, caseNumber);
            allCorrelations[phone] = result;
        }
        
        res.json({
            success: true,
            caseNumber,
            totalPhoneNumbers: uniquePhones.length,
            correlations: allCorrelations
        });
        
    } catch (error) {
        console.error('Error getting all correlations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Helper to get correlations for a single phone
 */
async function getCorrelationsForPhone(phoneNumber, caseNumber) {
    const whatsappIPDRs = await IPDR.find({
        caseNumber,
        phoneNumber,
        privatePort: { $gte: 50000, $lte: 59999 },
        isVoIP: true,
        duration: { $gte: 10 }
    }).sort({ startTime: 1 }).lean();
    
    if (whatsappIPDRs.length === 0) {
        return { correlations: [], count: 0 };
    }
    
    const minTime = new Date(Math.min(...whatsappIPDRs.map(r => r.startTime)));
    const maxTime = new Date(Math.max(...whatsappIPDRs.map(r => r.endTime)));
    
    const cdrRecords = await CDR.find({
        caseNumber,
        callingParty: phoneNumber,
        callStartTime: {
            $gte: new Date(minTime.getTime() - 10000),
            $lte: new Date(maxTime.getTime() + 10000)
        }
    }).lean();
    
    const correlations = [];
    
    for (const ipdr of whatsappIPDRs) {
        const matchingCDR = cdrRecords.find(cdr => {
            const timeDiff = Math.abs(new Date(cdr.callStartTime) - new Date(ipdr.startTime));
            return timeDiff <= 5000;
        });
        
        if (matchingCDR) {
            const partyBIPDR = await findPartyBIPDRSession(
                ipdr.destIP,
                ipdr.destPort,
                ipdr.startTime,
                ipdr.endTime,
                caseNumber,
                phoneNumber
            );
            
            correlations.push({
                partyA: phoneNumber,
                partyB: matchingCDR.calledParty,
                partyBIPDR: partyBIPDR ? partyBIPDR.phoneNumber : null,
                startTime: ipdr.startTime,
                duration: ipdr.duration,
                destIP: ipdr.destIP,
                destPort: ipdr.destPort,
                sourcePort: ipdr.privatePort,
                confidence: calculateCorrelationConfidence(ipdr, matchingCDR, partyBIPDR)
            });
        }
    }
    
    return {
        correlations,
        count: correlations.length
    };
}

module.exports = {
    listWhatsAppCalls,
    correlateWithPartyB,
    getAllCorrelations
};
