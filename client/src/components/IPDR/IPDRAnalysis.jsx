import config from "config";
import React, { useState, useEffect, useRef } from 'react';
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
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Progress,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter
} from 'reactstrap';
import { Bar, Pie, Line } from 'react-chartjs-2';

const IPDRAnalysis = () => {
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(false);
  const [ipdrData, setIpdrData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [statistics, setStatistics] = useState(null);
  const [suspiciousActivity, setSuspiciousActivity] = useState(null);
  const [whatsappCalls, setWhatsappCalls] = useState(null);
  const [portAnalysis, setPortAnalysis] = useState(null);
  
  // Verification Modal
  const [verificationModal, setVerificationModal] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  
  // WhatsApp Correlation
  const [correlations, setCorrelations] = useState(null);
  const [correlationPhone, setCorrelationPhone] = useState('');
  const [correlationLoading, setCorrelationLoading] = useState(false);
  
  // Filters
  const [serviceFilter, setServiceFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all'); // all, vpn, tor, suspicious

  useEffect(() => {
    isMounted.current = true;
    
    loadCases();
    loadIPDRData();
    loadStatistics();
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedCase && selectedCase !== 'all') {
      loadCaseAnalysis(selectedCase);
    }
  }, [selectedCase]);

  useEffect(() => {
    applyFilters();
  }, [ipdrData, serviceFilter, flagFilter, selectedCase]);

  const loadCases = async () => {
    try {
      const response = await fetch(`${config.BASE_URL}/api/case/all`);
      const data = await response.json();
      if (isMounted.current) {
        setCases(data);
      }
    } catch (error) {
      console.error('Error loading cases:', error);
    }
  };

  const loadIPDRData = async () => {
    if (isMounted.current) setLoading(true);
    try {
      const response = await fetch(`${config.BASE_URL}/api/ipdr/v2/all`);
      if (response.ok) {
        const data = await response.json();
        if (isMounted.current) {
          setIpdrData(data);
        }
      }
    } catch (error) {
      console.error('Error loading IPDR data:', error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch(`${config.BASE_URL}/api/ipdr/v2/statistics`);
      if (response.ok) {
        const data = await response.json();
        if (isMounted.current) {
          setStatistics(data);
        }
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const loadCaseAnalysis = async (caseNumber) => {
    try {
      // Load suspicious activity
      const suspiciousRes = await fetch(`${config.BASE_URL}/api/ipdr/v2/analyze/suspicious/${caseNumber}`);
      if (suspiciousRes.ok) {
        const data = await suspiciousRes.json();
        if (isMounted.current) {
          setSuspiciousActivity(data);
        }
      }

      // Load WhatsApp calls
      const whatsappRes = await fetch(`${config.BASE_URL}/api/ipdr/v2/whatsapp/${caseNumber}`);
      if (whatsappRes.ok) {
        const data = await whatsappRes.json();
        if (isMounted.current) {
          setWhatsappCalls(data);
        }
      }

      // Load port analysis
      const portRes = await fetch(`${config.BASE_URL}/api/ipdr/v2/analyze/ports/${caseNumber}`);
      if (portRes.ok) {
        const data = await portRes.json();
        if (isMounted.current) {
          setPortAnalysis(data);
        }
      }
    } catch (error) {
      console.error('Error loading case analysis:', error);
    }
  };

  const applyFilters = () => {
    let filtered = ipdrData;

    // Case filter
    if (selectedCase !== 'all') {
      filtered = filtered.filter(r => r.caseNumber === selectedCase);
    }

    // Service filter
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(r => r.serviceType === serviceFilter);
    }

    // Flag filter
    if (flagFilter !== 'all') {
      switch (flagFilter) {
        case 'vpn':
          filtered = filtered.filter(r => r.isVPN);
          break;
        case 'tor':
          filtered = filtered.filter(r => r.isTor);
          break;
        case 'proxy':
          filtered = filtered.filter(r => r.isProxy);
          break;
        case 'suspicious':
          filtered = filtered.filter(r => r.isSuspicious);
          break;
        case 'voip':
          filtered = filtered.filter(r => r.isVoIP);
          break;
        default:
          break;
      }
    }

    setFilteredData(filtered);
  };

  const toggleTab = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };

  // Fetch detailed verification info for a record
  const fetchVerificationInfo = async (record) => {
    if (isMounted.current) {
      setVerificationLoading(true);
      setVerificationModal(true);
    }
    
    try {
      const response = await fetch(`${config.BASE_URL}/api/ipdr/v2/verify-detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destIP: record.destIP,
          destPort: record.destPort,
          protocol: record.protocol,
          vpnProvider: record.vpnProvider,
          isVPN: record.isVPN,
          isTor: record.isTor,
          isProxy: record.isProxy,
          application: record.application,
          serviceType: record.serviceType,
          uplinkVolume: record.uplinkVolume,
          downlinkVolume: record.downlinkVolume,
          duration: record.duration
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (isMounted.current) {
          setVerificationData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching verification:', error);
      if (isMounted.current) {
        setVerificationData({ error: 'Failed to fetch verification data' });
      }
    } finally {
      if (isMounted.current) {
        setVerificationLoading(false);
      }
    }
  };

  const closeVerificationModal = () => {
    setVerificationModal(false);
    setVerificationData(null);
  };

  // Fetch WhatsApp VoIP correlations
  const fetchCorrelations = async () => {
    if (!correlationPhone || !selectedCase || selectedCase === 'all') {
      alert('Please select a case and enter an IMSI (15 digits)');
      return;
    }
    
    if (isMounted.current) setCorrelationLoading(true);
    try {
      const response = await fetch(
        `${config.BASE_URL}/api/correlation/whatsapp?imsi=${correlationPhone}&caseNumber=${selectedCase}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (isMounted.current) {
          setCorrelations(data);
        }
      } else {
        alert('Failed to fetch correlations');
      }
    } catch (error) {
      console.error('Error fetching correlations:', error);
      alert('Error fetching correlations');
    } finally {
      if (isMounted.current) setCorrelationLoading(false);
    }
  };

  // Get unique services for filter dropdown
  const uniqueServices = [...new Set(ipdrData.map(r => r.serviceType))].filter(Boolean);

  // Chart data for port distribution
  const getPortChartData = () => {
    if (!portAnalysis || portAnalysis.length === 0) return null;

    const top10 = portAnalysis.slice(0, 10);
    return {
      labels: top10.map(p => `${p._id.port} (${p._id.service})`),
      datasets: [{
        label: 'Connection Count',
        data: top10.map(p => p.count),
        backgroundColor: 'rgba(29, 140, 248, 0.8)',
      }]
    };
  };

  // Chart data for service distribution
  const getServiceChartData = () => {
    if (!statistics || !statistics.topServices) return null;

    return {
      labels: statistics.topServices.map(s => s._id || 'Unknown'),
      datasets: [{
        data: statistics.topServices.map(s => s.count),
        backgroundColor: [
          '#1d8cf8', '#00d6b4', '#fd5d93', '#f4516c', '#00c9ff',
          '#ff6b81', '#a29bfe', '#fdcb6e', '#00b894', '#e17055'
        ]
      }]
    };
  };

  const getFlagBadge = (record) => {
    const flags = [];
    if (record.isVPN) flags.push(<Badge key="vpn" color="warning" className="mr-1">VPN</Badge>);
    if (record.isTor) flags.push(<Badge key="tor" color="danger" className="mr-1">Tor</Badge>);
    if (record.isProxy) flags.push(<Badge key="proxy" color="info" className="mr-1">Proxy</Badge>);
    if (record.isVoIP) flags.push(<Badge key="voip" color="success" className="mr-1">VoIP</Badge>);
    if (record.isSuspicious) flags.push(<Badge key="sus" color="danger" className="mr-1">⚠ Suspicious</Badge>);
    return flags.length > 0 ? flags : <Badge color="secondary">Normal</Badge>;
  };

  return (
    <div className="content">
      {/* Case Selector */}
      <Row className="mb-3">
        <Col md="12">
          <Card className="card-stats">
            <CardBody>
              <Row>
                <Col md="4">
                  <FormGroup>
                    <Label>Select Case</Label>
                    <Input
                      type="select"
                      value={selectedCase}
                      onChange={(e) => setSelectedCase(e.target.value)}
                      style={{ color: '#000', backgroundColor: '#fff' }}
                    >
                      <option value="all">All Cases (Cross-Analysis)</option>
                      {cases.map((c, idx) => (
                        <option key={idx} value={c.caseNumber}>
                          {c.caseNumber} - {c.caseName} ({c.year})
                        </option>
                      ))}
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="3">
                  <FormGroup>
                    <Label>Service Type</Label>
                    <Input
                      type="select"
                      value={serviceFilter}
                      onChange={(e) => setServiceFilter(e.target.value)}
                      style={{ color: '#000', backgroundColor: '#fff' }}
                    >
                      <option value="all">All Services</option>
                      {uniqueServices.map((service, idx) => (
                        <option key={idx} value={service}>{service}</option>
                      ))}
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="3">
                  <FormGroup>
                    <Label>Activity Flag</Label>
                    <Input
                      type="select"
                      value={flagFilter}
                      onChange={(e) => setFlagFilter(e.target.value)}
                      style={{ color: '#000', backgroundColor: '#fff' }}
                    >
                      <option value="all">All Activity</option>
                      <option value="vpn">VPN Usage</option>
                      <option value="tor">Tor Network</option>
                      <option value="proxy">Proxy/Datacenter</option>
                      <option value="voip">VoIP Calls</option>
                      <option value="suspicious">Suspicious</option>
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="2">
                  <Label>&nbsp;</Label>
                  <div>
                    <strong>Filtered Records:</strong> {filteredData.length}
                  </div>
                </Col>
              </Row>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Statistics Overview */}
      {statistics && (
        <Row className="mb-4">
          <Col md="2">
            <Card className="card-stats">
              <CardBody>
                <p className="card-category">Total Records</p>
                <h3 className="card-title">{statistics.totalRecords}</h3>
              </CardBody>
            </Card>
          </Col>
          <Col md="2">
            <Card className="card-stats">
              <CardBody>
                <p className="card-category">VPN Detected</p>
                <h3 className="card-title text-warning">{statistics.vpnRecords}</h3>
              </CardBody>
            </Card>
          </Col>
          <Col md="2">
            <Card className="card-stats">
              <CardBody>
                <p className="card-category">Tor Usage</p>
                <h3 className="card-title text-danger">{statistics.torRecords}</h3>
              </CardBody>
            </Card>
          </Col>
          <Col md="2">
            <Card className="card-stats">
              <CardBody>
                <p className="card-category">VoIP Calls</p>
                <h3 className="card-title text-success">{statistics.voipRecords}</h3>
              </CardBody>
            </Card>
          </Col>
          <Col md="2">
            <Card className="card-stats">
              <CardBody>
                <p className="card-category">Suspicious</p>
                <h3 className="card-title text-danger">{statistics.suspiciousRecords}</h3>
              </CardBody>
            </Card>
          </Col>
          <Col md="2">
            <Card className="card-stats">
              <CardBody>
                <p className="card-category">Unique Dest IPs</p>
                <h3 className="card-title">{statistics.topDestIPs?.length || 0}</h3>
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* Tabs */}
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <Nav tabs>
                <NavItem>
                  <NavLink
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => toggleTab('overview')}
                    style={{ cursor: 'pointer' }}
                  >
                    📊 Overview
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={activeTab === 'records' ? 'active' : ''}
                    onClick={() => toggleTab('records')}
                    style={{ cursor: 'pointer' }}
                  >
                    📋 Records
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={activeTab === 'suspicious' ? 'active' : ''}
                    onClick={() => toggleTab('suspicious')}
                    style={{ cursor: 'pointer' }}
                  >
                    ⚠️ Suspicious Activity
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={activeTab === 'whatsapp' ? 'active' : ''}
                    onClick={() => toggleTab('whatsapp')}
                    style={{ cursor: 'pointer' }}
                  >
                    📞 WhatsApp/VoIP
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={activeTab === 'ports' ? 'active' : ''}
                    onClick={() => toggleTab('ports')}
                    style={{ cursor: 'pointer' }}
                  >
                    🔌 Port Analysis
                  </NavLink>
                </NavItem>
              </Nav>
            </CardHeader>

            <CardBody>
              <TabContent activeTab={activeTab}>
                {/* Overview Tab */}
                <TabPane tabId="overview">
                  <Row>
                    <Col md="6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Service Distribution</CardTitle>
                        </CardHeader>
                        <CardBody>
                          {getServiceChartData() && (
                            <Pie data={getServiceChartData()} options={{ maintainAspectRatio: true }} />
                          )}
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Top Applications</CardTitle>
                        </CardHeader>
                        <CardBody>
                          {statistics?.topApplications?.map((app, idx) => (
                            <div key={idx} className="mb-2">
                              <div className="d-flex justify-content-between">
                                <span>{app._id || 'Unknown'}</span>
                                <span><strong>{app.count}</strong></span>
                              </div>
                              <Progress value={(app.count / statistics.totalRecords) * 100} />
                            </div>
                          ))}
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>
                </TabPane>

                {/* Records Tab */}
                <TabPane tabId="records">
                  {loading ? (
                    <div className="text-center">
                      <Spinner color="primary" />
                      <p>Loading IPDR records...</p>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      <Table responsive striped size="sm">
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e1e2f', zIndex: 1 }}>
                          <tr>
                            <th>#</th>
                            <th>Time</th>
                            <th>Phone</th>
                            <th>Dest IP</th>
                            <th>Port</th>
                            <th>Service/App</th>
                            <th>Data</th>
                            <th>Flags</th>
                            <th>Details</th>
                            <th>Verify</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredData.map((record, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td><small>{new Date(record.startTime).toLocaleString()}</small></td>
                              <td><code>{record.phoneNumber}</code></td>
                              <td><code style={{ fontSize: '10px' }}>{record.destIP}</code></td>
                              <td>
                                <Badge color="info">{record.destPort}</Badge>
                                <br />
                                <small>{record.protocol}</small>
                              </td>
                              <td>
                                <strong>{record.serviceType}</strong>
                                <br />
                                <small>{record.application}</small>
                              </td>
                              <td>
                                <small>
                                  ↑ {(record.uplinkVolume / 1024 / 1024).toFixed(2)} MB<br />
                                  ↓ {(record.downlinkVolume / 1024 / 1024).toFixed(2)} MB
                                </small>
                              </td>
                              <td>{getFlagBadge(record)}</td>
                              <td>
                                {record.vpnProvider && <div><small>VPN: {record.vpnProvider}</small></div>}
                                {record.correlatedPartyB && (
                                  <div>
                                    <small>
                                      Party B: <code>{record.correlatedPartyB}</code>
                                      <br />
                                      Confidence: {record.correlationConfidence}%
                                    </small>
                                  </div>
                                )}
                                {record.suspicionReason && <div><small className="text-danger">{record.suspicionReason}</small></div>}
                              </td>
                              <td>
                                {(record.isVPN || record.isTor || record.isProxy || record.application === 'WhatsApp') && (
                                  <Button 
                                    size="sm" 
                                    color="info" 
                                    onClick={() => fetchVerificationInfo(record)}
                                    title="Get detailed verification info"
                                  >
                                    🔍 Info
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </TabPane>

                {/* Suspicious Activity Tab */}
                <TabPane tabId="suspicious">
                  {suspiciousActivity ? (
                    <>
                      <Row>
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">VPN Usage</p>
                              <h3 className="card-title text-warning">{suspiciousActivity.vpnUsage.length}</h3>
                            </CardBody>
                          </Card>
                        </Col>
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">Tor Network</p>
                              <h3 className="card-title text-danger">{suspiciousActivity.torUsage.length}</h3>
                            </CardBody>
                          </Card>
                        </Col>
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">Proxy Usage</p>
                              <h3 className="card-title text-info">{suspiciousActivity.proxyUsage.length}</h3>
                            </CardBody>
                          </Card>
                        </Col>
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">Other Suspicious</p>
                              <h3 className="card-title text-danger">{suspiciousActivity.otherSuspicious.length}</h3>
                            </CardBody>
                          </Card>
                        </Col>
                      </Row>

                      <Row>
                        <Col md="12">
                          <Card>
                            <CardHeader>
                              <CardTitle>Suspicious Activity Timeline</CardTitle>
                            </CardHeader>
                            <CardBody>
                              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {suspiciousActivity.timeline.map((item, idx) => (
                                  <Alert key={idx} color={
                                    item.type === 'Tor' ? 'danger' : 
                                    item.type === 'VPN' ? 'warning' : 'info'
                                  }>
                                    <strong>[{item.type}]</strong> {new Date(item.time).toLocaleString()}<br />
                                    <strong>Dest IP:</strong> {item.destIP} | <strong>Service:</strong> {item.service}<br />
                                    {item.reason && <small><strong>Reason:</strong> {item.reason}</small>}
                                  </Alert>
                                ))}
                              </div>
                            </CardBody>
                          </Card>
                        </Col>
                      </Row>
                    </>
                  ) : (
                    <Alert color="info">Select a case to view suspicious activity analysis</Alert>
                  )}
                </TabPane>

                {/* WhatsApp/VoIP Tab */}
                <TabPane tabId="whatsapp">
                  <Row className="mb-4">
                    <Col md="12">
                      <Alert color="info">
                        <h5>📞 WhatsApp VoIP Call Correlation</h5>
                        <p className="mb-0">
                          Find WhatsApp calls using IMSI/IMEI identifiers and correlate with Party B. 
                          Uses 5-digit UDP ports (50000-59999) and timing analysis. IPDR data doesn't contain phone numbers.
                        </p>
                      </Alert>
                    </Col>
                  </Row>

                  <Row className="mb-4">
                    <Col md="3">
                      <FormGroup>
                        <Label>IMSI</Label>
                        <Input
                          type="text"
                          placeholder="Enter 15-digit IMSI"
                          value={correlationPhone}
                          onChange={(e) => setCorrelationPhone(e.target.value)}
                          style={{ color: '#000', backgroundColor: '#fff' }}
                          maxLength="15"
                        />
                        <small className="text-muted">IPDR uses IMSI identifier</small>
                      </FormGroup>
                    </Col>
                    <Col md="3">
                      <FormGroup>
                        <Label>Case</Label>
                        <Input
                          type="select"
                          value={selectedCase}
                          onChange={(e) => setSelectedCase(e.target.value)}
                          style={{ color: '#000', backgroundColor: '#fff' }}
                        >
                          <option value="all">Select a case</option>
                          {cases.map((c) => (
                            <option key={c.caseNumber} value={c.caseNumber}>
                              {c.caseNumber} - {c.caseName}
                            </option>
                          ))}
                        </Input>
                      </FormGroup>
                    </Col>
                    <Col md="4">
                      <Label>&nbsp;</Label>
                      <Button
                        color="primary"
                        block
                        onClick={fetchCorrelations}
                        disabled={correlationLoading || !correlationPhone || selectedCase === 'all'}
                      >
                        {correlationLoading ? <Spinner size="sm" /> : 'Find Correlations'}
                      </Button>
                    </Col>
                  </Row>

                  {correlations && (
                    <>
                      <Row className="mb-4">
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">WhatsApp Calls</p>
                              <h3 className="card-title text-success">{correlations.totalWhatsAppCalls || 0}</h3>
                            </CardBody>
                          </Card>
                        </Col>
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">IMSI</p>
                              <h3 className="card-title text-info">{correlationPhone}</h3>
                            </CardBody>
                          </Card>
                        </Col>
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">Party B Found</p>
                              <h3 className="card-title text-warning">{correlations.totalPartyBFound || 0}</h3>
                            </CardBody>
                          </Card>
                        </Col>
                        <Col md="3">
                          <Card className="card-stats">
                            <CardBody>
                              <p className="card-category">Avg Duration</p>
                              <h3 className="card-title">
                                {correlations.whatsappCalls && correlations.whatsappCalls.length > 0
                                  ? Math.round(
                                      correlations.whatsappCalls.reduce((sum, c) => sum + (c.duration || 0), 0) /
                                        correlations.whatsappCalls.length
                                    )
                                  : 0}
                                s
                              </h3>
                            </CardBody>
                          </Card>
                        </Col>
                      </Row>

                      <Card>
                        <CardHeader>
                          <CardTitle>
                            WhatsApp VoIP Calls for IMSI: {correlationPhone}
                          </CardTitle>
                        </CardHeader>
                        <CardBody>
                          {correlations.whatsappCalls && correlations.whatsappCalls.length > 0 ? (
                            <Table responsive hover>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>Call Time</th>
                                  <th>Duration</th>
                                  <th>IMEI</th>
                                  <th>Destination IP</th>
                                  <th>Ports</th>
                                  <th>Data Volume</th>
                                  <th>Party B</th>
                                </tr>
                              </thead>
                              <tbody>
                                {correlations.whatsappCalls.map((call, idx) => (
                                  <React.Fragment key={idx}>
                                    <tr>
                                      <td>{call.id}</td>
                                      <td>
                                        <small>
                                          {new Date(call.startTime).toLocaleString()}
                                        </small>
                                      </td>
                                      <td>
                                        <Badge color="info">{call.duration}s</Badge>
                                      </td>
                                      <td>
                                        <code style={{ fontSize: '0.8em' }}>{call.imei}</code>
                                      </td>
                                      <td>
                                        <code style={{ fontSize: '0.85em' }}>
                                          {call.destinationIP}
                                        </code>
                                      </td>
                                      <td>
                                        <Badge color="success">{call.sourcePort}</Badge>
                                        {' → '}
                                        <Badge color="secondary">{call.destinationPort}</Badge>
                                      </td>
                                      <td>
                                        <small>
                                          ↑ {(call.uplinkBytes / 1024 / 1024).toFixed(2)} MB
                                          <br />
                                          ↓ {(call.downlinkBytes / 1024 / 1024).toFixed(2)} MB
                                        </small>
                                      </td>
                                      <td>
                                        {call.partyBCorrelations && call.partyBCorrelations.length > 0 ? (
                                          <Badge color="success">
                                            {call.partyBCorrelations.length} match{call.partyBCorrelations.length > 1 ? 'es' : ''}
                                          </Badge>
                                        ) : (
                                          <Badge color="secondary">No match</Badge>
                                        )}
                                      </td>
                                    </tr>
                                    {call.partyBCorrelations && call.partyBCorrelations.length > 0 && (
                                      <tr>
                                        <td colSpan="8" style={{ backgroundColor: '#f8f9fa', padding: '10px' }}>
                                          <strong>Party B Correlations:</strong>
                                          {call.partyBCorrelations.map((corr, cIdx) => (
                                            <div key={cIdx} className="mt-2 p-2 border rounded" style={{ backgroundColor: 'white' }}>
                                              <Row>
                                                <Col md="3">
                                                  <small className="text-muted">IMSI:</small><br />
                                                  <code>{corr.partyBImsi}</code>
                                                </Col>
                                                <Col md="2">
                                                  <small className="text-muted">Time:</small><br />
                                                  <small>{new Date(corr.partyBStartTime).toLocaleTimeString()}</small>
                                                </Col>
                                                <Col md="2">
                                                  <small className="text-muted">Duration:</small><br />
                                                  <Badge color="info">{corr.partyBDuration}s</Badge>
                                                </Col>
                                                <Col md="2">
                                                  <small className="text-muted">Port:</small><br />
                                                  <Badge color="success">{corr.partyBPort}</Badge>
                                                </Col>
                                                <Col md="3">
                                                  <small className="text-muted">Confidence:</small><br />
                                                  <Badge color={corr.confidence >= 80 ? 'success' : corr.confidence >= 60 ? 'warning' : 'danger'}>
                                                    {corr.confidence}% 
                                                  </Badge>
                                                  <small className="ml-2 text-muted">
                                                    (Overlap: {corr.timeOverlap}%, Duration: {corr.durationMatch}%)
                                                  </small>
                                                </Col>
                                              </Row>
                                            </div>
                                          ))}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </Table>
                          ) : (
                            <Alert color="warning">
                              No WhatsApp calls found for this IMSI in the selected case.
                            </Alert>
                          )}
                        </CardBody>
                      </Card>
                    </>
                  )}
                  
                  {whatsappCalls && !correlations && (
                    <>
                      <Alert color="success">
                        <strong>Detected {whatsappCalls.totalWhatsAppCalls} WhatsApp/VoIP Calls</strong>
                      </Alert>
                      
                      <Table responsive>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Time</th>
                            <th>Phone Number</th>
                            <th>Destination IP</th>
                            <th>Port</th>
                            <th>Duration</th>
                            <th>Data Volume</th>
                            <th>Correlated Party B</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {whatsappCalls.calls.map((call, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>{new Date(call.ipdr.startTime).toLocaleString()}</td>
                              <td><code>{call.ipdr.phoneNumber}</code></td>
                              <td><code>{call.ipdr.destIP}</code></td>
                              <td><Badge color="success">{call.ipdr.destPort}</Badge></td>
                              <td>{Math.floor((call.ipdr.endTime - call.ipdr.startTime) / 1000)}s</td>
                              <td>{(call.ipdr.totalVolume / 1024 / 1024).toFixed(2)} MB</td>
                              <td>
                                {call.correlatedPartyB ? (
                                  <code>{call.correlatedPartyB}</code>
                                ) : (
                                  <span className="text-muted">Not found</span>
                                )}
                              </td>
                              <td>
                                {call.confidence > 0 ? (
                                  <Badge color={call.confidence > 70 ? 'success' : call.confidence > 40 ? 'warning' : 'danger'}>
                                    {call.confidence}%
                                  </Badge>
                                ) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </>
                  )}
                </TabPane>

                {/* Port Analysis Tab */}
                <TabPane tabId="ports">
                  {portAnalysis && portAnalysis.length > 0 ? (
                    <>
                      <Row className="mb-4">
                        <Col md="12">
                          <Card>
                            <CardHeader>
                              <CardTitle>Top Ports by Connection Count</CardTitle>
                            </CardHeader>
                            <CardBody>
                              {getPortChartData() && (
                                <Bar data={getPortChartData()} options={{ maintainAspectRatio: true }} />
                              )}
                            </CardBody>
                          </Card>
                        </Col>
                      </Row>

                      <Table responsive>
                        <thead>
                          <tr>
                            <th>Port</th>
                            <th>Service</th>
                            <th>Application</th>
                            <th>Connection Count</th>
                            <th>Total Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portAnalysis.map((port, idx) => (
                            <tr key={idx}>
                              <td><Badge color="primary">{port._id.port}</Badge></td>
                              <td><strong>{port._id.service}</strong></td>
                              <td>{port._id.app}</td>
                              <td>{port.count}</td>
                              <td>{(port.totalData / 1024 / 1024 / 1024).toFixed(2)} GB</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </>
                  ) : (
                    <Alert color="info">Select a case to view port distribution analysis</Alert>
                  )}
                </TabPane>
              </TabContent>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Verification Modal */}
      <Modal isOpen={verificationModal} toggle={closeVerificationModal} size="lg">
        <ModalHeader toggle={closeVerificationModal}>
          🔍 Detection Verification
        </ModalHeader>
        <ModalBody>
          {verificationLoading ? (
            <div className="text-center p-4">
              <Spinner color="primary" />
              <p className="mt-2">Verifying detection accuracy...</p>
            </div>
          ) : verificationData ? (
            <div>
              {verificationData.error ? (
                <Alert color="danger">{verificationData.error}</Alert>
              ) : (
                <>
                  {/* VPN Detection */}
                  {verificationData.vpnDetection && (
                    <Card className="mb-3">
                      <CardHeader className="bg-warning text-dark">
                        <strong>🛡️ VPN Detection - {verificationData.vpnDetection.provider}</strong>
                      </CardHeader>
                      <CardBody className="bg-dark text-white">
                        <p className="mb-2">
                          <strong>IP {verificationData.ip}</strong> falls in range <code className="text-info">{verificationData.vpnDetection.rangeMatched}</code>
                        </p>
                        <p className="mb-1"><strong>WHOIS Verification:</strong></p>
                        <ul className="mb-0">
                          <li><strong>ISP:</strong> {verificationData.whois?.isp || 'N/A'}</li>
                          <li><strong>Organization:</strong> {verificationData.whois?.org || 'N/A'}</li>
                          <li><strong>ASN:</strong> {verificationData.whois?.as || 'N/A'}</li>
                          <li><strong>Country:</strong> {verificationData.whois?.country || 'N/A'}</li>
                          <li><strong>City:</strong> {verificationData.whois?.city || 'N/A'}</li>
                          <li><strong>Region:</strong> {verificationData.whois?.regionName || 'N/A'}</li>
                        </ul>
                      </CardBody>
                    </Card>
                  )}

                  {/* WhatsApp Detection */}
                  {verificationData.whatsappDetection && (
                    <Card className="mb-3">
                      <CardHeader className="bg-success text-white">
                        <strong>📞 WhatsApp Detection - Based on Port</strong>
                      </CardHeader>
                      <CardBody>
                        <p className="mb-2">
                          <strong>Port {verificationData.port}</strong> = {verificationData.port === 443 ? 'HTTPS (encrypted)' : verificationData.whatsappDetection.portType}
                        </p>
                        {verificationData.port === 443 && (
                          <p className="mb-2">
                            This is a <strong>backup/fallback port</strong> that WhatsApp uses when primary ports are blocked
                          </p>
                        )}
                        <p className="mb-1"><strong>Combined with:</strong></p>
                        <ul className="mb-0">
                          <li><strong>Data pattern:</strong> {verificationData.whatsappDetection.uploadMB} MB up, {verificationData.whatsappDetection.downloadMB} MB down → typical VoIP ratio (more download)</li>
                          <li><strong>Port {verificationData.port}</strong> + VoIP-like traffic → WhatsApp call over {verificationData.port === 443 ? 'HTTPS tunnel' : 'encrypted connection'}</li>
                        </ul>
                      </CardBody>
                    </Card>
                  )}

                  {/* Tor Detection */}
                  {verificationData.torDetection && verificationData.torDetection.verified && (
                    <Card className="mb-3">
                      <CardHeader className="bg-danger text-white">
                        <strong>🧅 Tor Network Detection</strong>
                      </CardHeader>
                      <CardBody>
                        <p className="mb-1">
                          <Badge color="success">✓ VERIFIED</Badge> This IP is a Tor exit node
                        </p>
                        <p className="mb-0"><strong>Source:</strong> {verificationData.torDetection.source}</p>
                      </CardBody>
                    </Card>
                  )}
                </>
              )}
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={closeVerificationModal}>Close</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default IPDRAnalysis;
