/**
 * Comprehensive Port-to-Service Mapping and Network Analysis Utilities
 * For IPDR Forensic Analysis
 */

// ========== PORT MAPPING DATABASE ==========

const PORT_SERVICES = {
    // Web Services
    80: { service: 'HTTP', app: 'Web Browser', category: 'web', encrypted: false },
    443: { service: 'HTTPS', app: 'Web Browser', category: 'web', encrypted: true },
    8080: { service: 'HTTP-Proxy', app: 'Web Proxy', category: 'web', encrypted: false },
    8443: { service: 'HTTPS-Alt', app: 'Web Browser', category: 'web', encrypted: true },
    
    // Messaging Apps
    5222: { service: 'XMPP', app: 'WhatsApp/Jabber', category: 'messaging', encrypted: true },
    5223: { service: 'XMPP-SSL', app: 'WhatsApp', category: 'messaging', encrypted: true },
    5228: { service: 'GCM', app: 'Google Cloud Messaging', category: 'messaging', encrypted: true },
    5242: { service: 'WhatsApp-Voice', app: 'WhatsApp', category: 'voip', encrypted: true },
    
    // VoIP Services
    3478: { service: 'STUN', app: 'VoIP/WebRTC', category: 'voip', encrypted: false },
    3479: { service: 'STUN-TLS', app: 'VoIP/WebRTC', category: 'voip', encrypted: true },
    5060: { service: 'SIP', app: 'VoIP/SIP', category: 'voip', encrypted: false },
    5061: { service: 'SIP-TLS', app: 'VoIP/SIP', category: 'voip', encrypted: true },
    
    // Telegram
    443: { service: 'HTTPS', app: 'Telegram', category: 'messaging', encrypted: true }, // Overlaps with HTTPS
    
    // Email
    25: { service: 'SMTP', app: 'Email', category: 'email', encrypted: false },
    465: { service: 'SMTPS', app: 'Email', category: 'email', encrypted: true },
    587: { service: 'SMTP-TLS', app: 'Email', category: 'email', encrypted: true },
    110: { service: 'POP3', app: 'Email', category: 'email', encrypted: false },
    995: { service: 'POP3S', app: 'Email', category: 'email', encrypted: true },
    143: { service: 'IMAP', app: 'Email', category: 'email', encrypted: false },
    993: { service: 'IMAPS', app: 'Email', category: 'email', encrypted: true },
    
    // Remote Access
    22: { service: 'SSH', app: 'SSH/SFTP', category: 'remote', encrypted: true },
    23: { service: 'Telnet', app: 'Telnet', category: 'remote', encrypted: false },
    3389: { service: 'RDP', app: 'Remote Desktop', category: 'remote', encrypted: true },
    5900: { service: 'VNC', app: 'VNC', category: 'remote', encrypted: false },
    
    // VPN Protocols
    500: { service: 'IKE', app: 'IPSec VPN', category: 'vpn', encrypted: true, isVPN: true },
    1194: { service: 'OpenVPN', app: 'OpenVPN', category: 'vpn', encrypted: true, isVPN: true },
    1701: { service: 'L2TP', app: 'L2TP VPN', category: 'vpn', encrypted: true, isVPN: true },
    1723: { service: 'PPTP', app: 'PPTP VPN', category: 'vpn', encrypted: true, isVPN: true },
    4500: { service: 'IPSec-NAT', app: 'IPSec VPN', category: 'vpn', encrypted: true, isVPN: true },
    
    // Tor & Anonymity
    9001: { service: 'Tor', app: 'Tor Network', category: 'anonymity', encrypted: true, isTor: true },
    9030: { service: 'Tor-Dir', app: 'Tor Directory', category: 'anonymity', encrypted: true, isTor: true },
    9050: { service: 'Tor-SOCKS', app: 'Tor SOCKS', category: 'anonymity', encrypted: true, isTor: true },
    9051: { service: 'Tor-Control', app: 'Tor Control', category: 'anonymity', encrypted: true, isTor: true },
    
    // Proxy Services
    1080: { service: 'SOCKS', app: 'SOCKS Proxy', category: 'proxy', encrypted: false, isProxy: true },
    3128: { service: 'Squid', app: 'Squid Proxy', category: 'proxy', encrypted: false, isProxy: true },
    8888: { service: 'HTTP-Proxy', app: 'HTTP Proxy', category: 'proxy', encrypted: false, isProxy: true },
    
    // File Sharing
    20: { service: 'FTP-Data', app: 'FTP', category: 'file', encrypted: false },
    21: { service: 'FTP', app: 'FTP', category: 'file', encrypted: false },
    445: { service: 'SMB', app: 'File Sharing', category: 'file', encrypted: false },
    
    // DNS
    53: { service: 'DNS', app: 'DNS', category: 'infrastructure', encrypted: false },
    853: { service: 'DNS-TLS', app: 'DNS over TLS', category: 'infrastructure', encrypted: true },
    
    // Gaming
    3074: { service: 'Xbox', app: 'Xbox Live', category: 'gaming', encrypted: false },
    27015: { service: 'Steam', app: 'Steam Gaming', category: 'gaming', encrypted: false },
    
    // Database
    3306: { service: 'MySQL', app: 'MySQL', category: 'database', encrypted: false },
    5432: { service: 'PostgreSQL', app: 'PostgreSQL', category: 'database', encrypted: false },
    27017: { service: 'MongoDB', app: 'MongoDB', category: 'database', encrypted: false },
    
    // Suspicious/Uncommon
    4444: { service: 'Unknown', app: 'Potentially Malicious', category: 'suspicious', encrypted: false, isSuspicious: true },
    6666: { service: 'IRC', app: 'IRC/Botnet', category: 'suspicious', encrypted: false, isSuspicious: true },
    31337: { service: 'Back Orifice', app: 'Backdoor', category: 'suspicious', encrypted: false, isSuspicious: true },
};

// WhatsApp UDP Port Ranges (for VoIP detection)
const WHATSAPP_UDP_PORTS = {
    ranges: [
        { min: 3478, max: 3497 }, // STUN/TURN for WhatsApp calls
        { min: 50000, max: 59999 }, // RTP ports for voice/video
    ],
    fixedPorts: [5222, 5223, 5242, 5228]
};

// Telegram Port Ranges
const TELEGRAM_PORTS = {
    tcp: [443, 80, 5222],
    udp: [443, 80]
};

// Known VPN Provider IP Ranges (Free sources compilation)
const VPN_PROVIDERS = {
    'NordVPN': ['91.90.0.0/16', '89.187.160.0/22', '185.98.224.0/22'],
    'ExpressVPN': ['194.60.248.0/21', '23.254.128.0/19'],
    'ProtonVPN': ['185.107.56.0/22', '193.4.56.0/24'],
    'Surfshark': ['86.106.80.0/20'],
    'CyberGhost': ['89.39.0.0/17', '45.95.168.0/22'],
    'HideMyAss': ['195.154.0.0/16'],
    'TunnelBear': ['104.244.64.0/20'],
    'Windscribe': ['69.4.224.0/20'],
    'IPVanish': ['209.95.32.0/19'],
    'VyprVPN': ['199.231.206.0/24'],
};

// Tor Exit Node IP Ranges (Sample - in production, fetch from https://check.torproject.org/exit-addresses)
const TOR_EXIT_NODES = [
    '103.251.167.0/24',
    '185.220.101.0/24',
    '23.129.64.0/24',
    '199.249.230.0/24',
    // Add more from Tor Project's public list
];

// Public proxy/datacenter IP ranges (known cloud providers)
const DATACENTER_RANGES = {
    'AWS': ['3.0.0.0/8', '13.0.0.0/8', '18.0.0.0/8', '52.0.0.0/8', '54.0.0.0/8'],
    'Google Cloud': ['34.0.0.0/8', '35.0.0.0/8', '104.196.0.0/14'],
    'Azure': ['13.64.0.0/11', '40.64.0.0/10', '52.224.0.0/11'],
    'DigitalOcean': ['104.131.0.0/16', '159.65.0.0/16', '178.128.0.0/16'],
    'Linode': ['45.33.0.0/16', '172.104.0.0/15'],
    'Vultr': ['45.32.0.0/16', '108.61.0.0/16', '207.246.0.0/16'],
};

// ========== ANALYSIS FUNCTIONS ==========

/**
 * Detect service type from port number
 */
function detectServiceFromPort(port, protocol) {
    const portInfo = PORT_SERVICES[port];
    
    if (portInfo) {
        return portInfo;
    }
    
    // Check WhatsApp UDP ranges
    if (protocol === 'UDP') {
        for (const range of WHATSAPP_UDP_PORTS.ranges) {
            if (port >= range.min && port <= range.max) {
                return {
                    service: 'WhatsApp-VoIP',
                    app: 'WhatsApp',
                    category: 'voip',
                    encrypted: true,
                    isVoIP: true
                };
            }
        }
    }
    
    // Check high ports (ephemeral/dynamic)
    if (port >= 49152 && port <= 65535) {
        return {
            service: 'Ephemeral',
            app: 'Dynamic Port',
            category: 'dynamic',
            encrypted: false
        };
    }
    
    return {
        service: 'Unknown',
        app: 'Unknown',
        category: 'unknown',
        encrypted: false,
        isSuspicious: true
    };
}

/**
 * Check if IP belongs to known VPN provider
 */
function detectVPN(ip) {
    const ipNum = ipToNumber(ip);
    
    for (const [provider, ranges] of Object.entries(VPN_PROVIDERS)) {
        for (const cidr of ranges) {
            if (isIPInRange(ipNum, cidr)) {
                return {
                    isVPN: true,
                    provider: provider,
                    confidence: 95
                };
            }
        }
    }
    
    return { isVPN: false, provider: null, confidence: 0 };
}

/**
 * Check if IP is a Tor exit node
 */
function detectTor(ip) {
    const ipNum = ipToNumber(ip);
    
    for (const cidr of TOR_EXIT_NODES) {
        if (isIPInRange(ipNum, cidr)) {
            return {
                isTor: true,
                confidence: 99
            };
        }
    }
    
    return { isTor: false, confidence: 0 };
}

/**
 * Check if IP belongs to datacenter/proxy
 */
function detectDatacenter(ip) {
    const ipNum = ipToNumber(ip);
    
    for (const [provider, ranges] of Object.entries(DATACENTER_RANGES)) {
        for (const cidr of ranges) {
            if (isIPInRange(ipNum, cidr)) {
                return {
                    isDatacenter: true,
                    provider: provider,
                    confidence: 90
                };
            }
        }
    }
    
    return { isDatacenter: false, provider: null, confidence: 0 };
}

/**
 * Analyze traffic pattern for suspicious behavior
 */
function analyzeTrafficPattern(record) {
    const suspicions = [];
    let isSuspicious = false;
    
    // 1. Check for encrypted traffic on unusual ports
    if (record.destPort !== 443 && record.destPort !== 22 && record.isEncrypted) {
        suspicions.push('Encrypted traffic on non-standard port');
        isSuspicious = true;
    }
    
    // 2. Check for very high data transfer
    if (record.totalVolume > 1000000000) { // > 1GB
        suspicions.push('Unusually high data volume');
        isSuspicious = true;
    }
    
    // 3. Check for unusual upload/download ratio
    const ratio = record.uplinkVolume / (record.downlinkVolume || 1);
    if (ratio > 10 || ratio < 0.1) {
        suspicions.push('Unusual upload/download ratio');
        isSuspicious = true;
    }
    
    // 4. Check for connections to multiple IPs in short time
    // (This would require correlation analysis)
    
    // 5. Check for suspicious ports
    const portInfo = detectServiceFromPort(record.destPort, record.protocol);
    if (portInfo.isSuspicious) {
        suspicions.push(`Suspicious port: ${record.destPort}`);
        isSuspicious = true;
    }
    
    return {
        isSuspicious,
        suspicionReason: suspicions.join('; '),
        trafficPattern: determineTrafficPattern(record)
    };
}

/**
 * Determine traffic pattern
 */
function determineTrafficPattern(record) {
    const duration = (record.endTime - record.startTime) / 1000; // in seconds
    const avgSpeed = record.totalVolume / duration;
    
    if (avgSpeed > 5000000) return 'burst'; // > 5MB/s
    if (avgSpeed < 100000) return 'intermittent'; // < 100KB/s
    return 'steady';
}

/**
 * Convert IP to number for range checking
 */
function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Check if IP is in CIDR range
 */
function isIPInRange(ipNum, cidr) {
    const [range, bits] = cidr.split('/');
    const mask = ~(Math.pow(2, 32 - parseInt(bits)) - 1);
    return (ipNum & mask) === (ipToNumber(range) & mask);
}

/**
 * Detect WhatsApp Call by analyzing UDP ports and timing
 */
function detectWhatsAppCall(ipdrRecords, timeWindow = 30000) {
    // Group records by time windows
    const whatsappSessions = [];
    
    for (let i = 0; i < ipdrRecords.length; i++) {
        const record = ipdrRecords[i];
        
        // Check if it's WhatsApp VoIP port
        if (record.protocol === 'UDP' && 
            (record.isVoIP || WHATSAPP_UDP_PORTS.fixedPorts.includes(record.destPort))) {
            
            // Look for corresponding records in time window
            const sessionRecords = ipdrRecords.filter(r => 
                Math.abs(r.startTime - record.startTime) < timeWindow &&
                r.protocol === 'UDP' &&
                r.phoneNumber === record.phoneNumber
            );
            
            if (sessionRecords.length > 1) {
                whatsappSessions.push({
                    phoneNumber: record.phoneNumber,
                    startTime: record.startTime,
                    records: sessionRecords,
                    confidence: 85
                });
            }
        }
    }
    
    return whatsappSessions;
}

/**
 * Correlate IPDR with CDR to find Party B
 * Match timing of WhatsApp calls with CDR records
 */
function correlateIPDRwithCDR(ipdrRecord, cdrRecords, timeWindow = 60000) {
    const matches = [];
    
    if (!ipdrRecord.isVoIP) {
        return { partyB: null, confidence: 0, method: 'N/A' };
    }
    
    // Find CDR records in time window
    for (const cdr of cdrRecords) {
        const timeDiff = Math.abs(cdr.startTime - ipdrRecord.startTime);
        
        if (timeDiff < timeWindow) {
            // Calculate correlation score
            let score = 100 - (timeDiff / timeWindow) * 50; // Time proximity score
            
            // Boost score if durations match
            const ipdrDuration = (ipdrRecord.endTime - ipdrRecord.startTime) / 1000;
            const cdrDuration = cdr.callDuration;
            const durationDiff = Math.abs(ipdrDuration - cdrDuration);
            
            if (durationDiff < 10) { // Within 10 seconds
                score += 30;
            }
            
            matches.push({
                partyB: cdr.calledNumber,
                confidence: Math.min(score, 100),
                method: 'Time-Duration Correlation',
                timeDiff: timeDiff,
                durationDiff: durationDiff
            });
        }
    }
    
    // Return best match
    if (matches.length > 0) {
        matches.sort((a, b) => b.confidence - a.confidence);
        return matches[0];
    }
    
    return { partyB: null, confidence: 0, method: 'No correlation found' };
}

module.exports = {
    PORT_SERVICES,
    WHATSAPP_UDP_PORTS,
    TELEGRAM_PORTS,
    VPN_PROVIDERS,
    TOR_EXIT_NODES,
    DATACENTER_RANGES,
    detectServiceFromPort,
    detectVPN,
    detectTor,
    detectDatacenter,
    analyzeTrafficPattern,
    detectWhatsAppCall,
    correlateIPDRwithCDR,
    ipToNumber,
    isIPInRange
};
