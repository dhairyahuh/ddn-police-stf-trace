/**
 * IPDR Analysis & Correlation Engine
 * Detects WhatsApp calls, VoIP, encrypted traffic, and correlates Party B
 */

// Known WhatsApp Server IP Ranges (approximate - these change)
const WHATSAPP_IP_RANGES = [
    { start: '31.13.', desc: 'Facebook/WhatsApp' },
    { start: '157.240.', desc: 'Facebook/WhatsApp' },
    { start: '179.60.', desc: 'WhatsApp Brazil' },
    { start: '185.60.', desc: 'WhatsApp Europe' },
];

// Known port ranges for different services
const PORT_SIGNATURES = {
    WHATSAPP_VOICE: { ports: [3478, 50000, 50001, 50002, 50003], protocol: 'UDP', range: [50000, 60000] },
    WHATSAPP_WEB: { ports: [80, 443, 5222], protocol: 'TCP' },
    TELEGRAM: { ports: [443], protocol: 'TCP' },
    SIGNAL: { ports: [443], protocol: 'TCP' },
    SKYPE: { ports: [3478, 3479], protocol: 'UDP', range: [50000, 65535] },
    VPN_OPENVPN: { ports: [1194], protocol: 'UDP' },
    VPN_L2TP: { ports: [1701], protocol: 'UDP' },
    VPN_PPTP: { ports: [1723], protocol: 'TCP' },
    TOR: { ports: [9001, 9030, 9050, 9051], protocol: 'TCP' },
    PROXY_SOCKS: { ports: [1080], protocol: 'TCP' },
    PROXY_HTTP: { ports: [3128, 8080, 8888], protocol: 'TCP' },
};

// Known Tor exit node IPs (small sample - in production, maintain updated list)
const TOR_EXIT_NODES = ['185.220.', '51.15.', '176.10.'];

// VPN provider IP ranges (sample)
const VPN_PROVIDERS = {
    'NordVPN': ['193.37.', '193.29.'],
    'ExpressVPN': ['169.150.', '216.131.'],
    'ProtonVPN': ['185.159.'],
};

/**
 * Analyze single IPDR record and classify it
 */
function analyzeIPDRRecord(record) {
    const analysis = {
        serviceType: 'Unknown',
        application: null,
        isVPN: false,
        isProxy: false,
        isTor: false,
        isEncrypted: false,
        isVoIP: false,
        isMessaging: false,
        isSuspicious: false,
        suspicionReasons: [],
        confidence: 0
    };

    const destPort = record.destPort || record.publicPort || 0;
    const destIP = record.destIP || record.publicIP || '';
    const protocol = (record.protocol || '').toUpperCase();
    const uplinkVolume = record.uplinkVolume || 0;
    const downlinkVolume = record.downlinkVolume || 0;
    const duration = record.duration || 0;

    // === WhatsApp Detection ===
    // Check if IP matches WhatsApp ranges
    const isWhatsAppIP = WHATSAPP_IP_RANGES.some(range => destIP.startsWith(range.start));
    
    // WhatsApp Voice/Video Call Detection
    if (protocol === 'UDP' && 
        (PORT_SIGNATURES.WHATSAPP_VOICE.ports.includes(destPort) || 
         (destPort >= PORT_SIGNATURES.WHATSAPP_VOICE.range[0] && destPort <= PORT_SIGNATURES.WHATSAPP_VOICE.range[1]))) {
        analysis.application = 'WhatsApp Voice/Video';
        analysis.isVoIP = true;
        analysis.isMessaging = true;
        analysis.serviceType = 'VoIP';
        analysis.confidence = isWhatsAppIP ? 95 : 75;
    }
    // WhatsApp Web/Chat Detection
    else if (isWhatsAppIP && protocol === 'TCP' && [80, 443, 5222].includes(destPort)) {
        analysis.application = 'WhatsApp Chat';
        analysis.isMessaging = true;
        analysis.serviceType = 'Messaging';
        analysis.isEncrypted = destPort === 443;
        analysis.confidence = 90;
    }

    // === Telegram Detection ===
    // Telegram uses HTTPS on port 443 with specific IP ranges (149.154.*)
    if (destIP.startsWith('149.154.') && protocol === 'TCP' && destPort === 443) {
        analysis.application = 'Telegram';
        analysis.isMessaging = true;
        analysis.serviceType = 'Messaging';
        analysis.isEncrypted = true;
        analysis.confidence = 90;
    }

    // === Signal Detection ===
    // Signal uses specific domains, harder to detect via IP alone
    if (protocol === 'TCP' && destPort === 443 && duration > 60 && uplinkVolume > 1000 && downlinkVolume > 1000) {
        // Could be Signal, but low confidence without domain info
        if (!analysis.application) {
            analysis.application = 'Encrypted Messaging (Possible Signal/WhatsApp)';
            analysis.isMessaging = true;
            analysis.isEncrypted = true;
            analysis.confidence = 50;
        }
    }

    // === VPN Detection ===
    if (PORT_SIGNATURES.VPN_OPENVPN.ports.includes(destPort) && protocol === 'UDP') {
        analysis.isVPN = true;
        analysis.application = 'OpenVPN';
        analysis.serviceType = 'VPN';
        analysis.isSuspicious = true;
        analysis.suspicionReasons.push('VPN usage detected - may hide internet activity');
        analysis.confidence = 85;
    }
    if (PORT_SIGNATURES.VPN_L2TP.ports.includes(destPort) && protocol === 'UDP') {
        analysis.isVPN = true;
        analysis.application = 'L2TP VPN';
        analysis.serviceType = 'VPN';
        analysis.isSuspicious = true;
        analysis.suspicionReasons.push('VPN usage detected');
        analysis.confidence = 85;
    }

    // Check against known VPN provider IPs
    for (const [provider, ipRanges] of Object.entries(VPN_PROVIDERS)) {
        if (ipRanges.some(range => destIP.startsWith(range))) {
            analysis.isVPN = true;
            analysis.application = `${provider} VPN`;
            analysis.serviceType = 'VPN';
            analysis.isSuspicious = true;
            analysis.suspicionReasons.push(`${provider} VPN detected`);
            analysis.confidence = 95;
            break;
        }
    }

    // === Tor Detection ===
    if (TOR_EXIT_NODES.some(node => destIP.startsWith(node))) {
        analysis.isTor = true;
        analysis.application = 'Tor Network';
        analysis.serviceType = 'Anonymization';
        analysis.isSuspicious = true;
        analysis.suspicionReasons.push('Tor network usage - anonymization tool');
        analysis.confidence = 90;
    }
    if (PORT_SIGNATURES.TOR.ports.includes(destPort)) {
        analysis.isTor = true;
        analysis.application = 'Tor Network';
        analysis.serviceType = 'Anonymization';
        analysis.isSuspicious = true;
        analysis.suspicionReasons.push('Tor port detected');
        analysis.confidence = 80;
    }

    // === Proxy Detection ===
    if (PORT_SIGNATURES.PROXY_SOCKS.ports.includes(destPort) || 
        PORT_SIGNATURES.PROXY_HTTP.ports.includes(destPort)) {
        analysis.isProxy = true;
        analysis.application = 'Proxy Server';
        analysis.serviceType = 'Proxy';
        analysis.isSuspicious = true;
        analysis.suspicionReasons.push('Proxy server detected');
        analysis.confidence = 75;
    }

    // === Skype Detection ===
    if (protocol === 'UDP' && 
        (PORT_SIGNATURES.SKYPE.ports.includes(destPort) || 
         (destPort >= PORT_SIGNATURES.SKYPE.range[0] && destPort <= PORT_SIGNATURES.SKYPE.range[1]))) {
        analysis.application = 'Skype';
        analysis.isVoIP = true;
        analysis.serviceType = 'VoIP';
        analysis.confidence = 70;
    }

    // === General HTTPS Encrypted Traffic ===
    if (protocol === 'TCP' && destPort === 443 && !analysis.application) {
        analysis.isEncrypted = true;
        analysis.serviceType = 'HTTPS';
        analysis.application = 'Encrypted Web Traffic';
        analysis.confidence = 60;
    }

    // === Suspicious Patterns ===
    // Large data transfer to unknown destination
    if (record.totalVolume > 100000000 && !analysis.application) { // > 100 MB
        analysis.isSuspicious = true;
        analysis.suspicionReasons.push('Large data transfer detected');
    }

    // High frequency connections to same IP
    // (Would need multiple records to detect this - mark for future correlation)

    // Night-time internet usage (10 PM - 6 AM)
    if (record.startTime) {
        const hour = new Date(record.startTime).getHours();
        if (hour >= 22 || hour < 6) {
            analysis.suspicionReasons.push('Night-time internet usage');
        }
    }

    return analysis;
}

/**
 * Correlate WhatsApp/VoIP calls between two parties
 * Finds bidirectional UDP traffic on VoIP ports with matching timestamps
 */
function correlateWhatsAppCalls(ipdrRecords) {
    const voipCalls = [];
    
    // Filter for potential VoIP traffic
    const potentialVoIP = ipdrRecords.filter(r => {
        const analysis = analyzeIPDRRecord(r);
        return analysis.isVoIP || 
               (r.protocol === 'UDP' && r.destPort >= 50000 && r.destPort <= 60000);
    });

    // Group by IMSI (caller)
    const callsByIMSI = {};
    potentialVoIP.forEach(record => {
        const imsi = record.imsi;
        if (!callsByIMSI[imsi]) {
            callsByIMSI[imsi] = [];
        }
        callsByIMSI[imsi].push(record);
    });

    // For each caller, find potential call pairs
    Object.entries(callsByIMSI).forEach(([imsi, records]) => {
        records.forEach(recordA => {
            // Look for another record with same destination IP around same time
            const matches = ipdrRecords.filter(recordB => {
                if (recordB.imsi === imsi) return false; // Different person
                
                // Check if recordB is communicating with recordA's IP
                const isReverseDirection = 
                    recordB.destIP === recordA.privateIP || 
                    recordB.destIP === recordA.publicIP ||
                    recordA.destIP === recordB.privateIP ||
                    recordA.destIP === recordB.publicIP;
                
                if (!isReverseDirection) return false;

                // Check timestamp proximity (within 5 seconds)
                const timeDiff = Math.abs(
                    new Date(recordA.startTime) - new Date(recordB.startTime)
                ) / 1000;
                
                return timeDiff <= 5 && recordB.protocol === 'UDP';
            });

            if (matches.length > 0) {
                const match = matches[0];
                voipCalls.push({
                    partyA_IMSI: imsi,
                    partyA_IMEI: recordA.imei,
                    partyB_IMSI: match.imsi,
                    partyB_IMEI: match.imei,
                    timestamp: recordA.startTime,
                    duration: Math.max(recordA.duration || 0, match.duration || 0),
                    confidence: 85,
                    correlationMethod: 'Bidirectional UDP VoIP Pattern',
                    application: 'WhatsApp Voice/Video (Likely)',
                    partyA_Record: recordA._id,
                    partyB_Record: match._id
                });
            }
        });
    });

    return voipCalls;
}

/**
 * Find Party B for WhatsApp calls by correlating with CDR data
 * If IPDR shows WhatsApp call at time X, check CDR for calls around same time
 */
function correlateIPDRWithCDR(ipdrRecords, cdrRecords) {
    const correlations = [];

    ipdrRecords.forEach(ipdr => {
        const analysis = analyzeIPDRRecord(ipdr);
        
        if (analysis.isVoIP) {
            // Find CDR records around same time (±2 minutes)
            const ipdrTime = new Date(ipdr.startTime).getTime();
            
            const matchingCDRs = cdrRecords.filter(cdr => {
                const cdrTime = new Date(cdr.startTime).getTime();
                const timeDiff = Math.abs(ipdrTime - cdrTime) / 1000; // seconds
                
                // Within 2 minutes and same IMSI
                return timeDiff <= 120 && cdr.imsi === ipdr.imsi;
            });

            if (matchingCDRs.length > 0) {
                matchingCDRs.forEach(cdr => {
                    correlations.push({
                        ipdr_id: ipdr._id,
                        cdr_id: cdr._id,
                        imsi: ipdr.imsi,
                        timestamp: ipdr.startTime,
                        partyB: cdr.calledNumber,
                        confidence: 75,
                        reason: 'WhatsApp call correlated with CDR call timing',
                        application: analysis.application
                    });
                });
            }
        }
    });

    return correlations;
}

/**
 * Detect messaging patterns
 * Frequent small data transfers to messaging servers
 */
function detectMessagingPatterns(ipdrRecords) {
    const messagingActivity = {};

    ipdrRecords.forEach(record => {
        const analysis = analyzeIPDRRecord(record);
        
        if (analysis.isMessaging) {
            const date = new Date(record.startTime).toDateString();
            const key = `${record.imsi}_${date}`;
            
            if (!messagingActivity[key]) {
                messagingActivity[key] = {
                    imsi: record.imsi,
                    date: date,
                    applications: {},
                    totalMessages: 0,
                    totalDataMB: 0
                };
            }
            
            const app = analysis.application || 'Unknown';
            messagingActivity[key].applications[app] = 
                (messagingActivity[key].applications[app] || 0) + 1;
            messagingActivity[key].totalMessages++;
            messagingActivity[key].totalDataMB += (record.totalVolume || 0) / 1024 / 1024;
        }
    });

    return Object.values(messagingActivity);
}

module.exports = {
    analyzeIPDRRecord,
    correlateWhatsAppCalls,
    correlateIPDRWithCDR,
    detectMessagingPatterns,
    WHATSAPP_IP_RANGES,
    PORT_SIGNATURES
};
