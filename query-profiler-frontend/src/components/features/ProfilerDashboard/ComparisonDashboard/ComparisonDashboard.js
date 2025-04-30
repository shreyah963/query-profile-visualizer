import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'react-feather';
import './ComparisonDashboard.css';
import ProfilerComparisonResults from './ProfilerComparisonResults';

const ComparisonDashboard = ({ onExit }) => {
  const [profile1, setProfile1] = useState(null);
  const [profile2, setProfile2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showComparisonResults, setShowComparisonResults] = useState(false);
  const [jsonInput1, setJsonInput1] = useState('');
  const [jsonInput2, setJsonInput2] = useState('');

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

  const handleCompare = () => {
    if (!profile1 || !profile2) {
      setError('Please provide both profiles to compare.');
      return;
    }

    setShowComparisonResults(true);
  };

  return (
    <div className="profiler-dashboard dual-query-mode">
      <header className="dashboard-header">
        <h1>Profile Comparison Mode</h1>
        <div className="search-container">
          <input type="text" placeholder="Search profiler" className="search-input" />
          <button className="download-btn">↓</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dual-query-container">
          <div className="query-column">
            <div className="query-header">
              <h2>Profile 1</h2>
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleProfileUpload(e, 1)}
                className="profile-upload"
              />
            </div>
            <div className="query-textarea-container">
              <textarea
                value={jsonInput1}
                onChange={(e) => handleJsonInput(e.target.value, 1)}
                placeholder="Or paste profile output in JSON format here..."
                rows={10}
                className="query-textarea"
              />
            </div>
          </div>
          <div className="query-column">
            <div className="query-header">
              <h2>Profile 2</h2>
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleProfileUpload(e, 2)}
                className="profile-upload"
              />
            </div>
            <div className="query-textarea-container">
              <textarea
                value={jsonInput2}
                onChange={(e) => handleJsonInput(e.target.value, 2)}
                placeholder="Or paste profile output in JSON format here..."
                rows={10}
                className="query-textarea"
              />
            </div>
          </div>
        </div>

        <div className="dual-query-actions">
          {error && <div className="query-error">{error}</div>}
          <div className="action-buttons">
            <button 
              className="compare-profiles-btn"
              onClick={handleCompare}
              disabled={isLoading}
            >
              {isLoading ? 'Comparing...' : 'Compare Profiles'}
            </button>
            <button className="exit-dual-mode-btn" onClick={onExit}>
              Exit Comparison Mode
            </button>
          </div>
        </div>

        {showComparisonResults && profile1 && profile2 && (
          <ProfilerComparisonResults 
            profiles={[profile1, profile2]} 
            onClose={() => setShowComparisonResults(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ComparisonDashboard; 