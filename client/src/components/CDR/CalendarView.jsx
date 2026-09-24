import config from "config";
import React, { useState, useEffect, useCallback } from 'react';
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

const CalendarView = () => {
  const [loading, setLoading] = useState(false);
  const [allCdrData, setAllCdrData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [displayedData, setDisplayedData] = useState([]);
  
  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromTime, setFromTime] = useState('00:00');
  const [toTime, setToTime] = useState('23:59');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('all');
  
  // Lazy loading
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  
  // Calendar statistics
  const [calendarStats, setCalendarStats] = useState({
    totalCalls: 0,
    dateRange: '',
    uniqueContacts: 0,
    totalDuration: 0,
    callsByDay: {},
    holidayCalls: 0
  });

  useEffect(() => {
    loadCases();
    loadAllCDRData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [fromDate, toDate, fromTime, toTime, phoneNumber, allCdrData, selectedCase]);

  useEffect(() => {
    loadMoreData();
  }, [filteredData, currentPage]);

  const loadCases = async () => {
    try {
      const response = await fetch(`${config.BASE_URL}/api/case/all`);
      const data = await response.json();
      setCases(data);
    } catch (error) {
      console.error('Error loading cases:', error);
    }
  };

  const loadAllCDRData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.BASE_URL}/api/cdr/getAllRecords`);
      
      if (!response.ok) {
        console.warn('API not available');
        setAllCdrData([]);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      setAllCdrData(data);
      
      // Set default date range based on data
      if (data.length > 0) {
        const dates = data.map(r => new Date(r.startTime));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        setFromDate(minDate.toISOString().split('T')[0]);
        setToDate(maxDate.toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error('Error loading CDR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    if (allCdrData.length === 0) {
      setFilteredData([]);
      return;
    }

    let filtered = allCdrData;

    // Case filter
    if (selectedCase !== 'all') {
      filtered = filtered.filter(record => record.caseNumber === selectedCase);
    }

    // Date range filter
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      filtered = filtered.filter(record => {
        const recordDate = new Date(record.startTime);
        return recordDate >= from && recordDate <= to;
      });
    }

    // Time range filter
    if (fromTime && toTime) {
      const [fromHour, fromMin] = fromTime.split(':').map(Number);
      const [toHour, toMin] = toTime.split(':').map(Number);

      filtered = filtered.filter(record => {
        const recordDate = new Date(record.startTime);
        const recordHour = recordDate.getHours();
        const recordMin = recordDate.getMinutes();
        const recordTimeInMin = recordHour * 60 + recordMin;
        const fromTimeInMin = fromHour * 60 + fromMin;
        const toTimeInMin = toHour * 60 + toMin;

        // Handle time range that crosses midnight
        if (fromTimeInMin > toTimeInMin) {
          return recordTimeInMin >= fromTimeInMin || recordTimeInMin <= toTimeInMin;
        } else {
          return recordTimeInMin >= fromTimeInMin && recordTimeInMin <= toTimeInMin;
        }
      });
    }

    // Phone number filter (search in both caller and called number)
    if (phoneNumber.trim() !== '') {
      const searchNum = phoneNumber.trim();
      filtered = filtered.filter(record => 
        record.callerNumber?.includes(searchNum) || 
        record.calledNumber?.includes(searchNum)
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    setFilteredData(filtered);
    setCurrentPage(1);
    calculateStats(filtered);
  }, [allCdrData, fromDate, toDate, fromTime, toTime, phoneNumber, selectedCase]);

  const calculateStats = (data) => {
    if (data.length === 0) {
      setCalendarStats({
        totalCalls: 0,
        dateRange: '',
        uniqueContacts: 0,
        totalDuration: 0,
        callsByDay: {},
        holidayCalls: 0
      });
      return;
    }

    const uniqueContacts = new Set();
    let totalDuration = 0;
    const callsByDay = {};
    let holidayCalls = 0;

    data.forEach(record => {
      // Unique contacts
      uniqueContacts.add(record.calledNumber);
      
      // Total duration
      totalDuration += record.callDuration || 0;
      
      // Calls by day
      const dateKey = new Date(record.startTime).toISOString().split('T')[0];
      callsByDay[dateKey] = (callsByDay[dateKey] || 0) + 1;
      
      // Holiday calls
      const dayInfo = getDayType(record.startTime);
      if (dayInfo.isHoliday) {
        holidayCalls++;
      }
    });

    const dates = data.map(r => new Date(r.startTime));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const dateRange = `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;

    setCalendarStats({
      totalCalls: data.length,
      dateRange,
      uniqueContacts: uniqueContacts.size,
      totalDuration,
      callsByDay,
      holidayCalls
    });
  };

  const loadMoreData = useCallback(() => {
    const startIndex = 0;
    const endIndex = currentPage * itemsPerPage;
    const newData = filteredData.slice(startIndex, endIndex);
    
    setDisplayedData(newData);
    setHasMore(endIndex < filteredData.length);
  }, [filteredData, currentPage, itemsPerPage]);

  const handleLoadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const downloadCSV = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }

    // CSV headers
    const headers = [
      'Date & Time',
      'Day of Week',
      'Caller Number',
      'Called Number',
      'Call Type',
      'Duration (seconds)',
      'IMEI',
      'IMSI',
      'Origin Cell ID',
      'Dest Cell ID',
      'Origin Lat',
      'Origin Long',
      'Dest Lat',
      'Dest Long',
      'Holiday/Festival',
      'Network Circle',
      'Case Number'
    ];

    // Convert data to CSV rows
    const csvRows = filteredData.map(record => {
      const dayInfo = getDayType(record.startTime);
      const holidayName = dayInfo.isHoliday ? dayInfo.holiday.name : '';
      
      return [
        new Date(record.startTime).toLocaleString(),
        dayInfo.dayName,
        record.callerNumber,
        record.calledNumber,
        record.callType,
        record.callDuration,
        record.imei,
        record.imsi,
        record.originCellID,
        record.destCellID,
        record.originLatLong?.lat || '',
        record.originLatLong?.long || '',
        record.destLatLong?.lat || '',
        record.destLatLong?.long || '',
        holidayName,
        record.networkCircle || '',
        record.caseNumber
      ].map(field => `"${field}"`).join(',');
    });

    // Combine headers and rows
    const csv = [headers.join(','), ...csvRows].join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filename = `CDR_Calendar_${fromDate}_to_${toDate}_${phoneNumber || 'all'}`.replace(/\s+/g, '_') + '.csv';
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }

    // Enrich data with day information
    const enrichedData = filteredData.map(record => {
      const dayInfo = getDayType(record.startTime);
      return {
        ...record,
        dayOfWeek: dayInfo.dayName,
        isWeekend: dayInfo.isWeekend,
        isSunday: dayInfo.isSunday,
        holiday: dayInfo.isHoliday ? dayInfo.holiday : null
      };
    });

    const dataStr = JSON.stringify(enrichedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const filename = `CDR_Calendar_${fromDate}_to_${toDate}_${phoneNumber || 'all'}`.replace(/\s+/g, '_') + '.json';
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setPhoneNumber('');
    setFromTime('00:00');
    setToTime('23:59');
    setSelectedCase('all');
    
    // Reset to data's date range
    if (allCdrData.length > 0) {
      const dates = allCdrData.map(r => new Date(r.startTime));
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      
      setFromDate(minDate.toISOString().split('T')[0]);
      setToDate(maxDate.toISOString().split('T')[0]);
    }
  };

  if (loading) {
    return (
      <div className="content">
        <Row>
          <Col md="12" className="text-center">
            <Spinner color="primary" />
            <p className="mt-3">Loading Calendar View...</p>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <h2 className="mb-3">📅 CDR Calendar View</h2>
        </Col>
      </Row>

      {/* Filters Card */}
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h4">🔍 Filters & Search</CardTitle>
            </CardHeader>
            <CardBody>
              <Row>
                {/* Date Range */}
                <Col md="3">
                  <FormGroup>
                    <Label for="fromDate">From Date</Label>
                    <Input
                      type="date"
                      id="fromDate"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </FormGroup>
                </Col>
                <Col md="3">
                  <FormGroup>
                    <Label for="toDate">To Date</Label>
                    <Input
                      type="date"
                      id="toDate"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </FormGroup>
                </Col>

                {/* Time Range */}
                <Col md="2">
                  <FormGroup>
                    <Label for="fromTime">From Time</Label>
                    <Input
                      type="time"
                      id="fromTime"
                      value={fromTime}
                      onChange={(e) => setFromTime(e.target.value)}
                    />
                  </FormGroup>
                </Col>
                <Col md="2">
                  <FormGroup>
                    <Label for="toTime">To Time</Label>
                    <Input
                      type="time"
                      id="toTime"
                      value={toTime}
                      onChange={(e) => setToTime(e.target.value)}
                    />
                  </FormGroup>
                </Col>

                {/* Phone Number Search */}
                <Col md="2">
                  <FormGroup>
                    <Label for="phoneNumber">Phone Number</Label>
                    <Input
                      type="text"
                      id="phoneNumber"
                      placeholder="Enter number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      maxLength="10"
                    />
                  </FormGroup>
                </Col>
              </Row>

              <Row>
                {/* Case Filter */}
                {cases.length > 0 && (
                  <Col md="4">
                    <FormGroup>
                      <Label for="caseSelect">Case</Label>
                      <Input
                        type="select"
                        id="caseSelect"
                        value={selectedCase}
                        onChange={(e) => setSelectedCase(e.target.value)}
                      >
                        <option value="all">All Cases</option>
                        {cases.map(caseData => (
                          <option key={caseData.caseNumber} value={caseData.caseNumber}>
                            {caseData.caseNumber} - {caseData.caseName}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                  </Col>
                )}

                {/* Action Buttons */}
                <Col md={cases.length > 0 ? 8 : 12} className="d-flex align-items-end">
                  <ButtonGroup>
                    <Button color="secondary" onClick={resetFilters}>
                      🔄 Reset Filters
                    </Button>
                    <Button color="success" onClick={downloadCSV} disabled={filteredData.length === 0}>
                      📥 Download CSV
                    </Button>
                    <Button color="info" onClick={downloadJSON} disabled={filteredData.length === 0}>
                      📥 Download JSON
                    </Button>
                  </ButtonGroup>
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Statistics Cards */}
      <Row className="mb-3">
        <Col md="2">
          <Card className="card-stats">
            <CardBody>
              <p className="card-category">Total Calls</p>
              <h3 className="card-title">{calendarStats.totalCalls}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md="3">
          <Card className="card-stats">
            <CardBody>
              <p className="card-category">Date Range</p>
              <h4 className="card-title" style={{ fontSize: '0.9em' }}>
                {calendarStats.dateRange || 'N/A'}
              </h4>
            </CardBody>
          </Card>
        </Col>
        <Col md="2">
          <Card className="card-stats">
            <CardBody>
              <p className="card-category">Unique Contacts</p>
              <h3 className="card-title text-info">{calendarStats.uniqueContacts}</h3>
            </CardBody>
          </Card>
        </Col>
        <Col md="2">
          <Card className="card-stats">
            <CardBody>
              <p className="card-category">Total Duration</p>
              <h4 className="card-title text-success" style={{ fontSize: '1em' }}>
                {formatDuration(calendarStats.totalDuration)}
              </h4>
            </CardBody>
          </Card>
        </Col>
        <Col md="3">
          <Card className="card-stats">
            <CardBody>
              <p className="card-category">Holiday/Festival Calls</p>
              <h3 className="card-title text-warning">{calendarStats.holidayCalls}</h3>
              <small className="text-muted">
                {calendarStats.totalCalls > 0 
                  ? `${Math.round((calendarStats.holidayCalls / calendarStats.totalCalls) * 100)}%`
                  : '0%'}
              </small>
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
                📋 Call Records 
                <Badge color="primary" className="ml-2">
                  Showing {displayedData.length} of {filteredData.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {filteredData.length === 0 ? (
                <Alert color="info">
                  No records found for the selected filters. Try adjusting the date range, time, or phone number.
                </Alert>
              ) : (
                <>
                  <Table responsive hover>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date & Time</th>
                        <th>Day</th>
                        <th>Caller</th>
                        <th>Called</th>
                        <th>Type</th>
                        <th>Duration</th>
                        <th>Location</th>
                        <th>Holiday/Festival</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedData.map((record, idx) => {
                        const dayInfo = getDayType(record.startTime);
                        return (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <small>{new Date(record.startTime).toLocaleString()}</small>
                            </td>
                            <td>
                              <Badge color={dayInfo.isWeekend ? 'info' : 'secondary'}>
                                {dayInfo.dayName}
                              </Badge>
                            </td>
                            <td>
                              <strong>{record.callerNumber}</strong>
                              {phoneNumber && record.callerNumber?.includes(phoneNumber) && (
                                <Badge color="success" className="ml-1">Match</Badge>
                              )}
                            </td>
                            <td>
                              <strong>{record.calledNumber}</strong>
                              {phoneNumber && record.calledNumber?.includes(phoneNumber) && (
                                <Badge color="success" className="ml-1">Match</Badge>
                              )}
                            </td>
                            <td>
                              <Badge color={record.callType === 'CALL-OUT' ? 'warning' : 'success'}>
                                {record.callType}
                              </Badge>
                            </td>
                            <td>{formatDuration(record.callDuration || 0)}</td>
                            <td>
                              <small>
                                {record.originLatLong?.lat?.toFixed(4)}, 
                                {record.originLatLong?.long?.toFixed(4)}
                              </small>
                            </td>
                            <td>
                              {dayInfo.isHoliday ? (
                                <Badge color={getHolidayBadgeColor(dayInfo.holiday.type)}>
                                  {dayInfo.holiday.name}
                                </Badge>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>

                  {/* Load More Button */}
                  {hasMore && (
                    <div className="text-center mt-3">
                      <Button color="primary" onClick={handleLoadMore}>
                        Load More ({filteredData.length - displayedData.length} remaining)
                      </Button>
                    </div>
                  )}

                  {!hasMore && filteredData.length > itemsPerPage && (
                    <div className="text-center mt-3">
                      <Alert color="success">
                        All {filteredData.length} records loaded
                      </Alert>
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CalendarView;
