import React, { useState } from 'react';
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
  Table,
  Badge,
  Spinner,
  Alert,
} from 'reactstrap';
import { ipdrAPI } from '../../services/api';
import { processIPDRForVoIP } from '../../services/dataProcessing';

const VoIPDetector = () => {
  const [loading, setLoading] = useState(false);
  const [voipCalls, setVoipCalls] = useState([]);
  const [filters, setFilters] = useState({
    imsi: '',
    imei: '',
    estimatedApp: '',
  });

  const handleDetect = async () => {
    setLoading(true);
    try {
      const response = await ipdrAPI.getAllRecords();
      const records = response.data;

      if (!records || records.length === 0) {
        alert('No IPDR records found');
        setLoading(false);
        return;
      }

      // Apply IMSI/IMEI filters
      let filteredRecords = records;
      if (filters.imsi) {
        filteredRecords = filteredRecords.filter(r => r.imsi === filters.imsi);
      }
      if (filters.imei) {
        filteredRecords = filteredRecords.filter(r => r.imei === filters.imei);
      }

      const detected = processIPDRForVoIP(filteredRecords);
      setVoipCalls(detected);
    } catch (error) {
      console.error('Error detecting VoIP:', error);
      alert('Error detecting VoIP calls');
    } finally {
      setLoading(false);
    }
  };

  // Filter by estimated app
  const filteredCalls = filters.estimatedApp
    ? voipCalls.filter(call => call.estimatedApp.includes(filters.estimatedApp))
    : voipCalls;

  // Statistics
  const stats = {
    total: voipCalls.length,
    byApp: {},
    totalDuration: 0,
    totalDataVolume: 0,
  };

  voipCalls.forEach(call => {
    stats.byApp[call.estimatedApp] = (stats.byApp[call.estimatedApp] || 0) + 1;
    stats.totalDuration += call.duration || 0;
    stats.totalDataVolume += call.dataVolume || 0;
  });

  const formatDataVolume = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <h4 className="title">VoIP Call Detection</h4>
              <p className="category">
                Identify VoIP traffic from IPDR data
              </p>
            </CardHeader>
            <CardBody>
              {/* Filters */}
              <Row className="mb-3">
                <Col md="3">
                  <FormGroup>
                    <Label>IMSI (Optional)</Label>
                    <Input
                      type="text"
                      value={filters.imsi}
                      onChange={(e) =>
                        setFilters({ ...filters, imsi: e.target.value })
                      }
                      placeholder="Filter by IMSI (15 digits)"
                      maxLength="15"
                    />
                    <small className="text-muted">IPDR uses IMSI, not phone numbers</small>
                  </FormGroup>
                </Col>
                <Col md="3">
                  <FormGroup>
                    <Label>IMEI (Optional)</Label>
                    <Input
                      type="text"
                      value={filters.imei}
                      onChange={(e) =>
                        setFilters({ ...filters, imei: e.target.value })
                      }
                      placeholder="Filter by IMEI (15 digits)"
                      maxLength="15"
                    />
                    <small className="text-muted">Device identifier</small>
                  </FormGroup>
                </Col>
                <Col md="4">
                  <FormGroup>
                    <Label>Estimated App (Optional)</Label>
                    <Input
                      type="select"
                      value={filters.estimatedApp}
                      onChange={(e) =>
                        setFilters({ ...filters, estimatedApp: e.target.value })
                      }
                    >
                      <option value="">All Apps</option>
                      <option value="SIP">SIP-based</option>
                      <option value="RTP">RTP-based</option>
                      <option value="UDP">UDP VoIP</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Telegram">Telegram</option>
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="2">
                  <FormGroup>
                    <Label>&nbsp;</Label>
                    <Button
                      color="primary"
                      block
                      onClick={handleDetect}
                      disabled={loading}
                    >
                      {loading ? <Spinner size="sm" /> : 'Detect VoIP'}
                    </Button>
                  </FormGroup>
                </Col>
              </Row>

              {/* Statistics */}
              {voipCalls.length > 0 && (
                <>
                  <Row className="mb-3">
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total VoIP Calls</h6>
                          <h3>{stats.total}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total Duration</h6>
                          <h3>{formatDuration(stats.totalDuration)}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total Data Volume</h6>
                          <h3>{formatDataVolume(stats.totalDataVolume)}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Avg Duration</h6>
                          <h3>
                            {formatDuration(
                              stats.total > 0
                                ? Math.round(stats.totalDuration / stats.total)
                                : 0
                            )}
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* App Distribution */}
                  {Object.keys(stats.byApp).length > 0 && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>VoIP Calls by Estimated App</h5>
                      </CardHeader>
                      <CardBody>
                        <Row>
                          {Object.entries(stats.byApp).map(([app, count]) => (
                            <Col md="3" key={app} className="mb-2">
                              <Badge color="primary" style={{ fontSize: '1em', padding: '10px' }}>
                                {app}: {count}
                              </Badge>
                            </Col>
                          ))}
                        </Row>
                      </CardBody>
                    </Card>
                  )}
                </>
              )}

              {/* VoIP Calls Table */}
              {filteredCalls.length > 0 && (
                <Card>
                  <CardHeader>
                    <h5>
                      Detected VoIP Calls{' '}
                      <Badge color="primary">
                        {filteredCalls.length} / {voipCalls.length}
                      </Badge>
                    </h5>
                  </CardHeader>
                  <CardBody>
                    <Table responsive>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Phone Number</th>
                          <th>Destination Port</th>
                          <th>Protocol</th>
                          <th>Duration</th>
                          <th>Data Volume</th>
                          <th>Estimated App</th>
                          <th>Data Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCalls.map((call, index) => {
                          const dataRate =
                            call.duration > 0
                              ? (call.dataVolume / call.duration).toFixed(2)
                              : 0;

                          return (
                            <tr key={index}>
                              <td>
                                {new Date(call.timestamp).toLocaleString()}
                              </td>
                              <td>
                                <code>
                                  {call.phoneNumber ||
                                    call.served_msisdn ||
                                    'N/A'}
                                </code>
                              </td>
                              <td>
                                <code>{call.destPort}</code>
                              </td>
                              <td>
                                <Badge
                                  color={
                                    call.protocol.toUpperCase() === 'UDP'
                                      ? 'warning'
                                      : 'info'
                                  }
                                >
                                  {call.protocol}
                                </Badge>
                              </td>
                              <td>{formatDuration(call.duration)}</td>
                              <td>{formatDataVolume(call.dataVolume)}</td>
                              <td>
                                <Badge color="success">
                                  {call.estimatedApp}
                                </Badge>
                              </td>
                              <td>
                                {dataRate} KB/s
                                {(dataRate >= 64 && dataRate <= 128) && (
                                  <Badge color="info" className="ml-2">
                                    VoIP Range
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              )}

              {voipCalls.length === 0 && !loading && (
                <Alert color="info">
                  Click "Detect VoIP" to analyze IPDR records for VoIP traffic.
                </Alert>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VoIPDetector;

