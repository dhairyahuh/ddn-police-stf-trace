import config from "config";
import React, { useState, useEffect } from 'react';
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
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  Spinner,
  Alert
} from 'reactstrap';

const CaseManagement = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCase, setCurrentCase] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [formData, setFormData] = useState({
    caseName: '',
    firNumber: '',
    year: new Date().getFullYear(),
    policeStation: '',
    state: '',
    district: '',
    description: '',
    status: 'Open',
    investigatingOfficer: '',
    caseType: ''
  });

  useEffect(() => {
    loadCases();
    loadStatistics();
  }, []);

  const loadCases = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.BASE_URL}/api/case/all`);
      const data = await response.json();
      setCases(data);
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch(`${config.BASE_URL}/api/case/statistics`);
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const toggleModal = () => {
    setModal(!modal);
    if (modal) {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      caseName: '',
      firNumber: '',
      year: new Date().getFullYear(),
      policeStation: '',
      state: '',
      district: '',
      description: '',
      status: 'Open',
      investigatingOfficer: '',
      caseType: ''
    });
    setEditMode(false);
    setCurrentCase(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editMode
        ? `${config.BASE_URL}/api/case/${currentCase.caseNumber}`
        : `${config.BASE_URL}/api/case/create`;

      const method = editMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        toggleModal();
        loadCases();
        loadStatistics();
      } else {
        alert(data.message || 'Error saving case');
      }
    } catch (error) {
      console.error('Error saving case:', error);
      alert('Error saving case');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (caseData) => {
    setCurrentCase(caseData);
    setFormData({
      caseName: caseData.caseName,
      firNumber: caseData.firNumber,
      year: caseData.year,
      policeStation: caseData.policeStation,
      state: caseData.state,
      district: caseData.district,
      description: caseData.description || '',
      status: caseData.status,
      investigatingOfficer: caseData.investigatingOfficer || '',
      caseType: caseData.caseType || ''
    });
    setEditMode(true);
    setModal(true);
  };

  const handleDelete = async (caseNumber) => {
    if (!window.confirm('Are you sure you want to delete this case?')) {
      return;
    }

    try {
      const response = await fetch(`${config.BASE_URL}/api/case/${caseNumber}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        loadCases();
        loadStatistics();
      } else {
        alert(data.message || 'Error deleting case');
      }
    } catch (error) {
      console.error('Error deleting case:', error);
      alert('Error deleting case');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return 'success';
      case 'Under Investigation': return 'warning';
      case 'Closed': return 'secondary';
      case 'Pending': return 'info';
      default: return 'primary';
    }
  };

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <Row>
                <Col md="8">
                  <CardTitle tag="h2">📁 Case Management</CardTitle>
                  <p className="category">Manage criminal investigation cases</p>
                </Col>
                <Col md="4" className="text-right">
                  <Button color="primary" onClick={toggleModal}>
                    <i className="tim-icons icon-simple-add"></i> Create New Case
                  </Button>
                </Col>
              </Row>
            </CardHeader>
            <CardBody>
              {/* Statistics */}
              {statistics && (
                <Row className="mb-4">
                  <Col md="3">
                    <Card className="card-stats">
                      <CardBody>
                        <p className="card-category">Total Cases</p>
                        <h3 className="card-title">{statistics.totalCases}</h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card className="card-stats">
                      <CardBody>
                        <p className="card-category">Open Cases</p>
                        <h3 className="card-title text-success">{statistics.openCases}</h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card className="card-stats">
                      <CardBody>
                        <p className="card-category">Under Investigation</p>
                        <h3 className="card-title text-warning">{statistics.underInvestigation}</h3>
                      </CardBody>
                    </Card>
                  </Col>
                  <Col md="3">
                    <Card className="card-stats">
                      <CardBody>
                        <p className="card-category">Closed Cases</p>
                        <h3 className="card-title text-secondary">{statistics.closedCases}</h3>
                      </CardBody>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Cases Table */}
              {loading ? (
                <div className="text-center">
                  <Spinner color="primary" />
                  <p>Loading cases...</p>
                </div>
              ) : cases.length === 0 ? (
                <Alert color="info">
                  No cases found. Create your first case to get started.
                </Alert>
              ) : (
                <Table responsive>
                  <thead>
                    <tr>
                      <th>Case Number</th>
                      <th>Case Name</th>
                      <th>Case ID</th>
                      <th>FIR Number</th>
                      <th>Year</th>
                      <th>Police Station</th>
                      <th>State</th>
                      <th>District</th>
                      <th>Status</th>
                      <th>CDR Count</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((caseData, idx) => (
                      <tr key={idx}>
                        <td><strong>{caseData.caseNumber}</strong></td>
                        <td>{caseData.caseName}</td>
                        <td><code>{caseData.caseId}</code></td>
                        <td>{caseData.firNumber}</td>
                        <td>{caseData.year}</td>
                        <td>{caseData.policeStation}</td>
                        <td>{caseData.state}</td>
                        <td>{caseData.district}</td>
                        <td>
                          <Badge color={getStatusColor(caseData.status)}>
                            {caseData.status}
                          </Badge>
                        </td>
                        <td>
                          <Badge color="info">{caseData.cdrCount || 0}</Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            color="info"
                            onClick={() => handleEdit(caseData)}
                            className="mr-1"
                          >
                            <i className="tim-icons icon-pencil"></i>
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            onClick={() => handleDelete(caseData.caseNumber)}
                          >
                            <i className="tim-icons icon-trash-simple"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal isOpen={modal} toggle={toggleModal} size="lg">
        <ModalHeader toggle={toggleModal}>
          {editMode ? 'Edit Case' : 'Create New Case'}
        </ModalHeader>
        <Form onSubmit={handleSubmit}>
          <ModalBody>
            <Row>
              <Col md="12">
                <FormGroup>
                  <Label>Case Name *</Label>
                  <Input
                    type="text"
                    name="caseName"
                    value={formData.caseName}
                    onChange={handleInputChange}
                    required
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  />
                </FormGroup>
              </Col>
            </Row>

            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>FIR Number *</Label>
                  <Input
                    type="text"
                    name="firNumber"
                    value={formData.firNumber}
                    onChange={handleInputChange}
                    required
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Year *</Label>
                  <Input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    min="2000"
                    max={new Date().getFullYear() + 1}
                    required
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  />
                </FormGroup>
              </Col>
            </Row>

            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>State *</Label>
                  <Input
                    type="select"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  >
                    <option value="">Select State</option>
                    {indianStates.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>District *</Label>
                  <Input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleInputChange}
                    required
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  />
                </FormGroup>
              </Col>
            </Row>

            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>Police Station *</Label>
                  <Input
                    type="text"
                    name="policeStation"
                    value={formData.policeStation}
                    onChange={handleInputChange}
                    required
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Status</Label>
                  <Input
                    type="select"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  >
                    <option value="Open">Open</option>
                    <option value="Under Investigation">Under Investigation</option>
                    <option value="Pending">Pending</option>
                    <option value="Closed">Closed</option>
                  </Input>
                </FormGroup>
              </Col>
            </Row>

            <Row>
              <Col md="6">
                <FormGroup>
                  <Label>Investigating Officer</Label>
                  <Input
                    type="text"
                    name="investigatingOfficer"
                    value={formData.investigatingOfficer}
                    onChange={handleInputChange}
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label>Case Type</Label>
                  <Input
                    type="text"
                    name="caseType"
                    value={formData.caseType}
                    onChange={handleInputChange}
                    placeholder="e.g., Theft, Fraud, etc."
                    style={{ color: '#000', backgroundColor: '#fff' }}
                  />
                </FormGroup>
              </Col>
            </Row>

            <FormGroup>
              <Label>Description</Label>
              <Input
                type="textarea"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                style={{ color: '#000', backgroundColor: '#fff' }}
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={toggleModal}>Cancel</Button>
            <Button color="primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : editMode ? 'Update Case' : 'Create Case'}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    </div>
  );
};

export default CaseManagement;
