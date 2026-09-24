/*!
*
=========================================================
* SancharNetra Portal v1.0.0
=========================================================
*
* Developed by: AlgoRhythm
* Copyright 2025 AlgoRhythm
* Licensed under MIT (https://github.com/creativetimofficial/black-dashboard-react/blob/master/LICENSE.md)
*
* Coded by AlgoRhythm
*
=========================================================
*
* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*
*/
import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Button,
  ButtonGroup,
  Input,
  FormGroup,
  Label,
  Table,
  Row,
  Col,
  Alert,
  Spinner
} from "reactstrap";
import { phoneProfilingAPI, emailProfilingAPI, breachAPI } from "../services/api";

function Profiling() {
  // Phone profiling state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profilingData, setProfilingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Email profiling state
  const [email, setEmail] = useState('');
  const [emailProfilingData, setEmailProfilingData] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState(null);

  // Breach intelligence state
  const [breachData, setBreachData] = useState(null);
  const [breachLoading, setBreachLoading] = useState(false);
  const [expandedRecords, setExpandedRecords] = useState({}); // Track expanded CSV records

  // Clear phone profiling results
  const clearPhoneResults = () => {
    setProfilingData(null);
    setError(null);
    setBreachData(null);
    setPhoneNumber('');
  };

  // Clear email profiling results
  const clearEmailResults = () => {
    setEmailProfilingData(null);
    setEmailError(null);
    setBreachData(null);
    setEmail('');
  };

  const handleSearch = async () => {
    if (!phoneNumber || phoneNumber.trim() === '') {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError(null);
    setProfilingData(null);

    // Always search breach database for local intelligence (runs in parallel)
    const breachPromise = searchBreachByPhone(phoneNumber.trim());

    try {
      const response = await phoneProfilingAPI.getPhoneProfiling(phoneNumber.trim());
      if (response.data.success) {
        setProfilingData(response.data);
      } else {
        // External API failed — only show error if breach DB also has nothing
        await breachPromise;
        setBreachData(prev => {
          if (!prev || !prev.found) {
            setError(response.data.message || 'No data found for this phone number.');
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error fetching profiling data:', err);
      // External API failed — only show error if breach DB also has nothing
      await breachPromise;
      setBreachData(prev => {
        if (!prev || !prev.found) {
          const errorMessage = (err.response && err.response.data && err.response.data.message)
            ? err.response.data.message
            : 'External profiling service unavailable. Showing local intelligence only.';
          setError(errorMessage);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  // Breach search by phone
  const searchBreachByPhone = async (phone) => {
    setBreachLoading(true);
    try {
      const response = await breachAPI.searchByPhone(phone);
      setBreachData(response.data);
    } catch (err) {
      console.error('Error searching breach data:', err);
      setBreachData(null);
    } finally {
      setBreachLoading(false);
    }
  };

  // Breach search by email
  const searchBreachByEmail = async (emailAddr) => {
    setBreachLoading(true);
    try {
      const response = await breachAPI.searchByEmail(emailAddr);
      setBreachData(response.data);
    } catch (err) {
      console.error('Error searching breach data:', err);
      setBreachData(null);
    } finally {
      setBreachLoading(false);
    }
  };

  // Instagram username state
  const [instagramUsername, setInstagramUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Breach search by username (Instagram)
  const searchBreachByUsername = async (username) => {
    if (!username || username.trim() === '') return;

    setUsernameLoading(true);
    setBreachLoading(true);
    try {
      const response = await breachAPI.searchByUsername(username.trim().toLowerCase());
      setBreachData(response.data);
    } catch (err) {
      console.error('Error searching by username:', err);
      setBreachData(null);
    } finally {
      setUsernameLoading(false);
      setBreachLoading(false);
    }
  };

  // Handle Instagram username search
  const handleUsernameSearch = () => {
    if (!instagramUsername || instagramUsername.trim() === '') return;
    searchBreachByUsername(instagramUsername.trim());
  };

  // Clear username search
  const clearUsernameResults = () => {
    setInstagramUsername('');
    setBreachData(null);
  };

  // Clear breach data
  const clearBreachData = () => {
    setBreachData(null);
  };

  // Download breach data as JSON
  const downloadBreachJSON = () => {
    if (!breachData || !breachData.found) return;

    const dataStr = JSON.stringify(breachData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `breach_intelligence_${breachData.searchValue || 'search'}_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download breach data as TXT
  const downloadBreachTXT = () => {
    if (!breachData || !breachData.found) return;

    let textContent = `Data Breach Intelligence Report\n`;
    textContent += `Search Type: ${breachData.searchType || 'N/A'}\n`;
    textContent += `Search Value: ${breachData.searchValue || 'N/A'}\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `Total Results: ${breachData.count || 0}\n`;
    textContent += `\n${'='.repeat(60)}\n\n`;

    if (breachData.breachSources && breachData.breachSources.length > 0) {
      textContent += `Breach Sources: ${breachData.breachSources.join(', ')}\n`;
    }

    if (breachData.dataTypesExposed && breachData.dataTypesExposed.length > 0) {
      textContent += `Exposed Data Types: ${breachData.dataTypesExposed.join(', ')}\n`;
    }

    textContent += `\n${'-'.repeat(60)}\n\n`;

    if (breachData.breaches && breachData.breaches.length > 0) {
      breachData.breaches.forEach((record, index) => {
        textContent += `Record ${index + 1}:\n`;
        textContent += `  Breach Source: ${record.breachName || 'N/A'}\n`;
        textContent += `  Name: ${record.name || 'N/A'}\n`;
        textContent += `  Phone: ${record.phone || 'N/A'}\n`;
        textContent += `  Email: ${record.email || 'N/A'}\n`;
        textContent += `  Username: ${record.username || 'N/A'}\n`;
        textContent += `  Active: ${record.isActive !== null ? (record.isActive ? 'Yes' : 'No') : 'N/A'}\n`;
        textContent += `  Staff: ${record.isStaff ? 'Yes' : 'No'}\n`;
        textContent += `\n${'-'.repeat(60)}\n\n`;
      });
    }

    textContent += `\n⚠️ DISCLAIMER: Breach data is for intelligence purposes only.\n`;
    textContent += `Must be corroborated with primary evidence before legal action.\n`;

    const dataBlob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `breach_intelligence_${breachData.searchValue || 'search'}_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download breach data as PDF (print view)
  const downloadBreachPDF = () => {
    if (!breachData || !breachData.found) return;

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Breach Intelligence Report - ${breachData.searchValue || 'Search'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #f5365c; border-bottom: 2px solid #f5365c; padding-bottom: 10px; }
          h2 { color: #666; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f5365c; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .header-info { margin-bottom: 20px; }
          .header-info p { margin: 5px 0; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; margin: 2px; font-size: 12px; }
          .badge-danger { background-color: #f5365c; color: white; }
          .badge-primary { background-color: #5e72e4; color: white; }
          .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin-top: 30px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header-info">
          <h1>🛡️ Data Breach Intelligence Report</h1>
          <p><strong>Search Type:</strong> ${breachData.searchType || 'N/A'}</p>
          <p><strong>Search Value:</strong> ${breachData.searchValue || 'N/A'}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Results:</strong> ${breachData.count || 0}</p>
          <p><strong>Breach Sources:</strong> ${breachData.breachSources ? breachData.breachSources.join(', ') : 'N/A'}</p>
        </div>
        
        <h2>Exposed Data Types</h2>
        <div>
          ${breachData.dataTypesExposed ? breachData.dataTypesExposed.map(type =>
      `<span class="badge ${type === 'Password Hash' ? 'badge-danger' : 'badge-primary'}">${type}</span>`
    ).join(' ') : 'N/A'}
        </div>
    `;

    if (breachData.breaches && breachData.breaches.length > 0) {
      htmlContent += `
        <h2>Breach Records</h2>
        <table>
          <tr>
            <th>Breach Source</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Username</th>
            <th>Status</th>
          </tr>
      `;
      breachData.breaches.forEach(record => {
        htmlContent += `
          <tr>
            <td>${record.breachName || 'N/A'}</td>
            <td>${record.name || 'N/A'}</td>
            <td>${record.email || 'N/A'}</td>
            <td>${record.phone || 'N/A'}</td>
            <td>${record.username || 'N/A'}</td>
            <td>${record.isActive ? 'Active' : 'Inactive'}${record.isStaff ? ' (Staff)' : ''}</td>
          </tr>
        `;
      });
      htmlContent += `</table>`;
    }

    htmlContent += `
        <div class="warning">
          <strong>⚠️ Intelligence-Only Data:</strong> Breach data is provided for investigative intelligence purposes only.
          This information must be corroborated with primary evidence before any legal action.
          Do not use this data as sole basis for accusations.
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const downloadJSON = () => {
    if (!profilingData) return;

    const dataStr = JSON.stringify(profilingData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phone_profiling_${phoneNumber}_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadTXT = () => {
    if (!profilingData) return;

    let textContent = `Phone Number Profiling Report\n`;
    textContent += `Phone Number: ${phoneNumber}\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `\n${'='.repeat(60)}\n\n`;

    if (profilingData.result && profilingData.result.length > 0) {
      profilingData.result.forEach((record, index) => {
        textContent += `Record ${index + 1}:\n`;
        textContent += `  ID: ${record.id || 'N/A'}\n`;
        textContent += `  Mobile: ${record.mobile || 'N/A'}\n`;
        textContent += `  Name: ${record.name || 'N/A'}\n`;
        textContent += `  Father's Name: ${record.father_name || 'N/A'}\n`;
        textContent += `  Address: ${record.address || 'N/A'}\n`;
        textContent += `  Alternate Mobile: ${record.alt_mobile || 'N/A'}\n`;
        textContent += `  Circle: ${record.circle || 'N/A'}\n`;
        textContent += `  ID Number: ${record.id_number || 'N/A'}\n`;
        textContent += `  Email: ${record.email || 'N/A'}\n`;
        textContent += `\n${'-'.repeat(60)}\n\n`;
      });
    } else {
      textContent += 'No records found.\n';
    }

    const dataBlob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phone_profiling_${phoneNumber}_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    if (!profilingData) return;

    // Create a printable HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Phone Profiling Report - ${phoneNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #666; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .record-section { margin-bottom: 30px; page-break-inside: avoid; }
          .header-info { margin-bottom: 20px; }
          .header-info p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header-info">
          <h1>Phone Number Profiling Report</h1>
          <p><strong>Phone Number:</strong> ${phoneNumber}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>
    `;

    if (profilingData.result && profilingData.result.length > 0) {
      profilingData.result.forEach((record, index) => {
        htmlContent += `
          <div class="record-section">
            <h2>Record ${index + 1}</h2>
            <table>
              <tr><th>Field</th><th>Value</th></tr>
              <tr><td>ID</td><td>${record.id || 'N/A'}</td></tr>
              <tr><td>Mobile</td><td>${record.mobile || 'N/A'}</td></tr>
              <tr><td>Name</td><td>${record.name || 'N/A'}</td></tr>
              <tr><td>Father's Name</td><td>${record.father_name || 'N/A'}</td></tr>
              <tr><td>Address</td><td>${record.address || 'N/A'}</td></tr>
              <tr><td>Alternate Mobile</td><td>${record.alt_mobile || 'N/A'}</td></tr>
              <tr><td>Circle</td><td>${record.circle || 'N/A'}</td></tr>
              <tr><td>ID Number</td><td>${record.id_number || 'N/A'}</td></tr>
              <tr><td>Email</td><td>${record.email || 'N/A'}</td></tr>
            </table>
          </div>
        `;
      });
    } else {
      htmlContent += '<p>No records found.</p>';
    }

    htmlContent += `
      </body>
      </html>
    `;

    // Open in new window and print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Email profiling functions
  const handleEmailSearch = async () => {
    if (!email || email.trim() === '') {
      setEmailError('Please enter an email address');
      return;
    }

    setEmailLoading(true);
    setEmailError(null);
    setEmailProfilingData(null);

    // Always search local breach DB (runs in parallel, never blocked)
    const breachPromise = searchBreachByEmail(email.trim());

    try {
      const response = await emailProfilingAPI.getEmailProfiling(email.trim());
      if (response.data && (response.data.NumOfResults > 0 || response.data.List)) {
        setEmailProfilingData(response.data);
      }
      // Even if external API returns empty, breach results still show
    } catch (err) {
      console.error('Error fetching email profiling data (external API):', err);
      // Don't show error — breach DB results will still display
    } finally {
      setEmailLoading(false);
    }

    // Ensure breach search completes
    await breachPromise;
  };

  const downloadEmailJSON = () => {
    if (!emailProfilingData) return;

    const dataStr = JSON.stringify(emailProfilingData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email_profiling_${email.replace('@', '_at_')}_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadEmailTXT = () => {
    if (!emailProfilingData) return;

    let textContent = `Email Profiling Report\n`;
    textContent += `Email: ${email}\n`;
    textContent += `Generated: ${new Date().toLocaleString()}\n`;
    textContent += `Total Databases: ${emailProfilingData.NumOfDatabase || 0}\n`;
    textContent += `Total Results: ${emailProfilingData.NumOfResults || 0}\n`;
    textContent += `\n${'='.repeat(60)}\n\n`;

    if (emailProfilingData.List) {
      Object.keys(emailProfilingData.List).forEach((dbName) => {
        const dbData = emailProfilingData.List[dbName];
        textContent += `Database: ${dbName}\n`;
        textContent += `Info Leak: ${dbData.InfoLeak || 'N/A'}\n`;
        textContent += `Number of Results: ${dbData.NumOfResults || 0}\n`;
        textContent += `\n${'-'.repeat(60)}\n`;

        if (dbData.Data && Array.isArray(dbData.Data)) {
          dbData.Data.forEach((record, index) => {
            textContent += `\n  Record ${index + 1}:\n`;
            Object.keys(record).forEach(key => {
              textContent += `    ${key}: ${record[key] || 'N/A'}\n`;
            });
          });
        }
        textContent += `\n${'='.repeat(60)}\n\n`;
      });
    } else {
      textContent += 'No records found.\n';
    }

    const dataBlob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email_profiling_${email.replace('@', '_at_')}_${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadEmailPDF = () => {
    if (!emailProfilingData) return;

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Profiling Report - ${email}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #666; margin-top: 30px; }
          h3 { color: #888; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .db-section { margin-bottom: 40px; page-break-inside: avoid; }
          .header-info { margin-bottom: 20px; }
          .header-info p { margin: 5px 0; }
          .info-leak { font-style: italic; color: #666; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header-info">
          <h1>Email Profiling Report</h1>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Databases:</strong> ${emailProfilingData.NumOfDatabase || 0}</p>
          <p><strong>Total Results:</strong> ${emailProfilingData.NumOfResults || 0}</p>
        </div>
    `;

    if (emailProfilingData.List) {
      Object.keys(emailProfilingData.List).forEach((dbName) => {
        const dbData = emailProfilingData.List[dbName];
        htmlContent += `
          <div class="db-section">
            <h2>${dbName}</h2>
            <p class="info-leak">${dbData.InfoLeak || 'N/A'}</p>
            <p><strong>Number of Results:</strong> ${dbData.NumOfResults || 0}</p>
        `;

        if (dbData.Data && Array.isArray(dbData.Data) && dbData.Data.length > 0) {
          dbData.Data.forEach((record, index) => {
            htmlContent += `
              <h3>Record ${index + 1}</h3>
              <table>
                <tr><th>Field</th><th>Value</th></tr>
            `;
            Object.keys(record).forEach(key => {
              htmlContent += `
                <tr><td>${key}</td><td>${record[key] || 'N/A'}</td></tr>
              `;
            });
            htmlContent += `</table>`;
          });
        }
        htmlContent += `</div>`;
      });
    } else {
      htmlContent += '<p>No records found.</p>';
    }

    htmlContent += `
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Helper function to render email profiling results
  const renderEmailResults = () => {
    if (!emailProfilingData || !emailProfilingData.List) {
      return (
        <Alert color="info">
          No email profiling data found.
        </Alert>
      );
    }

    const databases = Object.keys(emailProfilingData.List);

    return databases.map((dbName, dbIndex) => {
      const dbData = emailProfilingData.List[dbName];
      return (
        <Card key={dbIndex} className="mt-3">
          <CardHeader>
            <CardTitle tag="h5">{dbName}</CardTitle>
            <p className="text-muted mb-0">
              <small>{dbData.InfoLeak || 'N/A'}</small>
            </p>
            <p className="text-muted mb-0">
              <small>Results: {dbData.NumOfResults || 0}</small>
            </p>
          </CardHeader>
          <CardBody>
            {dbData.Data && Array.isArray(dbData.Data) && dbData.Data.length > 0 ? (
              <div className="table-responsive">
                <Table striped hover size="sm">
                  <thead>
                    <tr>
                      {Object.keys(dbData.Data[0]).map((key, idx) => (
                        <th key={idx}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbData.Data.map((record, recordIndex) => (
                      <tr key={recordIndex}>
                        {Object.keys(record).map((key, keyIndex) => (
                          <td key={keyIndex} style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                            {record[key] || 'N/A'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <Alert color="info" className="mb-0">
                No data available for this database.
              </Alert>
            )}
          </CardBody>
        </Card>
      );
    });
  };

  return (
    <>
      <div className="content">
        <Card>
          <CardHeader>
            <CardTitle tag="h4">Phone Number Profiling</CardTitle>
          </CardHeader>
          <CardBody>
            <Row>
              <Col md="8">
                <FormGroup>
                  <Label for="phoneNumber">Enter Phone Number</Label>
                  <Input
                    type="text"
                    id="phoneNumber"
                    placeholder="e.g., 8800236565"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                </FormGroup>
              </Col>
              <Col md="4" className="d-flex align-items-end">
                <Button
                  color="primary"
                  onClick={handleSearch}
                  disabled={loading || !phoneNumber.trim()}
                  className="w-100"
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </Button>
              </Col>
            </Row>

            {error && (
              <Alert color="danger" className="mt-3">
                {error}
              </Alert>
            )}

            {profilingData && (
              <div className="mt-4">
                <Row className="mb-3">
                  <Col>
                    <h5>Profiling Results</h5>
                    <p className="text-muted">
                      Found {profilingData.result && profilingData.result.length ? profilingData.result.length : 0} record(s)
                    </p>
                  </Col>
                  <Col className="text-right">
                    <ButtonGroup>
                      <Button color="danger" size="sm" onClick={clearPhoneResults} title="Clear Results">
                        ✕ Clear
                      </Button>
                      <Button color="success" size="sm" onClick={downloadPDF}>
                        Download PDF
                      </Button>
                      <Button color="info" size="sm" onClick={downloadTXT}>
                        Download TXT
                      </Button>
                      <Button color="secondary" size="sm" onClick={downloadJSON}>
                        Download JSON
                      </Button>
                    </ButtonGroup>
                  </Col>
                </Row>

                {profilingData.result && profilingData.result.length > 0 ? (
                  <div className="table-responsive">
                    <Table striped hover>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Mobile</th>
                          <th>Father's Name</th>
                          <th>Address</th>
                          <th>Alt Mobile</th>
                          <th>Circle</th>
                          <th>ID Number</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profilingData.result.map((record, index) => (
                          <tr key={record.id || index}>
                            <td>{index + 1}</td>
                            <td>{record.name || 'N/A'}</td>
                            <td>{record.mobile || 'N/A'}</td>
                            <td>{record.father_name || 'N/A'}</td>
                            <td style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                              {record.address || 'N/A'}
                            </td>
                            <td>{record.alt_mobile || 'N/A'}</td>
                            <td>{record.circle || 'N/A'}</td>
                            <td>{record.id_number || 'N/A'}</td>
                            <td>{record.email || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <Alert color="info">
                    No profiling data found for this phone number.
                  </Alert>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Email Profiling Section */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle tag="h4">Email Profiling</CardTitle>
          </CardHeader>
          <CardBody>
            <Row>
              <Col md="8">
                <FormGroup>
                  <Label for="email">Enter Email Address</Label>
                  <Input
                    type="email"
                    id="email"
                    placeholder="e.g., bhavnatheshine@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleEmailSearch();
                      }
                    }}
                  />
                </FormGroup>
              </Col>
              <Col md="4" className="d-flex align-items-end">
                <Button
                  color="primary"
                  onClick={handleEmailSearch}
                  disabled={emailLoading || !email.trim()}
                  className="w-100"
                >
                  {emailLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </Button>
              </Col>
            </Row>

            {emailError && (
              <Alert color="danger" className="mt-3">
                {emailError}
              </Alert>
            )}

            {emailProfilingData && (
              <div className="mt-4">
                <Row className="mb-3">
                  <Col>
                    <h5>Email Profiling Results</h5>
                    <p className="text-muted">
                      Found {emailProfilingData.NumOfDatabase || 0} database(s) with {emailProfilingData.NumOfResults || 0} total result(s)
                    </p>
                  </Col>
                  <Col className="text-right">
                    <ButtonGroup>
                      <Button color="danger" size="sm" onClick={clearEmailResults} title="Clear Results">
                        ✕ Clear
                      </Button>
                      <Button color="success" size="sm" onClick={downloadEmailPDF}>
                        Download PDF
                      </Button>
                      <Button color="info" size="sm" onClick={downloadEmailTXT}>
                        Download TXT
                      </Button>
                      <Button color="secondary" size="sm" onClick={downloadEmailJSON}>
                        Download JSON
                      </Button>
                    </ButtonGroup>
                  </Col>
                </Row>

                {renderEmailResults()}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Instagram Username Search Section */}
        <Card className="mt-4" style={{ border: '2px solid #E1306C' }}>
          <CardHeader style={{ backgroundColor: 'rgba(225, 48, 108, 0.1)' }}>
            <CardTitle tag="h4" style={{ color: '#E1306C' }}>
              📸 Instagram Username Search
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Row>
              <Col md="8">
                <FormGroup>
                  <Label for="instagramUsername">Enter Instagram Username</Label>
                  <Input
                    type="text"
                    id="instagramUsername"
                    placeholder="e.g., lourdes_cpt"
                    value={instagramUsername}
                    onChange={(e) => setInstagramUsername(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleUsernameSearch();
                      }
                    }}
                  />
                </FormGroup>
              </Col>
              <Col md="4" className="d-flex align-items-end">
                <Button
                  color="danger"
                  style={{ backgroundColor: '#E1306C', borderColor: '#E1306C' }}
                  onClick={handleUsernameSearch}
                  disabled={usernameLoading || !instagramUsername.trim()}
                  className="w-100"
                >
                  {usernameLoading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Searching...
                    </>
                  ) : (
                    '🔍 Search Instagram'
                  )}
                </Button>
              </Col>
            </Row>
            <Alert color="warning" className="mt-3 mb-0" style={{ backgroundColor: 'rgba(225, 48, 108, 0.1)', borderColor: '#E1306C', color: '#8B0040' }}>
              ⚠️ Social media data is sourced from third-party breach intelligence and must be independently corroborated.
            </Alert>
          </CardBody>
        </Card>

        {/* Data Breach Intelligence Section */}
        {(breachData || breachLoading) && (
          <Card className="mt-4" style={{ border: breachData && breachData.found ? '2px solid #f5365c' : '2px solid #2dce89' }}>
            <CardHeader style={{ backgroundColor: breachData && breachData.found ? 'rgba(245, 54, 92, 0.1)' : 'rgba(45, 206, 137, 0.1)' }}>
              <CardTitle tag="h4" style={{ color: breachData && breachData.found ? '#f5365c' : '#2dce89' }}>
                🛡️ Data Breach Intelligence
              </CardTitle>
            </CardHeader>
            <CardBody>
              {breachLoading ? (
                <div className="text-center py-4">
                  <Spinner color="primary" />
                  <p className="mt-2 text-muted">Searching breach databases...</p>
                </div>
              ) : breachData && breachData.found ? (
                <div>
                  {/* Action Buttons Row */}
                  <Row className="mb-3">
                    <Col>
                      <h5>Breach Intelligence Results</h5>
                      <p className="text-muted">
                        Found {breachData.count || 0} record(s) from {breachData.breachSources ? breachData.breachSources.length : 0} breach source(s)
                      </p>
                    </Col>
                    <Col className="text-right">
                      <ButtonGroup>
                        <Button color="danger" size="sm" onClick={clearBreachData} title="Clear Results">
                          ✕ Clear
                        </Button>
                        <Button color="success" size="sm" onClick={downloadBreachPDF}>
                          Download PDF
                        </Button>
                        <Button color="info" size="sm" onClick={downloadBreachTXT}>
                          Download TXT
                        </Button>
                        <Button color="secondary" size="sm" onClick={downloadBreachJSON}>
                          Download JSON
                        </Button>
                      </ButtonGroup>
                    </Col>
                  </Row>

                  {/* Warning Banner */}
                  <Alert color="danger" className="mb-4">
                    <strong>⚠️ Found in {breachData.count || 1} Data Breach{breachData.count > 1 ? 'es' : ''}</strong>
                    <br />
                    <small>
                      Source{breachData.breachSources && breachData.breachSources.length > 1 ? 's' : ''}: {breachData.breachSources ? breachData.breachSources.join(', ') : 'Unknown'}
                    </small>
                  </Alert>

                  {/* Exposed Data Types */}
                  {breachData.dataTypesExposed && breachData.dataTypesExposed.length > 0 && (
                    <div className="mb-4">
                      <h6>Exposed Data Types:</h6>
                      <div>
                        {breachData.dataTypesExposed.map((type, idx) => (
                          <span
                            key={idx}
                            className="badge mr-2 mb-2"
                            style={{
                              backgroundColor: type === 'Password Hash' ? '#f5365c' : '#5e72e4',
                              color: 'white',
                              padding: '8px 12px',
                              fontSize: '12px'
                            }}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Breach Records Display - Handles both TXT and CSV */}
                  {breachData.breaches && breachData.breaches.length > 0 && (
                    <div>
                      {/* CSV Subscriber Records */}
                      {breachData.breaches.filter(r => r.sourceType === 'csv').length > 0 && (
                        <div className="mb-4">
                          <h6 className="mb-3" style={{ color: '#fb6340' }}>📋 Subscriber/Utility Records ({breachData.breaches.filter(r => r.sourceType === 'csv').length})</h6>
                          {breachData.breaches.filter(r => r.sourceType === 'csv').map((record, idx) => (
                            <Card key={`csv-${idx}`} className="mb-3" style={{ border: '2px solid #fb6340' }}>
                              <CardHeader style={{ backgroundColor: 'rgba(251, 99, 64, 0.1)', padding: '12px 15px' }}>
                                <Row>
                                  <Col>
                                    <strong style={{ color: '#fb6340' }}>{record.breachName}</strong>
                                    <span className="badge badge-warning ml-2">CSV Data</span>
                                    {record.connectionStatus && (
                                      <span className={`badge ml-2 ${record.connectionStatus === 'In Service' ? 'badge-success' : 'badge-secondary'}`}>
                                        {record.connectionStatus}
                                      </span>
                                    )}
                                  </Col>
                                  <Col className="text-right">
                                    <Button
                                      color="link"
                                      size="sm"
                                      onClick={() => setExpandedRecords(prev => ({
                                        ...prev,
                                        [`csv-${idx}`]: !prev[`csv-${idx}`]
                                      }))}
                                    >
                                      {expandedRecords[`csv-${idx}`] ? '▼ Hide Full Record' : '▶ View Full Record'}
                                    </Button>
                                  </Col>
                                </Row>
                              </CardHeader>
                              <CardBody style={{ backgroundColor: '#1a1a2e' }}>
                                {/* High-Value Info Cards - Dark Theme */}
                                <Row className="mb-3">
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Name</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.name || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Mobile</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.phone || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Father Name</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.fatherName || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>District</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.district || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                </Row>
                                <Row className="mb-3">
                                  <Col md="6">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Address</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.address || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Connection Type</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.connectionType || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Load</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.loadAmount || 'N/A'} {record.loadUnit || ''}</strong>
                                    </div>
                                  </Col>
                                </Row>
                                {record.latitude && record.longitude && (
                                  <Row className="mb-3">
                                    <Col>
                                      <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                        <small className="d-block" style={{ color: '#94a3b8' }}>📍 Geolocation</small>
                                        <strong style={{ color: '#f1f5f9' }}>Lat: {record.latitude}, Lon: {record.longitude}</strong>
                                      </div>
                                    </Col>
                                  </Row>
                                )}

                                {/* Expandable Full Record Table - All CSV Fields */}
                                {expandedRecords[`csv-${idx}`] && record.csvData && (
                                  <div
                                    className="mt-3 p-3"
                                    style={{
                                      backgroundColor: '#1e293b',
                                      borderRadius: '8px',
                                      maxHeight: '400px',
                                      overflowY: 'auto'
                                    }}
                                  >
                                    <h6 className="mb-3" style={{ color: '#fff' }}>📄 Full CSV Record ({Object.keys(record.csvData).length} Fields)</h6>
                                    <Table size="sm" bordered style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#5e72e4', color: 'white' }}>
                                          <th style={{ width: '35%' }}>Field</th>
                                          <th>Value</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(record.csvData).map(([key, value], fieldIdx) => (
                                          <tr key={fieldIdx} style={{ backgroundColor: fieldIdx % 2 === 0 ? '#1e293b' : '#0f172a' }}>
                                            <td style={{ fontWeight: 'bold', color: '#94a3b8' }}>{key}</td>
                                            <td style={{ wordBreak: 'break-word', color: '#f1f5f9' }}>
                                              {value !== null && value !== undefined && value !== ''
                                                ? String(value)
                                                : <span style={{ color: '#64748b' }}>-</span>
                                              }
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </Table>
                                  </div>
                                )}
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* Instagram/JSON Breach Records (Social Media) */}
                      {breachData.breaches.filter(r => r.sourceType === 'json').length > 0 && (
                        <div className="mb-4">
                          <h6 className="mb-3" style={{ color: '#ff80ab' }}>📸 Social Media Records ({breachData.breaches.filter(r => r.sourceType === 'json').length})</h6>
                          {breachData.breaches.filter(r => r.sourceType === 'json').map((record, idx) => (
                            <Card key={`json-${idx}`} className="mb-3" style={{ border: '2px solid #E1306C' }}>
                              <CardHeader style={{ backgroundColor: 'rgba(225, 48, 108, 0.1)', padding: '12px 15px' }}>
                                <Row>
                                  <Col>
                                    <strong style={{ color: '#ff80ab', fontSize: '1.1em' }}>{record.breachName}</strong>
                                    <span className="badge ml-2" style={{ backgroundColor: '#E1306C', color: 'white' }}>{record.platform || 'Social'}</span>
                                  </Col>
                                  <Col className="text-right">
                                    <Button
                                      color="link"
                                      size="sm"
                                      style={{ color: '#ff80ab' }}
                                      onClick={() => setExpandedRecords(prev => ({
                                        ...prev,
                                        [`json-${idx}`]: !prev[`json-${idx}`]
                                      }))}
                                    >
                                      {expandedRecords[`json-${idx}`] ? '▼ Hide Full Record' : '▶ View Full Record'}
                                    </Button>
                                  </Col>
                                </Row>
                              </CardHeader>
                              <CardBody style={{ backgroundColor: '#1a1a2e' }}>
                                {/* High-Value Info Cards - Instagram */}
                                <Row className="mb-3">
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e', borderLeft: '3px solid #E1306C' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Username</small>
                                      <strong style={{ color: '#ffffff' }}>@{record.username || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Instagram ID</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.instagramId || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Name</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.name || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="3">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Phone</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.phone || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                </Row>
                                <Row className="mb-3">
                                  <Col md="6">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Email</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.email || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                  <Col md="6">
                                    <div className="p-2 rounded" style={{ backgroundColor: '#16213e' }}>
                                      <small className="d-block" style={{ color: '#94a3b8' }}>Address</small>
                                      <strong style={{ color: '#f1f5f9' }}>{record.address || 'N/A'}</strong>
                                    </div>
                                  </Col>
                                </Row>

                                {/* Expandable Full JSON Record */}
                                {expandedRecords[`json-${idx}`] && record.jsonData && (
                                  <div
                                    className="mt-3 p-3"
                                    style={{
                                      backgroundColor: '#1e293b',
                                      borderRadius: '8px',
                                      maxHeight: '400px',
                                      overflowY: 'auto',
                                      border: '1px solid #334155'
                                    }}
                                  >
                                    <h6 className="mb-3" style={{ color: '#fff' }}>📄 Full JSON Record ({Object.keys(record.jsonData).length} Fields)</h6>
                                    <Table size="sm" bordered style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#831843', color: 'white' }}>
                                          <th style={{ width: '35%' }}>Field</th>
                                          <th>Value</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(record.jsonData).map(([key, value], fieldIdx) => (
                                          <tr key={fieldIdx} style={{ backgroundColor: fieldIdx % 2 === 0 ? '#1e293b' : '#0f172a' }}>
                                            <td style={{ fontWeight: 'bold', color: '#cbd5e1' }}>{key}</td>
                                            <td style={{ wordBreak: 'break-word', color: '#f1f5f9' }}>
                                              {value !== null && value !== undefined && value !== ''
                                                ? String(value)
                                                : <span style={{ color: '#475569' }}>-</span>
                                              }
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </Table>
                                  </div>
                                )}
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* TXT Breach Records (Account Data) - Exclude CSV and JSON */}
                      {breachData.breaches.filter(r => r.sourceType === 'txt').length > 0 && (
                        <div className="table-responsive">
                          <h6 className="mb-2" style={{ color: '#f5365c' }}>🔐 Account Breach Records ({breachData.breaches.filter(r => r.sourceType === 'txt').length})</h6>
                          <Table striped hover size="sm">
                            <thead>
                              <tr style={{ backgroundColor: '#f5365c', color: 'white' }}>
                                <th>#</th>
                                <th>Breach Source</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Username</th>
                                <th>Account Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {breachData.breaches.filter(r => r.sourceType !== 'csv').map((record, idx) => (
                                <tr key={idx}>
                                  <td><strong>{idx + 1}</strong></td>
                                  <td><strong>{record.breachName || 'N/A'}</strong></td>
                                  <td>{record.name || 'N/A'}</td>
                                  <td style={{ maxWidth: '200px', wordWrap: 'break-word' }}>{record.email || 'N/A'}</td>
                                  <td>{record.phone || 'N/A'}</td>
                                  <td>{record.username || 'N/A'}</td>
                                  <td>
                                    {record.isActive !== null && (
                                      <span className={`badge ${record.isActive ? 'badge-success' : 'badge-secondary'}`}>
                                        {record.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                    )}
                                    {record.isStaff && (
                                      <span className="badge badge-info ml-1">Staff</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Legal Disclaimer */}
                  <Alert color="warning" className="mt-4 mb-0">
                    <small>
                      <strong>⚠️ Intelligence-Only Data:</strong> Breach data is provided for investigative intelligence purposes only.
                      This information must be corroborated with primary evidence before any legal action.
                      Do not use this data as sole basis for accusations.
                    </small>
                  </Alert>
                </div>
              ) : breachData && !breachData.found ? (
                <Alert color="success" className="mb-0">
                  <strong>✅ No Breaches Found</strong>
                  <br />
                  <small>
                    The searched {breachData.searchType || 'identifier'} ({breachData.searchValue}) was not found in any known breach databases.
                  </small>
                </Alert>
              ) : null}
            </CardBody >
          </Card >
        )
        }
      </div >
    </>
  );
}

export default Profiling;

