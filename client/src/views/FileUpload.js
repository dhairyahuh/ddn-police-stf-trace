/*!

=========================================================
* SancharNetra Portal v1.0.0
=========================================================

* Developed by: AlgoRhythm
* Copyright 2025 AlgoRhythm
* Licensed under MIT (https://github.com/creativetimofficial/black-dashboard-react/blob/master/LICENSE.md)

* Coded by AlgoRhythm

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import React from "react";
import FileUpload from "../components/FileUpload/FileUpload"
import axios from 'axios';
import config from '../config';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
  Row,
  Col,
  Badge,
  Alert
} from "reactstrap";

class Tables extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dbStatus: null,
      checkingDb: true
    };
  }

  componentDidMount() {
    this.checkDbStatus();
    // Check DB status every 5 seconds
    this.dbStatusInterval = setInterval(() => {
      this.checkDbStatus();
    }, 5000);
  }

  componentWillUnmount() {
    if (this.dbStatusInterval) {
      clearInterval(this.dbStatusInterval);
    }
  }

  checkDbStatus = () => {
    axios.get(`${config.BASE_URL}/db-status`)
      .then((response) => {
        this.setState({ 
          dbStatus: response.data,
          checkingDb: false 
        });
      })
      .catch((error) => {
        this.setState({ 
          dbStatus: { connected: false, status: 'error', error: error.message },
          checkingDb: false 
        });
      });
  }

  render() {
    const { dbStatus, checkingDb } = this.state;
    
    return (
      <>
        <div className="content">
          <Row>
            <Col md="12">
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">Data Upload</CardTitle>
                </CardHeader>
                <CardBody>
                  {/* Database Status Indicator */}
                  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#1e1e2e', borderRadius: '5px' }}>
                    <h6 style={{ color: '#fff', marginBottom: '10px' }}>Database Connection Status</h6>
                    {checkingDb ? (
                      <Badge color="warning">Checking connection...</Badge>
                    ) : dbStatus?.connected ? (
                      <div>
                        <Badge color="success" style={{ fontSize: '14px', padding: '5px 10px' }}>
                          ✓ Connected to MongoDB
                        </Badge>
                        <span style={{ color: '#aaa', marginLeft: '10px', fontSize: '12px' }}>
                          Database: {dbStatus.dbName || 'CDR_Visualizer'}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <Badge color="danger" style={{ fontSize: '14px', padding: '5px 10px' }}>
                          ✗ Database Not Connected
                        </Badge>
                        <Alert color="warning" style={{ marginTop: '10px', fontSize: '12px' }}>
                          Please make sure MongoDB is running. Start it with: <code>mongod</code> or <code>brew services start mongodb-community</code>
                        </Alert>
                      </div>
                    )}
                  </div>

                  <hr style={{ borderColor: '#2b3553', margin: '20px 0' }} />

                  <FileUpload name="CDR" apiEndPoint="/cdr/uploadCSV" />
                  <hr style={{ borderColor: '#2b3553', margin: '20px 0' }} />
                  <FileUpload name="IPDR" apiEndPoint="/ipdr/uploadCSV" />
                  <hr style={{ borderColor: '#2b3553', margin: '20px 0' }} />
                  <FileUpload name="Profile" apiEndPoint="/profile/uploadCSV" />
                </CardBody>
              </Card>
            </Col>
        </Row>
        </div>
      </>
    );
  }
}

export default Tables;
