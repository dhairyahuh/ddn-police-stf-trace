import React, { useState, useEffect } from 'react';
import Fab from '@material-ui/core/Fab'
import AddIcon from '@material-ui/icons/Add'
import CloudUpload from '@material-ui/icons/CloudUpload'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import ErrorIcon from '@material-ui/icons/Error'
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';
import { FormGroup, Label, Input, Alert, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';
import './FileUpload.css';
import axios from 'axios';
const config = require('../../config')

function submitForm(data, apiEndPoint, setResponse, setUploading, setUploadStatus, fileName, caseNumber) {
  setUploading(true);
  setUploadStatus(null);
  const url = `${config.BASE_URL}` + apiEndPoint;

  // Add case number to form data if it's a CDR or IPDR upload
  if (caseNumber && (apiEndPoint.includes('cdr') || apiEndPoint.includes('ipdr'))) {
    data.append('caseNumber', caseNumber);
  }

  axios.post(url, data, { headers: { 'content-type': "multipart/form-data" } })
    .then((response) => {
      setUploading(false);
      const recordsAdded = response.data?.recordsAdded || 0;
      const errors = response.data?.errors || 0;
      let message = `${fileName} file uploaded successfully!`;
      if (recordsAdded > 0) {
        message += ` ${recordsAdded} record(s) added to database.`;
      }
      if (errors > 0) {
        message += ` ${errors} record(s) had errors.`;
      }
      if (caseNumber) {
        message += ` Case: ${caseNumber}`;
      }
      setUploadStatus({ type: 'success', message: message });
      setResponse(response.data);
    }).catch((error) => {
      setUploading(false);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
      setUploadStatus({ type: 'error', message: `Upload failed: ${errorMsg}` });
      setResponse("error");
    })
}


function FileUpload(props) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [loadingCases, setLoadingCases] = useState(false);

  // Delete related state
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteOption, setDeleteOption] = useState('case'); // 'case' or 'all'
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(null);

  const isCDRUpload = props.name === 'CDR';
  const isIPDRUpload = props.name === 'IPDR';
  const requiresCase = isCDRUpload || isIPDRUpload;

  useEffect(() => {
    if (requiresCase) {
      loadCases();
    }
  }, [requiresCase]);

  const loadCases = async () => {
    setLoadingCases(true);
    try {
      const response = await axios.get(`${config.BASE_URL}/api/case/all`);
      setCases(response.data);
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setLoadingCases(false);
    }
  };

  function uploadWithFormData() {
    if (!file) {
      setUploadStatus({ type: 'error', message: 'Please select a file first' });
      return;
    }

    // For CDR/IPDR uploads, case selection is mandatory
    if (requiresCase && !selectedCase) {
      setUploadStatus({ type: 'error', message: `Please select a case before uploading ${props.name} data` });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    submitForm(formData, props.apiEndPoint, (msg) => console.log(msg), setUploading, setUploadStatus, props.name, selectedCase);
  }

  const toggleDeleteModal = () => {
    setDeleteModal(!deleteModal);
    setDeleteStatus(null);
  };

  const handleDelete = () => {
    if (deleteOption === 'case' && !selectedCase) {
      setDeleteStatus({ type: 'error', message: 'Please select a case to delete.' });
      return;
    }

    setDeleting(true);
    setDeleteStatus(null);

    const resource = props.name.toLowerCase(); // 'cdr' or 'ipdr'
    let url = '';

    if (deleteOption === 'all') {
      url = `${config.BASE_URL}/api/${resource}/delete/all`;
    } else {
      // Encode the case number to handle special characters
      const encodedCaseNumber = encodeURIComponent(selectedCase);
      url = `${config.BASE_URL}/api/${resource}/delete/${encodedCaseNumber}`;
    }

    axios.delete(url)
      .then((response) => {
        setDeleting(false);
        setDeleteStatus({
          type: 'success',
          message: response.data.message || 'Deletion successful'
        });
        // Auto close modal after 2 seconds on success
        setTimeout(() => {
          setDeleteModal(false);
          setDeleteStatus(null);
        }, 2000);
      })
      .catch((error) => {
        setDeleting(false);
        const errorMsg = error.response?.data?.message || error.message || 'Deletion failed';
        setDeleteStatus({ type: 'error', message: errorMsg });
      });
  };

  return (
    <>
    <div className="fileUpload">
      <p>Upload your {props.name} data file here</p>

      {/* Case Selection for CDR uploads */}
      {requiresCase && (
        <FormGroup>
          <Label for="caseSelect">Select Case *</Label>
          {loadingCases ? (
            <div><Spinner size="sm" /> Loading cases...</div>
          ) : cases.length === 0 ? (
            <Alert color="warning">
              No cases found. Please create a case first in Case Management.
            </Alert>
          ) : (
            <Input
              type="select"
              id="caseSelect"
              value={selectedCase}
              onChange={(e) => setSelectedCase(e.target.value)}
              required
              style={{ color: '#000', backgroundColor: '#fff' }}
            >
              <option value="">-- Select a Case --</option>
              {cases.map((c, idx) => (
                <option key={idx} value={c.caseNumber}>
                  {c.caseNumber} - {c.caseName} (FIR: {c.firNumber}, {c.year})
                </option>
              ))}
            </Input>
          )}
        </FormGroup>
      )}

      <label htmlFor={`upload-data-${props.name}`}>
        <input
          style={{ display: 'none' }}
          id={`upload-data-${props.name}`}
          name="upload-data"
          type="file"
          accept=".csv"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setUploadStatus(null);
          }}
        />
        <Fab
          color="primary"
          size="small"
          component="span"
          aria-label="add"
          variant="extended"
          style={{ marginRight: '10px' }}
        >
          <AddIcon /> Select {props.name} file
        </Fab>
      </label>
      <Fab
        color="secondary"
        size="small"
        variant="extended"
        onClick={uploadWithFormData}
        disabled={!file || uploading || (requiresCase && !selectedCase)}
        style={{ marginLeft: '10px' }}
      >
        <CloudUpload style={{ marginRight: '5px' }} /> {uploading ? 'Uploading...' : 'Upload to Database'}
      </Fab>

      {/* Delete Data Button (Only for CDR and IPDR) */}
      {requiresCase && (
        <Fab
          style={{ marginLeft: '10px', backgroundColor: '#d32f2f', color: 'white' }}
          size="small"
          variant="extended"
          onClick={toggleDeleteModal}
          disabled={uploading || deleting}
        >
          <DeleteForeverIcon style={{ marginRight: '5px' }} /> Delete Data
        </Fab>
      )}
      <br />
      <div style={{ marginTop: '15px', minHeight: '30px' }}>
        {file && (
          <span className="uploadedFile" style={{ display: 'block', marginBottom: '10px' }}>
            Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
          </span>
        )}
        {uploadStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            color: uploadStatus.type === 'success' ? '#4caf50' : '#f44336',
            marginTop: '10px'
          }}>
            {uploadStatus.type === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
            <span style={{ marginLeft: '8px' }}>{uploadStatus.message}</span>
          </div>
        )}
      </div>
    </div>
      
      {/* Delete Confirmation Modal */}
  <Modal isOpen={deleteModal} toggle={toggleDeleteModal} className="modal-danger">
    <ModalHeader toggle={toggleDeleteModal}>Delete {props.name} Data</ModalHeader>
    <ModalBody>
      <div className="text-center">
        <DeleteForeverIcon style={{ fontSize: 60, color: '#d32f2f', marginBottom: 20 }} />
        <p>You are about to delete {props.name} records. This action cannot be undone.</p>

        <FormGroup tag="fieldset" style={{ textAlign: 'left', margin: '20px 0' }}>
          <legend className="col-form-label">Select Deletion Scope:</legend>
          <FormGroup check>
            <Label check>
              <Input
                type="radio"
                name="deleteOption"
                checked={deleteOption === 'case'}
                onChange={() => setDeleteOption('case')}
              />{' '}
              Delete only for selected case
              {selectedCase && <strong> ({selectedCase})</strong>}
            </Label>
          </FormGroup>
          <FormGroup check>
            <Label check>
              <Input
                type="radio"
                name="deleteOption"
                checked={deleteOption === 'all'}
                onChange={() => setDeleteOption('all')}
              />{' '}
              Delete ALL {props.name} records from database
            </Label>
          </FormGroup>
        </FormGroup>

        {deleteOption === 'case' && !selectedCase && (
          <Alert color="warning">
            Please select a case from the dropdown in the main form first.
          </Alert>
        )}

        {deleteStatus && (
          <Alert color={deleteStatus.type === 'success' ? 'success' : 'danger'}>
            {deleteStatus.message}
          </Alert>
        )}
      </div>
    </ModalBody>
    <ModalFooter>
      <Button color="secondary" onClick={toggleDeleteModal} disabled={deleting}>
        Cancel
      </Button>
      <Button
        color="danger"
        onClick={handleDelete}
        disabled={deleting || (deleteOption === 'case' && !selectedCase)}
      >
        {deleting ? <Spinner size="sm" /> : 'Confirm Delete'}
      </Button>
    </ModalFooter>
  </Modal>
    </>
  );
}

export default FileUpload;