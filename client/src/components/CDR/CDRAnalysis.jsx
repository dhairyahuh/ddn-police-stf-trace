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
  ButtonGroup,
  Input,
  FormGroup,
  Label,
  Spinner,
  Alert
} from 'reactstrap';
import { getDayType, getHolidayBadgeColor } from '../../services/indianCalendar';

const CDRAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [cdrData, setCdrData] = useState([]);
  const [filteredDataCount, setFilteredDataCount] = useState(0);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('all');
  const [analysis, setAnalysis] = useState({
    topCallers: [],
    topSMS: [],
    topDurations: [],
    locationStats: [],
    imeiList: [],
    imsiList: [],
    imsiChanges: [],
    internationalCalls: [],
    frequentContacts: [],
    nightCalls: [],
    bankSMS: [],
    uniqueLocations: 0,
    holidayCalls: [],
    sundayCalls: [],
    festivalSummary: []
  });
  const [sortBy, setSortBy] = useState('location');
  const [filterType, setFilterType] = useState('all'); // all, calls, sms
  const [imeiInfo, setImeiInfo] = useState({}); // Store IMEI lookup results
  const [loadingImei, setLoadingImei] = useState({}); // Track loading state for each IMEI
  
  // Night calls time range filter
  const [nightCallsFromHour, setNightCallsFromHour] = useState(23); // Default 11 PM
  const [nightCallsToHour, setNightCallsToHour] = useState(5); // Default 5 AM

  useEffect(() => {
    loadCases();
    loadCDRData();
  }, []);
  
  useEffect(() => {
    if (cdrData.length > 0) {
      const filteredData = selectedCase === 'all' 
        ? cdrData 
        : cdrData.filter(record => record.caseNumber === selectedCase);
      setFilteredDataCount(filteredData.length);
      analyzeData(filteredData);
    }
  }, [selectedCase, cdrData]);

  const loadCases = async () => {
    try {
      const response = await fetch(`${config.BASE_URL}/api/case/all`);
      const data = await response.json();
      setCases(data);
    } catch (error) {
      console.error('Error loading cases:', error);
    }
  };

  // Fetch IMEI information from API
  const fetchIMEIInfo = async (imei) => {
    // Check if already loaded or loading
    if (imeiInfo[imei] || loadingImei[imei]) {
      return;
    }

    setLoadingImei(prev => ({ ...prev, [imei]: true }));

    try {
      console.log(`Fetching IMEI info for: ${imei}`);
      
      // Use backend proxy to avoid CORS issues
      const response = await fetch(`${config.BASE_URL}/imei-info/${imei}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log(`Raw response: ${text}`);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        throw new Error('Invalid JSON response from API');
      }
      
      console.log('Parsed data:', data);
      
      setImeiInfo(prev => ({
        ...prev,
        [imei]: data
      }));
    } catch (error) {
      console.error(`Error fetching IMEI info for ${imei}:`, error);
      setImeiInfo(prev => ({
        ...prev,
        [imei]: { 
          error: 'Failed to fetch IMEI info',
          errorMessage: error.message,
          errorDetails: error.toString()
        }
      }));
    } finally {
      setLoadingImei(prev => ({ ...prev, [imei]: false }));
    }
  };

  const loadCDRData = async () => {
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
    } catch (error) {
      console.error('Error loading CDR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeData = (data) => {
    if (!data || data.length === 0) return;

    // IMPORTANT: In the CDR data model:
    // - callerNumber = "Target No" (the phone whose CDR was uploaded - ALWAYS the subject)
    // - calledNumber = "B Party No" (the other party - ALWAYS the contact)
    // Regardless of call direction (IN/OUT), callerNumber is the subject
    
    // Identify the subject phone numbers (whose CDR was uploaded)
    const subjectNumbers = new Set();
    data.forEach(record => {
      // callerNumber is ALWAYS the subject in our data model
      if (record.callerNumber) {
        subjectNumbers.add(record.callerNumber);
      }
    });

    // 1. Top Callers (most frequent contacts) - only count ACTUAL CALLS, not SMS
    const callerMap = {};
    data.forEach(record => {
      // Only count CALL records (CALL-IN, CALL-OUT), exclude SMS
      if (!record.callType?.includes('CALL')) return;
      
      // In our data model, calledNumber is ALWAYS the other party (B Party)
      const contact = record.calledNumber;
      
      // Only count if contact exists and is not somehow a subject number (shouldn't happen but safe check)
      if (contact && !subjectNumbers.has(contact)) {
        if (!callerMap[contact]) {
          callerMap[contact] = {
            number: contact,
            count: 0,
            totalDuration: 0,
            firstCall: record.startTime,
            lastCall: record.startTime,
            callTypes: {}
          };
        }
        callerMap[contact].count++;
        callerMap[contact].totalDuration += record.callDuration || 0;
        callerMap[contact].lastCall = record.startTime;
        callerMap[contact].callTypes[record.callType] = (callerMap[contact].callTypes[record.callType] || 0) + 1;
      }
    });

    const topCallers = Object.values(callerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 2. Top SMS senders (banks, OTP services, etc.)
    // In our data model, calledNumber is ALWAYS the B Party (other party)
    const smsMap = {};
    data.filter(r => r.callType?.includes('SMS')).forEach(record => {
      // calledNumber is always the B Party (other party), regardless of SMS direction
      const contact = record.calledNumber;
      if (contact && !subjectNumbers.has(contact)) {
        if (!smsMap[contact]) {
          smsMap[contact] = {
            number: contact,
            count: 0,
            firstSMS: record.startTime,
            lastSMS: record.startTime,
            type: detectSMSType(contact)
          };
        }
        smsMap[contact].count++;
        smsMap[contact].lastSMS = record.startTime;
      }
    });

    const topSMS = Object.values(smsMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // 3. IMEIs used
    const imeiSet = new Set();
    const imeiDetails = {};
    data.forEach(record => {
      if (record.imei) {
        imeiSet.add(record.imei);
        if (!imeiDetails[record.imei]) {
          imeiDetails[record.imei] = {
            imei: record.imei,
            firstSeen: record.startTime,
            lastSeen: record.startTime,
            callCount: 0,
            numbers: new Set()
          };
        }
        imeiDetails[record.imei].callCount++;
        imeiDetails[record.imei].lastSeen = record.startTime;
        imeiDetails[record.imei].numbers.add(record.callerNumber);
      }
    });

    const imeiList = Object.values(imeiDetails).map(imei => ({
      ...imei,
      numbers: Array.from(imei.numbers),
      simSwap: imei.numbers.size > 1
    }));

    // 3b. IMSIs used
    const imsiDetails = {};
    data.forEach(record => {
      if (record.imsi) {
        if (!imsiDetails[record.imsi]) {
          imsiDetails[record.imsi] = {
            imsi: record.imsi,
            firstSeen: record.startTime,
            lastSeen: record.startTime,
            callCount: 0,
            numbers: new Set(),
            imeis: new Set()
          };
        }
        imsiDetails[record.imsi].callCount++;
        imsiDetails[record.imsi].lastSeen = record.startTime;
        imsiDetails[record.imsi].numbers.add(record.callerNumber);
        if (record.imei) {
          imsiDetails[record.imsi].imeis.add(record.imei);
        }
      }
    });

    const imsiList = Object.values(imsiDetails).map(imsi => ({
      ...imsi,
      numbers: Array.from(imsi.numbers),
      imeis: Array.from(imsi.imeis),
      multipleDevices: imsi.imeis.size > 1,
      multipleNumbers: imsi.numbers.size > 1
    }));

    // 3c. IMSI Change Monitor (New SIM Detection)
    const phoneIMSIMap = {};
    const sortedData = [...data].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    sortedData.forEach(record => {
      if (record.callerNumber && record.imsi) {
        if (!phoneIMSIMap[record.callerNumber]) {
          phoneIMSIMap[record.callerNumber] = [];
        }
        
        const lastEntry = phoneIMSIMap[record.callerNumber][phoneIMSIMap[record.callerNumber].length - 1];
        
        // Check if IMSI changed
        if (!lastEntry || lastEntry.imsi !== record.imsi) {
          phoneIMSIMap[record.callerNumber].push({
            imsi: record.imsi,
            imei: record.imei,
            firstSeen: record.startTime,
            lastSeen: record.startTime,
            callCount: 1
          });
        } else {
          lastEntry.lastSeen = record.startTime;
          lastEntry.callCount++;
        }
      }
    });

    // Find phone numbers with IMSI changes (new SIM)
    const imsiChanges = [];
    Object.entries(phoneIMSIMap).forEach(([phoneNumber, imsiHistory]) => {
      if (imsiHistory.length > 1) {
        imsiChanges.push({
          phoneNumber,
          changeCount: imsiHistory.length - 1,
          imsiHistory,
          suspicious: imsiHistory.length > 2
        });
      }
    });

    imsiChanges.sort((a, b) => b.changeCount - a.changeCount);

    // 4. International calls
    // In our data model, calledNumber is ALWAYS the B Party (other party)
    const internationalCalls = data.filter(record => {
      const contact = record.calledNumber;
      return contact && (contact.startsWith('+') || contact.startsWith('00'));
    }).map(record => ({
      ...record,
      contact: record.calledNumber,
      country: getCountryFromNumber(record.calledNumber)
    }));

    // 5. Top duration callers
    const topDurations = Object.values(callerMap)
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 10);

    // 6. Location-based statistics
    const locationMap = {};
    data.forEach(record => {
      if (record.originLatLong) {
        const locKey = `${record.originLatLong.lat?.toFixed(4)},${record.originLatLong.long?.toFixed(4)}`;
        if (!locationMap[locKey]) {
          locationMap[locKey] = {
            location: locKey,
            lat: record.originLatLong.lat,
            long: record.originLatLong.long,
            cellID: record.cellID || record.originCellID,
            count: 0,
            firstSeen: record.startTime,
            lastSeen: record.startTime
          };
        }
        locationMap[locKey].count++;
        locationMap[locKey].lastSeen = record.startTime;
      }
    });

    const locationStats = Object.values(locationMap)
      .sort((a, b) => b.count - a.count);

    // 7. Frequent contacts (reciprocal calls) - only counting actual calls, not SMS
    const contactPairs = {};
    data.forEach(record => {
      // Only count CALL records, not SMS
      if (!record.callType?.includes('CALL')) return;
      
      // In our data model, calledNumber is ALWAYS the other party (B Party)
      const contact = record.calledNumber;
      
      // Only count if contact exists and is not a subject number
      if (contact && !subjectNumbers.has(contact)) {
        if (!contactPairs[contact]) {
          contactPairs[contact] = {
            number: contact,
            count: 0,
            incoming: 0,
            outgoing: 0
          };
        }
        contactPairs[contact].count++;
        // CALL-IN means the B Party called the subject (incoming from B Party's perspective)
        if (record.callType === 'CALL-IN') contactPairs[contact].incoming++;
        // CALL-OUT means the subject called the B Party (outgoing to B Party's perspective)
        if (record.callType === 'CALL-OUT') contactPairs[contact].outgoing++;
      }
    });

    const frequentContacts = Object.values(contactPairs)
      .filter(contact => contact.incoming > 0 && contact.outgoing > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 8. Night calls - will be filtered separately based on user-selected time range
    // Store all records with time for later filtering
    const allCallsWithTime = data.map(record => ({
      ...record,
      hour: new Date(record.startTime).getHours()
    }));

    // 9. All SMS (categorized by type)
    // Show all SMS, not just banks - users want to see everything
    const bankSMS = topSMS; // Show all SMS with their types

    // 10. Holiday and Festival Calls Analysis
    const holidayCalls = [];
    const sundayCalls = [];
    const festivalCallsMap = {};
    
    data.forEach(record => {
      const dayInfo = getDayType(record.startTime);
      const contact = record.calledNumber;
      
      // Enrich record with day information
      const enrichedRecord = {
        ...record,
        dayInfo,
        contact
      };
      
      // Sunday calls
      if (dayInfo.isSunday) {
        sundayCalls.push(enrichedRecord);
      }
      
      // Holiday/Festival calls
      if (dayInfo.isHoliday) {
        holidayCalls.push(enrichedRecord);
        
        // Group by festival/holiday name
        const festivalName = dayInfo.holiday.name;
        if (!festivalCallsMap[festivalName]) {
          festivalCallsMap[festivalName] = {
            name: festivalName,
            date: dayInfo.holiday.date,
            type: dayInfo.holiday.type,
            calls: [],
            contacts: new Set(),
            locations: new Set(),
            callCount: 0
          };
        }
        
        festivalCallsMap[festivalName].calls.push(enrichedRecord);
        festivalCallsMap[festivalName].contacts.add(contact);
        festivalCallsMap[festivalName].callCount++;
        
        // Add location info
        if (record.originLatLong) {
          const locKey = `${record.originLatLong.lat?.toFixed(4)},${record.originLatLong.long?.toFixed(4)}`;
          festivalCallsMap[festivalName].locations.add(locKey);
        }
      }
    });
    
    // Convert festival map to array and sort by call count
    const festivalSummary = Object.values(festivalCallsMap).map(festival => ({
      ...festival,
      contacts: Array.from(festival.contacts),
      locations: Array.from(festival.locations),
      uniqueContacts: festival.contacts.size,
      uniqueLocations: festival.locations.size
    })).sort((a, b) => b.callCount - a.callCount);

    setAnalysis({
      topCallers,
      topSMS,
      topDurations,
      locationStats,
      imeiList,
      imsiList,
      imsiChanges,
      internationalCalls,
      frequentContacts,
      allCallsWithTime, // Store all calls with hour info for night call filtering
      bankSMS,
      uniqueLocations: locationStats.length,
      holidayCalls,
      sundayCalls,
      festivalSummary
    });
  };

  const detectSMSType = (number) => {
    if (!number) return 'Unknown';
    
    const numStr = number.toString().toUpperCase();
    
    // Telecom operator codes (typically 6-7 chars with letters)
    if (/^[A-Z]{2,3}[A-Z0-9]{3,5}$/.test(numStr) && numStr.length <= 8) {
      // Check for known telecom patterns
      if (numStr.includes('AIRTEL') || numStr.includes('AIR') || numStr.includes('AWAIRT')) return 'Telecom';
      if (numStr.includes('JIO') || numStr.includes('RJIL')) return 'Telecom';
      if (numStr.includes('VODAF') || numStr.includes('VF') || numStr.includes('VI')) return 'Telecom';
      if (numStr.includes('BSNL') || numStr.includes('MTNL')) return 'Telecom';
    }
    
    // Bank patterns (6-char alphanumeric codes starting with letters)
    if ((numStr.length === 6 || numStr.length === 7) && /^[A-Z]{2}/.test(numStr)) {
      // Common bank code patterns
      if (numStr.includes('HDFC') || numStr.includes('ICICI') || numStr.includes('SBI') || 
          numStr.includes('AXIS') || numStr.includes('BANK') || numStr.includes('PAYTM')) {
        return 'Bank';
      }
      return 'Service'; // Other 6-char codes are likely services
    }
    
    // OTP/Service numbers (short numeric codes)
    if (numStr.length <= 6 && /^\d+$/.test(numStr)) return 'OTP';
    
    // Commercial/Promotional services (5-digit codes starting with 1)
    if (numStr.startsWith('1') && numStr.length === 5) return 'Promotional';
    
    // Regular phone numbers (10 digits)
    if (numStr.length === 10 && /^\d+$/.test(numStr)) return 'Regular';
    
    return 'Other';
  };

  const getCountryFromNumber = (number) => {
    if (!number) return 'Unknown';
    if (number.startsWith('+91') || number.startsWith('0091')) return 'India';
    if (number.startsWith('+1') || number.startsWith('001')) return 'USA/Canada';
    if (number.startsWith('+44') || number.startsWith('0044')) return 'UK';
    if (number.startsWith('+971') || number.startsWith('00971')) return 'UAE';
    return 'International';
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Filter night calls based on user-selected time range
  const filteredNightCalls = React.useMemo(() => {
    if (!analysis.allCallsWithTime || analysis.allCallsWithTime.length === 0) {
      return [];
    }
    
    return analysis.allCallsWithTime.filter(record => {
      const hour = record.hour;
      
      // Handle time ranges that cross midnight (e.g., 23:00 to 5:00)
      if (nightCallsFromHour > nightCallsToHour) {
        // Range crosses midnight: include hours >= fromHour OR hours < toHour
        return hour >= nightCallsFromHour || hour < nightCallsToHour;
      } else {
        // Normal range within same day: include hours >= fromHour AND hours < toHour
        return hour >= nightCallsFromHour && hour < nightCallsToHour;
      }
    });
  }, [analysis.allCallsWithTime, nightCallsFromHour, nightCallsToHour]);

  if (loading) {
    return (
      <div className="content">
        <Row>
          <Col md="12" className="text-center">
            <Spinner color="primary" />
            <p className="mt-3">Loading CDR Analysis...</p>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div className="content">
      {/* Case Selector - Top Right */}
      {cases.length > 0 && (
        <Row className="mb-3">
          <Col md="8">
            <h2 className="mb-0">📊 CDR Analysis - Criminal Investigation</h2>
          </Col>
          <Col md="4" className="text-right">
            <FormGroup className="mb-0">
              <Input
                type="select"
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
              >
                <option value="all">All Cases ({cdrData.length} records)</option>
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
          </Col>
        </Row>
      )}
      
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h4">Forensic Analysis Dashboard</CardTitle>
              <p className="category">Comprehensive call detail record analysis for forensic investigation</p>
            </CardHeader>
            <CardBody>
              
              {cdrData.length === 0 ? (
                <Alert color="warning">
                  No CDR data found. Please upload CDR files first.
                </Alert>
              ) : (
                <>
                  {/* Summary Stats */}
                  <Row className="mb-4">
                    <Col md="2">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">Total Records</p>
                          <h3 className="card-title">{filteredDataCount}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="2">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">Unique Locations</p>
                          <h3 className="card-title">{analysis.uniqueLocations}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="2">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">IMEIs Used</p>
                          <h3 className="card-title">{analysis.imeiList.length}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="2">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">Int'l Calls</p>
                          <h3 className="card-title">{analysis.internationalCalls.length}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="2">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">Night Calls</p>
                          <h3 className="card-title text-warning">{filteredNightCalls.length}</h3>
                          <small className="text-muted">
                            {nightCallsFromHour}:00 - {nightCallsToHour}:00
                          </small>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="2">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">SIM Swaps</p>
                          <h3 className="card-title text-danger">
                            {analysis.imeiList.filter(i => i.simSwap).length}
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* Indian Calendar Stats */}
                  <Row className="mb-4">
                    <Col md="3">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">🎉 Festival/Holiday Calls</p>
                          <h3 className="card-title text-warning">{analysis.holidayCalls.length}</h3>
                          <small className="text-muted">
                            {analysis.festivalSummary.length} different festivals
                          </small>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">📅 Sunday Calls</p>
                          <h3 className="card-title text-info">{analysis.sundayCalls.length}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">🎊 Most Active Festival</p>
                          <h3 className="card-title text-success">
                            {analysis.festivalSummary.length > 0 
                              ? analysis.festivalSummary[0].callCount 
                              : 0}
                          </h3>
                          <small className="text-muted">
                            {analysis.festivalSummary.length > 0 
                              ? analysis.festivalSummary[0].name 
                              : 'N/A'}
                          </small>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">🗓️ Weekend Activity</p>
                          <h3 className="card-title text-primary">
                            {Math.round((analysis.sundayCalls.length / (filteredDataCount || 1)) * 100)}%
                          </h3>
                          <small className="text-muted">of total calls on Sunday</small>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* 1. Location-Based Analysis */}
                  <Row>
                    <Col md="12">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">📍 Location-Based Analysis</CardTitle>
                        </CardHeader>
                        <CardBody>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Cell Tower ID</th>
                                <th>Coordinates</th>
                                <th>Call Count</th>
                                <th>First Seen</th>
                                <th>Last Seen</th>
                                <th>Frequency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.locationStats.slice(0, 10).map((loc, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td><code>{loc.cellID}</code></td>
                                  <td><small>{loc.lat?.toFixed(6)}, {loc.long?.toFixed(6)}</small></td>
                                  <td><Badge color="info">{loc.count}</Badge></td>
                                  <td>{new Date(loc.firstSeen).toLocaleString()}</td>
                                  <td>{new Date(loc.lastSeen).toLocaleString()}</td>
                                  <td>
                                    {loc.count > 50 ? (
                                      <Badge color="success">High</Badge>
                                    ) : loc.count > 20 ? (
                                      <Badge color="warning">Medium</Badge>
                                    ) : (
                                      <Badge color="secondary">Low</Badge>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* 2. Top Callers */}
                  <Row>
                    <Col md="6">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">📞 Top Contacts (Most Frequent)</CardTitle>
                        </CardHeader>
                        <CardBody>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Number</th>
                                <th>Calls</th>
                                <th>Total Duration</th>
                                <th>Last Contact</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.topCallers.map((caller, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td><strong>{caller.number}</strong></td>
                                  <td><Badge color="primary">{caller.count}</Badge></td>
                                  <td>{formatDuration(caller.totalDuration)}</td>
                                  <td><small>{new Date(caller.lastCall).toLocaleDateString()}</small></td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </Col>

                    {/* 6. Top Duration Callers */}
                    <Col md="6">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">⏱️ Longest Call Durations</CardTitle>
                        </CardHeader>
                        <CardBody>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Number</th>
                                <th>Calls</th>
                                <th>Total Time</th>
                                <th>Avg/Call</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.topDurations.map((caller, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td><strong>{caller.number}</strong></td>
                                  <td>{caller.count}</td>
                                  <td><Badge color="success">{formatDuration(caller.totalDuration)}</Badge></td>
                                  <td>{formatDuration(Math.floor(caller.totalDuration / caller.count))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* 3. IMEI Analysis */}
                  <Row>
                    <Col md="12">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">📱 IMEI Analysis (Device Tracking)</CardTitle>
                        </CardHeader>
                        <CardBody>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>IMEI</th>
                                <th>Calls</th>
                                <th>Phone Numbers Used</th>
                                <th>First Seen</th>
                                <th>Last Seen</th>
                                <th>Status</th>
                                <th>IMEI Info</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.imeiList.map((imei, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td><code>{imei.imei}</code></td>
                                  <td>{imei.callCount}</td>
                                  <td>
                                    {imei.numbers.map((num, i) => (
                                      <Badge key={i} color="info" className="mr-1">{num}</Badge>
                                    ))}
                                  </td>
                                  <td><small>{new Date(imei.firstSeen).toLocaleString()}</small></td>
                                  <td><small>{new Date(imei.lastSeen).toLocaleString()}</small></td>
                                  <td>
                                    {imei.simSwap ? (
                                      <Badge color="danger">⚠️ SIM SWAP</Badge>
                                    ) : (
                                      <Badge color="success">✓ Normal</Badge>
                                    )}
                                  </td>
                                  <td>
                                    {!imeiInfo[imei.imei] && !loadingImei[imei.imei] ? (
                                      <Button
                                        color="primary"
                                        size="sm"
                                        onClick={() => fetchIMEIInfo(imei.imei)}
                                      >
                                        🔍 Get Info
                                      </Button>
                                    ) : loadingImei[imei.imei] ? (
                                      <Spinner size="sm" color="primary" />
                                    ) : imeiInfo[imei.imei] && imeiInfo[imei.imei].error ? (
                                      <div>
                                        <Badge color="danger">Error loading info</Badge>
                                        <div style={{ fontSize: '0.75em', marginTop: '5px' }}>
                                          <small className="text-muted">
                                            {imeiInfo[imei.imei].errorMessage || 'Check console for details'}
                                          </small>
                                        </div>
                                        <Button
                                          color="secondary"
                                          size="sm"
                                          className="mt-1"
                                          onClick={() => {
                                            // Clear error and retry
                                            const newImeiInfo = { ...imeiInfo };
                                            delete newImeiInfo[imei.imei];
                                            setImeiInfo(newImeiInfo);
                                            fetchIMEIInfo(imei.imei);
                                          }}
                                        >
                                          Retry
                                        </Button>
                                      </div>
                                    ) : imeiInfo[imei.imei] ? (
                                      <div style={{ fontSize: '0.85em' }}>
                                        {imeiInfo[imei.imei].brand && (
                                          <div><strong>Brand:</strong> {imeiInfo[imei.imei].brand}</div>
                                        )}
                                        {imeiInfo[imei.imei].model && (
                                          <div><strong>Model:</strong> {imeiInfo[imei.imei].model}</div>
                                        )}
                                        {imeiInfo[imei.imei].device && (
                                          <div><strong>Device:</strong> {imeiInfo[imei.imei].device}</div>
                                        )}
                                        {imeiInfo[imei.imei].name && (
                                          <div><strong>Name:</strong> {imeiInfo[imei.imei].name}</div>
                                        )}
                                        {imeiInfo[imei.imei].marketingName && (
                                          <div><strong>Marketing Name:</strong> {imeiInfo[imei.imei].marketingName}</div>
                                        )}
                                        {imeiInfo[imei.imei].manufacturer && (
                                          <div><strong>Manufacturer:</strong> {imeiInfo[imei.imei].manufacturer}</div>
                                        )}
                                        {imeiInfo[imei.imei].status && (
                                          <div>
                                            <Badge color={imeiInfo[imei.imei].status === 'valid' ? 'success' : 'warning'}>
                                              {imeiInfo[imei.imei].status}
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* 3b. IMSI Analysis */}
                  <Row>
                    <Col md="12">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">📡 IMSI Analysis (SIM Card Tracking)</CardTitle>
                        </CardHeader>
                        <CardBody>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>IMSI</th>
                                <th>Calls</th>
                                <th>Phone Numbers</th>
                                <th>Devices (IMEIs)</th>
                                <th>First Seen</th>
                                <th>Last Seen</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.imsiList.map((imsi, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td><code>{imsi.imsi}</code></td>
                                  <td>{imsi.callCount}</td>
                                  <td>
                                    {imsi.numbers.map((num, i) => (
                                      <Badge key={i} color="info" className="mr-1">{num}</Badge>
                                    ))}
                                  </td>
                                  <td>
                                    {imsi.imeis.map((imeiVal, i) => (
                                      <div key={i}><small><code>{imeiVal}</code></small></div>
                                    ))}
                                  </td>
                                  <td><small>{new Date(imsi.firstSeen).toLocaleString()}</small></td>
                                  <td><small>{new Date(imsi.lastSeen).toLocaleString()}</small></td>
                                  <td>
                                    {imsi.multipleDevices ? (
                                      <Badge color="danger">⚠️ Multiple Devices</Badge>
                                    ) : imsi.multipleNumbers ? (
                                      <Badge color="warning">⚠️ Multiple Numbers</Badge>
                                    ) : (
                                      <Badge color="success">✓ Normal</Badge>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* 3c. IMSI Change Monitor (New SIM Detection) */}
                  {analysis.imsiChanges.length > 0 && (
                    <Row>
                      <Col md="12">
                        <Card>
                          <CardHeader>
                            <CardTitle tag="h4">🔄 IMSI Change Monitor (New SIM Detection)</CardTitle>
                            <p className="card-category text-warning">
                              Phone numbers that have changed SIM cards - potential suspicious activity
                            </p>
                          </CardHeader>
                          <CardBody>
                            <Table responsive>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Phone Number</th>
                                  <th>SIM Changes</th>
                                  <th>IMSI History</th>
                                  <th>Alert Level</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysis.imsiChanges.map((change, idx) => (
                                  <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td><strong>{change.phoneNumber}</strong></td>
                                    <td>
                                      <Badge color={change.suspicious ? "danger" : "warning"}>
                                        {change.changeCount} {change.changeCount === 1 ? 'Change' : 'Changes'}
                                      </Badge>
                                    </td>
                                    <td>
                                      <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                        {change.imsiHistory.map((history, hIdx) => (
                                          <div key={hIdx} className="mb-2" style={{ borderLeft: '3px solid #1d8cf8', paddingLeft: '10px' }}>
                                            <div><strong>IMSI:</strong> <code>{history.imsi}</code></div>
                                            <div><strong>IMEI:</strong> <code>{history.imei}</code></div>
                                            <div>
                                              <small>
                                                <strong>Active:</strong> {new Date(history.firstSeen).toLocaleDateString()} 
                                                {' → '} 
                                                {new Date(history.lastSeen).toLocaleDateString()}
                                              </small>
                                            </div>
                                            <div><small><strong>Calls:</strong> {history.callCount}</small></div>
                                            {hIdx < change.imsiHistory.length - 1 && (
                                              <div className="text-warning mt-1">
                                                <small>⬇ SIM CHANGED</small>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                    <td>
                                      {change.suspicious ? (
                                        <Badge color="danger" className="badge-lg">
                                          🚨 High Risk
                                        </Badge>
                                      ) : (
                                        <Badge color="warning">
                                          ⚠️ Monitor
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </CardBody>
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {/* 4. International Calls */}
                  {analysis.internationalCalls.length > 0 && (
                    <Row>
                      <Col md="12">
                        <Card>
                          <CardHeader>
                            <CardTitle tag="h4">🌍 International Calls</CardTitle>
                          </CardHeader>
                          <CardBody>
                            <Table responsive>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Contact</th>
                                  <th>Country</th>
                                  <th>Type</th>
                                  <th>Time</th>
                                  <th>Duration</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysis.internationalCalls.slice(0, 20).map((call, idx) => (
                                  <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td><strong>{call.contact}</strong></td>
                                    <td><Badge color="warning">{call.country}</Badge></td>
                                    <td>{call.callType}</td>
                                    <td><small>{new Date(call.startTime).toLocaleString()}</small></td>
                                    <td>{formatDuration(call.callDuration || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </CardBody>
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {/* 5. SMS Analysis - All Categories */}
                  <Row>
                    <Col md="12">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">💬 SMS Analysis (All Messages)</CardTitle>
                          <p className="category">Categorized by sender type: Bank, Telecom, OTP, Service, etc.</p>
                        </CardHeader>
                        <CardBody>
                          {analysis.bankSMS.length === 0 ? (
                            <Alert color="info">
                              No SMS records found in the CDR data.
                            </Alert>
                          ) : (
                            <Table responsive>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Sender ID</th>
                                  <th>Category</th>
                                  <th>Count</th>
                                  <th>First SMS</th>
                                  <th>Last SMS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysis.bankSMS.map((sms, idx) => (
                                  <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td><code>{sms.number}</code></td>
                                    <td>
                                      <Badge color={
                                        sms.type === 'Bank' ? 'success' : 
                                        sms.type === 'Telecom' ? 'warning' :
                                        sms.type === 'OTP' ? 'info' :
                                        sms.type === 'Service' ? 'primary' :
                                        sms.type === 'Promotional' ? 'secondary' :
                                        sms.type === 'Regular' ? 'dark' :
                                        'light'
                                      }>
                                        {sms.type}
                                      </Badge>
                                    </td>
                                    <td><Badge color="primary">{sms.count}</Badge></td>
                                    <td><small>{new Date(sms.firstSMS).toLocaleString()}</small></td>
                                    <td><small>{new Date(sms.lastSMS).toLocaleString()}</small></td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          )}
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* Festival/Holiday Calls Analysis */}
                  <Row>
                    <Col md="12">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">🎉 Festival & Holiday Call Analysis</CardTitle>
                          <p className="category">Calls made during Indian festivals, national holidays, and Sundays</p>
                        </CardHeader>
                        <CardBody>
                          {analysis.festivalSummary.length === 0 ? (
                            <Alert color="info">
                              No festival or holiday calls found in the selected date range.
                            </Alert>
                          ) : (
                            <>
                              <h5>📊 Festival-wise Call Summary</h5>
                              <Table responsive className="mb-4">
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Festival/Holiday</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Total Calls</th>
                                    <th>Unique Contacts</th>
                                    <th>Unique Locations</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysis.festivalSummary.map((festival, idx) => (
                                    <tr key={idx}>
                                      <td>{idx + 1}</td>
                                      <td><strong>{festival.name}</strong></td>
                                      <td>{new Date(festival.date).toLocaleDateString()}</td>
                                      <td>
                                        <Badge color={getHolidayBadgeColor(festival.type)}>
                                          {festival.type === 'national' ? 'National' : 
                                           festival.type === 'festival' ? 'Festival' : 
                                           festival.type === 'public' ? 'Public Holiday' : 
                                           festival.type}
                                        </Badge>
                                      </td>
                                      <td><Badge color="primary">{festival.callCount}</Badge></td>
                                      <td><Badge color="info">{festival.uniqueContacts}</Badge></td>
                                      <td><Badge color="success">{festival.uniqueLocations}</Badge></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>

                              <h5 className="mt-4">📞 Recent Holiday/Festival Calls</h5>
                              <Table responsive>
                                <thead>
                                  <tr>
                                    <th>Date & Time</th>
                                    <th>Contact</th>
                                    <th>Festival/Holiday</th>
                                    <th>Type</th>
                                    <th>Call Type</th>
                                    <th>Location</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysis.holidayCalls.slice(0, 20).map((call, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <small>{new Date(call.startTime).toLocaleString()}</small>
                                        <br />
                                        <Badge color="secondary" className="mt-1">
                                          {call.dayInfo.dayName}
                                        </Badge>
                                      </td>
                                      <td><strong>{call.contact}</strong></td>
                                      <td>{call.dayInfo.holiday.name}</td>
                                      <td>
                                        <Badge color={getHolidayBadgeColor(call.dayInfo.holiday.type)}>
                                          {call.dayInfo.holiday.type}
                                        </Badge>
                                      </td>
                                      <td>
                                        <Badge color={call.callType === 'CALL-OUT' ? 'warning' : 'success'}>
                                          {call.callType}
                                        </Badge>
                                      </td>
                                      <td>
                                        <small>
                                          {call.originLatLong?.lat?.toFixed(4)}, {call.originLatLong?.long?.toFixed(4)}
                                        </small>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </>
                          )}
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* Sunday Calls Analysis */}
                  {analysis.sundayCalls.length > 0 && (
                    <Row>
                      <Col md="12">
                        <Card>
                          <CardHeader>
                            <CardTitle tag="h4">📅 Sunday Calls Analysis</CardTitle>
                            <p className="category text-info">
                              {analysis.sundayCalls.length} calls made on Sundays - potential suspicious activity
                            </p>
                          </CardHeader>
                          <CardBody>
                            <Table responsive>
                              <thead>
                                <tr>
                                  <th>Date & Time</th>
                                  <th>Contact</th>
                                  <th>Call Type</th>
                                  <th>Duration</th>
                                  <th>Location</th>
                                  <th>Holiday</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analysis.sundayCalls.slice(0, 20).map((call, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <small>{new Date(call.startTime).toLocaleString()}</small>
                                      <br />
                                      <Badge color="info">Sunday</Badge>
                                    </td>
                                    <td><strong>{call.contact}</strong></td>
                                    <td>
                                      <Badge color={call.callType === 'CALL-OUT' ? 'warning' : 'success'}>
                                        {call.callType}
                                      </Badge>
                                    </td>
                                    <td>{formatDuration(call.callDuration || 0)}</td>
                                    <td>
                                      <small>
                                        {call.originLatLong?.lat?.toFixed(4)}, {call.originLatLong?.long?.toFixed(4)}
                                      </small>
                                    </td>
                                    <td>
                                      {call.dayInfo.isHoliday ? (
                                        <Badge color={getHolidayBadgeColor(call.dayInfo.holiday.type)}>
                                          {call.dayInfo.holiday.name}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </CardBody>
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {/* Additional Insights */}
                  <Row>
                    {/* Frequent Reciprocal Contacts */}
                    <Col md="6">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">🔄 Frequent Contacts (2-Way)</CardTitle>
                        </CardHeader>
                        <CardBody>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>Contact Number</th>
                                <th>Total</th>
                                <th>In/Out</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.frequentContacts.map((contact, idx) => (
                                <tr key={idx}>
                                  <td>
                                    <strong>{contact.number}</strong>
                                  </td>
                                  <td><Badge color="info">{contact.count}</Badge></td>
                                  <td>
                                    <Badge color="success">{contact.incoming}↓</Badge>{' '}
                                    <Badge color="warning">{contact.outgoing}↑</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </Col>

                    {/* Night Calls (Custom Time Range) */}
                    <Col md="6">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h4">🌙 Night Calls (Custom Time Range)</CardTitle>
                          <Row className="mt-2">
                            <Col md="5">
                              <FormGroup>
                                <Label for="nightCallsFrom">From Hour (24h format)</Label>
                                <Input
                                  type="number"
                                  id="nightCallsFrom"
                                  min="0"
                                  max="23"
                                  value={nightCallsFromHour}
                                  onChange={(e) => setNightCallsFromHour(parseInt(e.target.value) || 0)}
                                />
                                <small className="text-muted">
                                  {nightCallsFromHour}:00 ({nightCallsFromHour === 0 ? '12 AM' : nightCallsFromHour < 12 ? `${nightCallsFromHour} AM` : nightCallsFromHour === 12 ? '12 PM' : `${nightCallsFromHour - 12} PM`})
                                </small>
                              </FormGroup>
                            </Col>
                            <Col md="5">
                              <FormGroup>
                                <Label for="nightCallsTo">To Hour (24h format)</Label>
                                <Input
                                  type="number"
                                  id="nightCallsTo"
                                  min="0"
                                  max="23"
                                  value={nightCallsToHour}
                                  onChange={(e) => setNightCallsToHour(parseInt(e.target.value) || 0)}
                                />
                                <small className="text-muted">
                                  {nightCallsToHour}:00 ({nightCallsToHour === 0 ? '12 AM' : nightCallsToHour < 12 ? `${nightCallsToHour} AM` : nightCallsToHour === 12 ? '12 PM' : `${nightCallsToHour - 12} PM`})
                                </small>
                              </FormGroup>
                            </Col>
                            <Col md="2" className="d-flex align-items-end">
                              <Button
                                color="secondary"
                                size="sm"
                                onClick={() => {
                                  setNightCallsFromHour(23);
                                  setNightCallsToHour(5);
                                }}
                                title="Reset to default (11 PM - 5 AM)"
                              >
                                Reset
                              </Button>
                            </Col>
                          </Row>
                        </CardHeader>
                        <CardBody>
                          <p className="text-warning">
                            <strong>{filteredNightCalls.length}</strong> calls made during selected hours
                            {nightCallsFromHour > nightCallsToHour && (
                              <span className="ml-2 text-muted">(crosses midnight)</span>
                            )}
                          </p>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>Contact</th>
                                <th>Time</th>
                                <th>Hour</th>
                                <th>Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredNightCalls.slice(0, 10).map((call, idx) => (
                                <tr key={idx}>
                                  <td>{call.calledNumber}</td>
                                  <td><small>{new Date(call.startTime).toLocaleString()}</small></td>
                                  <td><Badge color="info">{call.hour}:00</Badge></td>
                                  <td><Badge color="warning">{call.callType}</Badge></td>
                                </tr>
                              ))}
                              {filteredNightCalls.length === 0 && (
                                <tr>
                                  <td colSpan="4" className="text-center text-muted">
                                    No calls found in the selected time range
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>
                </>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CDRAnalysis;
