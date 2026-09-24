// API service for backend communication
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// CDR API endpoints
export const cdrAPI = {
  // Get all CDR records
  getAllRecords: () => api.get('/cdr/getAllRecords'),

  // Get records for a specific phone number
  getCallerRecords: (phoneNumber) =>
    api.post('/cdr/getCallerRecords', { callerNumber: phoneNumber }).then(res => {
      // Handle response format from backend
      return { data: res.data.message || res.data };
    }),

  // Get records with filters
  getRecords: (filters) =>
    api.post('/cdr/getRecords', filters),

  // Get movement data for phone number
  getMovementData: (phoneNumber, startDate, endDate) =>
    api.post('/cdr/getMovementData', { phoneNumber, startDate, endDate }),

  // Get SIM swap detection results
  getSIMSwapDetection: (phoneNumber) =>
    api.post('/cdr/getSIMSwapDetection', { phoneNumber }),

  // Get call pattern anomalies
  getCallPatternAnomalies: (phoneNumber) =>
    api.post('/cdr/getCallPatternAnomalies', { phoneNumber }),

  // Get calendar activity
  getCalendarActivity: (phoneNumber, startDate, endDate) =>
    api.post('/cdr/getCalendarActivity', { phoneNumber, startDate, endDate }),
};

// IPDR API endpoints
export const ipdrAPI = {
  // Get all IPDR records
  getAllRecords: () => api.get('/ipdr/getAllRecords'),

  // Get port intelligence
  getPortIntelligence: (filters) =>
    api.post('/ipdr/getPortIntelligence', filters),

  // Check IP quality
  checkIPQuality: (ipAddresses) =>
    api.post('/ipdr/checkIPQuality', { ipAddresses }),

  // Get VoIP detection results
  getVoIPDetection: (filters) =>
    api.post('/ipdr/getVoIPDetection', filters),
};

// IP Quality Score API (external)
export const ipQualityAPI = {
  checkIP: async (ip, apiKey) => {
    try {
      const response = await fetch(
        `https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}?strictness=1&allow_public_access_points=true`
      );
      return await response.json();
    } catch (error) {
      console.error('Error checking IP quality:', error);
      throw error;
    }
  },

  checkBatch: async (ips, apiKey) => {
    // Batch processing with rate limiting
    const results = [];
    const batchSize = 10; // Process 10 at a time to respect rate limits

    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ip => ipQualityAPI.checkIP(ip, apiKey))
      );
      results.push(...batchResults);

      // Rate limiting: wait 1 second between batches
      if (i + batchSize < ips.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  },
};

// Phone profiling API endpoints
export const phoneProfilingAPI = {
  getPhoneProfiling: (phoneNumber) =>
    api.post('/phone-profiling', { phoneNumber }),
};

// Email profiling API endpoints
export const emailProfilingAPI = {
  getEmailProfiling: (email) =>
    api.post('/email-profiling', { email }),
};

// Breach intelligence API endpoints (read-only)
export const breachAPI = {
  // Search breach records by phone
  searchByPhone: (phone) =>
    api.get(`/profiling/breach-search?phone=${encodeURIComponent(phone)}`),

  // Search breach records by email
  searchByEmail: (email) =>
    api.get(`/profiling/breach-search?email=${encodeURIComponent(email)}`),

  // Search breach records by username (Instagram/social media)
  searchByUsername: (username) =>
    api.get(`/profiling/breach-search?username=${encodeURIComponent(username)}`),

  // Get breach statistics (admin)
  getStats: () =>
    api.get('/profiling/breach-stats'),
};

export default api;

