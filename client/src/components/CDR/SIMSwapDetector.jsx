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
import { cdrAPI } from '../../services/api';
import { processCDRForSIMSwap } from '../../services/dataProcessing';

const SIMSwapDetector = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [swapData, setSwapData] = useState(null);

  const handleDetect = async () => {
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

      const result = processCDRForSIMSwap(records, phoneNumber);
      setSwapData(result);
    } catch (error) {
      console.error('Error detecting SIM swap:', error);
      alert('Error detecting SIM swap');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (riskLevel) => {
    const colors = {
      CRITICAL: 'danger',
      WARNING: 'warning',
      INFO: 'info',
    };
    return <Badge color={colors[riskLevel] || 'secondary'}>{riskLevel}</Badge>;
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <h4 className="title">SIM Swap Detection</h4>
              <p className="category">Detect IMEI changes and flag suspicious activity</p>
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
                      onClick={handleDetect}
                      disabled={loading}
                    >
                      {loading ? <Spinner size="sm" /> : 'Detect'}
                    </Button>
                  </FormGroup>
                </Col>
              </Row>

              {/* Summary */}
              {swapData && (
                <>
                  <Row className="mb-3">
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total Swaps</h6>
                          <h3>{swapData.totalSwaps}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Critical</h6>
                          <h3 className="text-danger">{swapData.criticalSwaps}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Warnings</h6>
                          <h3 className="text-warning">{swapData.warningSwaps}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Info</h6>
                          <h3 className="text-info">
                            {swapData.totalSwaps -
                              swapData.criticalSwaps -
                              swapData.warningSwaps}
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* IMEI History Timeline */}
                  {swapData.imeiHistory.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <h5>IMEI Change History</h5>
                      </CardHeader>
                      <CardBody>
                        <Table responsive>
                          <thead>
                            <tr>
                              <th>From IMEI</th>
                              <th>To IMEI</th>
                              <th>Change Time</th>
                              <th>Hours Since Last Change</th>
                              <th>Risk Score</th>
                              <th>Risk Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {swapData.imeiHistory.map((swap, index) => (
                              <tr key={index}>
                                <td>
                                  <code>{swap.fromIMEI}</code>
                                </td>
                                <td>
                                  <code>{swap.toIMEI}</code>
                                </td>
                                <td>
                                  {new Date(swap.changeTime).toLocaleString()}
                                </td>
                                <td>
                                  {swap.hoursSinceLastChange.toFixed(2)} hours
                                  {swap.suspicious && (
                                    <Badge color="danger" className="ml-2">
                                      Suspicious
                                    </Badge>
                                  )}
                                </td>
                                <td>
                                  <strong>{swap.riskScore}</strong>
                                </td>
                                <td>{getRiskBadge(swap.riskLevel)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </CardBody>
                    </Card>
                  ) : (
                    <Alert color="info">
                      No IMEI changes detected for this phone number.
                    </Alert>
                  )}

                  {/* Risk Analysis */}
                  {swapData.criticalSwaps > 0 && (
                    <Alert color="danger" className="mt-3">
                      <strong>Critical Alert:</strong> {swapData.criticalSwaps} critical
                      SIM swap(s) detected. These may indicate fraudulent activity or
                      account takeover attempts.
                    </Alert>
                  )}

                  {swapData.warningSwaps > 0 && (
                    <Alert color="warning" className="mt-3">
                      <strong>Warning:</strong> {swapData.warningSwaps} warning-level
                      SIM swap(s) detected. Review these changes for unusual patterns.
                    </Alert>
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

export default SIMSwapDetector;

