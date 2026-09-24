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
  ListGroup,
  ListGroupItem,
} from 'reactstrap';
import { Bar } from 'react-chartjs-2';
import { cdrAPI } from '../../services/api';
import { processCDRForCallPatterns } from '../../services/dataProcessing';

const CallPatternAnalyzer = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);

  const handleAnalyze = async () => {
    if (!phoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await cdrAPI.getCallerRecords(phoneNumber);
      const records = response.data;

      if (!records || records.length === 0) {
        alert('No records found for this phone number');
        setLoading(false);
        return;
      }

      const result = processCDRForCallPatterns(records, phoneNumber);
      setAnalysisData(result);
    } catch (error) {
      console.error('Error analyzing call patterns:', error);
      alert('Error analyzing call patterns');
    } finally {
      setLoading(false);
    }
  };

  // Hourly distribution chart
  const hourlyChartData = analysisData?.stats
    ? {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [
          {
            label: 'Call Activity',
            data: analysisData.stats.hourlyDistribution,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
        ],
      }
    : null;

  const hourlyChartOptions = {
    scales: {
      yAxes: [{
        ticks: {
          beginAtZero: true,
        },
      }],
    },
    legend: {
      display: false,
    },
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <h4 className="title">Call Pattern Anomaly Detection</h4>
              <p className="category">Analyze calling patterns and detect anomalies</p>
            </CardHeader>
            <CardBody>
              {/* Input */}
              <Row className="mb-3">
                <Col md="6">
                  <FormGroup>
                    <Label>Phone Number</Label>
                    <Input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </FormGroup>
                </Col>
                <Col md="2">
                  <FormGroup>
                    <Label>&nbsp;</Label>
                    <Button
                      color="primary"
                      block
                      onClick={handleAnalyze}
                      disabled={loading}
                    >
                      {loading ? <Spinner size="sm" /> : 'Analyze'}
                    </Button>
                  </FormGroup>
                </Col>
              </Row>

              {analysisData && (
                <>
                  {/* Statistics */}
                  <Row className="mb-3">
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total Calls</h6>
                          <h3>{analysisData.stats.totalCalls}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total SMS</h6>
                          <h3>{analysisData.stats.totalSMS}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Avg Duration</h6>
                          <h3>
                            {Math.round(analysisData.stats.averageDuration)}s
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Incoming/Outgoing</h6>
                          <h3>
                            {analysisData.stats.incomingCalls} /{' '}
                            {analysisData.stats.outgoingCalls}
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* Hourly Distribution Chart */}
                  {hourlyChartData && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>Hourly Activity Distribution</h5>
                      </CardHeader>
                      <CardBody>
                        <Bar data={hourlyChartData} options={hourlyChartOptions} />
                      </CardBody>
                    </Card>
                  )}

                  {/* Unusual Hours */}
                  {analysisData.unusualHours.length > 0 && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>
                          Unusual Hours Activity{' '}
                          <Badge color="warning">
                            {analysisData.unusualHours.length}
                          </Badge>
                        </h5>
                      </CardHeader>
                      <CardBody>
                        <Alert color="warning">
                          Calls detected during normally inactive hours (2 AM - 5 AM)
                        </Alert>
                        <Table responsive>
                          <thead>
                            <tr>
                              <th>Date/Time</th>
                              <th>Call Type</th>
                              <th>Duration</th>
                              <th>Called Number</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisData.unusualHours.slice(0, 10).map((record, index) => (
                              <tr key={index}>
                                <td>
                                  {new Date(
                                    record.timestamp || record.startTime || record.Date
                                  ).toLocaleString()}
                                </td>
                                <td>{record.callType || record['Call Type']}</td>
                                <td>
                                  {record.callDuration || record['Dur(s)'] || 0}s
                                </td>
                                <td>
                                  {record.calledNumber ||
                                    record['B Party No'] ||
                                    'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </CardBody>
                    </Card>
                  )}

                  {/* Frequency Spikes */}
                  {analysisData.frequencySpikes && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>
                          Frequency Spikes{' '}
                          <Badge color="danger">
                            {analysisData.frequencySpikes.spikes.length}
                          </Badge>
                        </h5>
                      </CardHeader>
                      <CardBody>
                        <Alert color="danger">
                          Days with activity > 3 standard deviations from average
                        </Alert>
                        <ListGroup>
                          {analysisData.frequencySpikes.spikes.map((spike, index) => (
                            <ListGroupItem key={index}>
                              <strong>{spike.date}:</strong> {spike.count} calls
                              (Average: {Math.round(spike.mean)}, Std Dev:{' '}
                              {Math.round(spike.stdDev)})
                            </ListGroupItem>
                          ))}
                        </ListGroup>
                      </CardBody>
                    </Card>
                  )}

                  {/* Most Called Numbers */}
                  {analysisData.mostCalled.length > 0 && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>Top 10 Most Called Numbers</h5>
                      </CardHeader>
                      <CardBody>
                        <Table responsive>
                          <thead>
                            <tr>
                              <th>Rank</th>
                              <th>Number</th>
                              <th>Total Calls</th>
                              <th>Total Duration</th>
                              <th>Avg Duration</th>
                              <th>Time Distribution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisData.mostCalled.map((contact, index) => (
                              <tr key={index}>
                                <td>{index + 1}</td>
                                <td>
                                  <code>{contact.number}</code>
                                </td>
                                <td>{contact.totalCalls}</td>
                                <td>{Math.round(contact.totalDuration)}s</td>
                                <td>{Math.round(contact.averageDuration)}s</td>
                                <td>
                                  M:{contact.timeDistribution.morning} A:
                                  {contact.timeDistribution.afternoon} E:
                                  {contact.timeDistribution.evening} N:
                                  {contact.timeDistribution.night}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </CardBody>
                    </Card>
                  )}

                  {/* First-Time Contacts at Odd Hours */}
                  {analysisData.firstTimeContacts.length > 0 && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>
                          First-Time Contacts at Odd Hours{' '}
                          <Badge color="warning">
                            {analysisData.firstTimeContacts.length}
                          </Badge>
                        </h5>
                      </CardHeader>
                      <CardBody>
                        <Alert color="warning">
                          First-time contacts made during odd hours (10 PM - 5 AM)
                        </Alert>
                        <Table responsive>
                          <thead>
                            <tr>
                              <th>Date/Time</th>
                              <th>Contact Number</th>
                              <th>Hour</th>
                              <th>Call Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisData.firstTimeContacts.slice(0, 10).map(
                              (record, index) => (
                                <tr key={index}>
                                  <td>
                                    {new Date(record.timestamp).toLocaleString()}
                                  </td>
                                  <td>
                                    <code>{record.contactNumber}</code>
                                  </td>
                                  <td>{record.hour}:00</td>
                                  <td>
                                    {record.callType || record['Call Type'] || 'N/A'}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </Table>
                      </CardBody>
                    </Card>
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

export default CallPatternAnalyzer;

