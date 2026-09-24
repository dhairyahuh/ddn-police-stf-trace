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
// nodejs library that concatenates classes
import classNames from "classnames";
// react plugin used to create charts
import { Line, Bar, Pie, Doughnut } from "react-chartjs-2";
import { Map as LeafletMap, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// reactstrap components
import {
  Button,
  ButtonGroup,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
  Row,
  Col,
  Badge,
  Progress,
} from "reactstrap";

// core components
import {
  chartExample1,
  chartExample2,
  chartExample3,
  chartExample4,
  graphDataFormat,
  pieExample
} from "variables/charts.js";

const config = require("../config.js")

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    let cdrCounts = []
    let ipdrCounts = [11,21,31,41,15,6,1,0,0,0,0,0]
    let smsCounts = [11,5,35,42,25,36,5,0,0,0,0,0]
    let highestCallers = [
      {caller : "Ram", duration : 53},
      {caller :  "Sandhya", duration : 20},
      {caller :  "9874561230", duration : 110},
      {caller :  "Hrishi", duration : 80},
      {caller :  "9874563211", duration : 100}
    ]

    for(let i = 1; i <= 12; ++i){
      cdrCounts.push(0)
      ipdrCounts.push(0)
    }

    this.state = {
      bigChartData: "data1",
      cdrCounts : cdrCounts,
      ipdrCounts : ipdrCounts,
      smsCounts: smsCounts,
      notes : [],
      cdrRecords : [],
      highestCallers : highestCallers,
      towerLocations: [], // For map visualization
      mapCenter: [28.6139, 77.2090], // Default to Delhi
      mapZoom: 10
    };
    
    this._isMounted = false;
  }

  componentDidMount() {
    this._isMounted = true;
    
    // Getting the CDR Statistics
    fetch(`${config.BASE_URL}/api/cdr/getStatistics/`)
      .then(response => response.json())
      .then((data) => {
        if (this._isMounted) {
          console.log(data)
          this.setState({
            cdrCounts : data.cdrCounts,
            smsCounts : data.smsCounts,
            highestCallers : data.highestCallers
          })
        }
      })
      .catch((err) => console.log(err))

    // Get IPDR Data and update counts
    fetch(`${config.BASE_URL}/api/ipdr/getStatistics/`)
      .then(response => response.json())
      .then((data) => {
        if (this._isMounted) {
          this.setState({
            ipdrCounts : data.ipdrCounts
          })
        }
      })
      .catch((err) => console.log(err))

    // Getting all the notes stored in the DB
    fetch(`${config.BASE_URL}/api/note/getAllNotes/`)
    .then(response => response.json())
      .then((data) => {
        if (this._isMounted) {
          let allNotes = []
          for(let note of data.message){
            let src = note.srcNumber
            let dest = note.destNumber
            let subNotes = note.notes
            for(let i = 0; i < subNotes.length; i++){
              allNotes.push({
                title : "Src : " + src + ", Dest : " + dest,
                text : subNotes[i],
                noteId: note._id,
                srcNumber: src,
                destNumber: dest,
                noteIndex: i
              })
            }
          }
          this.setState({
            notes : allNotes
          })
        }
      })
      .catch((err) => console.log(err))

      // Getting all CDR records
    fetch(`${config.BASE_URL}/api/cdr/getAllRecords/`)
    .then(response => response.json())
      .then((data) => {
        if (this._isMounted) {
          let cdrData = []
          let towers = []
          let towerMap = new Map()
          
          for(let record of data){
            cdrData.push({
              callerNumber : record.callerNumber,
              calledNumber : record.calledNumber,
              callDuration : record.callDuration,
              callType : record.callType,
              startTime : record.startTime,
              cellId : record.cellId
            })
            
            // Collect tower locations for map
            if(record.cellLat && record.cellLon) {
              const towerKey = `${record.cellLat}-${record.cellLon}`
              if(!towerMap.has(towerKey)) {
                towers.push({
                  lat: parseFloat(record.cellLat),
                  lon: parseFloat(record.cellLon),
                  cellId: record.cellId,
                  count: 1
                })
                towerMap.set(towerKey, towers.length - 1)
              } else {
                towers[towerMap.get(towerKey)].count++
              }
            }
          }

          this.setState({
            cdrRecords : cdrData,
            towerLocations: towers,
            mapCenter: towers.length > 0 ? [towers[0].lat, towers[0].lon] : [28.6139, 77.2090]
          })
        }
      })
      .catch((err) => console.log(err))
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  // Handle note deletion
  handleDeleteNote = (srcNumber, destNumber, noteIndex) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    fetch(`${config.BASE_URL}/api/note/deleteSubNote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        srcNumber,
        destNumber,
        noteIndex
      })
    })
    .then(response => response.json())
    .then((data) => {
      if (data.code === 200) {
        // Remove the deleted note from state
        const updatedNotes = this.state.notes.filter((note, idx) => {
          return !(note.srcNumber === srcNumber && 
                   note.destNumber === destNumber && 
                   note.noteIndex === noteIndex);
        });
        this.setState({ notes: updatedNotes });
        alert('Note deleted successfully');
      } else {
        alert('Error deleting note: ' + data.message);
      }
    })
    .catch((err) => {
      console.error('Error deleting note:', err);
      alert('Failed to delete note');
    });
  }

  // Handle view note in case context
  handleViewNote = (srcNumber, destNumber) => {
    // Navigate to CDR Analysis page with numbers
    this.props.history.push({
      pathname: '/admin/cdr-analysis',
      state: { srcNumber, destNumber }
    });
  }

  setBgChartData = name => {
    this.setState({
      bigChartData: name
    });
  };
  render() {
    let graphData = Object.assign({}, graphDataFormat)
    let callDurationData = Object.assign({}, chartExample3.data)

    // Splitting highest callers into labels and durations
    let highestLabels = []
    let highestDurations = []
    let totalCallDuration = 0
    for(let highestCaller of this.state.highestCallers){
      highestLabels.push(highestCaller.caller)
      highestDurations.push(highestCaller.duration)
      totalCallDuration += highestCaller.duration
    }
    callDurationData.labels = highestLabels
    callDurationData.datasets[0].data = highestDurations 

    // Getting the graph data
    if(this.state.bigChartData === "data1"){      
      graphData.datasets[0].data = this.state.cdrCounts
    }else if(this.state.bigChartData === "data2"){
      graphData.datasets[0].data = this.state.ipdrCounts
    }else if(this.state.bigChartData === "data3"){
      graphData.datasets[0].data = this.state.smsCounts
    }

    // Calculate statistics
    const totalCalls = this.state.cdrCounts.reduce((a,b) => a+b, 0)
    const totalIPDR = this.state.ipdrCounts.reduce((a,b) => a+b, 0)
    const totalSMS = this.state.smsCounts.reduce((a,b) => a+b, 0)
    const totalRecords = this.state.cdrRecords.length
    const numNotes = this.state.notes.length

    // Activity distribution for pie chart
    const activityData = {
      labels: ["Voice Calls", "SMS", "Data Sessions"],
      datasets: [{
        data: [totalCalls, totalSMS, totalIPDR],
        backgroundColor: ['#1f8ef1', '#00d6b4', '#fd5d93'],
        hoverBackgroundColor: ['#1f8ef1', '#00d6b4', '#fd5d93']
      }]
    }

    const pieOptions = {
      maintainAspectRatio: false,
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          fontColor: '#9a9a9a',
          fontSize: 11
        }
      },
      tooltips: {
        backgroundColor: '#27293d',
        titleFontColor: '#fff',
        bodyFontColor: '#fff',
        bodySpacing: 4,
        yPadding: 12,
        xPadding: 12,
        mode: 'nearest',
        intersect: 0,
        position: 'nearest'
      }
    }

    // Creating all the note components
    let notes = this.state.notes
    let key = 0
    const createNote = (note) => {
      key += 1
      return (
        <tr key={key}>
          <td>
            <p className="title mb-1" style={{fontSize: '13px', fontWeight: '500'}}> {note.title} </p>
            <p className="text-muted mb-0" style={{fontSize: '12px'}}>
              {note.text}
            </p>
          </td>
          <td className="text-right" style={{verticalAlign: 'middle'}}>
            <Button 
              color="link" 
              className="btn-link-info" 
              size="sm" 
              title="View in Case"
              onClick={() => this.handleViewNote(note.srcNumber, note.destNumber)}
            >
              <i className="tim-icons icon-zoom-split" />
            </Button>
            <Button 
              color="link" 
              className="btn-link-danger" 
              size="sm" 
              title="Delete Note"
              onClick={() => this.handleDeleteNote(note.srcNumber, note.destNumber, note.noteIndex)}
            >
              <i className="tim-icons icon-trash-simple" />
            </Button>
          </td>
        </tr> 
      );
    }

    // Creating a note component for each note
    let noteComponents = notes.map(createNote)

    // Creating all the CDR record component
    let records = this.state.cdrRecords.slice(0, 10) // Show only first 10 for clean dashboard
    function createCDRRecord (record){
      key += 1
      return (
        <tr key={key}>
          <td style={{fontSize: '12px'}}>{record.callerNumber || 'N/A'}</td>
          <td style={{fontSize: '12px'}}>{record.calledNumber || 'N/A'}</td>
          <td style={{fontSize: '12px', fontWeight: '500'}}>{record.callDuration || 0}s</td>
          <td className="text-center">
            <Badge 
              color={record.callType === 'Incoming' ? 'success' : record.callType === 'Outgoing' ? 'info' : 'warning'}
              style={{fontSize: '10px', padding: '4px 8px'}}
            >
              {record.callType || 'Unknown'}
            </Badge>
          </td>
          <td style={{fontSize: '11px', color: '#9a9a9a'}}>
            {record.startTime ? new Date(record.startTime).toLocaleString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'N/A'}
          </td>
        </tr>
      )
    }
    
    let recordComponents = records.map(createCDRRecord)

    return (
      <>
        <div className="content">
          {/* Key Metrics Cards */}
          <Row>
            <Col lg="3" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="5">
                      <div className="info-icon text-center icon-primary">
                        <i className="tim-icons icon-phone-2" style={{fontSize: '2.5rem'}} />
                      </div>
                    </Col>
                    <Col xs="7">
                      <div className="numbers">
                        <p className="card-category" style={{fontSize: '11px', marginBottom: '5px'}}>Total Calls</p>
                        <CardTitle tag="h3" style={{fontSize: '28px', fontWeight: '600', marginBottom: '0'}}>
                          {totalCalls.toLocaleString()}
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            <Col lg="3" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="5">
                      <div className="info-icon text-center icon-success">
                        <i className="tim-icons icon-email-85" style={{fontSize: '2.5rem'}} />
                      </div>
                    </Col>
                    <Col xs="7">
                      <div className="numbers">
                        <p className="card-category" style={{fontSize: '11px', marginBottom: '5px'}}>Total SMS</p>
                        <CardTitle tag="h3" style={{fontSize: '28px', fontWeight: '600', marginBottom: '0'}}>
                          {totalSMS.toLocaleString()}
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            <Col lg="3" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="5">
                      <div className="info-icon text-center icon-warning">
                        <i className="tim-icons icon-wifi" style={{fontSize: '2.5rem'}} />
                      </div>
                    </Col>
                    <Col xs="7">
                      <div className="numbers">
                        <p className="card-category" style={{fontSize: '11px', marginBottom: '5px'}}>Data Sessions</p>
                        <CardTitle tag="h3" style={{fontSize: '28px', fontWeight: '600', marginBottom: '0'}}>
                          {totalIPDR.toLocaleString()}
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
            <Col lg="3" md="6">
              <Card className="card-stats">
                <CardBody>
                  <Row>
                    <Col xs="5">
                      <div className="info-icon text-center icon-danger">
                        <i className="tim-icons icon-notes" style={{fontSize: '2.5rem'}} />
                      </div>
                    </Col>
                    <Col xs="7">
                      <div className="numbers">
                        <p className="card-category" style={{fontSize: '11px', marginBottom: '5px'}}>Active Notes</p>
                        <CardTitle tag="h3" style={{fontSize: '28px', fontWeight: '600', marginBottom: '0'}}>
                          {numNotes}
                        </CardTitle>
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Main Chart */}
          <Row>
            <Col xs="12">
              <Card className="card-chart">
                <CardHeader>
                  <Row>
                    <Col className="text-left" sm="6">
                      <h5 className="card-category" style={{fontSize: '12px', color: '#9a9a9a'}}>
                        Monthly Overview
                      </h5>
                      <CardTitle tag="h2" style={{fontSize: '24px', fontWeight: '300', marginTop: '5px'}}>
                        Communication Analytics
                      </CardTitle>
                    </Col>
                    <Col sm="6">
                      <ButtonGroup
                        className="btn-group-toggle float-right"
                        data-toggle="buttons"
                      >
                        <Button
                          tag="label"
                          className={classNames("btn-simple", {
                            active: this.state.bigChartData === "data1"
                          })}
                          color="info"
                          id="0"
                          size="sm"
                          onClick={() => this.setBgChartData("data1")}
                        >
                          <span className="d-none d-sm-block d-md-block d-lg-block d-xl-block">
                            CALLS
                          </span>
                          <span className="d-block d-sm-none">
                            <i className="tim-icons icon-single-02" />
                          </span>
                        </Button>
                        <Button
                          color="info"
                          id="1"
                          size="sm"
                          tag="label"
                          className={classNames("btn-simple", {
                            active: this.state.bigChartData === "data2"
                          })}
                          onClick={() => this.setBgChartData("data2")}
                        >
                          <span className="d-none d-sm-block d-md-block d-lg-block d-xl-block">
                            IPDR
                          </span>
                          <span className="d-block d-sm-none">
                            <i className="tim-icons icon-gift-2" />
                          </span>
                        </Button>
                        <Button
                          color="info"
                          id="2"
                          size="sm"
                          tag="label"
                          className={classNames("btn-simple", {
                            active: this.state.bigChartData === "data3"
                          })}
                          onClick={() => this.setBgChartData("data3")}
                        >
                          <span className="d-none d-sm-block d-md-block d-lg-block d-xl-block">
                            SMS
                          </span>
                          <span className="d-block d-sm-none">
                            <i className="tim-icons icon-tap-02" />
                          </span>
                        </Button>
                      </ButtonGroup>
                    </Col>
                  </Row>
                </CardHeader>
                <CardBody>
                  <div className="chart-area" style={{height: '280px'}}>
                    <Line
                      data={graphData}
                      options={chartExample1.options}
                    />
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Middle Row: Map + Activity Distribution */}
          <Row>
            <Col lg="8" md="12">
              <Card className="card-chart" style={{minHeight: '420px'}}>
                <CardHeader>
                  <Row>
                    <Col sm="6">
                      <h5 className="card-category" style={{fontSize: '12px', color: '#9a9a9a'}}>
                        Geographic Activity
                      </h5>
                      <CardTitle tag="h3" style={{fontSize: '18px', fontWeight: '400'}}>
                        <i className="tim-icons icon-square-pin text-info" />{" "}
                        Cell Tower Locations ({this.state.towerLocations.length} towers)
                      </CardTitle>
                    </Col>
                  </Row>
                </CardHeader>
                <CardBody style={{padding: '0'}}>
                  {this.state.towerLocations.length > 0 ? (
                    <LeafletMap
                      center={this.state.mapCenter}
                      zoom={this.state.mapZoom}
                      style={{ height: '350px', width: '100%', zIndex: 1 }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      {this.state.towerLocations.map((tower, idx) => (
                        <React.Fragment key={idx}>
                          <Circle
                            center={[tower.lat, tower.lon]}
                            radius={tower.count * 100}
                            fillColor="#1f8ef1"
                            fillOpacity={0.2}
                            color="#1f8ef1"
                            weight={2}
                          />
                          <Marker position={[tower.lat, tower.lon]}>
                            <Popup>
                              <strong>Cell ID: {tower.cellId}</strong><br/>
                              Activity Count: {tower.count}<br/>
                              Location: {tower.lat.toFixed(4)}, {tower.lon.toFixed(4)}
                            </Popup>
                          </Marker>
                        </React.Fragment>
                      ))}
                    </LeafletMap>
                  ) : (
                    <div className="text-center p-5" style={{height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <div>
                        <i className="tim-icons icon-square-pin" style={{fontSize: '4rem', opacity: 0.3}} />
                        <p className="text-muted mt-3" style={{fontSize: '14px'}}>
                          No tower location data available.<br/>
                          Upload CDR files with cell tower coordinates.
                        </p>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
            <Col lg="4" md="12">
              <Card className="card-chart" style={{minHeight: '420px'}}>
                <CardHeader>
                  <h5 className="card-category" style={{fontSize: '12px', color: '#9a9a9a'}}>
                    Communication Distribution
                  </h5>
                  <CardTitle tag="h3" style={{fontSize: '18px', fontWeight: '400'}}>
                    <i className="tim-icons icon-chart-pie-36 text-success" />{" "}
                    Activity Breakdown
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <div style={{height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    {(totalCalls + totalSMS + totalIPDR) > 0 ? (
                      <Pie
                        data={activityData}
                        options={pieOptions}
                      />
                    ) : (
                      <div className="text-center">
                        <i className="tim-icons icon-chart-pie-36" style={{fontSize: '3rem', opacity: 0.3}} />
                        <p className="text-muted mt-3" style={{fontSize: '13px'}}>
                          No activity data available
                        </p>
                      </div>
                    )}
                  </div>
                  {(totalCalls + totalSMS + totalIPDR) > 0 && (
                    <div className="mt-3" style={{borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px'}}>
                      <div className="d-flex justify-content-between mb-2">
                        <span style={{fontSize: '12px'}}>Voice Calls</span>
                        <span style={{fontSize: '12px', fontWeight: '600'}}>
                          {((totalCalls / (totalCalls + totalSMS + totalIPDR)) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={(totalCalls / (totalCalls + totalSMS + totalIPDR)) * 100}
                        color="info"
                        style={{height: '5px'}}
                      />
                      <div className="d-flex justify-content-between mb-2 mt-3">
                        <span style={{fontSize: '12px'}}>SMS Messages</span>
                        <span style={{fontSize: '12px', fontWeight: '600'}}>
                          {((totalSMS / (totalCalls + totalSMS + totalIPDR)) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={(totalSMS / (totalCalls + totalSMS + totalIPDR)) * 100}
                        color="success"
                        style={{height: '5px'}}
                      />
                      <div className="d-flex justify-content-between mb-2 mt-3">
                        <span style={{fontSize: '12px'}}>Data Usage</span>
                        <span style={{fontSize: '12px', fontWeight: '600'}}>
                          {((totalIPDR / (totalCalls + totalSMS + totalIPDR)) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={(totalIPDR / (totalCalls + totalSMS + totalIPDR)) * 100}
                        color="warning"
                        style={{height: '5px'}}
                      />
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Bottom Row: Top Callers + Recent Records */}
          <Row>
            <Col lg="5" md="12">
              <Card className="card-chart">
                <CardHeader>
                  <h5 className="card-category" style={{fontSize: '12px', color: '#9a9a9a'}}>
                    Call Duration Analysis
                  </h5>
                  <CardTitle tag="h3" style={{fontSize: '18px', fontWeight: '400'}}>
                    <i className="tim-icons icon-chat-33 text-primary" />{" "}
                    Top Contacts ({totalCallDuration} mins total)
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="chart-area" style={{height: '220px'}}>
                    {this.state.highestCallers.length > 0 ? (
                      <Bar
                        data={callDurationData}
                        options={chartExample3.options}
                      />
                    ) : (
                      <div className="text-center" style={{paddingTop: '60px'}}>
                        <i className="tim-icons icon-chat-33" style={{fontSize: '3rem', opacity: 0.3}} />
                        <p className="text-muted mt-3" style={{fontSize: '13px'}}>
                          No call data available
                        </p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col lg="7" md="12">
              <Card style={{minHeight: '335px'}}>
                <CardHeader>
                  <Row>
                    <Col sm="6">
                      <CardTitle tag="h4" style={{fontSize: '16px', fontWeight: '500', marginBottom: '5px'}}>
                        Recent Call Records
                      </CardTitle>
                      <p className="card-category" style={{fontSize: '11px', color: '#9a9a9a'}}>
                        Latest {records.length} activities
                      </p>
                    </Col>
                    <Col sm="6" className="text-right">
                      <Button color="link" className="btn-link-primary" size="sm" href="#/admin/cdr-analysis">
                        View All <i className="tim-icons icon-minimal-right" />
                      </Button>
                    </Col>
                  </Row>
                </CardHeader>
                <CardBody style={{padding: '0 15px 15px'}}>
                  {this.state.cdrRecords.length === 0 ? (
                    <div className="text-center text-muted p-4">
                      <i className="tim-icons icon-phone-2" style={{fontSize: '3rem', opacity: 0.3}} />
                      <p className="mt-3" style={{fontSize: '13px'}}>
                        No CDR data available. Upload CDR files to get started.
                      </p>
                    </div>
                  ) : (
                    <Table className="tablesorter" responsive hover>
                      <thead className="text-primary">
                        <tr>
                          <th style={{fontSize: '11px', fontWeight: '600'}}>Caller</th>
                          <th style={{fontSize: '11px', fontWeight: '600'}}>Called</th>
                          <th style={{fontSize: '11px', fontWeight: '600'}}>Duration</th>
                          <th className="text-center" style={{fontSize: '11px', fontWeight: '600'}}>Type</th>
                          <th style={{fontSize: '11px', fontWeight: '600'}}>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recordComponents}
                      </tbody>
                    </Table>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Investigation Notes */}
          {numNotes > 0 && (
            <Row>
              <Col xs="12">
                <Card className="card-tasks">
                  <CardHeader>
                    <Row>
                      <Col sm="6">
                        <h6 className="title d-inline" style={{fontSize: '16px', fontWeight: '500'}}>
                          Investigation Notes
                        </h6>
                        <Badge color="info" pill className="ml-2">{numNotes}</Badge>
                        <p className="card-category d-inline ml-3" style={{fontSize: '11px', color: '#9a9a9a'}}>
                          Latest Activity
                        </p>
                      </Col>
                      <Col sm="6" className="text-right">
                        <Button color="link" className="btn-link-primary" size="sm">
                          Manage Notes <i className="tim-icons icon-minimal-right" />
                        </Button>
                      </Col>
                    </Row>
                  </CardHeader>
                  <CardBody style={{maxHeight: '350px', overflow: 'auto'}}>
                    <div className="table-full-width">
                      <Table hover>
                        <tbody>
                          {noteComponents}
                        </tbody>
                      </Table>
                    </div>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          )}
        </div>
      </>
    );
  }
}

export default Dashboard;
