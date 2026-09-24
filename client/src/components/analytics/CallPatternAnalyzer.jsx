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
  TabContent,
  TabPane,
  Nav,
  NavItem,
  NavLink
} from 'reactstrap';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import classnames from 'classnames';

const CallPatternAnalyzer = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [patternData, setPatternData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('1');

  const toggle = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };

  const fetchPatternData = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${config.BASE_URL}/api/analytics/patterns/${phoneNumber}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPatternData(data);
    } catch (err) {
      setError(`Failed to fetch pattern data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getHourlyDistributionData = () => {
    if (!patternData?.hourlyDistribution) return null;

    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [{
        label: 'Calls per Hour',
        data: patternData.hourlyDistribution,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    };
  };

  const getDailyCallsData = () => {
    if (!patternData?.dailyCallCounts) return null;

    const dates = Object.keys(patternData.dailyCallCounts).sort();
    const counts = dates.map(date => patternData.dailyCallCounts[date]);

    return {
      labels: dates.map(date => new Date(date).toLocaleDateString()),
      datasets: [{
        label: 'Daily Calls',
        data: counts,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
        fill: true
      }]
    };
  };

  const getCallTypeDistribution = () => {
    if (!patternData?.mostCalledNumbers) return null;

    // Categorize numbers
    const categories = {
      'Regular Numbers': 0,
      'Short Codes': 0,
      'Toll Free': 0,
      'International': 0
    };

    patternData.mostCalledNumbers.forEach(contact => {
      const number = contact.number;
      if (number.length <= 5) {
        categories['Short Codes'] += contact.totalCalls;
      } else if (number.startsWith('1800') || number.startsWith('1900')) {
        categories['Toll Free'] += contact.totalCalls;
      } else if (number.startsWith('+') || number.startsWith('00')) {
        categories['International'] += contact.totalCalls;
      } else {
        categories['Regular Numbers'] += contact.totalCalls;
      }
    });

    return {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)'
        ]
      }]
    };
  };

  const getAnomalyBadgeColor = (severity) => {
    switch (severity) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'secondary';
    }
  };

  const calculateAnomalyScore = () => {
    if (!patternData?.anomalies) return 0;

    let score = 0;
    patternData.anomalies.forEach(anomaly => {
      switch (anomaly.severity) {
        case 'high': score += 30; break;
        case 'medium': score += 15; break;
        case 'low': score += 5; break;
      }
    });

    return Math.min(score, 100);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'danger';
    if (score >= 40) return 'warning';
    if (score >= 20) return 'info';
    return 'success';
  };

  return (
    <div className="content">
      <Card>
        <CardHeader>
          <CardTitle tag="h4">Call Pattern Analysis</CardTitle>
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
                    onClick={fetchPatternData}
                    disabled={loading}
                    className="btn-block"
                  >
                    {loading ? <Spinner size="sm" /> : 'Analyze Patterns'}
                  </Button>
                </FormGroup>
              </div>
            </div>
          </Form>

          {error && <Alert color="danger">{error}</Alert>}

          {patternData && (
            <>
              {/* Summary Cards */}
              <div className="row mt-4">
                <div className="col-md-3">
                  <div className="card card-stats">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-5">
                          <div className="icon-big text-center icon-warning">
                            <i className="tim-icons icon-chat-33 text-primary"></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">Total Records</p>
                            <p className="card-title">{patternData.totalRecords}</p>
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
                            <i className="tim-icons icon-single-02 text-info"></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">Unique Contacts</p>
                            <p className="card-title">{patternData.mostCalledNumbers.length}</p>
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
                            <i className="tim-icons icon-alert-circle-exc text-warning"></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">Anomalies</p>
                            <p className="card-title">{patternData.anomalies.length}</p>
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
                            <i className={`tim-icons icon-chart-bar-32 text-${getScoreColor(calculateAnomalyScore())}`}></i>
                          </div>
                        </div>
                        <div className="col-7">
                          <div className="numbers">
                            <p className="card-category">Risk Score</p>
                            <p className={`card-title text-${getScoreColor(calculateAnomalyScore())}`}>
                              {calculateAnomalyScore()}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabbed Content */}
              <Nav tabs className="mt-4">
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '1' })}
                    onClick={() => { toggle('1'); }}
                  >
                    Hourly Patterns
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '2' })}
                    onClick={() => { toggle('2'); }}
                  >
                    Daily Trends
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '3' })}
                    onClick={() => { toggle('3'); }}
                  >
                    Contact Analysis
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '4' })}
                    onClick={() => { toggle('4'); }}
                  >
                    Anomalies
                  </NavLink>
                </NavItem>
              </Nav>

              <TabContent activeTab={activeTab}>
                <TabPane tabId="1">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">24-Hour Call Distribution</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {getHourlyDistributionData() && (
                        <Bar 
                          data={getHourlyDistributionData()} 
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
                                  text: 'Number of Calls'
                                }
                              },
                              x: {
                                title: {
                                  display: true,
                                  text: 'Hour of Day'
                                }
                              }
                            }
                          }} 
                        />
                      )}
                    </CardBody>
                  </Card>
                </TabPane>

                <TabPane tabId="2">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Daily Call Trends</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {getDailyCallsData() && (
                        <Line 
                          data={getDailyCallsData()} 
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
                                  text: 'Number of Calls'
                                }
                              }
                            }
                          }} 
                        />
                      )}
                    </CardBody>
                  </Card>
                </TabPane>

                <TabPane tabId="3">
                  <div className="row">
                    <div className="col-md-4">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h5">Call Type Distribution</CardTitle>
                        </CardHeader>
                        <CardBody>
                          {getCallTypeDistribution() && (
                            <Doughnut 
                              data={getCallTypeDistribution()} 
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'bottom'
                                  }
                                }
                              }} 
                            />
                          )}
                        </CardBody>
                      </Card>
                    </div>
                    <div className="col-md-8">
                      <Card>
                        <CardHeader>
                          <CardTitle tag="h5">Most Contacted Numbers</CardTitle>
                        </CardHeader>
                        <CardBody>
                          <Table responsive>
                            <thead>
                              <tr>
                                <th>Number</th>
                                <th>Total Calls</th>
                                <th>Avg Duration</th>
                                <th>First Call</th>
                                <th>Last Call</th>
                              </tr>
                            </thead>
                            <tbody>
                              {patternData.mostCalledNumbers.slice(0, 10).map((contact, index) => (
                                <tr key={index}>
                                  <td>
                                    <code>{contact.number}</code>
                                    {contact.number.length <= 5 && <Badge color="info" className="ml-2">Short Code</Badge>}
                                  </td>
                                  <td>{contact.totalCalls}</td>
                                  <td>{Math.round(contact.avgCallDuration)} sec</td>
                                  <td>{new Date(contact.firstCall).toLocaleDateString()}</td>
                                  <td>{new Date(contact.lastCall).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </CardBody>
                      </Card>
                    </div>
                  </div>
                </TabPane>

                <TabPane tabId="4">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Detected Anomalies</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {patternData.anomalies.length > 0 ? (
                        <Table responsive>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Timestamp</th>
                              <th>Description</th>
                              <th>Severity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patternData.anomalies.map((anomaly, index) => (
                              <tr key={index}>
                                <td>
                                  <Badge color="secondary">
                                    {anomaly.type.replace('_', ' ').toUpperCase()}
                                  </Badge>
                                </td>
                                <td>{new Date(anomaly.timestamp).toLocaleString()}</td>
                                <td>{anomaly.description}</td>
                                <td>
                                  <Badge color={getAnomalyBadgeColor(anomaly.severity)}>
                                    {anomaly.severity.toUpperCase()}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <Alert color="success" className="text-center">
                          <h4>✅ No Anomalies Detected</h4>
                          <p className="mb-0">
                            The call patterns appear normal with no suspicious activity detected.
                          </p>
                        </Alert>
                      )}
                    </CardBody>
                  </Card>
                </TabPane>
              </TabContent>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default CallPatternAnalyzer;