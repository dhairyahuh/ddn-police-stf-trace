import config from "config";
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Table,
  Badge,
  Button,
  Input,
  FormGroup,
  Label,
  Spinner,
  Alert,
  ButtonGroup
} from 'reactstrap';
import { getDayType, getHolidayBadgeColor } from '../../services/indianCalendar';

const CommonNumberFinder = () => {
  const [loading, setLoading] = useState(false);
  const [cdrData, setCdrData] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [commonNumbers, setCommonNumbers] = useState([]);
  const [filteredCommonNumbers, setFilteredCommonNumbers] = useState([]);
  
  // Filters
  const [minOccurrence, setMinOccurrence] = useState(2);
  const [minSubjects, setMinSubjects] = useState(2); // Minimum number of subjects (A Party) that contacted this B Party
  const [searchNumber, setSearchNumber] = useState('');
  const [sortBy, setSortBy] = useState('occurrence'); // occurrence, subjects, firstContact, lastContact
  
  // Statistics
  const [stats, setStats] = useState({
    totalBPartyNumbers: 0,
    totalSubjects: 0,
    averageOccurrence: 0,
    mostCommonNumber: null,
    totalCalls: 0
  });

  useEffect(() => {
    let isMounted = true;

    const loadCases = async () => {
      try {
        const response = await fetch(`${config.BASE_URL}/api/case/all`);
        const data = await response.json();
        if (isMounted) {
          setCases(data);
          if (data.length > 0) {
            setSelectedCase(data[0].caseNumber);
          }
        }
      } catch (error) {
        console.error('Error loading cases:', error);
      }
    };

    const loadAllCDRData = async () => {
      if (isMounted) setLoading(true);
      try {
        const response = await fetch(`${config.BASE_URL}/api/cdr/getAllRecords`);
        
        if (!response.ok) {
          console.warn('API not available');
          if (isMounted) {
            setCdrData([]);
            setLoading(false);
          }
          return;
        }
        
        const data = await response.json();
        if (isMounted) setCdrData(data);
      } catch (error) {
        console.error('Error loading CDR data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCases();
    loadAllCDRData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedCase && cdrData.length > 0) {
      analyzeCommonNumbers();
    }
  }, [selectedCase, cdrData]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [commonNumbers, minOccurrence, minSubjects, searchNumber, sortBy]);

  const analyzeCommonNumbers = () => {
    if (!selectedCase || cdrData.length === 0) {
      setCommonNumbers([]);
      return;
    }

    // Filter data for selected case
    const caseData = cdrData.filter(record => record.caseNumber === selectedCase);
    
    if (caseData.length === 0) {
      setCommonNumbers([]);
      return;
    }

    // Map to store B Party analysis
    // Key: B Party Number
    // Value: { subjects (Set of A Party numbers), calls, timestamps, locations, etc. }
    const bPartyMap = {};

    caseData.forEach(record => {
      // In our data model:
      // - callerNumber (A Party) = Subject whose CDR was uploaded
      // - calledNumber (B Party) = Contact/other party
      const aParty = record.callerNumber; // Subject
      const bParty = record.calledNumber; // Contact

      if (!bParty) return;

      if (!bPartyMap[bParty]) {
        bPartyMap[bParty] = {
          bPartyNumber: bParty,
          subjects: new Set(), // A Party numbers that contacted this B Party
          totalCalls: 0,
          calls: [],
          firstContact: null,
          lastContact: null,
          incomingCalls: 0,
          outgoingCalls: 0,
          totalDuration: 0,
          locations: new Set(),
          callTypes: {},
          holidayCalls: 0
        };
      }

      const bPartyData = bPartyMap[bParty];
      
      // Add subject (A Party) to set
      bPartyData.subjects.add(aParty);
      
      // Track call details
      bPartyData.totalCalls++;
      bPartyData.calls.push(record);
      
      // Track timestamps
      const callTime = new Date(record.startTime);
      if (!bPartyData.firstContact || callTime < bPartyData.firstContact) {
        bPartyData.firstContact = callTime;
      }
      if (!bPartyData.lastContact || callTime > bPartyData.lastContact) {
        bPartyData.lastContact = callTime;
      }
      
      // Track call direction
      if (record.callType === 'CALL-IN') {
        bPartyData.incomingCalls++;
      } else if (record.callType === 'CALL-OUT') {
        bPartyData.outgoingCalls++;
      }
      
      // Track duration
      bPartyData.totalDuration += record.callDuration || 0;
      
      // Track locations
      if (record.originLatLong) {
        const locKey = `${record.originLatLong.lat?.toFixed(4)},${record.originLatLong.long?.toFixed(4)}`;
        bPartyData.locations.add(locKey);
      }
      
      // Track call types
      bPartyData.callTypes[record.callType] = (bPartyData.callTypes[record.callType] || 0) + 1;
      
      // Track holiday calls
      const dayInfo = getDayType(record.startTime);
      if (dayInfo.isHoliday) {
        bPartyData.holidayCalls++;
      }
    });

    // Convert to array and add computed fields
    const commonNumbersArray = Object.values(bPartyMap).map(bParty => ({
      ...bParty,
      subjects: Array.from(bParty.subjects),
      subjectCount: bParty.subjects.size,
      locations: Array.from(bParty.locations),
      uniqueLocations: bParty.locations.size,
      isCommon: bParty.subjects.size >= 2, // Common if contacted by 2+ subjects
      averageDuration: bParty.totalCalls > 0 ? Math.floor(bParty.totalDuration / bParty.totalCalls) : 0,
      callFrequency: calculateCallFrequency(bParty.firstContact, bParty.lastContact, bParty.totalCalls)
    }));

    setCommonNumbers(commonNumbersArray);
    calculateStats(commonNumbersArray, caseData);
  };

  const calculateCallFrequency = (firstContact, lastContact, totalCalls) => {
    if (!firstContact || !lastContact || totalCalls <= 1) return 0;
    
    const daysDiff = Math.max(1, Math.ceil((lastContact - firstContact) / (1000 * 60 * 60 * 24)));
    return (totalCalls / daysDiff).toFixed(2);
  };

  const calculateStats = (numbers, caseData) => {
    if (numbers.length === 0) {
      setStats({
        totalBPartyNumbers: 0,
        totalSubjects: 0,
        averageOccurrence: 0,
        mostCommonNumber: null,
        totalCalls: 0
      });
      return;
    }

    const totalCalls = numbers.reduce((sum, n) => sum + n.totalCalls, 0);
    const uniqueSubjects = new Set();
    caseData.forEach(record => uniqueSubjects.add(record.callerNumber));

    const mostCommon = [...numbers].sort((a, b) => b.totalCalls - a.totalCalls)[0];

    setStats({
      totalBPartyNumbers: numbers.length,
      totalSubjects: uniqueSubjects.size,
      averageOccurrence: (totalCalls / numbers.length).toFixed(1),
      mostCommonNumber: mostCommon,
      totalCalls: totalCalls
    });
  };

  const applyFiltersAndSort = () => {
    let filtered = [...commonNumbers];

    // Filter by minimum occurrence
    filtered = filtered.filter(num => num.totalCalls >= minOccurrence);

    // Filter by minimum subjects
    filtered = filtered.filter(num => num.subjectCount >= minSubjects);

    // Filter by search number
    if (searchNumber.trim() !== '') {
      const search = searchNumber.trim();
      filtered = filtered.filter(num => num.bPartyNumber?.includes(search));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'occurrence':
          return b.totalCalls - a.totalCalls;
        case 'subjects':
          return b.subjectCount - a.subjectCount;
        case 'firstContact':
          return a.firstContact - b.firstContact;
        case 'lastContact':
          return b.lastContact - a.lastContact;
        case 'duration':
          return b.totalDuration - a.totalDuration;
        case 'frequency':
          return parseFloat(b.callFrequency) - parseFloat(a.callFrequency);
        default:
          return b.totalCalls - a.totalCalls;
      }
    });

    setFilteredCommonNumbers(filtered);
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const downloadCSV = () => {
    if (filteredCommonNumbers.length === 0) {
      alert('No data to download');
      return;
    }

    const headers = [
      'B Party Number',
      'Total Calls',
      'Subject Count',
      'Subjects (A Party)',
      'First Contact',
      'Last Contact',
      'Incoming Calls',
      'Outgoing Calls',
      'Total Duration',
      'Average Duration',
      'Call Frequency (calls/day)',
      'Unique Locations',
      'Holiday Calls',
      'Call Types'
    ];

    const csvRows = filteredCommonNumbers.map(num => [
      num.bPartyNumber,
      num.totalCalls,
      num.subjectCount,
      num.subjects.join('; '),
      num.firstContact?.toLocaleString() || '',
      num.lastContact?.toLocaleString() || '',
      num.incomingCalls,
      num.outgoingCalls,
      num.totalDuration,
      num.averageDuration,
      num.callFrequency,
      num.uniqueLocations,
      num.holidayCalls,
      Object.entries(num.callTypes).map(([type, count]) => `${type}:${count}`).join('; ')
    ].map(field => `"${field}"`).join(','));

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filename = `Common_Numbers_${selectedCase}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setMinOccurrence(2);
    setMinSubjects(2);
    setSearchNumber('');
    setSortBy('occurrence');
  };

  if (loading) {
    return (
      <div className="content">
        <Row>
          <Col md="12" className="text-center">
            <Spinner color="primary" />
            <p className="mt-3">Loading Common Number Finder...</p>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <h2 className="mb-3">🔍 Common Number Finder</h2>
          <p className="text-muted">Find B Party numbers (contacts) that appear across multiple subjects in a case</p>
        </Col>
      </Row>

      {/* Case Selection */}
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h4">📁 Case Selection</CardTitle>
            </CardHeader>
            <CardBody>
              <FormGroup>
                <Label for="caseSelect">Select Case to Analyze</Label>
                <Input
                  type="select"
                  id="caseSelect"
                  value={selectedCase}
                  onChange={(e) => setSelectedCase(e.target.value)}
                >
                  <option value="">-- Select a Case --</option>
                  {cases.map(caseData => {
                    const caseRecords = cdrData.filter(r => r.caseNumber === caseData.caseNumber).length;
                    return (
                      <option key={caseData.caseNumber} value={caseData.caseNumber}>
                        {caseData.caseNumber} - {caseData.caseName} ({caseRecords} records)
                      </option>
                    );
                  })}
                </Input>
              </FormGroup>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {selectedCase && (
        <>
          {/* Statistics */}
          <Row className="mb-3">
            <Col md="3">
              <Card className="card-stats">
                <CardBody>
                  <p className="card-category">Total B Party Numbers</p>
                  <h3 className="card-title">{stats.totalBPartyNumbers}</h3>
                </CardBody>
              </Card>
            </Col>
            <Col md="3">
              <Card className="card-stats">
                <CardBody>
                  <p className="card-category">Total Subjects (A Party)</p>
                  <h3 className="card-title text-info">{stats.totalSubjects}</h3>
                </CardBody>
              </Card>
            </Col>
            <Col md="3">
              <Card className="card-stats">
                <CardBody>
                  <p className="card-category">Total Calls</p>
                  <h3 className="card-title text-success">{stats.totalCalls}</h3>
                </CardBody>
              </Card>
            </Col>
            <Col md="3">
              <Card className="card-stats">
                <CardBody>
                  <p className="card-category">Most Common Number</p>
                  <h4 className="card-title text-warning" style={{ fontSize: '1em' }}>
                    {stats.mostCommonNumber ? (
                      <>
                        {stats.mostCommonNumber.bPartyNumber}
                        <br />
                        <small className="text-muted">
                          {stats.mostCommonNumber.totalCalls} calls
                        </small>
                      </>
                    ) : 'N/A'}
                  </h4>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Filters */}
          <Row>
            <Col md="12">
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">🔍 Filters & Search</CardTitle>
                </CardHeader>
                <CardBody>
                  <Row>
                    <Col md="2">
                      <FormGroup>
                        <Label for="minOccurrence">Min. Occurrence</Label>
                        <Input
                          type="number"
                          id="minOccurrence"
                          min="1"
                          value={minOccurrence}
                          onChange={(e) => setMinOccurrence(parseInt(e.target.value) || 1)}
                        />
                        <small className="text-muted">Minimum total calls</small>
                      </FormGroup>
                    </Col>
                    <Col md="2">
                      <FormGroup>
                        <Label for="minSubjects">Min. Subjects</Label>
                        <Input
                          type="number"
                          id="minSubjects"
                          min="1"
                          value={minSubjects}
                          onChange={(e) => setMinSubjects(parseInt(e.target.value) || 1)}
                        />
                        <small className="text-muted">Contacted by X subjects</small>
                      </FormGroup>
                    </Col>
                    <Col md="3">
                      <FormGroup>
                        <Label for="searchNumber">Search Number</Label>
                        <Input
                          type="text"
                          id="searchNumber"
                          placeholder="Enter B Party number"
                          value={searchNumber}
                          onChange={(e) => setSearchNumber(e.target.value)}
                        />
                      </FormGroup>
                    </Col>
                    <Col md="3">
                      <FormGroup>
                        <Label for="sortBy">Sort By</Label>
                        <Input
                          type="select"
                          id="sortBy"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                        >
                          <option value="occurrence">Total Calls (High to Low)</option>
                          <option value="subjects">Subject Count (High to Low)</option>
                          <option value="frequency">Call Frequency (High to Low)</option>
                          <option value="duration">Total Duration (High to Low)</option>
                          <option value="firstContact">First Contact (Oldest)</option>
                          <option value="lastContact">Last Contact (Recent)</option>
                        </Input>
                      </FormGroup>
                    </Col>
                    <Col md="2" className="d-flex align-items-end">
                      <ButtonGroup>
                        <Button color="secondary" onClick={resetFilters}>
                          Reset
                        </Button>
                        <Button color="success" onClick={downloadCSV} disabled={filteredCommonNumbers.length === 0}>
                          📥 CSV
                        </Button>
                      </ButtonGroup>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Results Table */}
          <Row>
            <Col md="12">
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">
                    📋 Common Numbers Analysis
                    <Badge color="primary" className="ml-2">
                      {filteredCommonNumbers.length} numbers
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  {filteredCommonNumbers.length === 0 ? (
                    <Alert color="info">
                      No common numbers found with the selected filters. Try adjusting the minimum occurrence or minimum subjects.
                    </Alert>
                  ) : (
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>B Party Number</th>
                          <th>Total Calls</th>
                          <th>Contacted By (Subjects)</th>
                          <th>First Contact</th>
                          <th>Last Contact</th>
                          <th>Call Frequency</th>
                          <th>Total Duration</th>
                          <th>IN/OUT</th>
                          <th>Locations</th>
                          <th>Holiday Calls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCommonNumbers.map((num, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <strong>{num.bPartyNumber}</strong>
                              {searchNumber && num.bPartyNumber?.includes(searchNumber) && (
                                <Badge color="success" className="ml-1">Match</Badge>
                              )}
                              {num.subjectCount >= 3 && (
                                <Badge color="danger" className="ml-1">High Common</Badge>
                              )}
                            </td>
                            <td>
                              <Badge color="primary" style={{ fontSize: '1em' }}>
                                {num.totalCalls}
                              </Badge>
                            </td>
                            <td>
                              <Badge color="info" style={{ fontSize: '1em' }}>
                                {num.subjectCount} subjects
                              </Badge>
                              <div className="mt-1">
                                {num.subjects.slice(0, 3).map((subject, i) => (
                                  <small key={i} className="d-block text-muted">
                                    {subject}
                                  </small>
                                ))}
                                {num.subjects.length > 3 && (
                                  <small className="text-muted">
                                    +{num.subjects.length - 3} more
                                  </small>
                                )}
                              </div>
                            </td>
                            <td>
                              <small>{num.firstContact?.toLocaleString()}</small>
                            </td>
                            <td>
                              <small>{num.lastContact?.toLocaleString()}</small>
                            </td>
                            <td>
                              <Badge color="warning">
                                {num.callFrequency} calls/day
                              </Badge>
                            </td>
                            <td>{formatDuration(num.totalDuration)}</td>
                            <td>
                              <Badge color="success">{num.incomingCalls}↓</Badge>{' '}
                              <Badge color="warning">{num.outgoingCalls}↑</Badge>
                            </td>
                            <td>
                              <Badge color="secondary">{num.uniqueLocations}</Badge>
                            </td>
                            <td>
                              {num.holidayCalls > 0 ? (
                                <Badge color="warning">{num.holidayCalls}</Badge>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {!selectedCase && (
        <Row>
          <Col md="12">
            <Alert color="info">
              Please select a case to analyze common numbers.
            </Alert>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default CommonNumberFinder;

