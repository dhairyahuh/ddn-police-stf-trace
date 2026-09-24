// Anomaly detection utilities for call pattern analysis

/**
 * Detect unusual hours (2 AM - 5 AM) when user is normally inactive
 * @param {Array} records - CDR records
 * @param {string} phoneNumber - Phone number to analyze
 * @returns {Array} Anomalous records
 */
export function detectUnusualHours(records, phoneNumber) {
  const userRecords = records.filter(r => 
    r.phone_number === phoneNumber || 
    r.TargetNo === phoneNumber ||
    r.callerNumber === phoneNumber
  );

  // Calculate normal activity hours
  const hourCounts = new Array(24).fill(0);
  userRecords.forEach(record => {
    const timestamp = new Date(record.timestamp || record.startTime || record.Date);
    const hour = timestamp.getHours();
    hourCounts[hour]++;
  });

  // Find most active hours (top 50%)
  const sortedHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count);
  const activeHours = sortedHours
    .slice(0, 12)
    .map(h => h.hour);

  // Detect calls in unusual hours (2-5 AM) when normally inactive
  const unusualHours = [2, 3, 4, 5];
  return userRecords.filter(record => {
    const timestamp = new Date(record.timestamp || record.startTime || record.Date);
    const hour = timestamp.getHours();
    return unusualHours.includes(hour) && !activeHours.includes(hour);
  });
}

/**
 * Detect frequency spikes (std deviation > 3 from 7-day average)
 * @param {Array} records - CDR records
 * @param {string} phoneNumber - Phone number to analyze
 * @returns {Object} Spike information
 */
export function detectFrequencySpikes(records, phoneNumber) {
  const userRecords = records.filter(r => 
    r.phone_number === phoneNumber || 
    r.TargetNo === phoneNumber ||
    r.callerNumber === phoneNumber
  );

  // Group by date
  const dailyCounts = {};
  userRecords.forEach(record => {
    const timestamp = new Date(record.timestamp || record.startTime || record.Date);
    const dateKey = timestamp.toISOString().split('T')[0];
    dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
  });

  const counts = Object.values(dailyCounts);
  if (counts.length < 7) return null;

  // Calculate mean and standard deviation
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Find spikes (> 3 standard deviations)
  const spikes = [];
  Object.entries(dailyCounts).forEach(([date, count]) => {
    if (count > mean + 3 * stdDev) {
      spikes.push({ date, count, mean, stdDev });
    }
  });

  return spikes.length > 0 ? { spikes, mean, stdDev } : null;
}

/**
 * Get most called numbers with metrics
 * @param {Array} records - CDR records
 * @param {string} phoneNumber - Phone number to analyze
 * @param {number} topN - Number of top contacts to return
 * @returns {Array} Top contacts with metrics
 */
export function getMostCalledNumbers(records, phoneNumber, topN = 10) {
  const userRecords = records.filter(r => 
    (r.phone_number === phoneNumber || r.TargetNo === phoneNumber || r.callerNumber === phoneNumber) &&
    (r.callType === 'OUT' || r.callType === 'CALL-OUT' || r['Call Type'] === 'OUT')
  );

  const contactMap = {};

  userRecords.forEach(record => {
    const contactNumber = record.calledNumber || record['B Party No'] || record.called_number;
    if (!contactNumber) return;

    if (!contactMap[contactNumber]) {
      contactMap[contactNumber] = {
        number: contactNumber,
        totalCalls: 0,
        totalDuration: 0,
        calls: [],
      };
    }

    const duration = parseInt(record.callDuration || record['Dur(s)'] || record.duration || 0);
    contactMap[contactNumber].totalCalls++;
    contactMap[contactNumber].totalDuration += duration;
    contactMap[contactNumber].calls.push({
      timestamp: new Date(record.timestamp || record.startTime || record.Date),
      duration,
    });
  });

  // Calculate metrics for each contact
  const contacts = Object.values(contactMap).map(contact => {
    const avgDuration = contact.totalCalls > 0 
      ? contact.totalDuration / contact.totalCalls 
      : 0;

    // Time distribution
    const timeDistribution = {
      morning: 0, // 6-12
      afternoon: 0, // 12-18
      evening: 0, // 18-22
      night: 0, // 22-6
    };

    contact.calls.forEach(call => {
      const hour = call.timestamp.getHours();
      if (hour >= 6 && hour < 12) timeDistribution.morning++;
      else if (hour >= 12 && hour < 18) timeDistribution.afternoon++;
      else if (hour >= 18 && hour < 22) timeDistribution.evening++;
      else timeDistribution.night++;
    });

    return {
      ...contact,
      averageDuration: avgDuration,
      timeDistribution,
    };
  });

  // Sort by total calls and return top N
  return contacts
    .sort((a, b) => b.totalCalls - a.totalCalls)
    .slice(0, topN);
}

/**
 * Detect first-time contacts at odd hours
 * @param {Array} records - CDR records
 * @param {string} phoneNumber - Phone number to analyze
 * @returns {Array} First-time contact records
 */
export function detectFirstTimeContacts(records, phoneNumber) {
  const userRecords = records.filter(r => 
    r.phone_number === phoneNumber || 
    r.TargetNo === phoneNumber ||
    r.callerNumber === phoneNumber
  );

  // Sort by timestamp
  const sortedRecords = [...userRecords].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.startTime || a.Date);
    const timeB = new Date(b.timestamp || b.startTime || b.Date);
    return timeA - timeB;
  });

  const contactedNumbers = new Set();
  const firstTimeContacts = [];
  const oddHours = [0, 1, 2, 3, 4, 5, 22, 23]; // 10 PM - 5 AM

  sortedRecords.forEach(record => {
    const contactNumber = record.calledNumber || record['B Party No'] || record.called_number;
    if (!contactNumber) return;

    const timestamp = new Date(record.timestamp || record.startTime || record.Date);
    const hour = timestamp.getHours();

    if (!contactedNumbers.has(contactNumber) && oddHours.includes(hour)) {
      firstTimeContacts.push({
        ...record,
        contactNumber,
        timestamp,
        hour,
      });
    }

    contactedNumbers.add(contactNumber);
  });

  return firstTimeContacts;
}

/**
 * Calculate call pattern statistics
 * @param {Array} records - CDR records
 * @param {string} phoneNumber - Phone number to analyze
 * @returns {Object} Statistics object
 */
export function calculateCallPatternStats(records, phoneNumber) {
  const userRecords = records.filter(r => 
    r.phone_number === phoneNumber || 
    r.TargetNo === phoneNumber ||
    r.callerNumber === phoneNumber
  );

  const stats = {
    totalCalls: 0,
    totalSMS: 0,
    incomingCalls: 0,
    outgoingCalls: 0,
    totalDuration: 0,
    averageDuration: 0,
    hourlyDistribution: new Array(24).fill(0),
    dailyDistribution: new Array(7).fill(0), // 0 = Sunday
  };

  userRecords.forEach(record => {
    const callType = record.callType || record['Call Type'] || '';
    const timestamp = new Date(record.timestamp || record.startTime || record.Date);
    const hour = timestamp.getHours();
    const day = timestamp.getDay();

    stats.hourlyDistribution[hour]++;
    stats.dailyDistribution[day]++;

    if (callType.includes('SMS') || callType.includes('SMT') || callType.includes('SMO')) {
      stats.totalSMS++;
    } else {
      stats.totalCalls++;
      const duration = parseInt(record.callDuration || record['Dur(s)'] || record.duration || 0);
      stats.totalDuration += duration;

      if (callType.includes('IN') || callType.includes('CALL-IN')) {
        stats.incomingCalls++;
      } else if (callType.includes('OUT') || callType.includes('CALL-OUT')) {
        stats.outgoingCalls++;
      }
    }
  });

  stats.averageDuration = stats.totalCalls > 0 
    ? stats.totalDuration / stats.totalCalls 
    : 0;

  return stats;
}

