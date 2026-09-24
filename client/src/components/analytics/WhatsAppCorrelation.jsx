import React, { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
  Table,
  Alert,
  Row,
  Col,
  Badge,
  Spinner,
  Progress
} from 'reactstrap';
import axios from 'axios';

const WhatsAppCorrelation = () => {
  const [caseNumber, setCaseNumber] = useState('');
  const [imsi, setImsi] = useState('');
  const [imei, setImei] = useState('');
  const [destinationIP, setDestinationIP] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [whatsappCalls, setWhatsappCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [correlationResults, setCorrelationResults] = useState(null);
  const [step, setStep] = useState(1); // 1: Find WA calls, 2: Show results & select, 3: Correlate

  // Step 1: Identify WhatsApp calls using 5-digit UDP ports
  const findWhatsAppCalls = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWhatsappCalls([]);
    setSelectedCall(null);
    setCorrelationResults(null);

    try {
      const params = { caseNumber };
      if (imsi) params.imsi = imsi;
      if (imei) params.imei = imei;
      if (destinationIP) params.destinationIP = destinationIP;
      
      const response = await axios.get('/api/correlation/whatsapp-calls', {
        params
      });

      if (response.data.success) {
        setWhatsappCalls(response.data.whatsappCalls);
        if (response.data.whatsappCalls.length > 0) {
          setStep(2);
        } else {
          setError('No WhatsApp VoIP calls found (5-digit UDP ports: 50000-59999)');
        }
      } else {
        setError(response.data.error || 'Failed to find WhatsApp calls');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error finding WhatsApp calls');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: User selects a call to correlate
  const selectCallForCorrelation = (call) => {
    setSelectedCall(call);
  };

  // Step 3: Correlate with Party B using time and port analysis
  const correlateCall = async () => {
    if (!selectedCall) {
      setError('Please select a call to correlate');
      return;
    }

    setLoading(true);
    setError(null);
    setCorrelationResults(null);

    try {
      const response = await axios.get('/api/correlation/correlate', {
        params: {
          ipdrId: selectedCall.ipdrId,
          caseNumber
        }
      });

      if (response.data.success) {
        setCorrelationResults(response.data);
        setStep(3);
      } else {
        setError(response.data.error || 'Failed to correlate call');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error correlating call');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setStep(1);
    setWhatsappCalls([]);
    setSelectedCall(null);
    setCorrelationResults(null);
    setError(null);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'danger';
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle tag="h3">
            <i className="tim-icons icon-chat-33"></i> WhatsApp Call Correlation
          </CardTitle>
          <p className="text-muted">
            Identify WhatsApp VoIP calls in IPDR using 5-digit UDP ports (50000-59999). IPDR data uses IMSI/IMEI, not phone numbers. Filter by destination IP and time.
          </p>
        </CardHeader>
        <CardBody>
          {/* Step Indicator */}
          <Row className="mb-4">
            <Col md="12">
              <div className="d-flex justify-content-between align-items-center">
                <div className={`text-center ${step >= 1 ? 'text-primary' : 'text-muted'}`}>
                  <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${step >= 1 ? 'bg-primary' : 'bg-secondary'}`} style={{width: '40px', height: '40px'}}>
                    <strong>1</strong>
                  </div>
                  <div className="mt-2 small">Identify WA Calls</div>
                </div>
                <div className="flex-grow-1 mx-3" style={{height: '2px', backgroundColor: step >= 2 ? '#1d8cf8' : '#344675'}}></div>
                <div className={`text-center ${step >= 2 ? 'text-primary' : 'text-muted'}`}>
                  <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${step >= 2 ? 'bg-primary' : 'bg-secondary'}`} style={{width: '40px', height: '40px'}}>
                    <strong>2</strong>
                  </div>
                  <div className="mt-2 small">Select Call</div>
                </div>
                <div className="flex-grow-1 mx-3" style={{height: '2px', backgroundColor: step >= 3 ? '#1d8cf8' : '#344675'}}></div>
                <div className={`text-center ${step >= 3 ? 'text-primary' : 'text-muted'}`}>
                  <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${step >= 3 ? 'bg-primary' : 'bg-secondary'}`} style={{width: '40px', height: '40px'}}>
                    <strong>3</strong>
                  </div>
                  <div className="mt-2 small">Correlate & Analyze</div>
                </div>
              </div>
            </Col>
          </Row>

          {error && (
            <Alert color="danger" toggle={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Step 1: Input Form */}
          {step === 1 && (
            <Form onSubmit={findWhatsAppCalls}>
              <Row>
                <Col md="6">
                  <FormGroup>
                    <Label for="caseNumber">Case Number</Label>
                    <Input
                      type="text"
                      id="caseNumber"
                      placeholder="Enter case number"
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      required
                    />
                  </FormGroup>
                </Col>
                <Col md="6">
                  <FormGroup>
                    <Label for="imsi">IMSI (Optional)</Label>
                    <Input
                      type="text"
                      id="imsi"
                      placeholder="Filter by IMSI (15 digits)"
                      value={imsi}
                      onChange={(e) => setImsi(e.target.value)}
                      maxLength="15"
                    />
                    <small className="text-muted">IPDR identifies users by IMSI, not phone number</small>
                  </FormGroup>
                </Col>
              </Row>
              <Row>
                <Col md="6">
                  <FormGroup>
                    <Label for="imei">IMEI (Optional)</Label>
                    <Input
                      type="text"
                      id="imei"
                      placeholder="Filter by IMEI (15 digits)"
                      value={imei}
                      onChange={(e) => setImei(e.target.value)}
                      maxLength="15"
                    />
                    <small className="text-muted">Device identifier in IPDR records</small>
                  </FormGroup>
                </Col>
                <Col md="6">
                  <FormGroup>
                    <Label for="destinationIP">Destination IP (Optional)</Label>
                    <Input
                      type="text"
                      id="destinationIP"
                      placeholder="Filter by destination IP (e.g., 157.240.221.35)"
                      value={destinationIP}
                      onChange={(e) => setDestinationIP(e.target.value)}
                    />
                    <small className="text-muted">Filter by specific relay server IP</small>
                  </FormGroup>
                </Col>
              </Row>
              <Button color="primary" type="submit" disabled={loading}>
                {loading ? <><Spinner size="sm" /> Searching...</> : 'Find WhatsApp Calls'}
              </Button>
            </Form>
          )}

          {/* Step 2: Display WhatsApp Calls */}
          {step === 2 && whatsappCalls.length > 0 && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>WhatsApp VoIP Calls Found: {whatsappCalls.length}</h5>
                <Button color="secondary" size="sm" onClick={resetAnalysis}>
                  <i className="tim-icons icon-refresh-01"></i> New Search
                </Button>
              </div>
              <Alert color="info">
                <i className="tim-icons icon-bulb-63"></i> <strong>How it works:</strong> WhatsApp VoIP calls use 5-digit UDP ports (50000-59999). Correlation matches calls by:
                <ul className="mb-0 mt-2">
                  <li>Same destination IP (relay server)</li>
                  <li>Overlapping time window (±10 seconds)</li>
                  <li>5-digit UDP port range</li>
                  <li>Duration similarity</li>
                </ul>
              </Alert>
              <div className="table-responsive" style={{maxHeight: '400px', overflowY: 'auto'}}>
                <Table hover>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Destination IP</th>
                      <th>Ports</th>
                      <th>Data Transfer</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatsappCalls.map((call) => (
                      <tr
                        key={call.id}
                        className={selectedCall?.id === call.id ? 'table-active' : ''}
                        style={{cursor: 'pointer'}}
                      >
                        <td>{call.id}</td>
                        <td>
                          <div>{formatDateTime(call.startTime)}</div>
                          <small className="text-muted">to {formatDateTime(call.endTime)}</small>
                        </td>
                        <td>
                          <Badge color="info">{call.duration}s</Badge>
                        </td>
                        <td>
                          <code>{call.destinationIP}</code>
                          <div><small className="text-muted">Port: {call.destinationPort}</small></div>
                        </td>
                        <td>
                          <Badge color="success">Source: {call.sourcePort}</Badge>
                          <div><small className="text-muted">(5-digit UDP)</small></div>
                        </td>
                        <td>
                          <div>↑ {formatBytes(call.uplinkBytes)}</div>
                          <div>↓ {formatBytes(call.downlinkBytes)}</div>
                        </td>
                        <td>
                          <Button
                            color="primary"
                            size="sm"
                            onClick={() => selectCallForCorrelation(call)}
                            disabled={loading}
                          >
                            {selectedCall?.id === call.id ? 'Selected' : 'Select'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {selectedCall && (
                <div className="mt-3 text-center">
                  <Button color="success" size="lg" onClick={correlateCall} disabled={loading}>
                    {loading ? <><Spinner size="sm" /> Correlating...</> : 'Correlate Selected Call'}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Step 3: Correlation Results */}
          {step === 3 && correlationResults && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Correlation Results</h5>
                <Button color="secondary" size="sm" onClick={resetAnalysis}>
                  <i className="tim-icons icon-refresh-01"></i> New Analysis
                </Button>
              </div>

              <Row className="mb-4">
                <Col md="12">
                  <Card className="card-stats">
                    <CardBody>
                      <Row>
                        <Col md="6">
                          <h6 className="text-primary">Party A Call Details</h6>
                          <p><strong>Phone:</strong> {correlationResults.partyACall.phoneNumber}</p>
                          <p><strong>Time:</strong> {formatDateTime(correlationResults.partyACall.startTime)}</p>
                          <p><strong>Duration:</strong> {correlationResults.partyACall.duration}s</p>
                          <p><strong>Destination IP:</strong> <code>{correlationResults.partyACall.destinationIP}</code></p>
                        </Col>
                        <Col md="6">
                          <h6 className="text-info">Correlation Summary</h6>
                          <p><strong>Matches Found:</strong> {correlationResults.totalMatches}</p>
                          {correlationResults.expectedPartyB && (
                            <p><strong>Expected Party B:</strong> {correlationResults.expectedPartyB}</p>
                          )}
                        </Col>
                      </Row>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {correlationResults.totalMatches === 0 ? (
                <Alert color="warning">
                  <i className="tim-icons icon-alert-circle-exc"></i> No matching Party B sessions found in the uploaded IPDR data.
                  <br/><small>Make sure you've uploaded IPDR data for the destination IP that covers the same time period.</small>
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table>
                    <thead>
                      <tr>
                        <th>Party B Phone</th>
                        <th>Time Match</th>
                        <th>Port Match</th>
                        <th>Data Transfer</th>
                        <th>Location</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {correlationResults.correlations.map((corr, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{corr.partyB.phoneNumber}</strong>
                            {corr.partyB.phoneNumberMatch && (
                              <Badge color="success" className="ml-2">CDR Match</Badge>
                            )}
                            <div><small className="text-muted">IMEI: {corr.partyB.imei}</small></div>
                          </td>
                          <td>
                            <div><strong>Start:</strong> {formatDateTime(corr.partyB.startTime)}</div>
                            <div className="mt-1">
                              <Badge color={corr.matchDetails.timingMatch ? 'success' : 'warning'}>
                                Δ {corr.timeAnalysis ? corr.timeAnalysis.startTimeDifferenceSeconds : (corr.matchDetails.timeDifference / 1000).toFixed(2)}s
                              </Badge>
                            </div>
                            <div className="mt-1"><strong>Duration:</strong> {corr.partyB.duration}s</div>
                            <div>
                              <Badge color={corr.matchDetails.durationMatch ? 'success' : 'warning'}>
                                Δ {corr.matchDetails.durationDifference}s
                              </Badge>
                            </div>
                            {corr.timeAnalysis && (
                              <div className="mt-1">
                                <small className="text-info">
                                  Overlap: {corr.timeAnalysis.overlapPercentage}%
                                </small>
                              </div>
                            )}
                          </td>
                          <td>
                            <div><strong>Source:</strong> <code>{corr.partyB.sourcePort}</code></div>
                            <div><strong>Dest:</strong> <code>{corr.partyB.destPort}</code></div>
                            <div className="mt-1">
                              <Badge color="info">5-digit UDP</Badge>
                            </div>
                            {corr.portAnalysis && (
                              <>
                                <div className="mt-1">
                                  <small className={corr.portAnalysis.destPortMatch ? 'text-success' : 'text-warning'}>
                                    {corr.portAnalysis.destPortMatch ? '✓ Dest ports match' : '⚠ Dest ports differ'}
                                  </small>
                                </div>
                                <div>
                                  <small className="text-muted">
                                    Port Δ: {corr.portAnalysis.portDifference}
                                  </small>
                                </div>
                              </>
                            )}
                          </td>
                          <td>
                            <div>↑ {formatBytes(corr.dataTransfer.partyB.upload)}</div>
                            <div>↓ {formatBytes(corr.dataTransfer.partyB.download)}</div>
                            <div className="text-muted small">Total: {formatBytes(corr.dataTransfer.partyB.total)}</div>
                          </td>
                          <td>
                            <div><small>Cell: {corr.partyB.location.cellID}</small></div>
                            {corr.partyB.location.lat && corr.partyB.location.long && (
                              <div><small>{corr.partyB.location.lat.toFixed(4)}, {corr.partyB.location.long.toFixed(4)}</small></div>
                            )}
                          </td>
                          <td>
                            <Badge color={getConfidenceBadge(corr.confidence)} className="p-2">
                              {corr.confidence}%
                            </Badge>
                            <Progress
                              value={corr.confidence}
                              color={getConfidenceBadge(corr.confidence)}
                              className="mt-2"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Correlation Analysis Details */}
              {correlationResults.totalMatches > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle tag="h5">Correlation Analysis</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <Alert color="info">
                      <h6><i className="tim-icons icon-bulb-63"></i> How Correlation Works:</h6>
                      <ul className="mb-0">
                        <li><strong>Step 1:</strong> Identified WhatsApp calls using 5-digit UDP ports (50000-59999)</li>
                        <li><strong>Step 2:</strong> Searched for IPDR sessions to the same destination IP (relay server)</li>
                        <li><strong>Step 3:</strong> Matched sessions by timing (within 10 seconds) and port analysis</li>
                        <li><strong>Step 4:</strong> Verified both parties use 5-digit UDP ports (WhatsApp signature)</li>
                        <li><strong>Step 5:</strong> Calculated time overlap percentage for session correlation</li>
                        <li><strong>Confidence Score:</strong> Based on time match (40%), duration match (30%), and destination match (30%)</li>
                      </ul>
                      <hr />
                      <h6><i className="tim-icons icon-chart-bar-32"></i> Analysis Factors:</h6>
                      <ul className="mb-0">
                        <li><strong>Port Analysis:</strong> Verifies 5-digit UDP ports, port differences, and destination port matching</li>
                        <li><strong>Time Analysis:</strong> Start time difference, end time difference, duration match, and overlap percentage</li>
                        <li><strong>Data Transfer:</strong> Compares upload/download volumes between parties</li>
                        <li><strong>Location:</strong> Cell tower information for geographical verification</li>
                      </ul>
                    </Alert>
                  </CardBody>
                </Card>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default WhatsAppCorrelation;
