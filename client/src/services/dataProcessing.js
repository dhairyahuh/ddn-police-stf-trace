// Heavy data processing functions
import { processMovementData, getOSRMRoute } from '../utils/routeCalculation';
import { 
  detectUnusualHours, 
  detectFrequencySpikes, 
  getMostCalledNumbers,
  detectFirstTimeContacts,
  calculateCallPatternStats 
} from '../utils/anomalyDetection';
import { getPortInfo, getRiskColor, isVoIPPort } from '../utils/portDatabase';

/**
 * Process CDR data for movement reconstruction
 * @param {Array} rawData - Raw CDR records
 * @param {string} phoneNumber - Phone number to process
 * @returns {Promise<Array>} Processed movement segments with routes
 */
export async function processCDRForMovement(rawData, phoneNumber) {
  // Filter and sort records for the phone number
  const userRecords = rawData
    .filter(r => {
      const num = r.phone_number || r.TargetNo || r.callerNumber;
      return num === phoneNumber || num === `91${phoneNumber}` || num === phoneNumber.replace(/^91/, '');
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.startTime || a.Date);
      const timeB = new Date(b.timestamp || b.startTime || b.Date);
      return timeA - timeB;
    });

  // Process movement segments
  const segments = processMovementData(userRecords);

  // Fetch routes for each segment
  const segmentsWithRoutes = await Promise.all(
    segments.map(async (segment) => {
      const route = await getOSRMRoute(
        segment.from.lat,
        segment.from.lon,
        segment.to.lat,
        segment.to.lon
      );

      return {
        ...segment,
        route,
      };
    })
  );

  return segmentsWithRoutes;
}

/**
 * Process CDR data for SIM swap detection
 * @param {Array} rawData - Raw CDR records
 * @param {string} phoneNumber - Phone number to analyze
 * @returns {Object} SIM swap detection results
 */
export function processCDRForSIMSwap(rawData, phoneNumber) {
  const userRecords = rawData
    .filter(r => {
      const num = r.phone_number || r.TargetNo || r.callerNumber;
      return num === phoneNumber || num === `91${phoneNumber}` || num === phoneNumber.replace(/^91/, '');
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.startTime || a.Date);
      const timeB = new Date(b.timestamp || b.startTime || b.Date);
      return timeA - timeB;
    });

  // Group by IMEI
  const imeiGroups = {};
  userRecords.forEach(record => {
    const imei = record.IMEI || record.imei;
    if (!imei) return;

    if (!imeiGroups[imei]) {
      imeiGroups[imei] = [];
    }
    imeiGroups[imei].push(record);
  });

  // Detect IMEI changes
  const imeiHistory = [];
  let lastIMEI = null;
  let lastIMEITime = null;

  userRecords.forEach(record => {
    const imei = record.IMEI || record.imei;
    const timestamp = new Date(record.timestamp || record.startTime || record.Date);

    if (imei && imei !== lastIMEI) {
      if (lastIMEI) {
        const timeSinceChange = timestamp - lastIMEITime;
        const hoursSinceChange = timeSinceChange / (1000 * 60 * 60);

        imeiHistory.push({
          fromIMEI: lastIMEI,
          toIMEI: imei,
          changeTime: timestamp,
          hoursSinceLastChange: hoursSinceChange,
          suspicious: hoursSinceChange < 24,
        });
      }

      lastIMEI = imei;
      lastIMEITime = timestamp;
    }
  });

  // Calculate risk scores
  const swaps = imeiHistory.map(swap => {
    let riskScore = 0;
    let riskLevel = 'INFO';

    // Factor 1: Time since last change
    if (swap.hoursSinceLastChange < 24) {
      riskScore += 50;
    } else if (swap.hoursSinceLastChange < 30 * 24) {
      riskScore += 20;
    }

    // Factor 2: Location anomaly (check if location changed significantly)
    const recordsBefore = userRecords.filter(r => {
      const time = new Date(r.timestamp || r.startTime || r.Date);
      return time < swap.changeTime && time >= new Date(swap.changeTime.getTime() - 60 * 60 * 1000);
    });
    const recordsAfter = userRecords.filter(r => {
      const time = new Date(r.timestamp || r.startTime || r.Date);
      return time > swap.changeTime && time <= new Date(swap.changeTime.getTime() + 60 * 60 * 1000);
    });

    if (recordsBefore.length > 0 && recordsAfter.length > 0) {
      const beforeLat = parseFloat(recordsBefore[0].latitude || recordsBefore[0].originLatLong?.lat || 0);
      const beforeLon = parseFloat(recordsBefore[0].longitude || recordsBefore[0].originLatLong?.long || 0);
      const afterLat = parseFloat(recordsAfter[0].latitude || recordsAfter[0].originLatLong?.lat || 0);
      const afterLon = parseFloat(recordsAfter[0].longitude || recordsAfter[0].originLatLong?.long || 0);

      if (beforeLat && beforeLon && afterLat && afterLon) {
        const distance = Math.sqrt(
          Math.pow(afterLat - beforeLat, 2) + Math.pow(afterLon - beforeLon, 2)
        ) * 111; // Rough conversion to km

        if (distance > 50) { // Significant location jump
          riskScore += 30;
        }
      }
    }

    // Determine risk level
    if (riskScore >= 70) {
      riskLevel = 'CRITICAL';
    } else if (riskScore >= 40) {
      riskLevel = 'WARNING';
    }

    return {
      ...swap,
      riskScore,
      riskLevel,
    };
  });

  return {
    phoneNumber,
    imeiHistory: swaps,
    totalSwaps: swaps.length,
    criticalSwaps: swaps.filter(s => s.riskLevel === 'CRITICAL').length,
    warningSwaps: swaps.filter(s => s.riskLevel === 'WARNING').length,
  };
}

/**
 * Process CDR data for call pattern analysis
 * @param {Array} rawData - Raw CDR records
 * @param {string} phoneNumber - Phone number to analyze
 * @returns {Object} Call pattern analysis results
 */
export function processCDRForCallPatterns(rawData, phoneNumber) {
  const unusualHours = detectUnusualHours(rawData, phoneNumber);
  const frequencySpikes = detectFrequencySpikes(rawData, phoneNumber);
  const mostCalled = getMostCalledNumbers(rawData, phoneNumber, 10);
  const firstTimeContacts = detectFirstTimeContacts(rawData, phoneNumber);
  const stats = calculateCallPatternStats(rawData, phoneNumber);

  return {
    unusualHours,
    frequencySpikes,
    mostCalled,
    firstTimeContacts,
    stats,
  };
}

/**
 * Process IPDR data for port intelligence
 * @param {Array} rawData - Raw IPDR records
 * @returns {Object} Port intelligence results
 */
export function processIPDRForPortIntelligence(rawData) {
  const portCounts = {};
  const portDetails = [];

  rawData.forEach(record => {
    const destPort = parseInt(record.destPort || record.dest_port || record.destination_port || 0);
    if (!destPort) return;

    if (!portCounts[destPort]) {
      portCounts[destPort] = {
        port: destPort,
        count: 0,
        records: [],
      };
    }

    portCounts[destPort].count++;
    portCounts[destPort].records.push(record);
  });

  // Get port info for each port
  Object.values(portCounts).forEach(portData => {
    const portInfo = getPortInfo(portData.port);
    
    portDetails.push({
      ...portData,
      ...portInfo,
      riskColor: getRiskColor(portInfo.risk),
    });
  });

  // Sort by count
  portDetails.sort((a, b) => b.count - a.count);

  // Categorize by risk
  const riskCategories = {
    critical: portDetails.filter(p => p.risk === 'critical'),
    high: portDetails.filter(p => p.risk === 'high'),
    medium: portDetails.filter(p => p.risk === 'medium'),
    low: portDetails.filter(p => p.risk === 'low'),
    unknown: portDetails.filter(p => p.risk === 'unknown'),
  };

  return {
    portDetails,
    riskCategories,
    totalPorts: portDetails.length,
    totalConnections: rawData.length,
  };
}

/**
 * Process IPDR data for VoIP detection
 * @param {Array} rawData - Raw IPDR records
 * @returns {Array} Detected VoIP calls
 */
export function processIPDRForVoIP(rawData) {
  const voipCalls = [];

  rawData.forEach(record => {
    const destPort = parseInt(record.destPort || record.dest_port || record.destination_port || 0);
    const protocol = record.protocol || record.Protocol || 'TCP';
    const duration = parseInt(record.duration || record.Duration || 0);
    const dataVolume = parseInt(record.totalVolume || record.datavolumeuplink + record.datavolumedownlink || 0);

    // VoIP indicators
    const isVoIPPortMatch = isVoIPPort(destPort);
    const isUDP = protocol.toUpperCase() === 'UDP';
    const isSustained = duration > 120; // More than 2 minutes
    const isVoIPDataRate = dataVolume > 0 && duration > 0 && 
      (dataVolume / duration) >= 64 && (dataVolume / duration) <= 128; // 64-128 kbps

    if (isVoIPPortMatch || (isUDP && isSustained) || isVoIPDataRate) {
      // Estimate app based on port and IP ranges
      let estimatedApp = 'Unknown';
      if (destPort === 5060 || destPort === 5061) {
        estimatedApp = 'SIP-based (Skype/Other)';
      } else if (destPort >= 5004 && destPort <= 5005) {
        estimatedApp = 'RTP-based VoIP';
      } else if (isUDP && isSustained) {
        estimatedApp = 'UDP VoIP (WhatsApp/Telegram)';
      }

      voipCalls.push({
        ...record,
        destPort,
        protocol,
        duration,
        dataVolume,
        estimatedApp,
        timestamp: new Date(record.session_start || record.startTime),
      });
    }
  });

  return voipCalls.sort((a, b) => a.timestamp - b.timestamp);
}

