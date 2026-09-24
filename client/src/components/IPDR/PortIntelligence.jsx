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
import { Pie } from 'react-chartjs-2';
import { ipdrAPI } from '../../services/api';
import { processIPDRForPortIntelligence } from '../../services/dataProcessing';
import { getPortInfo, getRiskColor } from '../../utils/portDatabase';

const PortIntelligence = () => {
  const [loading, setLoading] = useState(false);
  const [portData, setPortData] = useState(null);
  const [filters, setFilters] = useState({
    phoneNumber: '',
    startDate: '',
    endDate: '',
  });

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const response = await ipdrAPI.getAllRecords();
      const records = response.data;

      if (!records || records.length === 0) {
        alert('No IPDR records found');
        setLoading(false);
        return;
      }

      // Apply filters
      let filteredRecords = records;
      if (filters.phoneNumber) {
        filteredRecords = filteredRecords.filter(r => 
          r.phoneNumber === filters.phoneNumber ||
          r.served_msisdn === filters.phoneNumber ||
          r.served_msisdn === `91${filters.phoneNumber}`
        );
      }

      const result = processIPDRForPortIntelligence(filteredRecords);
      setPortData(result);
    } catch (error) {
      console.error('Error analyzing ports:', error);
      alert('Error analyzing ports');
    } finally {
      setLoading(false);
    }
  };

  // Pie chart data for port categories
  const categoryChartData = portData
    ? {
        labels: Object.keys(portData.riskCategories).map(
          key => key.charAt(0).toUpperCase() + key.slice(1)
        ),
        datasets: [
          {
            data: Object.values(portData.riskCategories).map(
              ports => ports.length
            ),
            backgroundColor: [
              '#dc3545', // critical - red
              '#fd7e14', // high - orange
              '#ffc107', // medium - yellow
              '#28a745', // low - green
              '#6c757d', // unknown - gray
            ],
          },
        ],
      }
    : null;

  const pieChartOptions = {
    legend: {
      display: true,
      position: 'right',
    },
  };

  const getRiskBadge = (risk) => {
    const colors = {
      critical: 'danger',
      high: 'warning',
      medium: 'info',
      low: 'success',
      unknown: 'secondary',
    };
    return <Badge color={colors[risk] || 'secondary'}>{risk.toUpperCase()}</Badge>;
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <h4 className="title">Port Intelligence</h4>
              <p className="category">Port identification and risk assessment</p>
            </CardHeader>
            <CardBody>
              {/* Filters */}
              <Row className="mb-3">
                <Col md="4">
                  <FormGroup>
                    <Label>Phone Number (Optional)</Label>
                    <Input
                      type="text"
                      value={filters.phoneNumber}
                      onChange={(e) =>
                        setFilters({ ...filters, phoneNumber: e.target.value })
                      }
                      placeholder="Filter by phone number"
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

              {portData && (
                <>
                  {/* Summary */}
                  <Row className="mb-3">
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total Unique Ports</h6>
                          <h3>{portData.totalPorts}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Total Connections</h6>
                          <h3>{portData.totalConnections}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>Critical Risk</h6>
                          <h3 className="text-danger">
                            {portData.riskCategories.critical.length}
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="3">
                      <Card>
                        <CardBody>
                          <h6>High Risk</h6>
                          <h3 className="text-warning">
                            {portData.riskCategories.high.length}
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* Risk Category Chart */}
                  {categoryChartData && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>Port Category Distribution</h5>
                      </CardHeader>
                      <CardBody>
                        <Row>
                          <Col md="6">
                            <Pie data={categoryChartData} options={pieChartOptions} />
                          </Col>
                          <Col md="6">
                            <ListGroup>
                              {Object.entries(portData.riskCategories).map(
                                ([category, ports]) => (
                                  <ListGroupItem key={category}>
                                    <strong>
                                      {category.charAt(0).toUpperCase() +
                                        category.slice(1)}:
                                    </strong>{' '}
                                    {ports.length} ports
                                  </ListGroupItem>
                                )
                              )}
                            </ListGroup>
                          </Col>
                        </Row>
                      </CardBody>
                    </Card>
                  )}

                  {/* Critical/High Risk Alerts */}
                  {(portData.riskCategories.critical.length > 0 ||
                    portData.riskCategories.high.length > 0) && (
                    <Card className="mb-3">
                      <CardHeader>
                        <h5>
                          High Risk Port Alerts{' '}
                          <Badge color="danger">
                            {portData.riskCategories.critical.length +
                              portData.riskCategories.high.length}
                          </Badge>
                        </h5>
                      </CardHeader>
                      <CardBody>
                        <Alert color="danger">
                          <strong>Critical Risk Ports:</strong>
                          <ul>
                            {portData.riskCategories.critical.map((port, index) => (
                              <li key={index}>
                                Port {port.port} - {port.name} ({port.count}{' '}
                                connections)
                              </li>
                            ))}
                          </ul>
                        </Alert>
                        {portData.riskCategories.high.length > 0 && (
                          <Alert color="warning">
                            <strong>High Risk Ports:</strong>
                            <ul>
                              {portData.riskCategories.high
                                .slice(0, 10)
                                .map((port, index) => (
                                  <li key={index}>
                                    Port {port.port} - {port.name} ({port.count}{' '}
                                    connections)
                                  </li>
                                ))}
                            </ul>
                          </Alert>
                        )}
                      </CardBody>
                    </Card>
                  )}

                  {/* Port Details Table */}
                  <Card>
                    <CardHeader>
                      <h5>Port Details</h5>
                    </CardHeader>
                    <CardBody>
                      <Table responsive>
                        <thead>
                          <tr>
                            <th>Port</th>
                            <th>Service Name</th>
                            <th>Category</th>
                            <th>Connections</th>
                            <th>Risk Level</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portData.portDetails.slice(0, 50).map((port, index) => (
                            <tr key={index}>
                              <td>
                                <code>{port.port}</code>
                              </td>
                              <td>{port.name}</td>
                              <td>{port.category}</td>
                              <td>{port.count}</td>
                              <td>{getRiskBadge(port.risk)}</td>
                              <td>
                                <small className="text-muted">
                                  {port.risk === 'critical' &&
                                    '⚠️ Potential security threat'}
                                  {port.risk === 'high' &&
                                    '⚠️ Requires investigation'}
                                  {port.risk === 'medium' &&
                                    'Monitor for unusual activity'}
                                  {port.risk === 'low' && 'Normal traffic'}
                                </small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </CardBody>
                  </Card>
                </>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PortIntelligence;

