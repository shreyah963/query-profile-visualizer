import React, { useState } from 'react';
import ProfilerSummary from './ProfilerSummary';
import ProfilerQueries from './ProfilerQueries';
import QueryInput from './QueryInput';
import './ProfilerDashboard.css';

const ProfilerDashboard = ({ data, updateData }) => {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [profileToCompare, setProfileToCompare] = useState(null);

  if (!data) {
    return <div className="no-data">No profiling data available</div>;
  }

  const handleCompare = () => {
    setCompareMode(!compareMode);
    if (!compareMode) {
      setProfileToCompare(null);
    }
  };

  // Handle custom query execution
  const handleQueryExecuted = (newQueryData) => {
    if (updateData && typeof updateData === 'function') {
      updateData(newQueryData);
    }
    
    // Reset selection when a new query is executed
    setSelectedProfile(null);
    setProfileToCompare(null);
  };

  // Extract execution time information
  // Attempt to get it from multiple sources, prioritizing the most reliable ones
  const extractExecutionTime = () => {
    // From the took field in the response
    if (data.executionTime) {
      return data.executionTime;
    }
    
    // From raw took field
    if (data.took) {
      return data.took;
    }
    
    // From the profile data
    if (data.profileData?.shards?.[0]?.searches?.[0]?.took_in_millis) {
      return data.profileData.shards[0].searches[0].took_in_millis;
    }
    
    // From the first query's time
    if (data.profileData?.shards?.[0]?.searches?.[0]?.query?.[0]?.time_in_nanos) {
      return data.profileData.shards[0].searches[0].query[0].time_in_nanos / 1000000;
    }
    
    // Default
    return 0;
  };
  
  // Extract hits information
  const extractHitsInfo = () => {
    // If the hits info is already processed in the backend
    if (data.hitsInfo?.total !== undefined) {
      return {
        total: data.hitsInfo.total,
        maxScore: data.hitsInfo.maxScore || 0
      };
    }
    
    // Try to get from the raw hits property
    if (data.hits?.total) {
      // Handle both object and number format
      const totalHits = typeof data.hits.total === 'object' ? 
        data.hits.total.value : data.hits.total;
      
      return {
        total: totalHits,
        maxScore: data.hits.max_score || 0
      };
    }
    
    // Fallback to query results array length
    if (data.queryResults && Array.isArray(data.queryResults)) {
      return {
        total: data.queryResults.length,
        maxScore: data.queryResults[0]?._score || 0
      };
    }
    
    // Default
    return { total: 0, maxScore: 0 };
  };
  
  const executionTime = extractExecutionTime();
  
  const shardInfo = {
    total: data.profileData?._shards?.total || data._shards?.total || data.shardInfo?.total || 1,
    successful: data.profileData?._shards?.successful || data._shards?.successful || data.shardInfo?.successful || 1,
    failed: data.profileData?._shards?.failed || data._shards?.failed || data.shardInfo?.failed || 0
  };
  
  const hitsInfo = extractHitsInfo();

  return (
    <div className="profiler-dashboard">
      <header className="dashboard-header">
        <h1>Query Profiler Dashboard</h1>
        <div className="search-container">
          <input type="text" placeholder="Search profiler" className="search-input" />
          <button className="download-btn">
            <i className="download-icon">↓</i>
          </button>
        </div>
      </header>

      {/* Query Input Section */}
      <QueryInput onQueryExecuted={handleQueryExecuted} />

      <ProfilerSummary 
        executionTime={executionTime} 
        shardInfo={shardInfo} 
        hitsInfo={hitsInfo} 
      />

      <div className="dashboard-actions">
        <button 
          className={`compare-btn ${compareMode ? 'active' : ''}`}
          onClick={handleCompare}
        >
          COMPARE
        </button>
        
        <button
          className="new-query-btn"
          onClick={() => document.getElementById('query-input-trigger').click()}
        >
          NEW QUERY
        </button>
      </div>

      <ProfilerQueries 
        data={data} 
        compareMode={compareMode}
        selectedProfile={selectedProfile}
        setSelectedProfile={setSelectedProfile}
        profileToCompare={profileToCompare}
        setProfileToCompare={setProfileToCompare}
      />
    </div>
  );
};

export default ProfilerDashboard;
