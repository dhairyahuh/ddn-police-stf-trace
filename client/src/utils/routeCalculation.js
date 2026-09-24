// Route calculation utilities for CDR movement reconstruction

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate speed in km/h from distance and time difference
 * @param {number} distance - Distance in kilometers
 * @param {number} timeDiff - Time difference in milliseconds
 * @returns {number} Speed in km/h
 */
export function calculateSpeed(distance, timeDiff) {
  const hours = timeDiff / (1000 * 60 * 60);
  return hours > 0 ? distance / hours : 0;
}

/**
 * Check if speed is feasible (less than 150 km/h)
 * @param {number} speed - Speed in km/h
 * @returns {boolean} True if speed is feasible
 */
export function isFeasibleSpeed(speed) {
  return speed <= 150;
}

/**
 * Get route from OSRM API
 * @param {number} lat1 - Start latitude
 * @param {number} lon1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lon2 - End longitude
 * @returns {Promise<Object>} Route data with geometry and distance
 */
export async function getOSRMRoute(lat1, lon1, lat2, lon2) {
  try {
    // Using public OSRM demo server (replace with your own instance for production)
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      return {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance / 1000, // Convert to km
        duration: data.routes[0].duration, // in seconds
        confidence: calculateRouteConfidence(
          lat1,
          lon1,
          lat2,
          lon2,
          data.routes[0].distance / 1000
        ),
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching OSRM route:", error);
    return null;
  }
}

/**
 * Calculate route confidence score based on multiple factors
 * @param {number} lat1 - Start latitude
 * @param {number} lon1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lon2 - End longitude
 * @param {number} routeDistance - Route distance in km
 * @param {number} timeDiff - Time difference in milliseconds
 * @returns {string} Confidence level: 'high', 'medium', or 'low'
 */
export function calculateRouteConfidence(
  lat1,
  lon1,
  lat2,
  lon2,
  routeDistance,
  timeDiff = null
) {
  const straightDistance = calculateDistance(lat1, lon1, lat2, lon2);
  const cellTowerRadius = 3; // Average cell tower coverage radius in km

  // Factor 1: Distance from cell tower coverage
  const distanceFromTower = Math.abs(routeDistance - straightDistance);
  const towerScore = distanceFromTower <= cellTowerRadius * 2 ? 1 : 0.5;

  // Factor 2: Speed feasibility (if time difference provided)
  let speedScore = 1;
  if (timeDiff) {
    const speed = calculateSpeed(routeDistance, timeDiff);
    speedScore = isFeasibleSpeed(speed) ? 1 : 0.3;
  }

  // Factor 3: Route efficiency (straight line vs actual route)
  const efficiency = straightDistance / routeDistance;
  const efficiencyScore = efficiency > 0.7 ? 1 : efficiency > 0.5 ? 0.7 : 0.4;

  // Calculate overall confidence
  const overallScore = (towerScore + speedScore + efficiencyScore) / 3;

  if (overallScore >= 0.8) return "high";
  if (overallScore >= 0.5) return "medium";
  return "low";
}

/**
 * Get confidence color
 * @param {string} confidence - Confidence level
 * @returns {string} Color hex code
 */
export function getConfidenceColor(confidence) {
  const colors = {
    high: "#28a745",
    medium: "#ffc107",
    low: "#dc3545",
  };
  return colors[confidence] || colors.low;
}

/**
 * Process CDR records for movement reconstruction
 * @param {Array} records - CDR records sorted by timestamp
 * @returns {Array} Processed movement segments
 */
export function processMovementData(records) {
  const segments = [];

  for (let i = 0; i < records.length - 1; i++) {
    const current = records[i];
    const next = records[i + 1];

    // Extract coordinates
    const lat1 = parseFloat(current.latitude || current.originLatLong?.lat || 0);
    const lon1 = parseFloat(current.longitude || current.originLatLong?.long || 0);
    const lat2 = parseFloat(next.latitude || next.originLatLong?.lat || 0);
    const lon2 = parseFloat(next.longitude || next.originLatLong?.long || 0);

    // Skip if coordinates are invalid
    if (!lat1 || !lon1 || !lat2 || !lon2) continue;

    const time1 = new Date(current.timestamp || current.startTime || current.Date);
    const time2 = new Date(next.timestamp || next.startTime || next.Date);
    const timeDiff = time2 - time1;

    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    const speed = calculateSpeed(distance, timeDiff);

    segments.push({
      from: { lat: lat1, lon: lon1, timestamp: time1, cellId: current.cell_id || current.FirstCGI },
      to: { lat: lat2, lon: lon2, timestamp: time2, cellId: next.cell_id || next.FirstCGI },
      distance,
      speed,
      timeDiff,
      feasible: isFeasibleSpeed(speed),
    });
  }

  return segments;
}

