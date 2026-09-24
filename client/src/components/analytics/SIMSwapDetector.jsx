import config from "config";
import React, { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Form,
  FormGroup,
  Input,
  Label,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  Progress
} from 'reactstrap';
import { Bar } from 'react-chartjs-2';

const SIMSwapDetector = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [swapData, setSwapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSwapData = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.BASE_URL}/api/analytics/simswap/${phoneNumber}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSwapData(data);
    } catch (err) {
      setError(`Failed to fetch SIM swap data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'secondary';
    }
  };

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📱';
    }
  };

  const getRiskChartData = () => {
    if (!swapData?.imeiChanges) return null;

    const riskCounts = { critical: 0, warning: 0, info: 0 };
    swapData.imeiChanges.forEach(change => {
      riskCounts[change.riskLevel]++;
    });

    return {
      labels: ['Critical', 'Warning', 'Info'],
      datasets: [{
        label: 'Number of Changes',
        data: [riskCounts.critical, riskCounts.warning, riskCounts.info],
        backgroundColor: [
          'rgba(220, 53, 69, 0.8)',
          'rgba(255, 193, 7, 0.8)',
          'rgba(23, 162, 184, 0.8)'
        ],
        borderColor: [
          'rgba(220, 53, 69, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(23, 162, 184, 1)'
        ],
        borderWidth: 1
      }]
    };
  };

  const calculateRiskScore = () => {
    if (!swapData?.imeiChanges) return 0;

    let score = 0;
    swapData.imeiChanges.forEach(change => {
      switch (change.riskLevel) {
        case 'critical': score += 100; break;
        case 'warning': score += 50; break;
        case 'info': score += 10; break;
      }
    });

    return Math.min(score, 100);
  };

  const getRiskScoreColor = (score) => {
    if (score >= 80) return 'danger';
    if (score >= 50) return 'warning';
    if (score >= 20) return 'info';
    return 'success';
  };

  const getRiskDescription = (score) => {
    if (score >= 80) return 'Very High Risk - Multiple recent IMEI changes detected';
    if (score >= 50) return 'High Risk - Recent IMEI changes detected';
    if (score >= 20) return 'Medium Risk - Some IMEI changes detected';
    return 'Low Risk - Normal IMEI usage pattern';
  };

  return (
    <div className="content">
      <Card>
        <CardHeader>
          <CardTitle tag="h4">SIM Swap Detection</CardTitle>
        </CardHeader>
        <CardBody>
          <Form>
            <div className="row">
              <div className="col-md-8">
                <FormGroup>
                  <Label>Phone Number</Label>
                  <Input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number to analyze"
                  />
                </FormGroup>
              </div>
              <div className="col-md-4">
                <FormGroup>
                  <Label>&nbsp;</Label>
                  <Button
                    color="primary"
                    onClick={fetchSwapData}
                    disabled={loading}
                    className="btn-block"
                  >
                    {loading ? <Spinner size="sm" /> : 'Analyze SIM Swaps'}
                  </Button>
                </FormGroup>
              </div>
            </div>
          </Form>

          {error && <Alert color="danger">{error}</Alert>}

          {swapData && (
            <>
              {/* Risk Score Card */}
              <div className="row mt-4">
                <div className="col-md-6">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Risk Assessment</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <div className="text-center">
                        <h2 className={`text-${getRiskScoreColor(calculateRiskScore())}`}>
                          {calculateRiskScore()}%
                        </h2>
                        <Progress
                          value={calculateRiskScore()}
                          color={getRiskScoreColor(calculateRiskScore())}
                          className="mb-3"
                        />
                        <p className="mb-0">
                          {getRiskDescription(calculateRiskScore())}
                        </p>
                        <hr />
                        <div className="row text-center">
                          <div className="col-4">
                            <h5>{swapData.imeiChanges.length}</h5>
                            <small>Total Changes</small>
                          </div>
                          <div className="col-4">
                            <h5>{swapData.imeiChanges.filter(c => c.riskLevel === 'critical').length}</h5>
                            <small>Critical</small>
                          </div>
                          <div className="col-4">
                            <h5>{swapData.totalRecords}</h5>
                            <small>Total Records</small>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
                <div className="col-md-6">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Risk Distribution</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {getRiskChartData() && (
                        <Bar 
                          data={getRiskChartData()} 
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { display: false }
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: {
                                  stepSize: 1
                                }
                              }
                            }
                          }} 
                        />
                      )}
                    </CardBody>
                  </Card>
                </div>
              </div>

              {/* IMEI Changes Table */}
              {swapData.imeiChanges.length > 0 ? (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle tag="h5">IMEI Change History</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <Table responsive>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Change Time</th>
                          <th>Old IMEI</th>
                          <th>New IMEI</th>
                          <th>Hours Since Last</th>
                          <th>Risk Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {swapData.imeiChanges.map((change, index) => (
                          <tr key={index} className={change.riskLevel === 'critical' ? 'table-danger' : change.riskLevel === 'warning' ? 'table-warning' : ''}>
                            <td>{index + 1}</td>
                            <td>
                              {new Date(change.changeTime).toLocaleString()}
                            </td>
                            <td>
                              <code>{change.oldImei}</code>
                            </td>
                            <td>
                              <code>{change.newImei}</code>
                            </td>
                            <td>
                              {change.hoursSinceLastChange ? 
                                change.hoursSinceLastChange.toFixed(1) : 
                                'N/A'
                              }
                            </td>
                            <td>
                              <Badge color={getRiskBadgeColor(change.riskLevel)}>
                                {getRiskIcon(change.riskLevel)} {change.riskLevel.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              ) : (
                <Card className="mt-4">
                  <CardBody>
                    <Alert color="success" className="text-center">
                      <h4>✅ No SIM Swaps Detected</h4>
                      <p className="mb-0">
                        This phone number shows consistent IMEI usage with no suspicious device changes.
                      </p>
                    </Alert>
                  </CardBody>
                </Card>
              )}

              {/* Analysis Summary */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle tag="h5">Analysis Summary</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="text-center p-3 border rounded">
                        <h5 className="text-primary">{swapData.totalRecords}</h5>
                        <small>CDR Records Analyzed</small>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="text-center p-3 border rounded">
                        <h5 className="text-info">{swapData.imeiChanges.length}</h5>
                        <small>IMEI Changes Found</small>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="text-center p-3 border rounded">
                        <h5 className={`text-${getRiskScoreColor(calculateRiskScore())}`}>
                          {calculateRiskScore() >= 80 ? 'HIGH' : 
                           calculateRiskScore() >= 50 ? 'MEDIUM' : 
                           calculateRiskScore() >= 20 ? 'LOW' : 'MINIMAL'}
                        </h5>
                        <small>Overall Risk Level</small>
                      </div>
                    </div>
                  </div>
                  
                  <hr />
                  
                  <div className="alert alert-info">
                    <strong>Detection Criteria:</strong>
                    <ul className="mb-0 mt-2">
                      <li><strong>Critical Risk:</strong> IMEI changes within 24 hours</li>
                      <li><strong>Warning Risk:</strong> IMEI changes within 7 days</li>
                      <li><strong>Info Risk:</strong> Any IMEI changes detected</li>
                    </ul>
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

export default SIMSwapDetector;