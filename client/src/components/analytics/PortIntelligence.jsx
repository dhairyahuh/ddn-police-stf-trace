import config from "config";
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  Progress,
  Input,
  FormGroup,
  Label
} from 'reactstrap';
import { Doughnut, Bar } from 'react-chartjs-2';

const PortIntelligence = () => {
  const [portData, setPortData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');
  const [searchPort, setSearchPort] = useState('');

  useEffect(() => {
    fetchPortData();
  }, []);

  const fetchPortData = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.BASE_URL}/api/analytics/ports`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPortData(data);
    } catch (err) {
      setError(`Failed to fetch port data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeColor = (risk) => {
    switch (risk) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      case 'unknown': return 'secondary';
      default: return 'secondary';
    }
  };

  const getRiskIcon = (risk) => {
    switch (risk) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '🔶';
      case 'low': return '✅';
      case 'unknown': return '❓';
      default: return '🔌';
    }
  };

  const getRiskDistributionData = () => {
    if (!portData?.riskDistribution) return null;

    return {
      labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk', 'Unknown'],
      datasets: [{
        data: [
          portData.riskDistribution.low,
          portData.riskDistribution.medium,
          portData.riskDistribution.high,
          portData.riskDistribution.critical,
          portData.riskDistribution.unknown
        ],
        backgroundColor: [
          'rgba(40, 167, 69, 0.8)',
          'rgba(23, 162, 184, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(220, 53, 69, 0.8)',
          'rgba(108, 117, 125, 0.8)'
        ]
      }]
    };
  };

  const getTopPortsData = () => {
    if (!portData?.portStats) return null;

    const topPorts = portData.portStats.slice(0, 10);
    
    return {
      labels: topPorts.map(p => `Port ${p.port}`),
      datasets: [{
        label: 'Connection Count',
        data: topPorts.map(p => p.count),
        backgroundColor: topPorts.map(p => {
          switch (p.risk) {
            case 'critical': return 'rgba(220, 53, 69, 0.8)';
            case 'high': return 'rgba(255, 193, 7, 0.8)';
            case 'medium': return 'rgba(23, 162, 184, 0.8)';
            case 'low': return 'rgba(40, 167, 69, 0.8)';
            default: return 'rgba(108, 117, 125, 0.8)';
          }
        }),
        borderColor: topPorts.map(p => {
          switch (p.risk) {
            case 'critical': return 'rgba(220, 53, 69, 1)';
            case 'high': return 'rgba(255, 193, 7, 1)';
            case 'medium': return 'rgba(23, 162, 184, 1)';
            case 'low': return 'rgba(40, 167, 69, 1)';
            default: return 'rgba(108, 117, 125, 1)';
          }
        }),
        borderWidth: 1
      }]
    };
  };

  const getFilteredPorts = () => {
    if (!portData?.portStats) return [];
    
    let filtered = portData.portStats;
    
    if (filterRisk !== 'all') {
      filtered = filtered.filter(port => port.risk === filterRisk);
    }
    
    if (searchPort) {
      filtered = filtered.filter(port => 
        port.port.toString().includes(searchPort) || 
        port.name.toLowerCase().includes(searchPort.toLowerCase())
      );
    }
    
    return filtered;
  };

  const calculateRiskScore = () => {
    if (!portData?.riskDistribution) return 0;
    
    const total = portData.totalConnections;
    const weighted = 
      (portData.riskDistribution.critical * 100) +
      (portData.riskDistribution.high * 75) +
      (portData.riskDistribution.medium * 50) +
      (portData.riskDistribution.unknown * 30) +
      (portData.riskDistribution.low * 10);
    
    return Math.round((weighted / total) * 0.1);
  };

  const getOverallRiskLevel = (score) => {
    if (score >= 80) return { level: 'Critical', color: 'danger' };
    if (score >= 60) return { level: 'High', color: 'warning' };
    if (score >= 40) return { level: 'Medium', color: 'info' };
    if (score >= 20) return { level: 'Low', color: 'success' };
    return { level: 'Minimal', color: 'success' };
  };

  if (loading) {
    return (
      <div className="content">
        <div className="text-center">
          <Spinner size="lg" color="primary" />
          <p className="mt-3">Loading port intelligence data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <Card>
        <CardHeader>
          <CardTitle tag="h4">IPDR Port Intelligence</CardTitle>
        </CardHeader>
        <CardBody>
          <Button color="primary" onClick={fetchPortData} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Refresh Data'}
          </Button>

          {error && <Alert color="danger" className="mt-3">{error}</Alert>}

          {portData && (
            <>
              {/* Risk Overview Cards */}
              <div className="row mt-4">
                <div className="col-md-3">
                  <div className="card card-stats">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-5">
                          <div className="icon-big text-center icon-warning">
                            <i className="tim-icons icon-chart-pie-36 text-primary"></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">Total Connections</p>
                            <p className="card-title">{portData.totalConnections.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card card-stats">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-5">
                          <div className="icon-big text-center icon-warning">
                            <i className="tim-icons icon-compass-05 text-info"></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">Unique Ports</p>
                            <p className="card-title">{portData.portStats.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card card-stats">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-5">
                          <div className="icon-big text-center icon-warning">
                            <i className="tim-icons icon-alert-circle-exc text-danger"></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">High Risk Ports</p>
                            <p className="card-title">
                              {portData.portStats.filter(p => p.risk === 'critical' || p.risk === 'high').length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card card-stats">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-5">
                          <div className="icon-big text-center icon-warning">
                            <i className={`tim-icons icon-chart-bar-32 text-${getOverallRiskLevel(calculateRiskScore()).color}`}></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">Risk Score</p>
                            <p className={`card-title text-${getOverallRiskLevel(calculateRiskScore()).color}`}>
                              {calculateRiskScore()}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="row mt-4">
                <div className="col-md-8">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Top Active Ports</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {getTopPortsData() && (
                        <Bar 
                          data={getTopPortsData()} 
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { display: false }
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                title: {
                                  display: true,
                                  text: 'Connection Count'
                                }
                              }
                            }
                          }} 
                        />
                      )}
                    </CardBody>
                  </Card>
                </div>
                <div className="col-md-4">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Risk Distribution</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {getRiskDistributionData() && (
                        <Doughnut 
                          data={getRiskDistributionData()} 
                          options={{
                            responsive: true,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: {
                                  fontSize: 10
                                }
                              }
                            }
                          }} 
                        />
                      )}
                      
                      <div className="mt-3">
                        <div className="text-center">
                          <h5 className={`text-${getOverallRiskLevel(calculateRiskScore()).color}`}>
                            {getOverallRiskLevel(calculateRiskScore()).level} Risk
                          </h5>
                          <Progress
                            value={calculateRiskScore()}
                            color={getOverallRiskLevel(calculateRiskScore()).color}
                          />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>

              {/* Port Details Table */}
              <Card className="mt-4">
                <CardHeader>
                  <div className="row">
                    <div className="col-md-6">
                      <CardTitle tag="h5">Port Intelligence Database</CardTitle>
                    </div>
                    <div className="col-md-3">
                      <FormGroup>
                        <Label>Filter by Risk</Label>
                        <Input
                          type="select"
                          value={filterRisk}
                          onChange={(e) => setFilterRisk(e.target.value)}
                        >
                          <option value="all">All Risks</option>
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                          <option value="unknown">Unknown</option>
                        </Input>
                      </FormGroup>
                    </div>
                    <div className="col-md-3">
                      <FormGroup>
                        <Label>Search Port/Service</Label>
                        <Input
                          type="text"
                          value={searchPort}
                          onChange={(e) => setSearchPort(e.target.value)}
                          placeholder="Port number or service name"
                        />
                      </FormGroup>
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  <Table responsive>
                    <thead>
                      <tr>
                        <th>Port</th>
                        <th>Service</th>
                        <th>Category</th>
                        <th>Connections</th>
                        <th>Risk Level</th>
                        <th>% of Traffic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredPorts().slice(0, 50).map((port, index) => (
                        <tr key={index} className={
                          port.risk === 'critical' ? 'table-danger' :
                          port.risk === 'high' ? 'table-warning' : ''
                        }>
                          <td>
                            <strong>{port.port}</strong>
                          </td>
                          <td>
                            {port.name}
                            {port.port === 4444 && <Badge color="danger" className="ml-2">BACKDOOR</Badge>}
                            {port.port === 3389 && <Badge color="warning" className="ml-2">RDP</Badge>}
                          </td>
                          <td>
                            <Badge color="info" outline>
                              {port.category}
                            </Badge>
                          </td>
                          <td>{port.count.toLocaleString()}</td>
                          <td>
                            <Badge color={getRiskBadgeColor(port.risk)}>
                              {getRiskIcon(port.risk)} {port.risk.toUpperCase()}
                            </Badge>
                          </td>
                          <td>
                            {((port.count / portData.totalConnections) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  
                  {getFilteredPorts().length === 0 && (
                    <Alert color="info" className="text-center">
                      No ports match the current filter criteria.
                    </Alert>
                  )}
                </CardBody>
              </Card>

              {/* Security Recommendations */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle tag="h5">Security Recommendations</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="row">
                    {portData.riskDistribution.critical > 0 && (
                      <div className="col-md-12">
                        <Alert color="danger">
                          <strong>🚨 Critical Risk Detected!</strong>
                          <ul className="mt-2 mb-0">
                            <li>Block unauthorized access to critical ports (4444, 6666, etc.)</li>
                            <li>Implement network segmentation</li>
                            <li>Monitor for potential backdoor activities</li>
                          </ul>
                        </Alert>
                      </div>
                    )}
                    
                    {portData.riskDistribution.high > 0 && (
                      <div className="col-md-12">
                        <Alert color="warning">
                          <strong>⚠️ High Risk Services Detected!</strong>
                          <ul className="mt-2 mb-0">
                            <li>Secure RDP connections (Port 3389) with VPN</li>
                            <li>Disable unnecessary Telnet services (Port 23)</li>
                            <li>Implement database access controls</li>
                          </ul>
                        </Alert>
                      </div>
                    )}

                    <div className="col-md-6">
                      <h6>Port Security Guidelines:</h6>
                      <ul>
                        <li><strong>Ports 1-1023:</strong> System/Well-known ports - Monitor closely</li>
                        <li><strong>Ports 1024-49151:</strong> Registered ports - Verify legitimacy</li>
                        <li><strong>Ports 49152-65535:</strong> Dynamic ports - Check for anomalies</li>
                      </ul>
                    </div>
                    
                    <div className="col-md-6">
                      <h6>Common Threat Indicators:</h6>
                      <ul>
                        <li>High-numbered ports (&gt;10000) with heavy traffic</li>
                        <li>Database ports accessible from external networks</li>
                        <li>Multiple connections to unknown services</li>
                      </ul>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default PortIntelligence;