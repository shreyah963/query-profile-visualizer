import React from 'react';

const ProfilerChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="no-data">No profiling data available for visualization</div>;
  }

  // Calculate the total execution time
  const totalTime = data.reduce((sum, query) => sum + query.time_ms, 0);

  return (
    <div className="profiler-chart">
      <h2>Query Execution Profile</h2>
      <div className="total-time">
        Total Query Time: {totalTime.toFixed(2)} ms
      </div>
      
      <div className="chart-container">
        {data.map((query, index) => (
          <div key={index} className="query-block">
            <div className="query-type">{query.type}</div>
            <div className="query-time">{query.time_ms.toFixed(2)} ms</div>
            <div className="query-bar-container">
              <div 
                className="query-bar" 
                style={{ 
                  width: `${(query.time_ms / totalTime) * 100}%`,
                  backgroundColor: getBarColor(index)
                }}
              ></div>
            </div>
            
            {query.children && query.children.length > 0 && (
              <div className="children-container">
                {query.children.map((child, childIndex) => (
                  <div key={childIndex} className="child-block">
                    <div className="child-type">{child.type}</div>
                    <div className="child-description">{child.description}</div>
                    <div className="child-time">{child.time_ms.toFixed(2)} ms</div>
                    <div className="child-bar-container">
                      <div 
                        className="child-bar" 
                        style={{ 
                          width: `${(child.time_ms / query.time_ms) * 100}%`,
                          backgroundColor: getChildBarColor(childIndex)
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to get colors for the bars
const getBarColor = (index) => {
  const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
  return colors[index % colors.length];
};

// Helper function to get colors for the child bars
const getChildBarColor = (index) => {
  const colors = ['#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'];
  return colors[index % colors.length];
};

export default ProfilerChart; 