import config from "config";
import React, { useState, useEffect, useRef } from 'react';
import { Map as LeafletMap, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Card,
  CardHeader,
  CardBody,
  Row,
  Col,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  ButtonGroup,
  Badge,
  Spinner,
  Alert,
} from 'reactstrap';
import { cdrAPI } from '../../services/api';
import { processCDRForMovement } from '../../services/dataProcessing';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MovementMap = () => {
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState(10);

  // Case/Target selection state
  const [caseTargets, setCaseTargets] = useState([]); // [{_id: caseNumber, numbers: [{number, recordCount}], totalRecords}]
  const [selectedCase, setSelectedCase] = useState('all');
  const [availableNumbers, setAvailableNumbers] = useState([]); // numbers available for selected case
  const [selectedNumber, setSelectedNumber] = useState('all');
  const [loadingTargets, setLoadingTargets] = useState(true);

  const [targetNumber, setTargetNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [movementData, setMovementData] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [routes, setRoutes] = useState([]);
  const [stats, setStats] = useState({});
  const [showAllLines, setShowAllLines] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [filteredMovementData, setFilteredMovementData] = useState([]);
  const animationRef = useRef(null);

  // Step 1: Load unique targets on mount
  useEffect(() => {
    loadUniqueTargets();
  }, []);

  // Step 2: When case or number selection changes, reload CDR data
  useEffect(() => {
    if (!loadingTargets) {
      loadMovementData();
    }
  }, [selectedCase, selectedNumber]);

  // Update available numbers when selected case changes
  useEffect(() => {
    if (selectedCase === 'all') {
      // Collect all unique numbers across all cases
      const allNumbers = [];
      caseTargets.forEach(ct => {
        ct.numbers.forEach(n => {
          if (!allNumbers.find(an => an.number === n.number)) {
            allNumbers.push(n);
          }
        });
      });
      setAvailableNumbers(allNumbers);
    } else {
      const caseData = caseTargets.find(ct => ct._id === selectedCase);
      setAvailableNumbers(caseData ? caseData.numbers : []);
    }
    setSelectedNumber('all');
  }, [selectedCase, caseTargets]);

  // Load unique target numbers grouped by case
  const loadUniqueTargets = async () => {
    setLoadingTargets(true);
    try {
      const response = await fetch(`${config.BASE_URL}/api/cdr/getUniqueTargets`);
      if (!response.ok) {
        console.warn('Failed to load unique targets');
        setLoadingTargets(false);
        return;
      }
      const data = await response.json();
      console.log('Loaded unique targets:', data);
      setCaseTargets(data);

      // If only one case with one number, auto-select it
      if (data.length === 1) {
        setSelectedCase(data[0]._id);
        if (data[0].numbers.length === 1) {
          setSelectedNumber(data[0].numbers[0].number);
        }
      }
    } catch (error) {
      console.error('Error loading unique targets:', error);
    } finally {
      setLoadingTargets(false);
    }
  };

  // Load movement data based on selected case/number
  const loadMovementData = async () => {
    setLoading(true);
    try {
      // Build query params for filtered fetch
      const params = new URLSearchParams();
      if (selectedCase !== 'all') {
        params.append('caseNumber', selectedCase);
      }
      if (selectedNumber !== 'all') {
        params.append('callerNumber', selectedNumber);
      }

      const response = await fetch(`${config.BASE_URL}/api/cdr/getFilteredRecords?${params.toString()}`);

      if (!response.ok) {
        console.warn('API endpoint not available, using empty dataset');
        setMovementData([]);
        setLoading(false);
        return;
      }

      const responseText = await response.text();

      if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
        console.warn('Server returned HTML instead of JSON');
        setMovementData([]);
        setLoading(false);
        return;
      }

      let allData;
      try {
        allData = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('Invalid JSON response:', parseError.message);
        setMovementData([]);
        setLoading(false);
        return;
      }

      console.log('Loaded CDR data:', allData?.length, 'records');

      if (!allData || allData.length === 0) {
        setMovementData([]);
        setFilteredMovementData([]);
        setAvailableDates([]);
        setStats({});
        setLoading(false);
        return;
      }

      // Set display target number
      if (selectedNumber !== 'all') {
        setTargetNumber(selectedNumber);
      } else {
        // Show all unique numbers
        const uniqueNums = [...new Set(allData.map(r => r.callerNumber))];
        setTargetNumber(uniqueNums.join(', '));
      }

      // Filter and process movement data with IMEI analysis
      const movementRecords = allData
        .filter(record => record.originLatLong && record.originLatLong.lat && record.originLatLong.long)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      // Build IMEI -> Phone Numbers mapping for SIM swap detection
      const imeiToNumbers = {};
      allData.forEach(record => {
        if (record.imei && record.callerNumber) {
          if (!imeiToNumbers[record.imei]) {
            imeiToNumbers[record.imei] = new Set();
          }
          imeiToNumbers[record.imei].add(record.callerNumber);
        }
      });

      // Mark records with SIM swap (same IMEI used by multiple numbers)
      const processedRecords = movementRecords.map(record => {
        const numbersWithSameIMEI = record.imei ? imeiToNumbers[record.imei] : new Set();
        const simSwapDetected = numbersWithSameIMEI && numbersWithSameIMEI.size > 1;
        const otherNumbers = simSwapDetected
          ? Array.from(numbersWithSameIMEI).filter(num => num !== record.callerNumber)
          : [];

        return {
          ...record,
          simSwapDetected,
          otherNumbersOnIMEI: otherNumbers,
          imeiNumberCount: numbersWithSameIMEI.size
        };
      });

      setMovementData(processedRecords);

      // Calculate stats
      const uniqueLocations = new Set(
        processedRecords.map(r => `${r.originLatLong.lat},${r.originLatLong.long}`)
      ).size;

      const timeSpan = processedRecords.length > 1 ?
        (new Date(processedRecords[processedRecords.length - 1].startTime) -
          new Date(processedRecords[0].startTime)) / (1000 * 60 * 60 * 24) : 0;

      const simSwapCount = processedRecords.filter(r => r.simSwapDetected).length;
      const uniqueIMEIs = new Set(processedRecords.map(r => r.imei).filter(Boolean)).size;

      // Extract unique dates
      const uniqueDates = [...new Set(processedRecords.map(r =>
        new Date(r.startTime).toDateString()
      ))].sort((a, b) => new Date(a) - new Date(b));

      setAvailableDates(uniqueDates);
      setSelectedDate(uniqueDates[0]);

      setStats({
        totalRecords: processedRecords.length,
        uniqueLocations,
        timeSpanDays: Math.ceil(timeSpan),
        firstRecord: processedRecords[0]?.startTime,
        lastRecord: processedRecords[processedRecords.length - 1]?.startTime,
        targetNumber: targetNumber,
        simSwapCount,
        uniqueIMEIs
      });

      setRoutes([]);

      // Center map on first record
      if (movementRecords.length > 0) {
        const firstRecord = movementRecords[0];
        setMapCenter([firstRecord.originLatLong.lat, firstRecord.originLatLong.long]);
        setMapZoom(13);
      }
    } catch (error) {
      console.error('Error loading movement data:', error);
      alert(`Failed to load movement data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter movement data by selected date
  useEffect(() => {
    if (!selectedDate || movementData.length === 0) {
      setFilteredMovementData(movementData);
      return;
    }

    const filtered = movementData.filter(record => {
      const recordDate = new Date(record.startTime).toDateString();
      return recordDate === selectedDate;
    });

    setFilteredMovementData(filtered);
    setCurrentTimeIndex(0);

    if (filtered.length > 0) {
      setMapCenter([filtered[0].originLatLong.lat, filtered[0].originLatLong.long]);
    }
  }, [selectedDate, movementData]);

  // Playback controls
  useEffect(() => {
    if (isPlaying && filteredMovementData.length > 0) {
      animationRef.current = setInterval(() => {
        setCurrentTimeIndex(prev => {
          if (prev >= filteredMovementData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, filteredMovementData.length]);

  // Get current position for playback
  const getCurrentPosition = () => {
    if (filteredMovementData.length === 0 || currentTimeIndex >= filteredMovementData.length) {
      return null;
    }
    const record = filteredMovementData[currentTimeIndex];
    return {
      lat: record.originLatLong.lat,
      lon: record.originLatLong.long,
      timestamp: record.startTime,
      cellId: record.cellID || 'N/A',
    };
  };

  const currentPos = getCurrentPosition();

  // Get total numbers count across all cases
  const totalNumbers = caseTargets.reduce((sum, ct) => sum + ct.numbers.length, 0);

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <h4 className="title">CDR Movement Reconstruction & Analysis</h4>
              <p className="category">
                ⚠️ <strong>Important:</strong> Shows cell tower locations from CDR data, NOT exact GPS positions.
                Each marker represents where a call was made based on cell tower coverage (±500m to 5km accuracy).
              </p>
            </CardHeader>
            <CardBody>

              {/* Case & Target Number Selector */}
              <Row className="mb-3">
                <Col md="12">
                  <Card style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <CardBody>
                      <h5 className="text-white mb-3">
                        🎯 <strong>Select Case & Target Number</strong>
                        {totalNumbers > 1 && (
                          <Badge color="info" className="ml-2" style={{ fontSize: '0.8em' }}>
                            {totalNumbers} numbers across {caseTargets.length} case{caseTargets.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </h5>

                      {loadingTargets ? (
                        <div className="text-center">
                          <Spinner color="info" size="sm" /> <span className="text-white ml-2">Loading cases & targets...</span>
                        </div>
                      ) : caseTargets.length === 0 ? (
                        <Alert color="warning">
                          No CDR data found. Please upload CDR files first from the <strong>Data Upload</strong> page.
                        </Alert>
                      ) : (
                        <Row>
                          {/* Case Selector */}
                          <Col md="5">
                            <FormGroup>
                              <Label className="text-white">
                                📁 <strong>Case:</strong>
                              </Label>
                              <Input
                                type="select"
                                value={selectedCase}
                                onChange={(e) => setSelectedCase(e.target.value)}
                                style={{
                                  fontSize: '1em',
                                  fontWeight: 'bold',
                                  backgroundColor: '#1e1e2f',
                                  color: '#e0e0e0',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                }}
                              >
                                {caseTargets.length > 1 && (
                                  <option value="all">📂 All Cases ({caseTargets.reduce((s, c) => s + c.totalRecords, 0)} records)</option>
                                )}
                                {caseTargets.map(ct => (
                                  <option key={ct._id} value={ct._id}>
                                    📁 {ct._id} — {ct.numbers.length} number{ct.numbers.length !== 1 ? 's' : ''} ({ct.totalRecords} records)
                                  </option>
                                ))}
                              </Input>
                            </FormGroup>
                          </Col>

                          {/* Target Number Selector */}
                          <Col md="5">
                            <FormGroup>
                              <Label className="text-white">
                                📞 <strong>Target Number:</strong>
                              </Label>
                              <Input
                                type="select"
                                value={selectedNumber}
                                onChange={(e) => setSelectedNumber(e.target.value)}
                                style={{
                                  fontSize: '1em',
                                  fontWeight: 'bold',
                                  backgroundColor: '#1e1e2f',
                                  color: '#e0e0e0',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                }}
                              >
                                {availableNumbers.length > 1 && (
                                  <option value="all">📱 All Numbers ({availableNumbers.length} numbers)</option>
                                )}
                                {availableNumbers.map(n => (
                                  <option key={n.number} value={n.number}>
                                    📱 {n.number} — {n.recordCount} records
                                  </option>
                                ))}
                              </Input>
                            </FormGroup>
                          </Col>

                          {/* Refresh Button */}
                          <Col md="2" className="d-flex align-items-end pb-3">
                            <Button
                              color="info"
                              size="sm"
                              onClick={() => { loadUniqueTargets(); loadMovementData(); }}
                              disabled={loading}
                              block
                            >
                              {loading ? <Spinner size="sm" /> : '🔄 Refresh'}
                            </Button>
                          </Col>
                        </Row>
                      )}

                      {/* Number Chips - Quick Switch */}
                      {availableNumbers.length > 1 && (
                        <div className="mt-2">
                          <small className="text-muted d-block mb-2">Quick select:</small>
                          <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                            {availableNumbers.map(n => (
                              <Badge
                                key={n.number}
                                color={selectedNumber === n.number ? 'info' : 'secondary'}
                                style={{
                                  cursor: 'pointer',
                                  fontSize: '0.85em',
                                  padding: '6px 12px',
                                  transition: 'all 0.2s',
                                  opacity: selectedNumber === n.number ? 1 : 0.7,
                                  border: selectedNumber === n.number ? '2px solid #17a2b8' : '2px solid transparent'
                                }}
                                onClick={() => setSelectedNumber(
                                  selectedNumber === n.number ? 'all' : n.number
                                )}
                              >
                                📱 {n.number} ({n.recordCount})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Date Selector */}
              {availableDates.length > 0 && (
                <Row className="mb-3">
                  <Col md="12">
                    <Card className="bg-gradient-primary">
                      <CardBody>
                        <Row>
                          <Col md="6">
                            <FormGroup>
                              <Label className="text-white">
                                📅 <strong>Select Date to View:</strong>
                              </Label>
                              <Input
                                type="select"
                                value={selectedDate || ''}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{ fontSize: '1.1em', fontWeight: 'bold' }}
                              >
                                {availableDates.map(date => (
                                  <option key={date} value={date}>
                                    {new Date(date).toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </option>
                                ))}
                              </Input>
                            </FormGroup>
                          </Col>
                          <Col md="6">
                            <Label className="text-white">Quick Navigation:</Label>
                            <div>
                              <Button
                                color="light"
                                size="sm"
                                onClick={() => {
                                  const currentIndex = availableDates.indexOf(selectedDate);
                                  if (currentIndex > 0) {
                                    setSelectedDate(availableDates[currentIndex - 1]);
                                  }
                                }}
                                disabled={!selectedDate || availableDates.indexOf(selectedDate) === 0}
                                className="mr-2"
                              >
                                ← Previous Day
                              </Button>
                              <Button
                                color="light"
                                size="sm"
                                onClick={() => {
                                  const currentIndex = availableDates.indexOf(selectedDate);
                                  if (currentIndex < availableDates.length - 1) {
                                    setSelectedDate(availableDates[currentIndex + 1]);
                                  }
                                }}
                                disabled={!selectedDate || availableDates.indexOf(selectedDate) === availableDates.length - 1}
                              >
                                Next Day →
                              </Button>
                            </div>
                            <small className="text-white mt-2 d-block">
                              Viewing day {availableDates.indexOf(selectedDate) + 1} of {availableDates.length} |
                              {filteredMovementData.length} records this day
                            </small>
                          </Col>
                        </Row>
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Explanation Alert */}
              <Alert color="warning" className="mb-3">
                <strong>📍 What you're seeing:</strong><br/>
                • <strong>Blue lines:</strong> Connect calls made within 2 hours of each other (likely same journey/activity)<br/>
                • <strong>Orange lines:</strong> Suspicious movements (impossible speed between locations)<br/>
                • <strong>No line:</strong> Gap {'>'} 2 hours between calls - person likely stopped, changed location, or phone was off<br/>
                • <strong>Markers:</strong> Each dot represents a call/SMS made at that cell tower location<br/>
                • <strong>Note:</strong> This shows general movement patterns based on when calls were made, not continuous GPS tracking.
              </Alert>

              {/* Target Info and Controls */}
              <Row className="mb-3">
                <Col md="6">
                  <div className="d-flex align-items-center">
                    <h5 className="mb-0 text-white me-3">
                      Target Number: <span className="text-info">{targetNumber || 'Select a target...'}</span>
                    </h5>
                  </div>
                </Col>
                <Col md="2">
                  <Button
                    color="secondary"
                    size="sm"
                    onClick={loadMovementData}
                    disabled={loading}
                  >
                    {loading ? <Spinner size="sm" /> : 'Refresh Data'}
                  </Button>
                </Col>
                {movementData.length > 0 && (
                  <>
                    <Col md="3">
                      <FormGroup>
                        <Label>Playback Speed</Label>
                        <ButtonGroup>
                          {[1, 2, 5, 10].map((speed) => (
                            <Button
                              key={speed}
                              color={playbackSpeed === speed ? 'primary' : 'secondary'}
                              onClick={() => setPlaybackSpeed(speed)}
                            >
                              {speed}x
                            </Button>
                          ))}
                        </ButtonGroup>
                      </FormGroup>
                    </Col>
                    <Col md="3">
                      <FormGroup>
                        <Label>&nbsp;</Label>
                        <div>
                          <Button
                            color={isPlaying ? 'danger' : 'success'}
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="mr-2"
                          >
                            {isPlaying ? 'Pause' : 'Play'}
                          </Button>
                          <Button
                            color="secondary"
                            onClick={() => setCurrentTimeIndex(0)}
                          >
                            Reset
                          </Button>
                          <Button
                            color={showAllLines ? 'warning' : 'secondary'}
                            size="sm"
                            onClick={() => setShowAllLines(!showAllLines)}
                            className="ml-2"
                            title={showAllLines ? 'Showing ALL lines (spider web mode)' : 'Showing FILTERED lines (30min/50km limit)'}
                          >
                            {showAllLines ? '🕸️ All Lines' : '🔍 Filtered'}
                          </Button>
                        </div>
                      </FormGroup>
                    </Col>
                  </>
                )}
              </Row>

              {/* Timeline Scrubber */}
              {filteredMovementData.length > 0 && (
                <Row className="mb-3">
                  <Col md="10">
                    <FormGroup>
                      <Label className="text-white">
                        Timeline: Record {currentTimeIndex + 1} / {filteredMovementData.length}
                        {filteredMovementData[currentTimeIndex] && (
                          <span className="ml-3 text-info">
                            {new Date(filteredMovementData[currentTimeIndex].startTime).toLocaleString()}
                          </span>
                        )}
                      </Label>
                      <Input
                        type="range"
                        min="0"
                        max={filteredMovementData.length - 1}
                        value={currentTimeIndex}
                        onChange={(e) => {
                          setCurrentTimeIndex(parseInt(e.target.value));
                          setIsPlaying(false);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </FormGroup>
                  </Col>
                  <Col md="2">
                    <FormGroup>
                      <Label className="text-white">Jump to Index</Label>
                      <Input
                        type="number"
                        min="0"
                        max={filteredMovementData.length - 1}
                        value={currentTimeIndex}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val >= 0 && val < filteredMovementData.length) {
                            setCurrentTimeIndex(val);
                            setIsPlaying(false);
                          }
                        }}
                      />
                    </FormGroup>
                  </Col>
                </Row>
              )}

              {/* Movement Statistics & Legend */}
              {filteredMovementData.length > 0 && (
                <>
                <Row className="mb-3">
                  <Col md="8">
                    <Card className="bg-dark">
                      <CardBody>
                        <h6 className="text-white mb-2">📊 Daily Movement Statistics</h6>
                        <Row>
                          <Col md="3">
                            <small className="text-muted">Calls This Day</small>
                            <p className="text-white mb-0">{filteredMovementData.length}</p>
                          </Col>
                          <Col md="3">
                            <small className="text-muted">Unique Locations</small>
                            <p className="text-white mb-0">{new Set(filteredMovementData.map(r => `${r.originLatLong?.lat},${r.originLatLong?.long}`)).size}</p>
                          </Col>
                          <Col md="3">
                            <small className="text-muted">Distance Traveled</small>
                            <p className="text-white mb-0">{filteredMovementData.reduce((sum, r) => sum + (r.dayDistance || r.distance || 0), 0).toFixed(2)} km</p>
                          </Col>
                          <Col md="3">
                            <small className="text-muted">⚠️ Suspicious Movements</small>
                            <p className={filteredMovementData.filter(r => r.daySuspicious || r.suspicious).length > 0 ? "text-danger mb-0" : "text-success mb-0"}>
                              {filteredMovementData.filter(r => r.daySuspicious || r.suspicious).length}
                            </p>
                          </Col>
                        </Row>
                        <Row className="mt-2">
                          <Col md="12">
                            <small className="text-muted">Selected Date</small>
                            <p className="text-white mb-0" style={{ fontSize: '0.95em' }}>
                              {selectedDate && new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </Col>
                        </Row>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="4">
                    <Card className="bg-dark">
                      <CardBody>
                        <h6 className="text-white mb-2">🎨 Marker Legend</h6>
                        <div style={{ fontSize: '0.9em' }}>
                          <div className="mb-2">
                            <span style={{ color: '#00FF00', fontSize: '1.2em', textShadow: '0 0 3px #FFD700' }}>●</span>
                            <strong className="text-success ml-2">Bright Green (Gold border)</strong> - START point
                          </div>
                          <div className="mb-2">
                            <span style={{ color: '#FF0000', fontSize: '1.2em' }}>●</span>
                            <strong className="text-white ml-2">Red</strong> - Current position
                          </div>
                          <div className="mb-2">
                            <span style={{ color: '#28a745', fontSize: '1.2em' }}>●</span>
                            <strong className="text-white ml-2">Green</strong> - Normal movement
                          </div>
                          <div className="mb-2">
                            <span style={{ color: '#FF6B00', fontSize: '1.2em' }}>●</span>
                            <strong className="text-danger ml-2">Orange</strong> - SIM Swap Detected (IMEI shared)
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
                </>
              )}

              {/* Info Box */}
              <Row className="mb-3">
                <Col md="12">
                  <Alert color="info">
                    <strong>🔍 How to use for investigation:</strong><br/>
                    • <strong>🎯 Case & Number Selector:</strong> Choose which case and target number to analyze from the dropdowns above<br/>
                    • <strong>📅 Date Selector:</strong> Choose which day to analyze from the dropdown above<br/>
                    • <strong>⏮️⏭️ Previous/Next Day:</strong> Navigate between days to track movement patterns over time<br/>
                    • <strong>Timeline Playback:</strong> Watch how suspect moved throughout the selected day<br/>
                    • <strong>Click Markers:</strong> View call details and IMEI analysis<br/>
                    • <strong>Color Coding:</strong> Green (start/normal), Red (current), Orange (SIM swap detected)<br/>
                    • <strong>🔶 Orange Markers:</strong> IMEI has been used by multiple phone numbers - indicates same person using different SIM cards<br/>
                    • <strong>Blue Lines:</strong> Connect calls within 2 hours on the same day<br/>
                    • <strong>🔍 Filtered Mode:</strong> Shows only reasonable time-based connections (default)<br/>
                    • <strong>🕸️ All Lines Mode:</strong> Debug mode showing all connections
                  </Alert>
                </Col>
              </Row>

              {/* Map */}
              <div style={{ height: '600px', position: 'relative' }}>
                <LeafletMap
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Route Lines */}
                  {filteredMovementData.length > 1 && currentTimeIndex > 0 && (
                    <>
                      {(() => {
                        const visibleData = filteredMovementData.slice(0, currentTimeIndex + 1);
                        const lines = [];
                        let filteredCount = 0;
                        let totalPairs = visibleData.length - 1;

                        for (let idx = 1; idx < visibleData.length; idx++) {
                          const record = visibleData[idx];
                          const prev = visibleData[idx - 1];

                          if (!prev.originLatLong?.lat || !record.originLatLong?.lat) continue;

                          const timeDiff = (new Date(record.startTime) - new Date(prev.startTime)) / 1000 / 60;

                          const shouldFilter = !showAllLines && (timeDiff > 120 || timeDiff < 0);

                          if (shouldFilter) {
                            filteredCount++;
                            continue;
                          }

                          lines.push(
                            <Polyline
                              key={`line-${idx}`}
                              positions={[
                                [prev.originLatLong.lat, prev.originLatLong.long],
                                [record.originLatLong.lat, record.originLatLong.long]
                              ]}
                              color={record.simSwapDetected ? '#FF6B00' : '#007bff'}
                              weight={3}
                              opacity={0.7}
                            />
                          );
                        }

                        if (currentTimeIndex % 10 === 0) {
                          console.log(`Lines: ${lines.length} shown, ${filteredCount} filtered out of ${totalPairs} total pairs`);
                        }

                        return lines;
                      })()}
                    </>
                  )}

                  {/* Markers for CDR locations */}
                  {filteredMovementData.map((record, index) => {
                    const isActive = index === currentTimeIndex;
                    const isStartPoint = index === 0;

                    let markerColor;
                    let markerLabel;
                    if (isActive) {
                      markerColor = '#FF0000';
                      markerLabel = 'Current';
                    } else if (isStartPoint) {
                      markerColor = '#00FF00';
                      markerLabel = 'START';
                    } else if (record.simSwapDetected) {
                      markerColor = '#FF6B00';
                      markerLabel = 'SIM Swap Detected';
                    } else {
                      markerColor = '#28a745';
                      markerLabel = 'Normal';
                    }

                    const showMarker = index <= currentTimeIndex + 10;

                    if (!showMarker) return null;
                    const position = [
                      record.originLatLong?.lat || record.latitude,
                      record.originLatLong?.long || record.longitude
                    ];

                    const customIcon = L.divIcon({
                      className: 'custom-marker',
                      html: `<div style="
                        width: ${isActive || isStartPoint ? '24px' : '14px'};
                        height: ${isActive || isStartPoint ? '24px' : '14px'};
                        border-radius: 50%;
                        background-color: ${markerColor};
                        border: ${isStartPoint ? '3px solid #FFD700' : '2px solid white'};
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        ${isActive || isStartPoint ? 'animation: pulse 1s infinite;' : ''}
                      "></div>
                      <style>
                        @keyframes pulse {
                          0%, 100% { transform: scale(1); opacity: 1; }
                          50% { transform: scale(1.2); opacity: 0.8; }
                        }
                      </style>`,
                      iconSize: [isActive || isStartPoint ? 28 : 18, isActive || isStartPoint ? 28 : 18],
                      iconAnchor: [isActive || isStartPoint ? 14 : 9, isActive || isStartPoint ? 14 : 9]
                    });

                    return (
                      <Marker
                        key={index}
                        position={position}
                        icon={customIcon}
                        onClick={() => setSelectedRecord(record)}
                      >
                        <Popup>
                          <div style={{ minWidth: '250px' }}>
                            <strong style={{ color: markerColor }}>● {markerLabel} - Record #{index + 1}</strong><br/>
                            <hr style={{ margin: '5px 0' }}/>
                            <strong>📅 Time:</strong> {new Date(record.startTime || record.time).toLocaleString()}<br/>
                            <strong>📞 Type:</strong> {record.callType || 'Unknown'}<br/>
                            <strong>📞 Caller:</strong> {record.callerNumber || 'Unknown'}<br/>
                            <strong>📡 Cell ID:</strong> {record.cellID || 'Unknown'}<br/>
                            {record.calledNumber && (
                              <>
                                <strong>☎️ Called:</strong> {record.calledNumber}<br/>
                              </>
                            )}
                            {record.duration && (
                              <>
                                <strong>⏱️ Duration:</strong> {record.duration}s<br/>
                              </>
                            )}
                            <hr style={{ margin: '5px 0' }}/>
                            <strong style={{ color: '#0066FF' }}>IMEI Analysis:</strong><br/>
                            <strong>📱 IMEI:</strong> {record.imei || 'Unknown'}<br/>
                            <strong>📋 IMSI:</strong> {record.imsi || 'Unknown'}<br/>
                            {record.caseNumber && (
                              <>
                                <strong>📁 Case:</strong> {record.caseNumber}<br/>
                              </>
                            )}
                            {record.simSwapDetected ? (
                              <>
                                <Badge color="danger">⚠️ SIM SWAP DETECTED!</Badge><br/>
                                <small className="text-danger">
                                  <strong>This IMEI used by {record.imeiNumberCount} numbers:</strong><br/>
                                  {record.otherNumbersOnIMEI.map((num, i) => (
                                    <span key={i}>• {num}<br/></span>
                                  ))}
                                  <em>Same device, different SIM cards = likely same person</em>
                                </small>
                              </>
                            ) : (
                              <Badge color="success">✓ No SIM swap detected</Badge>
                            )}
                            {index === 0 && <><br/><em>First recorded location</em></>}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

                </LeafletMap>
              </div>

              {/* Daily Statistics */}
              {filteredMovementData.length > 0 && (
                <Row className="mt-3">
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>Calls This Day</h6>
                        <h3>{filteredMovementData.length}</h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>Distance Traveled</h6>
                        <h3>
                          {filteredMovementData
                            .reduce((sum, seg) => sum + (seg.dayDistance || seg.distance || 0), 0)
                            .toFixed(2)}{' '}
                          km
                        </h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>Suspicious Movements</h6>
                        <h3 className="text-danger">
                          {filteredMovementData.filter(seg => seg.daySuspicious || seg.suspicious).length}
                        </h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>Unique Locations</h6>
                        <h3>
                          {new Set(filteredMovementData.map(r =>
                            `${r.originLatLong?.lat},${r.originLatLong?.long}`
                          )).size}
                        </h3>
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MovementMap;
