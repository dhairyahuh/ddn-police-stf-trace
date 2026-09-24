import React, { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Row,
  Col
} from 'reactstrap';
import classnames from 'classnames';

// Import analytics components
import MovementMap from '../components/analytics/MovementMap';
import SIMSwapDetector from '../components/analytics/SIMSwapDetector';
import CallPatternAnalyzer from '../components/analytics/CallPatternAnalyzer';
import PortIntelligence from '../components/analytics/PortIntelligence';
import WhatsAppCorrelation from '../components/analytics/WhatsAppCorrelation';

const Analytics = () => {
  const [activeTab, setActiveTab] = useState('1');

  const toggle = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };

  return (
    <div className="content">
      <Row>
        <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h2">Advanced Analytics Dashboard</CardTitle>
              <p className="text-muted">
                Comprehensive analysis tools for CDR and IPDR data intelligence
              </p>
            </CardHeader>
            <CardBody>
              <Nav tabs>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '1' })}
                    onClick={() => { toggle('1'); }}
                  >
                    <i className="tim-icons icon-square-pin"></i> Movement Reconstruction
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '2' })}
                    onClick={() => { toggle('2'); }}
                  >
                    <i className="tim-icons icon-refresh-01"></i> SIM Swap Detection
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '3' })}
                    onClick={() => { toggle('3'); }}
                  >
                    <i className="tim-icons icon-chart-bar-32"></i> Call Pattern Analysis
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '4' })}
                    onClick={() => { toggle('4'); }}
                  >
                    <i className="tim-icons icon-lock-circle"></i> Port Intelligence
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    className={classnames({ active: activeTab === '5' })}
                    onClick={() => { toggle('5'); }}
                  >
                    <i className="tim-icons icon-chat-33"></i> WhatsApp Correlation
                  </NavLink>
                </NavItem>
              </Nav>

              <TabContent activeTab={activeTab}>
                <TabPane tabId="1">
                  <MovementMap />
                </TabPane>
                <TabPane tabId="2">
                  <SIMSwapDetector />
                </TabPane>
                <TabPane tabId="3">
                  <CallPatternAnalyzer />
                </TabPane>
                <TabPane tabId="4">
                  <PortIntelligence />
                </TabPane>
                <TabPane tabId="5">
                  <WhatsAppCorrelation />
                </TabPane>
              </TabContent>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* Analytics Overview Cards */}
      <Row className="mt-4">
        <Col lg="3" md="6" sm="6">
          <Card className="card-stats">
            <CardBody>
              <Row>
                <div className="col-5 col-md-4">
                  <div className="icon-big text-center icon-warning">
                    <i className="tim-icons icon-square-pin text-success"></i>
                  </div>
                </div>
                <div className="col-7 col-md-8">
                  <div className="numbers">
                    <p className="card-category">Movement Tracking</p>
                    <CardTitle tag="p">Real-time Location Analysis</CardTitle>
                    <p />
                  </div>
                </div>
              </Row>
            </CardBody>
          </Card>
        </Col>
        <Col lg="3" md="6" sm="6">
          <Card className="card-stats">
            <CardBody>
              <Row>
                <div className="col-5 col-md-4">
                  <div className="icon-big text-center icon-warning">
                    <i className="tim-icons icon-refresh-01 text-info"></i>
                  </div>
                </div>
                <div className="col-7 col-md-8">
                  <div className="numbers">
                    <p className="card-category">SIM Security</p>
                    <CardTitle tag="p">Swap Detection Engine</CardTitle>
                    <p />
                  </div>
                </div>
              </Row>
            </CardBody>
          </Card>
        </Col>
        <Col lg="3" md="6" sm="6">
          <Card className="card-stats">
            <CardBody>
              <Row>
                <div className="col-5 col-md-4">
                  <div className="icon-big text-center icon-warning">
                    <i className="tim-icons icon-chart-bar-32 text-primary"></i>
                  </div>
                </div>
                <div className="col-7 col-md-8">
                  <div className="numbers">
                    <p className="card-category">Behavior Analysis</p>
                    <CardTitle tag="p">Pattern Recognition</CardTitle>
                    <p />
                  </div>
                </div>
              </Row>
            </CardBody>
          </Card>
        </Col>
        <Col lg="3" md="6" sm="6">
          <Card className="card-stats">
            <CardBody>
              <Row>
                <div className="col-5 col-md-4">
                  <div className="icon-big text-center icon-warning">
                    <i className="tim-icons icon-lock-circle text-warning"></i>
                  </div>
                </div>
                <div className="col-7 col-md-8">
                  <div className="numbers">
                    <p className="card-category">Network Security</p>
                    <CardTitle tag="p">Port Intelligence</CardTitle>
                    <p />
                  </div>
                </div>
              </Row>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;