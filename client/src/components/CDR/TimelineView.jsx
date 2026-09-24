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
  Input,
  FormGroup,
  Label,
  Spinner,
  Alert,
  Table
} from 'reactstrap';
import { getDayType, getHolidayBadgeColor } from '../../services/indianCalendar';

const TimelineView = () => {
  const [loading, setLoading] = useState(false);
  const [cdrData, setCdrData] = useState([]);
  const [ipdrData, setIpdrData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedType, setSelectedType] = useState('all'); // all, call, sms, data
  const [searchNumber, setSearchNumber] = useState('');
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [timelineData, selectedDate, selectedType, searchNumber]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load CDR data
      const cdrResponse = await fetch(`${config.BASE_URL}/api/cdr/getAllRecords`);
      const cdrRecords = cdrResponse.ok ? await cdrResponse.json() : [];

      // Load IPDR data
      const ipdrResponse = await fetch(`${config.BASE_URL}/api/ipdr/getAllRecords`);
      const ipdrRecords = ipdrResponse.ok ? await ipdrResponse.json() : [];

      setCdrData(cdrRecords);
      setIpdrData(ipdrRecords);

      // Merge and create unified timeline
      const timeline = [
        ...cdrRecords.map(r => ({
          ...r,
          source: 'CDR',
          timestamp: new Date(r.startTime),
          type: r.callType?.includes('SMS') ? 'SMS' : 'CALL',
          displayType: r.callType,
          otherParty: r.calledNumber,
          location: r.originLatLong
        })),
        ...ipdrRecords.map(r => ({
          ...r,
          source: 'IPDR',
          timestamp: new Date(r.timestamp || r.startTime),
          type: 'DATA',
          displayType: 'INTERNET',
          otherParty: r.destIP || r.url,
          location: r.location || r.sourceLatLong
        }))
      ].sort((a, b) => a.timestamp - b.timestamp);

      setTimelineData(timeline);

      // Calculate statistics
      calculateStats(timeline);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const callRecords = data.filter(r => r.type === 'CALL');
    const smsRecords = data.filter(r => r.type === 'SMS');
    const dataRecords = data.filter(r => r.type === 'DATA');

    const nightActivity = data.filter(r => {
      const hour = r.timestamp.getHours();
      return hour >= 22 || hour < 6;
    });

    const uniqueDates = [...new Set(data.map(r => r.timestamp.toDateString()))];
    const uniqueNumbers = new Set();
    data.forEach(r => {
      if (r.callerNumber) uniqueNumbers.add(r.callerNumber);
      if (r.calledNumber) uniqueNumbers.add(r.calledNumber);
    });

    setStats({
      totalRecords: data.length,
      totalCalls: callRecords.length,
      totalSMS: smsRecords.length,
      totalData: dataRecords.length,
      nightActivity: nightActivity.length,
      nightPercentage: ((nightActivity.length / data.length) * 100).toFixed(1),
      uniqueDates: uniqueDates.length,
      uniqueNumbers: uniqueNumbers.size,
      firstActivity: data[0]?.timestamp,
      lastActivity: data[data.length - 1]?.timestamp
    });
  };

  const applyFilters = () => {
    let filtered = [...timelineData];

    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter(r => 
        r.timestamp.toDateString() === new Date(selectedDate).toDateString()
      );
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(r => r.type.toLowerCase() === selectedType.toLowerCase());
    }

    // Filter by search number
    if (searchNumber) {
      const search = searchNumber.toLowerCase();
      filtered = filtered.filter(r =>
        r.callerNumber?.includes(search) ||
        r.calledNumber?.includes(search) ||
        r.otherParty?.includes(search)
      );
    }

    setFilteredData(filtered);
  };

  const getTimeOfDayBadge = (timestamp) => {
    const hour = timestamp.getHours();
    if (hour >= 6 && hour < 12) return <Badge color="success">Morning</Badge>;
    if (hour >= 12 && hour < 17) return <Badge color="info">Afternoon</Badge>;
    if (hour >= 17 && hour < 22) return <Badge color="warning">Evening</Badge>;
    return <Badge color="danger">Night</Badge>;
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'CALL': return '📞';
      case 'SMS': return '💬';
      case 'DATA': return '🌐';
      default: return '📋';
    }
  };

  const exportTimeline = () => {
    const csv = [
      ['Timestamp', 'Type', 'Source', 'Caller', 'Other Party', 'Duration', 'Location', 'Time of Day'],
      ...filteredData.map(r => [
        r.timestamp.toLocaleString(),
        r.displayType,
        r.source,
        r.callerNumber || 'N/A',
        r.otherParty || 'N/A',
        r.callDuration || r.duration || 'N/A',
        r.location ? `${r.location.lat}, ${r.location.long}` : 'N/A',
        getTimeOfDayText(r.timestamp)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_${new Date().toISOString()}.csv`;
    a.click();
  };

  const getTimeOfDayText = (timestamp) => {
    const hour = timestamp.getHours();
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 22) return 'Evening';
    return 'Night';
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <Row>
                <Col md="6">
                  <h4 className="title">📅 Unified Activity Timeline</h4>
                  <p className="category">Complete chronological view of all communications and internet activity</p>
                </Col>
                <Col md="6" className="text-right">
                  <Button color="primary" onClick={exportTimeline} disabled={filteredData.length === 0}>
                    📥 Export to CSV
                  </Button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              {/* Statistics */}
              <Row className="mb-3">
                <Col md="2">
                  <Card className="bg-gradient-primary">
                    <CardBody className="text-center">
                      <h6 className="text-white">Total Activities</h6>
                      <h3 className="text-white">{stats.totalRecords || 0}</h3>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-info">
                    <CardBody className="text-center">
                      <h6 className="text-white">Calls</h6>
                      <h3 className="text-white">{stats.totalCalls || 0}</h3>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-success">
                    <CardBody className="text-center">
                      <h6 className="text-white">SMS</h6>
                      <h3 className="text-white">{stats.totalSMS || 0}</h3>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-warning">
                    <CardBody className="text-center">
                      <h6 className="text-white">Internet</h6>
                      <h3 className="text-white">{stats.totalData || 0}</h3>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-danger">
                    <CardBody className="text-center">
                      <h6 className="text-white">Night Activity</h6>
                      <h3 className="text-white">{stats.nightActivity || 0}</h3>
                      <small className="text-white">({stats.nightPercentage}%)</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-default">
                    <CardBody className="text-center">
                      <h6 className="text-white">Unique Numbers</h6>
                      <h3 className="text-white">{stats.uniqueNumbers || 0}</h3>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Filters */}
              <Card className="bg-default">
                <CardBody>
                  <Row>
                    <Col md="3">
                      <FormGroup>
                        <Label className="text-white">Filter by Date</Label>
                        <Input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />
                      </FormGroup>
                    </Col>
                    <Col md="3">
                      <FormGroup>
                        <Label className="text-white">Filter by Type</Label>
                        <Input
                          type="select"
                          value={selectedType}
                          onChange={(e) => setSelectedType(e.target.value)}
                        >
                          <option value="all">All Activities</option>
                          <option value="call">Calls Only</option>
                          <option value="sms">SMS Only</option>
                          <option value="data">Internet Only</option>
                        </Input>
                      </FormGroup>
                    </Col>
                    <Col md="3">
                      <FormGroup>
                        <Label className="text-white">Search Number/IP</Label>
                        <Input
                          type="text"
                          placeholder="Enter number or IP..."
                          value={searchNumber}
                          onChange={(e) => setSearchNumber(e.target.value)}
                        />
                      </FormGroup>
                    </Col>
                    <Col md="3">
                      <FormGroup>
                        <Label className="text-white">Actions</Label>
                        <div>
                          <Button
                            color="warning"
                            size="sm"
                            onClick={() => {
                              setSelectedDate('');
                              setSelectedType('all');
                              setSearchNumber('');
                            }}
                          >
                            Clear Filters
                          </Button>
                        </div>
                      </FormGroup>
                    </Col>
                  </Row>
                </CardBody>
              </Card>

              {/* Timeline Table */}
              {loading ? (
                <div className="text-center p-5">
                  <Spinner color="primary" />
                  <p className="mt-3">Loading timeline data...</p>
                </div>
              ) : filteredData.length === 0 ? (
                <Alert color="info">
                  No activity found. Please upload CDR or IPDR data first, or adjust your filters.
                </Alert>
              ) : (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Table responsive hover striped>
                    <thead style={{ position: 'sticky', top: 0, background: '#27293d', zIndex: 1 }}>
                      <tr>
                        <th>#</th>
                        <th>📅 Date & Time</th>
                        <th>Type</th>
                        <th>Source</th>
                        <th>Caller</th>
                        <th>Other Party</th>
                        <th>Duration</th>
                        <th>Time of Day</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((record, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{record.timestamp.toLocaleDateString()}</strong><br/>
                            <small>{record.timestamp.toLocaleTimeString()}</small>
                          </td>
                          <td>
                            <Badge color={
                              record.type === 'CALL' ? 'primary' :
                              record.type === 'SMS' ? 'success' : 'info'
                            }>
                              {getActivityIcon(record.type)} {record.displayType}
                            </Badge>
                          </td>
                          <td>
                            <Badge color={record.source === 'CDR' ? 'warning' : 'danger'}>
                              {record.source}
                            </Badge>
                          </td>
                          <td>{record.callerNumber || 'N/A'}</td>
                          <td>
                            <small>{record.otherParty || 'N/A'}</small>
                          </td>
                          <td>{record.callDuration || record.duration || '-'}</td>
                          <td>{getTimeOfDayBadge(record.timestamp)}</td>
                          <td>
                            {record.location?.lat ? (
                              <small>{record.location.lat.toFixed(4)}, {record.location.long.toFixed(4)}</small>
                            ) : (
                              <span className="text-muted">No location</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Footer Stats */}
              {filteredData.length > 0 && (
                <Alert color="info" className="mt-3">
                  <strong>📊 Showing {filteredData.length} of {timelineData.length} activities</strong>
                  {stats.firstActivity && stats.lastActivity && (
                    <> | Timeline spans from {stats.firstActivity.toLocaleDateString()} to {stats.lastActivity.toLocaleDateString()} ({stats.uniqueDates} days)</>
                  )}
                </Alert>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TimelineView;
