import React, { useState, useEffect } from 'react';
import './ProfilerCompare.css';

const ProfilerCompare = ({ onClose, profiles, onCompare }) => {
  const [selectedProfiles, setSelectedProfiles] = useState([]);
  const [compareType, setCompareType] = useState('execution');
  const [error, setError] = useState('');

  // Handle profile selection
  const handleProfileSelect = (profileId) => {
    const isSelected = selectedProfiles.includes(profileId);
    
    if (isSelected) {
      // Remove from selection
      setSelectedProfiles(selectedProfiles.filter(id => id !== profileId));
    } else {
      // Add to selection (max 2)
      if (selectedProfiles.length < 2) {
        setSelectedProfiles([...selectedProfiles, profileId]);
      } else {
        setError('You can only select up to 2 profiles for comparison.');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  // Handle compare action
  const handleCompare = () => {
    if (selectedProfiles.length !== 2) {
      setError('Please select exactly 2 profiles to compare.');
      return;
    }

    onCompare(selectedProfiles, compareType);
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
            <label>Select Profiles to Compare (select 2):</label>
            <div className="profiles-list">
              {profiles && profiles.length > 0 ? (
                profiles.map((profile, index) => (
                  <div key={index} className="profile-item">
                    <input
                      type="checkbox"
                      id={`profile-${index}`}
                      checked={selectedProfiles.includes(index)}
                      onChange={() => handleProfileSelect(index)}
                    />
                    <label htmlFor={`profile-${index}`}>
                      {profile.name || `Profile ${index + 1}`}
                      {profile.timestamp && 
                        <span className="profile-timestamp">
                          {new Date(profile.timestamp).toLocaleString()}
                        </span>
                      }
                    </label>
                  </div>
                ))
              ) : (
                <div className="no-profiles">No profiles available for comparison</div>
              )}
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