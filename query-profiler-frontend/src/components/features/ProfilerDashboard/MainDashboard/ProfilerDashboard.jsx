import React, { useState } from 'react';
import ProfilerQueries from '../ProfilerQueries';
import ShardVisualization from '../ShardVisualization/ShardVisualization';

const ProfilerDashboard = ({ data, updateData }) => {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profile1, setProfile1] = useState(null);
  const [error, setError] = useState(null);
  const [jsonInput1, setJsonInput1] = useState('');
  const [showJsonInput, setShowJsonInput] = useState(true);
  const [selectedShardIndex, setSelectedShardIndex] = useState(0);
  
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
        const processedData = buildDashboardData(profileData);
        updateData(processedData);
        setSelectedProfile(null);
        setSelectedShardIndex(0);
      } catch (err) {
        setError('Invalid JSON file: ' + err.message);
        setTimeout(() => setError(''), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleJsonInput = (value, profileNumber) => {
    // Update the text area value
    setJsonInput1(value);

    // Try to parse and update the profile data
    try {
      const profileData = JSON.parse(value);
      setProfile1(profileData);
      setError(null);
    } catch (err) {
      // Don't show error while typing
      // But clear the profile data if JSON becomes invalid
      setProfile1(null);
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

  return (
    <div className="profiler-dashboard">
      <header className="dashboard-header">
        <h1>Query Profiler Dashboard</h1>
      </header>

      <div className="dashboard-content">
      <div className="dashboard-actions">
        <div className="profile-actions">
          <div className="profile-actions-left">
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
      </div>

      {/* Only show dashboard actions if no profile data is loaded */}
      {(!data || !data.profileData || !data.profileData.shards || data.profileData.shards.length === 0) ? null : (
        <>
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
            />
          )}

        </>
      )}
      </div>
    </div>
  );
};

export default ProfilerDashboard;
