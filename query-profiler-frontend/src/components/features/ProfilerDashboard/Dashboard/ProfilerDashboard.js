import React, { useState, useEffect } from 'react';
import ProfilerSummary from '../ProfilerSummary';
import ProfilerQueries from '../ProfilerQueries';
import QueryInput from '../QueryInput';
import { ProfilerComparisonResults } from '../ProfilerComparison';
import ShardVisualization from '../ShardVisualization/ShardVisualization';
import './ProfilerDashboard.css';

const ProfilerDashboard = ({ data, updateData }) => {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileToCompare, setProfileToCompare] = useState(null);
  const [showComparisonResults, setShowComparisonResults] = useState(false);
  const [comparisonType, setComparisonType] = useState('detailed');
  const [showDualQueryInput, setShowDualQueryInput] = useState(false);
  const [profile1, setProfile1] = useState(null);
  const [profile2, setProfile2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jsonInput1, setJsonInput1] = useState('');
  const [jsonInput2, setJsonInput2] = useState('');
  const [uploadError, setUploadError] = useState(null);
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [selectedShardIndex, setSelectedShardIndex] = useState(0);
  
  if (!data && !showDualQueryInput) {
    return <div className="no-data">No profiling data available</div>;
  }

  // Helper to build dashboard data from uploaded/pasted profile
  const buildDashboardData = (raw) => {
    if (!raw) {
      console.error('No profile data provided');
      return null;
    }

    // If the uploaded object is { profile: { ... } }, use that as profileData
    const profileData = raw.profile || raw;

    // Ensure we have shards data for visualization
    if (!profileData.shards && profileData.profile?.shards) {
      profileData.shards = profileData.profile.shards;
    }

    // Log the processed data for debugging
    console.log('Processed profile data:', {
      hasShards: Boolean(profileData.shards),
      shardCount: profileData.shards?.length,
    });

    return {
      profileData,
      selectedShardIndex: 0
    };
  };

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
        // Update main visualization if not in comparison mode
        if (!showDualQueryInput) {
          const processedData = buildDashboardData(profileData);
          updateData(processedData);
          setSelectedProfile(null);
          setSelectedShardIndex(0);
        }
      } catch (err) {
        setError('Invalid JSON file: ' + err.message);
        setTimeout(() => setError(''), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleJsonInput = (value, profileNumber) => {
    // Update the text area value
    if (profileNumber === 1) {
      setJsonInput1(value);
    } else {
      setJsonInput2(value);
    }

    // Try to parse and update the profile data
    try {
      const profileData = JSON.parse(value);
      if (profileNumber === 1) {
        setProfile1(profileData);
      } else {
        setProfile2(profileData);
      }
      setError(null);
    } catch (err) {
      // Don't show error while typing
      // But clear the profile data if JSON becomes invalid
      if (profileNumber === 1) {
        setProfile1(null);
      } else {
        setProfile2(null);
      }
    }
  };

  // New: Only update visualization when Visualize is clicked
  const handleVisualizeClick = () => {
    try {
      const profileData = JSON.parse(jsonInput1);
      setProfile1(profileData);
      const processedData = buildDashboardData(profileData);
      updateData(processedData);
      setSelectedProfile(null);
      setSelectedShardIndex(0);
      setError(null);
    } catch (err) {
      setError('Invalid JSON: ' + err.message);
      // Do not update the dashboard if JSON is invalid
    }
  };

  const handleCompare = () => {
    console.log('Comparing profiles:', { profile1, profile2 });
    
    if (!profile1 || !profile2) {
      setError('Please provide both profiles to compare.');
      return;
    }

    setShowComparisonResults(true);
  };

  const handleDualQueryComparison = () => {
    setShowDualQueryInput(true);
    setError(null);
  };

  const exitDualQueryMode = () => {
    setShowDualQueryInput(false);
    setProfile1(null);
    setProfile2(null);
    setJsonInput1('');
    setJsonInput2('');
    setError(null);
  };

  // Handle shard selection
  const handleShardChange = (event) => {
    const newIndex = parseInt(event.target.value, 10);
    setSelectedShardIndex(newIndex);
    // Update the data with the new selected shard
    if (data && data.profileData) {
      updateData({
        ...data,
        selectedShardIndex: newIndex
      });
    }
  };

  // Handle shard selection from visualization
  const handleShardSelect = (shardIndex) => {
    setSelectedShardIndex(shardIndex);
    if (data && data.profileData) {
      updateData({
        ...data,
        selectedShardIndex: shardIndex
      });
    }
  };

  // Render dual query comparison UI
  if (showDualQueryInput) {
    return (
      <div className="profiler-dashboard dual-query-mode">
        <header className="dashboard-header">
          <h1>Profile Comparison Mode</h1>
          <button className="exit-dual-mode-btn" onClick={exitDualQueryMode}>
            Exit Comparison Mode
          </button>
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
          <button 
            className="compare-profiles-btn"
            onClick={handleCompare}
            disabled={isLoading}
          >
            {isLoading ? 'Comparing...' : 'Compare Profiles'}
          </button>
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
  }

  return (
    <div className="profiler-dashboard">
      <header className="dashboard-header">
        <h1>Query Profiler Dashboard</h1>
        <div className="search-container">
          <input type="text" placeholder="Search profiler" className="search-input" />
          <button className="download-btn">↓</button>
        </div>
      </header>

      <div className="dashboard-content">
      <div className="dashboard-actions">
        <div className="profile-actions">
          <div className="profile-actions-left">
            <button
              className="visualize-btn"
              onClick={() => setShowJsonInput(!showJsonInput)}
            >
              Visualize Profile
            </button>
            <input
              type="file"
              id="profile-upload"
              accept=".json"
              onChange={(e) => handleProfileUpload(e, 1)}
              style={{ display: 'none' }}
            />
            <button
              className="upload-btn"
              onClick={() => document.getElementById('profile-upload').click()}
            >
              Upload File
            </button>
          </div>
          <button
            className="compare-btn"
            onClick={handleDualQueryComparison}
          >
            Compare Profiles
          </button>
        </div>
        {showJsonInput && (
          <div className="json-input-container">
            <textarea
              className="json-input"
              value={jsonInput1}
              onChange={(e) => handleJsonInput(e.target.value, 1)}
              placeholder="Paste your profile output in JSON format here..."
              rows={10}
            />
            {error && <div className="upload-error">{error}</div>}
            <div className="action-buttons">
              <button
                className="submit-json-btn"
                onClick={handleVisualizeClick}
                disabled={!jsonInput1.trim()}
              >
                Visualize
              </button>
            </div>
          </div>
        )}
        {uploadError && <div className="upload-error">{uploadError}</div>}
      </div>

      {data && data.profileData && data.profileData.shards && data.profileData.shards.length > 1 && (
        <ShardVisualization 
          profileData={data.profileData}
          onShardSelect={handleShardSelect}
        />
      )}

      {data && data.profileData && data.profileData.shards && data.profileData.shards.length > 0 && (
        <div className="shard-selector">
          <label htmlFor="shard-select">Select Shard: </label>
          <select
            id="shard-select"
            value={selectedShardIndex}
            onChange={handleShardChange}
            className="shard-select"
          >
            {data.profileData.shards.map((shard, index) => (
              <option key={shard.id || index} value={index}>
                Shard {index + 1}: {shard.id || `[${index}]`}
              </option>
            ))}
          </select>
          <span className="shard-info">
            {data.profileData.shards.length} shard{data.profileData.shards.length !== 1 ? 's' : ''} available
          </span>
        </div>
      )}

      {data && data.profileData && (
        <ProfilerQueries 
          data={{
            ...data,
            profileData: {
              ...data.profileData,
              // Only pass the selected shard's data for visualization
              shards: [data.profileData.shards[selectedShardIndex]]
            }
          }}
          selectedProfile={selectedProfile}
          setSelectedProfile={setSelectedProfile}
          setProfileToCompare={showComparisonResults ? setProfileToCompare : () => {}}
          profileToCompare={showComparisonResults ? profileToCompare : null}
        />
      )}

      {showComparisonResults && selectedProfile && profileToCompare && (
        <ProfilerComparisonResults 
          profiles={[selectedProfile, profileToCompare]} 
          comparisonType={comparisonType}
          onClose={() => setShowComparisonResults(false)}
        />
      )}
      </div>
    </div>
  );
};

export default ProfilerDashboard;
