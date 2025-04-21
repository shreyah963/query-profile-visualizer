import React from 'react';
import './ProfilerSummary.css';

const ProfilerSummary = ({ executionTime, shardInfo, hitsInfo }) => {
  // Ensure we have a reasonable execution time value
  const validExecutionTime = typeof executionTime === 'number' && executionTime > 0 
    ? executionTime 
    : 0;
  
  // Calculate progress percentage for the execution time bar
  // Use a reasonable scale - max at around 200ms (common query times)
  const executionTimeProgress = Math.min(100, Math.max(5, validExecutionTime / 200 * 100)); 

  return (
    <div className="profiler-summary">
      <div className="summary-card">
        <h3 className="summary-title">Execution Time</h3>
        <div className="execution-time">
          <span className="time-value">{validExecutionTime} ms</span>
          <div className="time-progress-bar">
            <div 
              className="time-progress" 
              style={{ width: `${executionTimeProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="summary-divider"></div>

      <div className="summary-card">
        <h3 className="summary-title">Shard info</h3>
        <div className="shard-info">
          <p className="shard-stats">
            <span className="stat-highlight">{shardInfo.total}</span> total, 
            <span className="stat-highlight"> {shardInfo.successful}</span> successful
          </p>
          <p className="shard-stats">
            <span className="stat-highlight">{shardInfo.failed}</span> failed
          </p>
        </div>
      </div>

      <div className="summary-divider"></div>

      <div className="summary-card">
        <h3 className="summary-title">Hits</h3>
        <div className="hits-info">
          <p className="hits-total">{formatNumber(hitsInfo.total)}</p>
          <p className="hits-max-score">(max score: {hitsInfo.maxScore.toFixed(2)})</p>
        </div>
      </div>
    </div>
  );
};

// Helper function to format numbers with commas for thousands
const formatNumber = (num) => {
  if (typeof num !== 'number') {
    num = Number(num) || 0;
  }
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default ProfilerSummary; 