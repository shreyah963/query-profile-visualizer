import React, { useState } from 'react';
import './ProfilerCompare.css';

const ProfilerCompare = ({ onClose, profiles, onCompare }) => {
  const [profile1, setProfile1] = useState(null);
  const [profile2, setProfile2] = useState(null);
  const [compareType, setCompareType] = useState('execution');
  const [error, setError] = useState('');
  const [jsonInput1, setJsonInput1] = useState('');
  const [jsonInput2, setJsonInput2] = useState('');

  // Handle profile upload
  const handleProfileUpload = (event, profileNumber) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const profileData = JSON.parse(e.target.result);
        if (profileNumber === 1) {
          setProfile1(profileData);
        } else {
          setProfile2(profileData);
        }
      } catch (err) {
        setError('Invalid JSON file: ' + err.message);
        setTimeout(() => setError(''), 3000);
      }
    };
    reader.readAsText(file);
  };

  // Handle JSON input
  const handleJsonInput = (value, profileNumber) => {
    try {
      const profileData = JSON.parse(value);
      if (profileNumber === 1) {
        setProfile1(profileData);
        setJsonInput1(value);
      } else {
        setProfile2(profileData);
        setJsonInput2(value);
      }
    } catch (err) {
      // Don't show error while typing
      if (profileNumber === 1) {
        setJsonInput1(value);
      } else {
        setJsonInput2(value);
      }
    }
  };

  // Handle compare action
  const handleCompare = () => {
    if (!profile1 || !profile2) {
      setError('Please provide both profiles to compare.');
      return;
    }

    onCompare([profile1, profile2], compareType);
    onClose();
  };

  return (
    <div className="profiler-compare-overlay">
      <div className="profiler-compare-modal">
        <div className="profiler-compare-header">
          <h2>Compare Profiles</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="profiler-compare-content">
          <div className="form-group">
            <label>Profile 1:</label>
            <div className="profile-input-container">
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleProfileUpload(e, 1)}
                className="profile-upload"
              />
              <textarea
                className="profile-json-input"
                value={jsonInput1}
                onChange={(e) => handleJsonInput(e.target.value, 1)}
                placeholder="Or paste profile output in JSON format here..."
                rows={10}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Profile 2:</label>
            <div className="profile-input-container">
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleProfileUpload(e, 2)}
                className="profile-upload"
              />
              <textarea
                className="profile-json-input"
                value={jsonInput2}
                onChange={(e) => handleJsonInput(e.target.value, 2)}
                placeholder="Or paste profile output in JSON format here..."
                rows={10}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Comparison Type:</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="compareType"
                  value="execution"
                  checked={compareType === 'execution'}
                  onChange={() => setCompareType('execution')}
                />
                Execution Time
              </label>
              <label>
                <input
                  type="radio"
                  name="compareType"
                  value="structure"
                  checked={compareType === 'structure'}
                  onChange={() => setCompareType('structure')}
                />
                Query Structure
              </label>
              <label>
                <input
                  type="radio"
                  name="compareType"
                  value="results"
                  checked={compareType === 'results'}
                  onChange={() => setCompareType('results')}
                />
                Result Differences
              </label>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="modal-actions">
            <button className="cancel-button" onClick={onClose}>Cancel</button>
            <button className="submit-button" onClick={handleCompare}>Compare</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilerCompare; 