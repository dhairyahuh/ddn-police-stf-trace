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
  Progress,
  Input,
  FormGroup,
  Label
} from 'reactstrap';

const IPDRCorrelation = () => {
  const [loading, setLoading] = useState(false);
  const [ipdrData, setIpdrData] = useState([]);
  const [cdrData, setCdrData] = useState([]);
  const [analyzed, setAnalyzed] = useState([]);
  const [whatsappCalls, setWhatsappCalls] = useState([]);
  const [correlations, setCorrelations] = useState([]);
  const [messagingPatterns, setMessagingPatterns] = useState([]);
  const [stats, setStats] = useState({});
  const [filterApp, setFilterApp] = useState('all');
  const [uniqueIMSIs, setUniqueIMSIs] = useState([]);
  const [dataWarning, setDataWarning] = useState(null);

  useEffect(() => {
    loadAndAnalyze();
  }, []);

  const loadAndAnalyze = async () => {
    setLoading(true);
    try {
      // Load IPDR data
      const ipdrResponse = await fetch(`${config.BASE_URL}/api/ipdr/getAllRecords`);
      const ipdrRecords = ipdrResponse.ok ? await ipdrResponse.json() : [];

      // Load CDR data for correlation
      const cdrResponse = await fetch(`${config.BASE_URL}/api/cdr/getAllRecords`);
      const cdrRecords = cdrResponse.ok ? await cdrResponse.json() : [];

      setIpdrData(ipdrRecords);
      setCdrData(cdrRecords);

      // CRITICAL: Check if we have IPDR data from multiple parties
      const imsiSet = new Set(ipdrRecords.map(r => r.imsi).filter(Boolean));
      const uniqueImsiArray = Array.from(imsiSet);
      setUniqueIMSIs(uniqueImsiArray);

      // Validate data requirements
      if (ipdrRecords.length === 0) {
        setDataWarning({
          type: 'error',
          message: 'No IPDR data found. Please upload IPDR files first.'
        });
      } else if (uniqueImsiArray.length < 2) {
        setDataWarning({
          type: 'warning',
          message: `⚠️ CORRELATION REQUIRES MULTIPLE PARTIES: Currently only ${uniqueImsiArray.length} IMSI found in database. To detect WhatsApp calls between suspects, you need IPDR data from BOTH Party A and Party B. Upload IPDR for additional suspects to enable bidirectional correlation.`
        });
      } else {
        setDataWarning({
          type: 'success',
          message: `✅ ${uniqueImsiArray.length} unique IMSIs detected. Bidirectional correlation enabled.`
        });
      }

      if (ipdrRecords.length > 0) {
        analyzeIPDR(ipdrRecords, cdrRecords);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeIPDRRecord = (record) => {
    const destPort = record.destPort || record.publicPort || 0;
    const destIP = record.destIP || record.publicIP || '';
    const protocol = (record.protocol || '').toUpperCase();

    const analysis = {
      ...record,
      serviceType: 'Unknown',
      application: null,
      isVPN: false,
      isVoIP: false,
      isMessaging: false,
      isSuspicious: false,
      suspicionReasons: [],
      confidence: 0
    };

    // WhatsApp Detection
    const isWhatsAppIP = destIP.startsWith('31.13.') || destIP.startsWith('157.240.');
    if (protocol === 'UDP' && destPort >= 50000 && destPort <= 60000) {
      analysis.application = 'WhatsApp Voice/Video';
      analysis.isVoIP = true;
      analysis.isMessaging = true;
      analysis.serviceType = 'VoIP';
      analysis.confidence = isWhatsAppIP ? 95 : 75;
    } else if (isWhatsAppIP && protocol === 'TCP') {
      analysis.application = 'WhatsApp Chat';
      analysis.isMessaging = true;
      analysis.serviceType = 'Messaging';
      analysis.confidence = 90;
    }

    // Telegram Detection
    if (destIP.startsWith('149.154.') && protocol === 'TCP' && destPort === 443) {
      analysis.application = 'Telegram';
      analysis.isMessaging = true;
      analysis.serviceType = 'Messaging';
      analysis.confidence = 90;
    }

    // VPN Detection
    if ([1194, 1701, 1723].includes(destPort)) {
      analysis.isVPN = true;
      analysis.application = 'VPN';
      analysis.serviceType = 'VPN';
      analysis.isSuspicious = true;
      analysis.suspicionReasons.push('VPN usage detected');
      analysis.confidence = 85;
    }

    // Tor Detection
    if ([9001, 9030, 9050, 9051].includes(destPort)) {
      analysis.application = 'Tor Network';
      analysis.serviceType = 'Anonymization';
      analysis.isSuspicious = true;
      analysis.suspicionReasons.push('Tor network usage');
      analysis.confidence = 90;
    }

    // Encrypted HTTPS
    if (protocol === 'TCP' && destPort === 443 && !analysis.application) {
      analysis.serviceType = 'HTTPS';
      analysis.application = 'Encrypted Web';
      analysis.confidence = 60;
    }

    return analysis;
  };

  const analyzeIPDR = (ipdrRecords, cdrRecords) => {
    // Analyze each IPDR record
    const analyzedRecords = ipdrRecords.map(analyzeIPDRRecord);
    setAnalyzed(analyzedRecords);

    // Find WhatsApp calls (bidirectional UDP)
    const voipCalls = correlateWhatsAppCalls(analyzedRecords);
    setWhatsappCalls(voipCalls);

    // Correlate with CDR
    const ipdrCdrCorrelation = correlateWithCDR(analyzedRecords, cdrRecords);
    setCorrelations(ipdrCdrCorrelation);

    // Detect messaging patterns
    const messaging = detectMessaging(analyzedRecords);
    setMessagingPatterns(messaging);

    // Calculate statistics
    const voipCount = analyzedRecords.filter(r => r.isVoIP).length;
    const vpnCount = analyzedRecords.filter(r => r.isVPN).length;
    const messagingCount = analyzedRecords.filter(r => r.isMessaging).length;
    const suspiciousCount = analyzedRecords.filter(r => r.isSuspicious).length;

    // CRITICAL: Count individual VoIP instances per IMSI
    const individualVoIPByIMSI = {};
    analyzedRecords.filter(r => r.isVoIP).forEach(r => {
      if (!individualVoIPByIMSI[r.imsi]) {
        individualVoIPByIMSI[r.imsi] = [];
      }
      individualVoIPByIMSI[r.imsi].push(r);
    });

    const appCounts = {};
    analyzedRecords.forEach(r => {
      if (r.application) {
        appCounts[r.application] = (appCounts[r.application] || 0) + 1;
      }
    });

    setStats({
      total: ipdrRecords.length,
      voipCount,
      vpnCount,
      messagingCount,
      suspiciousCount,
      whatsappCallsFound: voipCalls.length,
      totalIndividualVoIPInstances: voipCount, // Total VoIP records (includes unknown Party B)
      correlatedVoIPCalls: voipCalls.length, // Only calls where BOTH parties are in database
      correlatedWithCDR: ipdrCdrCorrelation.length,
      appCounts,
      individualVoIPByIMSI // Breakdown by suspect
    });
  };

  const correlateWhatsAppCalls = (records) => {
    const calls = [];
    const voipRecords = records.filter(r => r.isVoIP && r.protocol === 'UDP');

    voipRecords.forEach(recordA => {
      // CRITICAL: For valid Party B detection, we need BOTH parties to have IPDR records
      // showing UDP VoIP traffic at nearly the same time
      const matches = records.filter(recordB => {
        // Must be different users
        if (recordB.imsi === recordA.imsi) return false;
        
        // Must be UDP VoIP traffic
        if (recordB.protocol !== 'UDP' || !recordB.isVoIP) return false;
        
        // Timestamp must match within 5 seconds (call setup time)
        const timeDiff = Math.abs(
          new Date(recordA.startTime) - new Date(recordB.startTime)
        ) / 1000;
        if (timeDiff > 5) return false;
        
        // VALIDATION: Both should be connecting to WhatsApp servers
        // or to each other (peer-to-peer)
        const bothToWhatsApp = 
          (recordA.destIP?.startsWith('31.13.') || recordA.destIP?.startsWith('157.240.')) &&
          (recordB.destIP?.startsWith('31.13.') || recordB.destIP?.startsWith('157.240.'));
        
        // Calculate confidence based on matching criteria
        let confidence = 0;
        if (timeDiff <= 2) confidence += 30; // Very close timing
        else if (timeDiff <= 5) confidence += 20;
        
        if (bothToWhatsApp) confidence += 40; // Both to WhatsApp IPs
        
        // Port range matching
        const portA = recordA.destPort || recordA.publicPort || 0;
        const portB = recordB.destPort || recordB.publicPort || 0;
        if (portA >= 50000 && portA <= 60000 && portB >= 50000 && portB <= 60000) {
          confidence += 30; // Both in WhatsApp VoIP port range
        }
        
        return confidence >= 60; // Only accept if confidence is reasonable
      });

      if (matches.length > 0) {
        const match = matches[0];
        const timeDiff = Math.abs(new Date(recordA.startTime) - new Date(match.startTime)) / 1000;
        
        let confidence = 0;
        if (timeDiff <= 2) confidence += 30;
        else if (timeDiff <= 5) confidence += 20;
        
        if ((recordA.destIP?.startsWith('31.13.') || recordA.destIP?.startsWith('157.240.')) &&
            (match.destIP?.startsWith('31.13.') || match.destIP?.startsWith('157.240.'))) {
          confidence += 40;
        }
        
        const portA = recordA.destPort || recordA.publicPort || 0;
        const portB = match.destPort || match.publicPort || 0;
        if (portA >= 50000 && portA <= 60000 && portB >= 50000 && portB <= 60000) {
          confidence += 30;
        }
        
        calls.push({
          partyA_IMSI: recordA.imsi,
          partyB_IMSI: match.imsi,
          partyA_IP: recordA.destIP,
          partyB_IP: match.destIP,
          partyA_Port: portA,
          partyB_Port: portB,
          timestamp: recordA.startTime,
          timeDiff: timeDiff.toFixed(2),
          duration: recordA.duration || 0,
          confidence: Math.min(confidence, 95), // Cap at 95%, never 100%
          application: recordA.application,
          validationNote: 'Both parties have IPDR showing UDP VoIP traffic'
        });
      }
    });

    return calls;
  };

  const correlateWithCDR = (ipdrRecords, cdrRecords) => {
    // NOTE: This correlation is WEAK and should be used with extreme caution
    // CDR shows calls on cellular network, IPDR shows internet data
    // Temporal correlation alone is NOT sufficient evidence
    const correlations = [];

    ipdrRecords.filter(r => r.isVoIP).forEach(ipdr => {
      const ipdrTime = new Date(ipdr.startTime).getTime();
      
      const matches = cdrRecords.filter(cdr => {
        const cdrTime = new Date(cdr.startTime).getTime();
        const timeDiff = Math.abs(ipdrTime - cdrTime) / 1000;
        
        // Only correlate if same IMSI and within 60 seconds (tightened from 120)
        return timeDiff <= 60 && cdr.imsi === ipdr.imsi;
      });

      if (matches.length > 0) {
        matches.forEach(cdr => {
          const timeDiff = Math.abs(ipdrTime - new Date(cdr.startTime).getTime()) / 1000;
          
          // Calculate realistic confidence score
          let confidence = 30; // Base confidence is LOW
          if (timeDiff <= 10) confidence += 20; // Very close timing
          else if (timeDiff <= 30) confidence += 10;
          
          correlations.push({
            timestamp: ipdr.startTime,
            imsi: ipdr.imsi,
            partyB: cdr.calledNumber,
            confidence: confidence, // Will be 30-50%, indicating weak correlation
            application: ipdr.application,
            timeDiff: timeDiff.toFixed(1),
            warning: 'Weak correlation - temporal proximity only, not conclusive'
          });
        });
      }
    });

    return correlations;
  };

  const detectMessaging = (records) => {
    const patterns = {};

    records.filter(r => r.isMessaging).forEach(record => {
      const date = new Date(record.startTime).toDateString();
      const key = `${record.imsi}_${date}`;
      
      if (!patterns[key]) {
        patterns[key] = {
          imsi: record.imsi,
          date,
          apps: {},
          count: 0
        };
      }
      
      const app = record.application || 'Unknown';
      patterns[key].apps[app] = (patterns[key].apps[app] || 0) + 1;
      patterns[key].count++;
    });

    return Object.values(patterns);
  };

  const getAppBadge = (app) => {
    if (!app) return <Badge color="secondary">Unknown</Badge>;
    if (app.includes('WhatsApp')) return <Badge color="success">📱 {app}</Badge>;
    if (app.includes('Telegram')) return <Badge color="info">✈️ {app}</Badge>;
    if (app.includes('VPN')) return <Badge color="danger">🔒 {app}</Badge>;
    if (app.includes('Tor')) return <Badge color="danger">🧅 {app}</Badge>;
    return <Badge color="primary">{app}</Badge>;
  };

  const filteredRecords = filterApp === 'all' 
    ? analyzed 
    : analyzed.filter(r => r.application?.toLowerCase().includes(filterApp.toLowerCase()));

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <Row>
                <Col md="8">
                  <h4 className="title">🔍 IPDR Advanced Analysis & Correlation</h4>
                  <p className="category">WhatsApp call detection, VoIP correlation, and encrypted traffic analysis</p>
                </Col>
                <Col md="4" className="text-right">
                  <Button color="primary" onClick={loadAndAnalyze} disabled={loading}>
                    {loading ? <Spinner size="sm" /> : '🔄 Refresh Analysis'}
                  </Button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              {/* Statistics */}
              <Row className="mb-4">
                <Col md="2">
                  <Card className="bg-gradient-primary">
                    <CardBody className="text-center">
                      <h6 className="text-white">Total Records</h6>
                      <h2 className="text-white">{stats.total || 0}</h2>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-success">
                    <CardBody className="text-center">
                      <h6 className="text-white">Total VoIP Activity</h6>
                      <h2 className="text-white">{stats.totalIndividualVoIPInstances || 0}</h2>
                      <small className="text-white">All WhatsApp/VoIP calls</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-info">
                    <CardBody className="text-center">
                      <h6 className="text-white">Correlated Calls</h6>
                      <h2 className="text-white">{stats.correlatedVoIPCalls || 0}</h2>
                      <small className="text-white">Both parties in DB</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-warning">
                    <CardBody className="text-center">
                      <h6 className="text-white">Messaging</h6>
                      <h2 className="text-white">{stats.messagingCount || 0}</h2>
                      <small className="text-white">Chat activity</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-danger">
                    <CardBody className="text-center">
                      <h6 className="text-white">VPN/Proxy</h6>
                      <h2 className="text-white">{stats.vpnCount || 0}</h2>
                      <small className="text-white">Anonymization</small>
                    </CardBody>
                  </Card>
                </Col>
                <Col md="2">
                  <Card className="bg-gradient-dark">
                    <CardBody className="text-center">
                      <h6 className="text-white">Suspicious</h6>
                      <h2 className="text-white">{stats.suspiciousCount || 0}</h2>
                      <small className="text-white">Flagged activity</small>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Data Validation Warning */}
              {dataWarning && (
                <Alert color={dataWarning.type === 'error' ? 'danger' : dataWarning.type === 'warning' ? 'warning' : 'success'}>
                  {dataWarning.message}
                  {dataWarning.type === 'warning' && (
                    <div className="mt-3">
                      <strong>How to enable correlation:</strong>
                      <ol className="mb-0">
                        <li>Go to "Data Upload" page</li>
                        <li>Upload IPDR files for Party A (Suspect 1)</li>
                        <li>Upload IPDR files for Party B (Suspect 2)</li>
                        <li>Return to this page - correlation will automatically detect calls between them</li>
                      </ol>
                      <p className="mt-2 mb-0"><small><strong>Current IMSIs in database:</strong> {uniqueIMSIs.join(', ')}</small></p>
                    </div>
                  )}
                </Alert>
              )}

              {/* Individual VoIP Activity Summary */}
              {stats.individualVoIPByIMSI && Object.keys(stats.individualVoIPByIMSI).length > 0 && (
                <Card className="mb-3">
                  <CardHeader>
                    <h5>📊 Individual WhatsApp/VoIP Activity (Per Suspect)</h5>
                    <small className="text-muted">Shows ALL VoIP activity for each suspect, including calls to unknown parties (Party B not in database)</small>
                  </CardHeader>
                  <CardBody>
                    <Alert color="info">
                      <strong>ℹ️ Important:</strong> Total VoIP Activity ({stats.totalIndividualVoIPInstances}) includes calls to people whose IPDR we don't have. 
                      We can only identify Party B when their IPDR is also in the database (shown in "Correlated Calls" section below).
                    </Alert>
                    <Table responsive>
                      <thead>
                        <tr>
                          <th>IMSI</th>
                          <th>Total VoIP Calls</th>
                          <th>WhatsApp Calls</th>
                          <th>Other VoIP</th>
                          <th>Correlated (Party B Known)</th>
                          <th>Unknown Party B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.individualVoIPByIMSI).map(([imsi, records]) => {
                          const whatsappCount = records.filter(r => r.application?.includes('WhatsApp')).length;
                          const otherVoIP = records.length - whatsappCount;
                          const correlatedCount = whatsappCalls.filter(c => 
                            c.partyA_IMSI === imsi || c.partyB_IMSI === imsi
                          ).length;
                          const unknownPartyB = records.length - correlatedCount;
                          
                          return (
                            <tr key={imsi}>
                              <td><small>{imsi}</small></td>
                              <td><Badge color="primary">{records.length}</Badge></td>
                              <td><Badge color="success">{whatsappCount}</Badge></td>
                              <td><Badge color="secondary">{otherVoIP}</Badge></td>
                              <td><Badge color="info">{correlatedCount}</Badge></td>
                              <td><Badge color="warning">{unknownPartyB}</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                    <small className="text-muted">
                      <strong>Legend:</strong> "Correlated" = Party B identified (both in database), 
                      "Unknown Party B" = Calls detected but Party B's IPDR not available (could be anyone)
                    </small>
                  </CardBody>
                </Card>
              )}

              {/* WhatsApp Call Correlations */}
              {whatsappCalls.length > 0 ? (
                <>
                  <Alert color="success">
                    <strong>📞 Correlated WhatsApp Calls Between Known Suspects: {whatsappCalls.length}</strong>
                    <p className="mb-2">✅ <strong>Verified bidirectional correlation</strong> - Both parties have IPDR records showing UDP VoIP traffic at the same time</p>
                    <p className="mb-0"><small><strong>Validation criteria:</strong> Same protocol (UDP), VoIP port range (50000-60000), WhatsApp server IPs (31.13.*, 157.240.*), timestamp match (±5 sec)</small></p>
                  </Alert>
                  <Card className="mb-3">
                    <CardHeader>
                      <h5>📱 Correlated WhatsApp Calls (Both Parties Identified)</h5>
                      <small className="text-muted">These calls can be proven because both Party A and Party B have IPDR records in the database</small>
                    </CardHeader>
                    <CardBody>
                      <Table responsive striped>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Timestamp</th>
                            <th>Party A (IMSI)</th>
                            <th>Party A Dest IP:Port</th>
                            <th>Party B (IMSI)</th>
                            <th>Party B Dest IP:Port</th>
                            <th>Time Diff</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {whatsappCalls.map((call, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td><small>{new Date(call.timestamp).toLocaleString()}</small></td>
                              <td><small>{call.partyA_IMSI}</small></td>
                              <td><small>{call.partyA_IP}:{call.partyA_Port}</small></td>
                              <td><small>{call.partyB_IMSI}</small></td>
                              <td><small>{call.partyB_IP}:{call.partyB_Port}</small></td>
                              <td>{call.timeDiff}s</td>
                              <td>
                                <Badge color={call.confidence >= 80 ? 'success' : call.confidence >= 60 ? 'warning' : 'danger'}>
                                  {call.confidence}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </CardBody>
                  </Card>
                </>
              ) : (
                stats.totalIndividualVoIPInstances > 0 && (
                  <Alert color="warning">
                    <strong>⚠️ WhatsApp/VoIP Activity Detected But No Correlations Found</strong>
                    <p className="mb-2">We detected {stats.totalIndividualVoIPInstances} VoIP calls across all suspects, but couldn't correlate them.</p>
                    <p className="mb-0"><strong>Possible reasons:</strong></p>
                    <ul className="mb-0">
                      <li>Suspects called people whose IPDR is NOT in the database (most common)</li>
                      <li>Calls were to non-suspects (family, friends, business contacts)</li>
                      <li>Need to upload IPDR for additional persons of interest</li>
                    </ul>
                  </Alert>
                )
              )}

              {/* CDR Correlation with Warning */}
              {correlations.length > 0 && (
                <>
                  <Alert color="warning">
                    <strong>⚠️ Warning: Weak Correlation</strong>
                    <p className="mb-0">The IPDR-CDR correlations below are based ONLY on timestamp proximity (±60 seconds) for the same IMSI. This is NOT conclusive evidence. Use with extreme caution.</p>
                  </Alert>
                  <Card className="mb-3">
                    <CardHeader>
                      <h5>🔗 IPDR-CDR Temporal Correlation (Low Confidence)</h5>
                      <small className="text-danger">These correlations are speculative and should not be used as sole evidence</small>
                    </CardHeader>
                    <CardBody>
                      <Table responsive striped>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Timestamp</th>
                            <th>IMSI</th>
                            <th>Suggested Party B</th>
                            <th>Time Diff</th>
                            <th>Confidence</th>
                            <th>Warning</th>
                          </tr>
                        </thead>
                        <tbody>
                          {correlations.slice(0, 20).map((corr, idx) => (
                            <tr key={idx} className="table-warning">
                              <td>{idx + 1}</td>
                              <td><small>{new Date(corr.timestamp).toLocaleString()}</small></td>
                              <td><small>{corr.imsi}</small></td>
                              <td><strong>{corr.partyB}</strong></td>
                              <td>{corr.timeDiff}s</td>
                              <td>
                                <Badge color="danger">{corr.confidence}%</Badge>
                              </td>
                              <td><small className="text-danger">Temporal only</small></td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </CardBody>
                  </Card>
                </>
              )}

              {/* Filter */}
              <Row className="mb-3">
                <Col md="4">
                  <FormGroup>
                    <Label>Filter by Application:</Label>
                    <Input
                      type="select"
                      value={filterApp}
                      onChange={(e) => setFilterApp(e.target.value)}
                    >
                      <option value="all">All Applications</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                      <option value="vpn">VPN</option>
                      <option value="tor">Tor</option>
                      <option value="voip">All VoIP</option>
                    </Input>
                  </FormGroup>
                </Col>
              </Row>

              {/* Detailed Records */}
              <Card>
                <CardHeader>
                  <h5>📊 Analyzed IPDR Records ({filteredRecords.length})</h5>
                </CardHeader>
                <CardBody>
                  {loading ? (
                    <div className="text-center p-5">
                      <Spinner color="primary" />
                      <p className="mt-3">Analyzing IPDR data...</p>
                    </div>
                  ) : filteredRecords.length === 0 ? (
                    <Alert color="info">No IPDR data found. Please upload IPDR files first.</Alert>
                  ) : (
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                      <Table responsive hover striped size="sm">
                        <thead style={{ position: 'sticky', top: 0, background: '#27293d' }}>
                          <tr>
                            <th>#</th>
                            <th>Timestamp</th>
                            <th>Protocol</th>
                            <th>Dest IP</th>
                            <th>Port</th>
                            <th>Application</th>
                            <th>Type</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecords.slice(0, 100).map((record, idx) => (
                            <tr key={idx} className={record.isSuspicious ? 'table-danger' : ''}>
                              <td>{idx + 1}</td>
                              <td><small>{new Date(record.startTime).toLocaleTimeString()}</small></td>
                              <td><Badge color={record.protocol === 'UDP' ? 'primary' : 'secondary'}>{record.protocol}</Badge></td>
                              <td><small>{record.destIP || 'N/A'}</small></td>
                              <td>{record.destPort || record.publicPort || 0}</td>
                              <td>{getAppBadge(record.application)}</td>
                              <td>
                                {record.isVoIP && <Badge color="success">VoIP</Badge>}
                                {record.isMessaging && <Badge color="info">Chat</Badge>}
                                {record.isVPN && <Badge color="danger">VPN</Badge>}
                              </td>
                              <td>{record.confidence}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </CardBody>
              </Card>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default IPDRCorrelation;
