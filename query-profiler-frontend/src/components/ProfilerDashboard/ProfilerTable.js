import React from 'react';

const ProfilerTable = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="no-data">No query results available</div>;
  }

  // Get the keys from the first result as column headers
  const firstResult = data[0];
  const fields = firstResult ? Object.keys(firstResult._source || {}) : [];

  return (
    <div className="profiler-table">
      <h2>Query Results</h2>
      <table className="results-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Score</th>
            {fields.map((field, index) => (
              <th key={index}>{field}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((result, resultIndex) => (
            <tr key={resultIndex}>
              <td>{result._id}</td>
              <td>{result._score}</td>
              {fields.map((field, fieldIndex) => (
                <td key={fieldIndex}>
                  {formatField(result._source[field])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Helper function to format field values for display
const formatField = (value) => {
  if (value === null || value === undefined) {
    return '-';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value).substring(0, 100) + (JSON.stringify(value).length > 100 ? '...' : '');
  }
  
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  return String(value);
};

export default ProfilerTable; 