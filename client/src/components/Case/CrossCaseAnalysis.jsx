import config from "config";
import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Row,
  Col,
  Table,
  Badge,
  Button,
  Input,
  FormGroup,
  Label,
  Spinner,
  Alert,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane
} from 'reactstrap';

const CrossCaseAnalysis = () => {
  const [activeTab, setActiveTab] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState(null);
  const [expandedCase, setExpandedCase] = useState(null);

  const toggleTab = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };

  const toggleCaseRecords = (caseNumber) => {
    setExpandedCase(expandedCase === caseNumber ? null : caseNumber);
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      alert('Please enter a search value');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const endpoint = activeTab === 'phone'
        ? `${config.BASE_URL}/api/case/cross-case/phone/${searchValue}`
        : `${config.BASE_URL}/api/case/cross-case/imei/${searchValue}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      setResults(data);
    } catch (error) {
      console.error('Error performing cross-case search:', error);
      alert('Error performing search');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h2">🔍 Cross-Case Analysis</CardTitle>
              <p className="category">Search for phone numbers or IMEIs across all cases</p>
            </CardHeader>
            <CardBody>
              {/* Tab Navigation */}
              <Nav tabs>
                <NavItem>
                  <NavLink
                    className={activeTab === 'phone' ? 'active' : ''}
                    onClick={() => toggleTab('phone')}
                    style={{ cursor: 'pointer' }}
                  >
                    📞 Phone Number Search
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={activeTab === 'imei' ? 'active' : ''}
                    onClick={() => toggleTab('imei')}
                    style={{ cursor: 'pointer' }}
                  >
                    📱 IMEI Search
                  </NavLink>
                </NavItem>
              </Nav>

              <TabContent activeTab={activeTab} className="mt-4">
                <TabPane tabId="phone">
                  <Row>
                    <Col md="8">
                      <FormGroup>
                        <Label><strong>Enter Phone Number (10 digits)</strong></Label>
                        <Input
                          type="text"
                          placeholder="e.g., 9876543210"
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          onKeyPress={handleKeyPress}
                          maxLength="10"
                        />
                      </FormGroup>
                    </Col>
                    <Col md="4">
                      <FormGroup>
                        <Label>&nbsp;</Label>
                        <Button
                          color="primary"
                          block
                          onClick={handleSearch}
                          disabled={loading}
                        >
                          {loading ? <Spinner size="sm" /> : 'Search'}
                        </Button>
                      </FormGroup>
                    </Col>
                  </Row>
                </TabPane>

                <TabPane tabId="imei">
                  <Row>
                    <Col md="8">
                      <FormGroup>
                        <Label><strong>Enter IMEI (15 digits)</strong></Label>
                        <Input
                          type="text"
                          placeholder="e.g., 123456789012345"
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          onKeyPress={handleKeyPress}
                          maxLength="15"
                        />
                      </FormGroup>
                    </Col>
                    <Col md="4">
                      <FormGroup>
                        <Label>&nbsp;</Label>
                        <Button
                          color="primary"
                          block
                          onClick={handleSearch}
                          disabled={loading}
                        >
                          {loading ? <Spinner size="sm" /> : 'Search'}
                        </Button>
                      </FormGroup>
                    </Col>
                  </Row>
                </TabPane>
              </TabContent>

              {/* Results */}
              {loading && (
                <div className="text-center mt-4">
                  <Spinner color="primary" size="lg" />
                  <p className="mt-3">Searching across all cases...</p>
                </div>
              )}

              {results && !loading && (
                <>
                  {/* Summary */}
                  <Row className="mt-4">
                    <Col md="4">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">
                            {activeTab === 'phone' ? 'Phone Number' : 'IMEI'}
                          </p>
                          <h3 className="card-title">
                            <code>{activeTab === 'phone' ? results.phoneNumber : results.imei}</code>
                          </h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="4">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">Cases Found</p>
                          <h3 className="card-title text-warning">{results.totalCases}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md="4">
                      <Card className="card-stats">
                        <CardBody>
                          <p className="card-category">Total CDR Records</p>
                          <h3 className="card-title text-info">{results.totalCDRs}</h3>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>

                  {/* IMEI-specific: Phone Numbers */}
                  {activeTab === 'imei' && results.phoneNumbers && (
                    <Row>
                      <Col md="12">
                        <Card>
                          <CardHeader>
                            <CardTitle tag="h4">📞 Phone Numbers Using This IMEI</CardTitle>
                          </CardHeader>
                          <CardBody>
                            <div>
                              {results.phoneNumbers.map((num, idx) => (
                                <Badge key={idx} color="info" className="mr-2 mb-2" style={{ fontSize: '14px', padding: '8px 12px' }}>
                                  {num}
                                </Badge>
                              ))}
                            </div>
                            {results.phoneNumbers.length > 1 && (
                              <Alert color="danger" className="mt-3">
                                <strong>⚠️ SIM SWAP DETECTED:</strong> This IMEI has been used with {results.phoneNumbers.length} different phone numbers!
                              </Alert>
                            )}
                          </CardBody>
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {/* Case Details */}
                  {results.caseAnalysis && results.caseAnalysis.length > 0 ? (
                    <Row>
                      <Col md="12">
                        <Card>
                          <CardHeader>
                            <CardTitle tag="h4">📁 Cases Involving This {activeTab === 'phone' ? 'Number' : 'IMEI'}</CardTitle>
                          </CardHeader>
                          <CardBody>
                            {results.caseAnalysis.map((caseData, idx) => (
                              <Card key={idx} className="mb-3" style={{ borderLeft: '4px solid #1d8cf8' }}>
                                <CardBody>
                                  <Row>
                                    <Col md="8">
                                      <h4>{caseData.caseDetails.caseName}</h4>
                                      <p className="mb-1">
                                        <strong>Case Number:</strong> <code>{caseData.caseDetails.caseNumber}</code>
                                      </p>
                                      <p className="mb-1">
                                        <strong>FIR Number:</strong> {caseData.caseDetails.firNumber}
                                      </p>
                                      <p className="mb-1">
                                        <strong>Location:</strong> {caseData.caseDetails.policeStation}, {caseData.caseDetails.district}, {caseData.caseDetails.state}
                                      </p>
                                      <p className="mb-1">
                                        <strong>Year:</strong> {caseData.caseDetails.year}
                                      </p>
                                      {caseData.caseDetails.investigatingOfficer && (
                                        <p className="mb-1">
                                          <strong>Investigating Officer:</strong> {caseData.caseDetails.investigatingOfficer}
                                        </p>
                                      )}
                                    </Col>
                                    <Col md="4">
                                      <Badge color="primary" className="badge-lg mb-2 d-block">
                                        Status: {caseData.caseDetails.status}
                                      </Badge>
                                      <Badge color="info" className="badge-lg mb-2 d-block">
                                        CDR Records: {caseData.cdrCount}
                                      </Badge>
                                      {activeTab === 'imei' && caseData.phoneNumbers && (
                                        <div className="mt-2">
                                          <small><strong>Phone Numbers in this case:</strong></small>
                                          <div>
                                            {caseData.phoneNumbers.map((num, i) => (
                                              <Badge key={i} color="success" className="mr-1 mt-1">
                                                {num}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </Col>
                                  </Row>
                                  <Row className="mt-3">
                                    <Col md="6">
                                      <small className="text-muted">
                                        <strong>First Activity:</strong> {new Date(caseData.firstActivity).toLocaleString()}
                                      </small>
                                    </Col>
                                    <Col md="6">
                                      <small className="text-muted">
                                        <strong>Last Activity:</strong> {new Date(caseData.lastActivity).toLocaleString()}
                                      </small>
                                    </Col>
                                  </Row>
                                  
                                  {/* View Records Button */}
                                  <Row className="mt-3">
                                    <Col md="12">
                                      <Button 
                                        color="primary" 
                                        size="sm"
                                        onClick={() => toggleCaseRecords(caseData.caseDetails.caseNumber)}
                                      >
                                        {expandedCase === caseData.caseDetails.caseNumber ? '📊 Hide CDR Records' : '📊 View CDR Records'}
                                      </Button>
                                    </Col>
                                  </Row>

                                  {/* CDR Records Table */}
                                  {expandedCase === caseData.caseDetails.caseNumber && caseData.cdrs && (
                                    <Row className="mt-3">
                                      <Col md="12">
                                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                          <Table responsive striped size="sm">
                                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e1e2f', zIndex: 1 }}>
                                              <tr>
                                                <th>#</th>
                                                <th>Date/Time</th>
                                                <th>Caller</th>
                                                <th>Called</th>
                                                <th>Type</th>
                                                <th>Duration</th>
                                                <th>Location</th>
                                                <th>IMEI</th>
                                                <th>Network</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {caseData.cdrs.map((record, recordIdx) => (
                                                <tr key={recordIdx}>
                                                  <td>{recordIdx + 1}</td>
                                                  <td>
                                                    <small>{new Date(record.startTime).toLocaleString()}</small>
                                                  </td>
                                                  <td>
                                                    <code style={{ fontSize: '11px' }}>{record.callerNumber}</code>
                                                  </td>
                                                  <td>
                                                    <code style={{ fontSize: '11px' }}>{record.calledNumber}</code>
                                                  </td>
                                                  <td>
                                                    <Badge 
                                                      color={
                                                        record.callType?.includes('SMS') ? 'info' :
                                                        record.callType?.includes('OUT') ? 'warning' :
                                                        record.callType?.includes('IN') ? 'success' :
                                                        'secondary'
                                                      }
                                                      style={{ fontSize: '10px' }}
                                                    >
                                                      {record.callType}
                                                    </Badge>
                                                  </td>
                                                  <td>
                                                    {record.callDuration ? 
                                                      `${Math.floor(record.callDuration / 60)}m ${record.callDuration % 60}s` : 
                                                      '-'
                                                    }
                                                  </td>
                                                  <td>
                                                    <small>{record.originCellID || '-'}</small>
                                                  </td>
                                                  <td>
                                                    <code style={{ fontSize: '10px' }}>{record.imei || '-'}</code>
                                                  </td>
                                                  <td>
                                                    <small>{record.networkCircle || record.connectionType || record.accessType || '-'}</small>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </Table>
                                        </div>
                                      </Col>
                                    </Row>
                                  )}
                                </CardBody>
                              </Card>
                            ))}
                          </CardBody>
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <Alert color="warning" className="mt-4">
                      No cases found for this {activeTab === 'phone' ? 'phone number' : 'IMEI'}.
                    </Alert>
                  )}
                </>
              )}

              {!results && !loading && (
                <Alert color="info" className="mt-4">
                  Enter a {activeTab === 'phone' ? 'phone number' : 'IMEI'} above to search across all cases.
                </Alert>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CrossCaseAnalysis;
