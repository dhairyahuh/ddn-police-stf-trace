import config from "config";
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Row,
  Col,
  Badge,
  Button,
  Spinner,
  Alert,
  Table,
  Progress
} from 'reactstrap';

const DwellTimeAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [cdrData, setCdrData] = useState([]);
  const [dwellLocations, setDwellLocations] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    loadAndAnalyze();
  }, []);

  const loadAndAnalyze = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.BASE_URL}/api/cdr/getAllRecords`);
      if (!response.ok) {
        console.warn('API not available');
        setCdrData([]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setCdrData(data);

      if (data.length === 0) {
        setLoading(false);
        return;
      }

      // Analyze dwell time
      analyzeDwellTime(data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDwellTime = (data) => {
    // Sort by time
    const sorted = data
      .filter(r => r.originLatLong?.lat && r.originLatLong?.long)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    // Group by location (cell tower with small tolerance for coordinates)
    const locationMap = {};
    const LOCATION_TOLERANCE = 0.001; // ~111 meters

    sorted.forEach((record, index) => {
      const lat = parseFloat(record.originLatLong.lat);
      const long = parseFloat(record.originLatLong.long);
      
      // Find if this location already exists (with tolerance)
      let locationKey = null;
      for (const key in locationMap) {
        const [existingLat, existingLong] = key.split(',').map(Number);
        const latDiff = Math.abs(existingLat - lat);
        const longDiff = Math.abs(existingLong - long);
        
        if (latDiff < LOCATION_TOLERANCE && longDiff < LOCATION_TOLERANCE) {
          locationKey = key;
          break;
        }
      }

      if (!locationKey) {
        locationKey = `${lat.toFixed(4)},${long.toFixed(4)}`;
        locationMap[locationKey] = {
          lat,
          long,
          visits: [],
          firstSeen: record.startTime,
          lastSeen: record.startTime,
          totalCalls: 0,
          callTypes: {},
          cellIDs: new Set(),
          uniqueDates: new Set()
        };
      }

      const location = locationMap[locationKey];
      location.visits.push({
        timestamp: new Date(record.startTime),
        callType: record.callType,
        duration: record.callDuration,
        cellID: record.cellID || record.originCellID
      });
      location.totalCalls++;
      location.lastSeen = record.startTime;
      location.callTypes[record.callType] = (location.callTypes[record.callType] || 0) + 1;
      if (record.cellID || record.originCellID) {
        location.cellIDs.add(record.cellID || record.originCellID);
      }
      location.uniqueDates.add(new Date(record.startTime).toDateString());
    });

    // Calculate dwell time for each location
    const dwellResults = Object.entries(locationMap).map(([key, loc]) => {
      // Calculate total time spent (from first to last call at this location)
      const firstCall = new Date(loc.firstSeen);
      const lastCall = new Date(loc.lastSeen);
      const dwellTimeHours = (lastCall - firstCall) / (1000 * 60 * 60);

      // Classify location type based on visit patterns
      const uniqueDays = loc.uniqueDates.size;
      const isFrequent = uniqueDays >= 3;
      const hasNightActivity = loc.visits.some(v => {
        const hour = v.timestamp.getHours();
        return hour >= 22 || hour < 6;
      });

      let locationType = 'Other';
      if (isFrequent && hasNightActivity) {
        locationType = 'Likely Home';
      } else if (isFrequent && !hasNightActivity) {
        locationType = 'Likely Work/Regular';
      } else if (uniqueDays === 1 && loc.totalCalls >= 5) {
        locationType = 'Meeting Point';
      }

      return {
        ...loc,
        locationKey: key,
        dwellTimeHours,
        dwellTimeDays: dwellTimeHours / 24,
        uniqueDays,
        locationType,
        hasNightActivity,
        cellIDList: Array.from(loc.cellIDs)
      };
    });

    // Sort by dwell time (descending)
    dwellResults.sort((a, b) => b.dwellTimeHours - a.dwellTimeHours);

    setDwellLocations(dwellResults);

    // Calculate overall stats
    const totalDwellTime = dwellResults.reduce((sum, loc) => sum + loc.dwellTimeHours, 0);
    const likelyHome = dwellResults.find(loc => loc.locationType === 'Likely Home');
    const likelyWork = dwellResults.filter(loc => loc.locationType === 'Likely Work/Regular');
    const meetingPoints = dwellResults.filter(loc => loc.locationType === 'Meeting Point');

    setStats({
      totalLocations: dwellResults.length,
      totalDwellTimeHours: totalDwellTime,
      totalDwellTimeDays: totalDwellTime / 24,
      likelyHome: likelyHome,
      likelyWork: likelyWork.length,
      meetingPoints: meetingPoints.length,
      mostFrequentLocation: dwellResults[0]
    });
  };

  const getLocationTypeColor = (type) => {
    switch (type) {
      case 'Likely Home': return 'danger';
      case 'Likely Work/Regular': return 'primary';
      case 'Meeting Point': return 'warning';
      default: return 'secondary';
    }
  };

  const exportDwellData = () => {
    const csv = [
      ['Rank', 'Location (Lat, Long)', 'Type', 'Total Calls', 'Unique Days', 'Dwell Time (Hours)', 'First Seen', 'Last Seen', 'Cell IDs', 'Night Activity'],
      ...dwellLocations.map((loc, index) => [
        index + 1,
        `${loc.lat}, ${loc.long}`,
        loc.locationType,
        loc.totalCalls,
        loc.uniqueDays,
        loc.dwellTimeHours.toFixed(2),
        new Date(loc.firstSeen).toLocaleString(),
        new Date(loc.lastSeen).toLocaleString(),
        loc.cellIDList.join('; '),
        loc.hasNightActivity ? 'Yes' : 'No'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dwell_time_analysis_${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <Row>
                <Col md="6">
                  <h4 className="title">📍 Dwell Time & Location Analysis</h4>
                  <p className="category">Identify frequently visited locations and time spent at each</p>
                </Col>
                <Col md="6" className="text-right">
                  <Button color="primary" onClick={exportDwellData} disabled={dwellLocations.length === 0}>
                    📥 Export Analysis
                  </Button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              {/* Key Findings */}
              <Alert color="info">
                <strong>🔍 Analysis Method:</strong> Groups calls from same/nearby cell towers. 
                Dwell time = time between first and last call at each location. 
                <strong>Note:</strong> This shows when calls were made, not continuous presence.
              </Alert>

              {/* Statistics Cards */}
              <Row className="mb-4">
                <Col md="3">
                  <Card className="bg-gradient-primary">
                    <CardBody className="text-center">
                      <h6 className="text-white">Total Locations</h6>
                      <h2 className="text-white">{stats.totalLocations || 0}</h2>
                      <small className="text-white">Unique cell tower areas</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="3">
                  <Card className="bg-gradient-danger">
                    <CardBody className="text-center">
                      <h6 className="text-white">Likely Home</h6>
                      <h2 className="text-white">{stats.likelyHome ? '1' : '0'}</h2>
                      <small className="text-white">Frequent + Night activity</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="3">
                  <Card className="bg-gradient-info">
                    <CardBody className="text-center">
                      <h6 className="text-white">Work/Regular</h6>
                      <h2 className="text-white">{stats.likelyWork || 0}</h2>
                      <small className="text-white">Frequent daytime locations</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="3">
                  <Card className="bg-gradient-warning">
                    <CardBody className="text-center">
                      <h6 className="text-white">Meeting Points</h6>
                      <h2 className="text-white">{stats.meetingPoints || 0}</h2>
                      <small className="text-white">Single-day clusters</small>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Likely Home Location Highlight */}
              {stats.likelyHome && (
                <Alert color="danger">
                  <strong>🏠 LIKELY HOME LOCATION IDENTIFIED:</strong><br/>
                  <strong>Location:</strong> {stats.likelyHome.lat.toFixed(4)}, {stats.likelyHome.long.toFixed(4)}<br/>
                  <strong>Evidence:</strong> {stats.likelyHome.totalCalls} calls over {stats.likelyHome.uniqueDays} days, including night activity<br/>
                  <strong>Cell Towers:</strong> {stats.likelyHome.cellIDList.join(', ')}<br/>
                  <strong>⚖️ Investigation Note:</strong> High confidence - person regularly makes calls from this location during late hours
                </Alert>
              )}

              {/* Location Table */}
              {loading ? (
                <div className="text-center p-5">
                  <Spinner color="primary" />
                  <p className="mt-3">Analyzing locations...</p>
                </div>
              ) : dwellLocations.length === 0 ? (
                <Alert color="warning">
                  No CDR data found. Please upload CDR files first.
                </Alert>
              ) : (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Table responsive hover>
                    <thead style={{ position: 'sticky', top: 0, background: '#27293d', zIndex: 1 }}>
                      <tr>
                        <th>Rank</th>
                        <th>Location Type</th>
                        <th>Coordinates</th>
                        <th>Total Calls</th>
                        <th>Unique Days</th>
                        <th>Dwell Time</th>
                        <th>First/Last Seen</th>
                        <th>Cell IDs</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dwellLocations.map((loc, index) => (
                        <tr 
                          key={index}
                          onClick={() => setSelectedLocation(selectedLocation === index ? null : index)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <Badge color="primary">#{index + 1}</Badge>
                          </td>
                          <td>
                            <Badge color={getLocationTypeColor(loc.locationType)}>
                              {loc.locationType}
                            </Badge>
                            {loc.hasNightActivity && <><br/><Badge color="dark">🌙 Night</Badge></>}
                          </td>
                          <td>
                            <small>
                              {loc.lat.toFixed(4)},<br/>{loc.long.toFixed(4)}
                            </small>
                          </td>
                          <td>
                            <strong>{loc.totalCalls}</strong>
                            <br/>
                            <Progress 
                              value={(loc.totalCalls / dwellLocations[0].totalCalls) * 100} 
                              color="success"
                            />
                          </td>
                          <td>{loc.uniqueDays} days</td>
                          <td>
                            <strong>{loc.dwellTimeHours.toFixed(1)}h</strong>
                            <br/>
                            <small className="text-muted">({loc.dwellTimeDays.toFixed(1)} days)</small>
                          </td>
                          <td>
                            <small>
                              {new Date(loc.firstSeen).toLocaleDateString()}<br/>
                              to<br/>
                              {new Date(loc.lastSeen).toLocaleDateString()}
                            </small>
                          </td>
                          <td>
                            <small>{loc.cellIDList.slice(0, 3).join(', ')}</small>
                            {loc.cellIDList.length > 3 && <><br/><small>+{loc.cellIDList.length - 3} more</small></>}
                          </td>
                          <td>
                            <Button size="sm" color="info">
                              {selectedLocation === index ? 'Hide' : 'View'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  {/* Detailed View */}
                  {selectedLocation !== null && (
                    <Card className="mt-3 bg-gradient-info">
                      <CardBody>
                        <h5>📊 Detailed Analysis - Location #{selectedLocation + 1}</h5>
                        <Row>
                          <Col md="6">
                            <p><strong>Call Types Distribution:</strong></p>
                            {Object.entries(dwellLocations[selectedLocation].callTypes).map(([type, count]) => (
                              <div key={type}>
                                {type}: {count} calls
                                <Progress value={(count / dwellLocations[selectedLocation].totalCalls) * 100} />
                              </div>
                            ))}
                          </Col>
                          <Col md="6">
                            <p><strong>Visit Timeline:</strong></p>
                            <small>
                              {dwellLocations[selectedLocation].visits.slice(0, 10).map((visit, i) => (
                                <div key={i}>
                                  • {visit.timestamp.toLocaleString()} - {visit.callType}
                                </div>
                              ))}
                              {dwellLocations[selectedLocation].visits.length > 10 && (
                                <div className="text-muted">... and {dwellLocations[selectedLocation].visits.length - 10} more</div>
                              )}
                            </small>
                          </Col>
                        </Row>
                      </CardBody>
                    </Card>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DwellTimeAnalysis;
