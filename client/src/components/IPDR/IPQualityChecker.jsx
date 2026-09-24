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
  Progress,
  ListGroup,
  ListGroupItem,
} from 'reactstrap';
import { ipdrAPI, ipQualityAPI } from '../../services/api';

const IPQualityChecker = () => {
  const [loading, setLoading] = useState(false);
  const [ipResults, setIpResults] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [filters, setFilters] = useState({
    showVPNOnly: false,
    showProxyOnly: false,
    showTorOnly: false,
    showHighFraudOnly: false,
  });

  const handleCheckIPs = async () => {
    if (!apiKey) {
      alert('Please enter IPQualityScore API key');
      return;
    }

    setLoading(true);
    try {
      // Get all IPDR records
      const response = await ipdrAPI.getAllRecords();
      const records = response.data;

      if (!records || records.length === 0) {
        alert('No IPDR records found');
        setLoading(false);
        return;
      }

      // Extract unique IP addresses
      const uniqueIPs = new Set();
      records.forEach(record => {
        const ip = record.destIP || record.dest_ip || record.destination_ip || 
                   record.served_ipv4_address || record.publicIP;
        if (ip && ip !== '') {
          uniqueIPs.add(ip);
        }
      });

      const ipArray = Array.from(uniqueIPs);
      console.log(`Checking ${ipArray.length} unique IPs...`);

      // Batch process IPs
      const results = await ipQualityAPI.checkBatch(ipArray, apiKey);

      // Format results
      const formattedResults = ipArray.map((ip, index) => {
        const result = results[index];
        return {
          ip,
          vpn: result.vpn || false,
          proxy: result.proxy || false,
          tor: result.tor || false,
          fraudScore: result.fraud_score || 0,
          isp: result.ISP || 'Unknown',
          country: result.country_code || 'Unknown',
          isCrawler: result.is_crawler || false,
          recentAbuse: result.recent_abuse || false,
          connectionType: result.connection_type || 'Unknown',
        };
      });

      setIpResults(formattedResults);
    } catch (error) {
      console.error('Error checking IP quality:', error);
      alert('Error checking IP quality. Make sure your API key is valid.');
    } finally {
      setLoading(false);
    }
  };

  // Filter results
  const filteredResults = ipResults.filter(result => {
    if (filters.showVPNOnly && !result.vpn) return false;
    if (filters.showProxyOnly && !result.proxy) return false;
    if (filters.showTorOnly && !result.tor) return false;
    if (filters.showHighFraudOnly && result.fraudScore < 75) return false;
    return true;
  });

  const getStatusBadge = (result) => {
    if (result.tor) {
      return <Badge style={{ backgroundColor: '#6f42c1' }}>Tor</Badge>;
    }
    if (result.vpn) {
      return <Badge color="danger">VPN</Badge>;
    }
    if (result.proxy) {
      return <Badge color="warning">Proxy</Badge>;
    }
    if (result.fraudScore >= 75) {
      return <Badge color="danger">High Risk</Badge>;
    }
    return <Badge color="success">Clean</Badge>;
  };

  const getFraudScoreColor = (score) => {
    if (score >= 75) return 'danger';
    if (score >= 50) return 'warning';
    if (score >= 25) return 'info';
    return 'success';
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <h4 className="title">IP Quality Score Integration</h4>
              <p className="category">
                Check IP reputation using IPQualityScore API
              </p>
            </CardHeader>
            <CardBody>
              {/* API Key Input */}
              <Row className="mb-3">
                <Col md="6">
                  <FormGroup>
                    <Label>IPQualityScore API Key</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                    />
                    <small className="text-muted">
                      Get your API key from{' '}
                      <a
                        href="https://www.ipqualityscore.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ipqualityscore.com
                      </a>
                    </small>
                  </FormGroup>
                </Col>
                <Col md="2">
                  <FormGroup>
                    <Label>&nbsp;</Label>
                    <Button
                      color="primary"
                      block
                      onClick={handleCheckIPs}
                      disabled={loading || !apiKey}
                    >
                      {loading ? <Spinner size="sm" /> : 'Check IPs'}
                    </Button>
                  </FormGroup>
                </Col>
              </Row>

              {/* Filters */}
              {ipResults.length > 0 && (
                <Card className="mb-3">
                  <CardHeader>
                    <h5>Filters</h5>
                  </CardHeader>
                  <CardBody>
                    <Row>
                      <Col md="3">
                        <FormGroup check>
                          <Label check>
                            <Input
                              type="checkbox"
                              checked={filters.showVPNOnly}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  showVPNOnly: e.target.checked,
                                })
                              }
                            />{' '}
                            VPN Only
                          </Label>
                        </FormGroup>
                      </Col>
                      <Col md="3">
                        <FormGroup check>
                          <Label check>
                            <Input
                              type="checkbox"
                              checked={filters.showProxyOnly}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  showProxyOnly: e.target.checked,
                                })
                              }
                            />{' '}
                            Proxy Only
                          </Label>
                        </FormGroup>
                      </Col>
                      <Col md="3">
                        <FormGroup check>
                          <Label check>
                            <Input
                              type="checkbox"
                              checked={filters.showTorOnly}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  showTorOnly: e.target.checked,
                                })
                              }
                            />{' '}
                            Tor Only
                          </Label>
                        </FormGroup>
                      </Col>
                      <Col md="3">
                        <FormGroup check>
                          <Label check>
                            <Input
                              type="checkbox"
                              checked={filters.showHighFraudOnly}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  showHighFraudOnly: e.target.checked,
                                })
                              }
                            />{' '}
                            High Fraud Score (&gt;75)
                          </Label>
                        </FormGroup>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              )}

              {/* Summary */}
              {ipResults.length > 0 && (
                <Row className="mb-3">
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>Total IPs Checked</h6>
                        <h3>{ipResults.length}</h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>VPN Detected</h6>
                        <h3 className="text-danger">
                          {ipResults.filter(r => r.vpn).length}
                        </h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>Proxy Detected</h6>
                        <h3 className="text-warning">
                          {ipResults.filter(r => r.proxy).length}
                        </h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card>
                      <CardBody>
                        <h6>Tor Exit Nodes</h6>
                        <h3 className="text-purple">
                          {ipResults.filter(r => r.tor).length}
                        </h3>
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Results Table */}
              {filteredResults.length > 0 && (
                <Card>
                  <CardHeader>
                    <h5>
                      IP Quality Results{' '}
                      <Badge color="primary">
                        {filteredResults.length} / {ipResults.length}
                      </Badge>
                    </h5>
                  </CardHeader>
                  <CardBody>
                    <Table responsive>
                      <thead>
                        <tr>
                          <th>IP Address</th>
                          <th>Status</th>
                          <th>Fraud Score</th>
                          <th>ISP</th>
                          <th>Country</th>
                          <th>Connection Type</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((result, index) => (
                          <tr key={index}>
                            <td>
                              <code>{result.ip}</code>
                            </td>
                            <td>{getStatusBadge(result)}</td>
                            <td>
                              <div>
                                <Progress
                                  value={result.fraudScore}
                                  color={getFraudScoreColor(result.fraudScore)}
                                  className="mb-1"
                                />
                                <small>{result.fraudScore}/100</small>
                              </div>
                            </td>
                            <td>{result.isp}</td>
                            <td>{result.country}</td>
                            <td>{result.connectionType}</td>
                            <td>
                              {result.recentAbuse && (
                                <Badge color="danger" className="mr-1">
                                  Recent Abuse
                                </Badge>
                              )}
                              {result.isCrawler && (
                                <Badge color="info" className="mr-1">
                                  Crawler
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              )}

              {ipResults.length === 0 && !loading && (
                <Alert color="info">
                  Enter your API key and click "Check IPs" to analyze IP addresses
                  from IPDR records.
                </Alert>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default IPQualityChecker;

