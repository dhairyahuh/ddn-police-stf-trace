/**
 * IPDR CSV Upload Parser with Advanced Intelligence
 * 
 * Features:
 * - Port-to-service mapping
 * - VPN/Proxy/Tor detection
 * - WhatsApp call detection via UDP ports
 * - Party B correlation using timing analysis
 * - Suspicious activity flagging
 * - IP geolocation and ASN lookup
 */

const csv = require('csv-parser');
const fs = require('fs');
const { IPDR } = require('../models/ipDetails');
const { CDR } = require('../models/callDetails');
const geoip = require('geoip-lite');
const {
    detectServiceFromPort,
    detectVPN,
    detectTor,
    detectDatacenter,
    isWhatsAppIP,
    isWhatsAppPort,
    analyzeTrafficPattern,
    correlateIPDRwithCDR
} = require('../utils/ipdrAnalysisAccurate');

/**
 * Process and enrich IPDR record with intelligence (ACCURATE VERSION)
 */
async function enrichIPDRRecord(record, caseNumber, cdrRecords) {
    // Ensure caseNumber is set
    record.caseNumber = caseNumber;
    
    // Detect service from destination port
    const portInfo = detectServiceFromPort(record.destPort, record.protocol);
    record.serviceType = portInfo.service;
    record.application = portInfo.app;
    record.isEncrypted = portInfo.encrypted || false;
    
    // Check if port indicates VoIP
    if (portInfo.isVoIP || portInfo.category === 'voip') {
        record.isVoIP = true;
    }
    
    // Check if port indicates messaging
    if (portInfo.category === 'messaging') {
        record.isMessaging = true;
    }
    
    // === ACCURATE IP GEOLOCATION ===
    const geo = geoip.lookup(record.destIP);
    if (geo) {
        record.destIPCountry = geo.country;
        record.destIPCity = geo.city || 'Unknown';
        record.destIPASN = `AS${geo.as}` || 'Unknown';
        record.destIPOrganization = geo.organization || 'Unknown';
    }
    
    // === ACCURATE VPN DETECTION ===
    const vpnCheck = await detectVPN(record.destIP);
    if (vpnCheck.isVPN) {
        record.isVPN = true;
        record.vpnProvider = vpnCheck.provider;
        record.vpnConfidence = vpnCheck.confidence;
        record.suspicionReason = `VPN detected: ${vpnCheck.provider}`;
    }
    
    // === ACCURATE TOR DETECTION (Real-time from Tor Project) ===
    const torCheck = await detectTor(record.destIP);
    if (torCheck.isTor) {
        record.isTor = true;
        record.suspicionReason = 'Tor exit node detected (Official Tor Project list)';
    }
    
    // === ACCURATE DATACENTER/PROXY DETECTION ===
    const datacenterCheck = detectDatacenter(record.destIP);
    if (datacenterCheck.isDatacenter) {
        record.isProxy = true;
        if (!record.vpnProvider) {
            record.vpnProvider = `Datacenter: ${datacenterCheck.provider}`;
        }
        if (!record.suspicionReason) {
            record.suspicionReason = `Cloud/Datacenter IP: ${datacenterCheck.provider}`;
        }
    }
    
    // === ACCURATE WHATSAPP DETECTION ===
    const whatsappIPCheck = isWhatsAppIP(record.destIP);
    const whatsappPortCheck = isWhatsAppPort(record.destPort, record.protocol);
    
    if (whatsappIPCheck.isWhatsApp || whatsappPortCheck.isWhatsAppVoIP) {
        record.isVoIP = true;
        record.isMessaging = true;
        record.application = 'WhatsApp';
        record.serviceType = whatsappPortCheck.type || 'WhatsApp Service';
        
        if (whatsappPortCheck.isWhatsAppVoIP && whatsappPortCheck.type === 'media') {
            // This is WhatsApp VoIP - correlate with CDR to find Party B
            const correlation = await correlateIPDRwithCDR(record, cdrRecords);
            if (correlation.found) {
                record.correlatedPartyB = correlation.partyB;
                record.correlationConfidence = correlation.confidence;
                record.correlationMethod = correlation.method;
            }
        }
    }
    
    // Check for suspicious port if flagged
    if (portInfo.isSuspicious || portInfo.isTor) {
        record.isSuspicious = true;
        if (!record.suspicionReason) {
            record.suspicionReason = `Suspicious port: ${record.destPort}`;
        }
    }
    
    // Analyze traffic pattern
    const pattern = analyzeTrafficPattern(record);
    record.trafficPattern = pattern.trafficPattern;
    if (pattern.isSuspicious) {
        record.isSuspicious = true;
        record.suspicionReason = record.suspicionReason 
            ? `${record.suspicionReason}; ${pattern.suspicionReason}`
            : pattern.suspicionReason;
    }
    
    // Calculate data ratio
    if (record.downlinkVolume > 0) {
        record.dataRatio = record.uplinkVolume / record.downlinkVolume;
    }
    
    // Correlate with CDR for Party B detection (if VoIP)
    if (record.isVoIP && cdrRecords && cdrRecords.length > 0) {
        const correlation = correlateIPDRwithCDR(record, cdrRecords);
        if (correlation.partyB) {
            record.correlatedPartyB = correlation.partyB;
            record.correlationConfidence = correlation.confidence;
            record.correlationMethod = correlation.method;
        }
    }
    
    return record;
}

/**
 * Parse IPDR CSV file
 */
function parseIPDRCSV(filePath, caseNumber, callback) {
    let recordCount = 0;
    let errorCount = 0;
    const records = [];
    
    // Helper to parse various date formats
    const parseDateTime = (dateStr, dateOnly, timeOnly) => {
        // Try combined date-time field first
        if (dateStr && typeof dateStr === 'string' && dateStr.trim()) {
            // Format: "14/09/2025 15:28:06" (dd/MM/yyyy HH:mm:ss)
            const ddMMyyyyHHmmss = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/;
            const match = dateStr.match(ddMMyyyyHHmmss);
            if (match) {
                const [, day, month, year, hour, min, sec] = match;
                return new Date(year, month - 1, day, hour, min, sec);
            }
        }
        
        // Try combining separate date and time fields
        if (dateOnly && timeOnly) {
            // Date format: "dd/mm/yyyy", Time format: "hh:mm:ss"
            const dateMatch = dateOnly.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            const timeMatch = timeOnly.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (dateMatch && timeMatch) {
                const [, day, month, year] = dateMatch;
                const [, hour, min, sec] = timeMatch;
                return new Date(year, month - 1, day, hour, min, sec);
            }
        }
        
        // Fallback to current time
        return new Date();
    };
    
    // Helper to find column value (case-insensitive)
    const findColumnValue = (row, possibleNames) => {
        for (const name of possibleNames) {
            for (const key in row) {
                if (key.toLowerCase().trim() === name.toLowerCase().trim()) {
                    return row[key];
                }
            }
        }
        return null;
    };
    
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headers) => {
            console.log('CSV Headers detected:', headers);
        })
        .on('data', async (row) => {
            try {
                // Log first row for debugging
                if (records.length === 0) {
                    console.log('First CSV row keys:', Object.keys(row));
                    console.log('First CSV row sample:', JSON.stringify(row, null, 2).substring(0, 500));
                }
                
                // Extract fields with multiple possible column names
                const time1 = findColumnValue(row, ['TIME1 (dd/MM/yyyy HH:mm:ss)', 'session_start', 'start time', 'session start', 'starttime', 'startTime']);
                const endTimeValue = findColumnValue(row, ['endtime', 'endTime', 'end time', 'session_end', 'end_time']);
                const startDate = findColumnValue(row, ['Start Date of Public IP Address allocation (dd/mm/yyyy)', 'start date', 'date']);
                const startTimeOnly = findColumnValue(row, ['IST Start Time of Public IP address allocation (hh:mm:ss)', 'start time', 'time']);
                
                const ipdrData = {
                    caseNumber: caseNumber,
                    phoneNumber: findColumnValue(row, ['Landline/MSISDN/MDN/Leased Circuit ID for Internet Access', 'served_msisdn', 'msisdn', 'phone number', 'calling party', 'subscriber']),
                    privateIP: findColumnValue(row, ['Source IP Address', 'served_ipv4_address', 'served_ipv6_address', 'private ip', 'ue ip', 'subscriber ip', 'privateIP', 'privateip']),
                    privatePort: parseInt(findColumnValue(row, ['Source Port', 'private port', 'ue port', 'source port', 'privatePort', 'privateport'])) || 0,
                    publicIP: findColumnValue(row, ['Translated IP Address', 'pgw_address', 'public ip', 'ggsn ip', 'serving node ip', 'publicIP', 'publicip']) || null,
                    publicPort: parseInt(findColumnValue(row, ['Translated Port', 'public port', 'ggsn port', 'publicPort', 'publicport'])) || 0,
                    destIP: findColumnValue(row, ['Destination IP Address', 'destination ip', 'dest ip', 'server ip', 'remote ip', 'destIP', 'destip']) || 'N/A',
                    destPort: parseInt(findColumnValue(row, ['Destination Port', 'destination port', 'dest port', 'server port', 'remote port', 'destPort', 'destport'])) || 0,
                    protocol: findColumnValue(row, ['protocol', 'ip protocol', 'Protocol']) || 'IP',
                    startTime: parseDateTime(time1, startDate, startTimeOnly),
                    endTime: endTimeValue ? parseDateTime(endTimeValue, null, null) : null,
                    uplinkVolume: parseInt(findColumnValue(row, ['Data Volume Up Link', 'datavolumeuplink', 'uplink', 'upload', 'uplink volume', 'bytes sent', 'uplinkVolume', 'uplinkvolume'])) || 0,
                    downlinkVolume: parseInt(findColumnValue(row, ['Data Volume Down Link', 'datavolumedownlink', 'downlink', 'download', 'downlink volume', 'bytes received', 'downlinkVolume', 'downlinkvolume'])) || 0,
                    totalVolume: parseInt(findColumnValue(row, ['total volume', 'total bytes', 'data volume', 'totalVolume', 'totalvolume'])) || 0,
                    imei: findColumnValue(row, ['Source MAC-ID Address/Other device Identification number', 'imei', 'IMEI']),
                    imsi: findColumnValue(row, ['IMSI', 'served_imsi', 'imsi']),
                    originCellID: findColumnValue(row, ['First CELL ID', 'ecgi_id', 'cell id', 'cgi', 'lac ci', 'ecgi', 'originCellID', 'origincellid']),
                    accessType: findColumnValue(row, ['Access Point Name', 'rat type', 'access type', 'network type', 'accessType', 'accesstype']) || 'LTE',
                    roamingIndicator: findColumnValue(row, ['Roaming Circle Indicator', 'roaming_indicator', 'roaming']),
                    roamingCircle: findColumnValue(row, ['Roaming Circle']),
                    duration: parseInt(findColumnValue(row, ['Session Duration', 'duration', 'Duration'])) || 0,
                    // Location fields
                    originLat: parseFloat(findColumnValue(row, ['latitude', 'lat', 'originLat', 'originlat'])) || 28.7041,
                    originLong: parseFloat(findColumnValue(row, ['longitude', 'long', 'lon', 'originLong', 'originlong'])) || 77.1025,
                };
                
                // Calculate total volume if not provided
                if (ipdrData.totalVolume === 0) {
                    ipdrData.totalVolume = ipdrData.uplinkVolume + ipdrData.downlinkVolume;
                }
                
                // Calculate endTime from startTime + duration
                if (ipdrData.startTime && ipdrData.duration) {
                    ipdrData.endTime = new Date(ipdrData.startTime.getTime() + (ipdrData.duration * 1000));
                } else if (!ipdrData.endTime) {
                    ipdrData.endTime = ipdrData.startTime;
                }
                
                // Calculate duration if not provided but have start/end times
                if (ipdrData.duration === 0 && ipdrData.startTime && ipdrData.endTime) {
                    ipdrData.duration = Math.floor((ipdrData.endTime - ipdrData.startTime) / 1000);
                }
                
                // Set originLatLong
                ipdrData.originLatLong = {
                    lat: ipdrData.originLat,
                    long: ipdrData.originLong
                };
                delete ipdrData.originLat;
                delete ipdrData.originLong;
                
                // Basic validation - IMSI OR phone number required
                if (!ipdrData.imsi && !ipdrData.phoneNumber) {
                    console.error('Validation failed - missing IMSI and phone:', {
                        imsi: ipdrData.imsi,
                        phoneNumber: ipdrData.phoneNumber,
                        rawRow: row
                    });
                    errorCount++;
                    return;
                }
                
                // Pad phone number to 10 digits (optional field)
                if (ipdrData.phoneNumber) {
                    ipdrData.phoneNumber = ipdrData.phoneNumber.toString()
                        .replace(/\D/g, '') // Remove non-digits
                        .slice(-10) // Take last 10 digits
                        .padStart(10, '0');
                }
                
                // Pad IMEI to 15 digits
                if (ipdrData.imei) {
                    ipdrData.imei = ipdrData.imei.toString()
                        .replace(/\D/g, '')
                        .padStart(15, '0')
                        .slice(0, 15);
                }
                
                // Pad IMSI to 15 digits
                if (ipdrData.imsi) {
                    ipdrData.imsi = ipdrData.imsi.toString()
                        .replace(/\D/g, '')
                        .padStart(15, '0')
                        .slice(0, 15);
                }
                
                records.push(ipdrData);
                
            } catch (error) {
                console.error('Error processing IPDR row:', error, row);
                errorCount++;
            }
        })
        .on('end', async () => {
            console.log(`IPDR CSV parsing complete. ${records.length} records parsed, ${errorCount} errors.`);
            
            // Now enrich all records with intelligence
            try {
                // Get CDR records for this case for correlation
                const cdrRecords = await CDR.find({ caseNumber }).lean();
                console.log(`Found ${cdrRecords.length} CDR records for correlation.`);
                
                // Process records in batches for better performance
                const batchSize = 100;
                let enrichedBatch = [];
                
                console.log(`Starting to process ${records.length} IPDR records...`);
                
                for (let i = 0; i < records.length; i++) {
                    try {
                        // Enrich with intelligence
                        const enrichedRecord = await enrichIPDRRecord(records[i], caseNumber, cdrRecords);
                        enrichedBatch.push(enrichedRecord);
                        
                        // Save in batches
                        if (enrichedBatch.length >= batchSize || i === records.length - 1) {
                            try {
                                // Validate first record before inserting
                                if (enrichedBatch.length > 0) {
                                    const testDoc = new IPDR(enrichedBatch[0]);
                                    const validationErr = testDoc.validateSync();
                                    if (validationErr) {
                                        console.log('VALIDATION ERROR on first record:');
                                        Object.keys(validationErr.errors).forEach(key => {
                                            console.log(`  ${key}:`, validationErr.errors[key].message);
                                        });
                                    }
                                }
                                
                                const result = await IPDR.insertMany(enrichedBatch, { ordered: false });
                                const actualInserted = Array.isArray(result) ? result.length : (result.insertedCount || 0);
                                recordCount += actualInserted;
                                console.log(`Progress: ${recordCount}/${records.length} records saved (batch: ${actualInserted}/${enrichedBatch.length})`);
                            } catch (insertErr) {
                                console.error('Batch insert error:', insertErr.message);
                                console.error('Error name:', insertErr.name);
                                
                                if (insertErr.writeErrors && insertErr.writeErrors.length > 0) {
                                    console.error('Sample validation errors (first 3):');
                                    insertErr.writeErrors.slice(0, 3).forEach((err, idx) => {
                                        console.error(`  Error ${idx + 1}:`, err.err);
                                    });
                                    const successCount = enrichedBatch.length - insertErr.writeErrors.length;
                                    recordCount += successCount;
                                    errorCount += insertErr.writeErrors.length;
                                    console.log(`Batch result: ${successCount} saved, ${insertErr.writeErrors.length} failed`);
                                } else {
                                    // Complete batch failure
                                    console.error('Entire batch failed. Sample record that failed:');
                                    console.error(JSON.stringify(enrichedBatch[0], null, 2));
                                    errorCount += enrichedBatch.length;
                                }
                            }
                            enrichedBatch = []; // Clear batch
                        }
                    } catch (err) {
                        console.error('Error enriching IPDR record:', err.message);
                        errorCount++;
                    }
                }
                
                console.log(`IPDR processing complete: ${recordCount} records added, ${errorCount} errors`);
                callback(null, { recordsAdded: recordCount, errors: errorCount });
                
            } catch (err) {
                console.error('Error in IPDR enrichment:', err);
                callback(err);
            }
        })
        .on('error', (error) => {
            console.error('Error reading IPDR CSV:', error);
            callback(error);
        });
}

module.exports = {
    parseIPDRCSV,
    enrichIPDRRecord
};
