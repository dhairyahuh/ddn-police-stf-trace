import config from "config";
import React, { useState, useEffect, useRef } from 'react';
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
  Spinner
} from 'reactstrap';
import { Line } from 'react-chartjs-2';

const MovementMap = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [movementData, setMovementData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    // Load Leaflet CSS and JS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
    script.onload = initializeMap;
    document.head.appendChild(script);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, []);

  const initializeMap = () => {
    if (mapRef.current && window.L && !mapInstance.current) {
      mapInstance.current = window.L.map(mapRef.current).setView([20.5937, 78.9629], 5); // India center
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance.current);
    }
  };

  const fetchMovementData = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`${config.BASE_URL}/api/analytics/movement/${phoneNumber}?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMovementData(data);
      
      if (data.movements.length > 0) {
        plotMovementOnMap(data.movements);
      }
    } catch (err) {
      setError(`Failed to fetch movement data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const plotMovementOnMap = (movements) => {
    if (!mapInstance.current || !window.L) return;

    // Clear existing layers
    mapInstance.current.eachLayer((layer) => {
      if (layer !== mapInstance.current._layers[Object.keys(mapInstance.current._layers)[0]]) {
        mapInstance.current.removeLayer(layer);
      }
    });

    const bounds = [];
    const colors = { high: 'green', medium: 'orange', low: 'red' };

    movements.forEach((movement, index) => {
      const { from, to, confidence, speed, distance } = movement;
      
      // Add markers
      const fromMarker = window.L.marker([from.lat, from.lng])
        .bindPopup(`
          <strong>Location ${index + 1}</strong><br/>
          Time: ${new Date(from.timestamp).toLocaleString()}<br/>
          Cell ID: ${from.cellId}
        `);
      
      const toMarker = window.L.marker([to.lat, to.lng])
        .bindPopup(`
          <strong>Location ${index + 2}</strong><br/>
          Time: ${new Date(to.timestamp).toLocaleString()}<br/>
          Cell ID: ${to.cellId}<br/>
          Speed: ${speed.toFixed(2)} km/h<br/>
          Distance: ${distance.toFixed(2)} km
        `);

      // Add line between points
      const line = window.L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: colors[confidence] || 'gray',
        weight: 3,
        opacity: 0.7
      }).bindPopup(`
        Speed: ${speed.toFixed(2)} km/h<br/>
        Confidence: ${confidence}<br/>
        Distance: ${distance.toFixed(2)} km
      `);

      fromMarker.addTo(mapInstance.current);
      toMarker.addTo(mapInstance.current);
      line.addTo(mapInstance.current);

      bounds.push([from.lat, from.lng]);
      bounds.push([to.lat, to.lng]);
    });

    if (bounds.length > 0) {
      mapInstance.current.fitBounds(bounds);
    }
  };

  const getSpeedChartData = () => {
    if (!movementData?.movements) return null;

    return {
      labels: movementData.movements.map((_, index) => `Movement ${index + 1}`),
      datasets: [{
        label: 'Speed (km/h)',
        data: movementData.movements.map(m => m.speed),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }]
    };
  };

  const getConfidenceBadgeColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'danger';
      default: return 'secondary';
    }
  };

  return (
    <div className="content">
      <Card>
        <CardHeader>
          <CardTitle tag="h4">Movement Reconstruction</CardTitle>
        </CardHeader>
        <CardBody>
          <Form>
            <div className="row">
              <div className="col-md-4">
                <FormGroup>
                  <Label>Phone Number</Label>
                  <Input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </FormGroup>
              </div>
              <div className="col-md-3">
                <FormGroup>
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </FormGroup>
              </div>
              <div className="col-md-3">
                <FormGroup>
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </FormGroup>
              </div>
              <div className="col-md-2">
                <FormGroup>
                  <Label>&nbsp;</Label>
                  <Button
                    color="primary"
                    onClick={fetchMovementData}
                    disabled={loading}
                    className="btn-block"
                  >
                    {loading ? <Spinner size="sm" /> : 'Analyze'}
                  </Button>
                </FormGroup>
              </div>
            </div>
          </Form>

          {error && <Alert color="danger">{error}</Alert>}

          {movementData && (
            <>
              <div className="row mt-4">
                <div className="col-md-8">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Movement Map</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <div
                        ref={mapRef}
                        style={{ height: '400px', width: '100%' }}
                      />
                      <div className="mt-2">
                        <small>
                          <Badge color="success">High Confidence</Badge>{' '}
                          <Badge color="warning">Medium Confidence</Badge>{' '}
                          <Badge color="danger">Low Confidence</Badge>
                        </small>
                      </div>
                    </CardBody>
                  </Card>
                </div>
                <div className="col-md-4">
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h5">Speed Analysis</CardTitle>
                    </CardHeader>
                    <CardBody>
                      {getSpeedChartData() && (
                        <Line data={getSpeedChartData()} options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Speed (km/h)'
                              }
                            }
                          }
                        }} />
                      )}
                    </CardBody>
                  </Card>
                </div>
              </div>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle tag="h5">Movement Details ({movementData.movements.length} movements from {movementData.totalRecords} records)</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table responsive>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Time</th>
                        <th>Distance (km)</th>
                        <th>Speed (km/h)</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementData.movements.map((movement, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>
                            {movement.from.lat.toFixed(6)}, {movement.from.lng.toFixed(6)}<br/>
                            <small>Cell: {movement.from.cellId}</small>
                          </td>
                          <td>
                            {movement.to.lat.toFixed(6)}, {movement.to.lng.toFixed(6)}<br/>
                            <small>Cell: {movement.to.cellId}</small>
                          </td>
                          <td>
                            {new Date(movement.from.timestamp).toLocaleString()}<br/>
                            → {new Date(movement.to.timestamp).toLocaleString()}
                          </td>
                          <td>{movement.distance.toFixed(2)}</td>
                          <td>{movement.speed.toFixed(2)}</td>
                          <td>
                            <Badge color={getConfidenceBadgeColor(movement.confidence)}>
                              {movement.confidence}
                            </Badge>
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
    </div>
  );
};

export default MovementMap;