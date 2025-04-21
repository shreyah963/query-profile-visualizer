import React, { useState } from 'react';
import './QueryDetail.css';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Register the language
SyntaxHighlighter.registerLanguage('json', json);

const QueryDetail = ({ query, compareQuery, compareMode }) => {
  const [showRawBreakdown, setShowRawBreakdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    breakdown: true,   // Start with breakdown section expanded
    children: false,
    explanation: false,
    queryStructure: false  // Add new queryStructure section
  });

  // Get the original query from the query object
  const originalQueryData = query.originalQueryData || null;

  if (!query) return null;

  // Safe toFixed function that handles undefined or null values
  const safeToFixed = (value, digits = 2) => {
    if (value === undefined || value === null) return '0';
    return Number(value).toFixed(digits);
  };

  // Format duration with precision
  const formatDuration = (ms) => {
    if (ms < 0.1) {
      return `${safeToFixed(ms, 4)} ms`; // Extra precision for very small values
    } else if (ms < 1) {
      return `${safeToFixed(ms, 3)} ms`; // More precision for small values
    } else if (ms < 1000) {
      return `${safeToFixed(ms, 2)} ms`; // Standard precision for normal values
    }
    return `${safeToFixed(ms / 1000, 3)} s`; // Convert to seconds for large values
  };

  const toggleSection = (section) => {
    setExpandedSections(prevState => ({
      ...prevState,
      [section]: !prevState[section]
    }));
  };

  // Determine the query intent label
  const getQueryIntentLabel = () => {
    if (query.queryName === 'MatchAllDocsQuery' && originalQueryData?.aggs) {
      return 'Aggregation Query';
    } else if (query.queryName === 'ConstantScoreQuery' && originalQueryData?.query?.bool) {
      return 'Complex Boolean Query';
    } else if (query.queryName === 'Aggregations') {
      return 'Aggregation Operations';
    } else {
      return query.queryName;
    }
  };

  // Render the original query structure in pretty JSON format with syntax highlighting
  const renderQueryStructure = () => {
    if (!originalQueryData) {
      return <div className="no-breakdown">No original query data available</div>;
    }

    try {
      const prettyJson = JSON.stringify(originalQueryData, null, 2);
      return (
        <div className="query-structure">
          <SyntaxHighlighter 
            language="json" 
            style={atomOneDark}
            className="query-json"
            customStyle={{ margin: 0, borderRadius: '4px', fontSize: '0.85rem' }}
            showLineNumbers={true}
          >
            {prettyJson}
          </SyntaxHighlighter>
        </div>
      );
    } catch (err) {
      return <div className="no-breakdown">Error rendering query structure: {err.message}</div>;
    }
  };

  const renderBreakdownItems = (breakdown, compareBreakdown = null) => {
    if (!breakdown || Object.keys(breakdown).length === 0) {
      return <div className="no-breakdown">No breakdown data available</div>;
    }

    const items = Object.entries(breakdown)
      .filter(([key, value]) => typeof value === 'number' && value > 0)
      .sort((a, b) => b[1] - a[1]);

    if (items.length === 0) {
      return <div className="no-breakdown">No breakdown data available</div>;
    }
    
    // Find the max value for scaling the bars
    const maxValue = items[0][1];

    // Function to determine color based on value (nanoseconds)
    const getPerformanceColor = (valueNs) => {
      const valueMs = valueNs / 1000000; // Convert to ms
      if (valueMs < 0.1) return '#4caf50'; // Green for fast
      if (valueMs < 1) return '#ff9800';   // Yellow/orange for medium
      return '#f44336';                    // Red for slow
    };

    return items.map(([key, value]) => {
      const compareValue = compareBreakdown ? compareBreakdown[key] || 0 : null;
      const showComparison = compareMode && compareBreakdown;
      
      // Format the key for display - replace underscores with spaces and capitalize
      const displayKey = key.replace(/_/g, ' ')
                           .replace(/\b\w/g, c => c.toUpperCase());
      
      // Convert nanoseconds to milliseconds for display
      const valueMs = value / 1000000;
      const compareValueMs = compareValue ? compareValue / 1000000 : 0;
      
      // Determine color based on performance
      const barColor = getPerformanceColor(value);

      return (
        <div key={key} className="breakdown-item">
          <div className="breakdown-label" title={displayKey}>{displayKey}</div>
          <div className="breakdown-bar-container">
            <div 
              className="breakdown-bar"
              style={{ 
                width: `${Math.min(100, (value / maxValue) * 100)}%`,
                backgroundColor: barColor
              }}
            ></div>
          </div>
          <div className="breakdown-value" style={{ color: barColor }}>
            {safeToFixed(valueMs, 3)} ms
          </div>
          
          {showComparison && (
            <div className={`comparison-indicator ${compareValue > value ? 'worse' : 'better'}`}>
              {compareValue > value ? '▲' : '▼'} {safeToFixed(Math.abs(compareValueMs - valueMs), 3)} ms
            </div>
          )}
        </div>
      );
    });
  };

  // Render raw breakdown data
  const renderRawBreakdown = (rawBreakdown) => {
    if (!rawBreakdown || Object.keys(rawBreakdown).length === 0) {
      return <div className="no-breakdown">No raw breakdown data available</div>;
    }

    // Function to determine color based on value (nanoseconds)
    const getPerformanceColor = (valueNs) => {
      if (!valueNs || valueNs === 0) return '#666666'; // Default gray for zero values
      const valueMs = valueNs / 1000000; // Convert to ms
      if (valueMs < 0.1) return '#4caf50'; // Green for fast
      if (valueMs < 1) return '#ff9800';   // Yellow/orange for medium
      return '#f44336';                    // Red for slow
    };

    // Sort and organize data for better display
    const processedData = Object.entries(rawBreakdown)
      .sort(([keyA], [keyB]) => {
        // Sort by operation type (non-count operations first)
        const isCountA = keyA.endsWith('_count');
        const isCountB = keyB.endsWith('_count');
        if (isCountA !== isCountB) return isCountA ? 1 : -1;
        
        // Then alphabetically
        return keyA.localeCompare(keyB);
      });

    // Group the data by operation type (time and count pairs)
    const timeOperations = processedData.filter(([key]) => !key.endsWith('_count'));
    const countOperations = processedData.filter(([key]) => key.endsWith('_count'));

    // Common cell styling
    const cellBaseStyle = { padding: '8px 12px' };
    const operationCellStyle = { ...cellBaseStyle, width: '50%', textAlign: 'left' };
    const numericCellStyle = { ...cellBaseStyle, width: '25%', textAlign: 'right', fontFamily: 'monospace' };

    return (
      <div className="raw-breakdown">
        <table className="raw-breakdown-table">
          <thead>
            <tr>
              <th style={operationCellStyle}>Operation</th>
              <th style={numericCellStyle}>Time (ns)</th>
              <th style={numericCellStyle}>Count</th>
            </tr>
          </thead>
          <tbody>
            {timeOperations.map(([key, value]) => {
              const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const color = getPerformanceColor(value);
              
              // Find matching count operation
              const countKey = key + '_count';
              const countEntry = countOperations.find(([k]) => k === countKey);
              const countValue = countEntry ? countEntry[1] : 0;
              
              return (
                <tr key={key}>
                  <td style={operationCellStyle}>{displayKey}</td>
                  <td style={{ ...numericCellStyle, color }}>
                    {value.toLocaleString()}
                  </td>
                  <td style={numericCellStyle}>
                    {countValue > 0 ? countValue.toLocaleString() : '\u2014'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Extract properties with default values to avoid undefined errors
  const timeMs = query.time_ms || query.totalDuration || 0;
  const percentage = query.percentage || 0;
  const queryType = query.type || query.queryName || 'Unknown query';
  const queryDescription = query.description || '';
  const children = query.children || [];
  const breakdown = query.breakdown || {};
  const rawBreakdown = query.rawBreakdown || query.breakdown || {};

  // Get the query intent label
  const queryIntentLabel = getQueryIntentLabel();

  return (
    <div className="query-detail">
      <div className="detail-header">
        <h3>
          {queryIntentLabel}
          {queryIntentLabel !== queryType && (
            <span className="technical-type">({queryType})</span>
          )}
        </h3>
        {queryDescription && (
          <p className="query-description">{queryDescription}</p>
        )}
      </div>

      <div className="detail-metrics">
        <div className="detail-metric">
          <span className="metric-label">Total time:</span>
          <span className="metric-value highlight">{formatDuration(timeMs)}</span>
        </div>
        <div className="detail-metric">
          <span className="metric-label">% of query:</span>
          <span className="metric-value">{safeToFixed(percentage, 1)}%</span>
        </div>
      </div>

      {compareMode && compareQuery && (
        <div className="comparison-header">
          <h4>Comparing with: {compareQuery.type || compareQuery.queryName || 'Unknown query'}</h4>
          <div className="comparison-metrics">
            <div className="comparison-metric">
              <span className="metric-label">Time difference:</span>
              <span className={`metric-value ${(compareQuery.time_ms || compareQuery.totalDuration || 0) > timeMs ? 'better' : 'worse'}`}>
                {safeToFixed((compareQuery.time_ms || compareQuery.totalDuration || 0) - timeMs, 3)} ms
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible sections */}
      <div className="detail-sections">
        {/* Breakdown section */}
        <div className="detail-section">
          <div 
            className={`section-header ${expandedSections.breakdown ? 'expanded' : ''}`} 
            onClick={() => toggleSection('breakdown')}
          >
            <h4>Operation Breakdown</h4>
            <span className="toggle-icon">{expandedSections.breakdown ? '▼' : '▶'}</span>
          </div>
          
          {expandedSections.breakdown && (
            <div className="section-content">
              <div className="breakdown-controls">
                <button 
                  className={`breakdown-toggle ${!showRawBreakdown ? 'active' : ''}`}
                  onClick={() => setShowRawBreakdown(false)}
                >
                  Visual Breakdown
                </button>
                <button 
                  className={`breakdown-toggle ${showRawBreakdown ? 'active' : ''}`}
                  onClick={() => setShowRawBreakdown(true)}
                >
                  Raw Data
                </button>
              </div>
              
              <div className="breakdown-list">
                {!showRawBreakdown ? 
                  renderBreakdownItems(breakdown, compareQuery?.breakdown) :
                  renderRawBreakdown(rawBreakdown)
                }
              </div>
            </div>
          )}
        </div>
        
        {/* Query Structure section */}
        {originalQueryData && (
          <div className="detail-section">
            <div 
              className={`section-header ${expandedSections.queryStructure ? 'expanded' : ''}`}
              onClick={() => toggleSection('queryStructure')}
            >
              <h4>Original Query Structure</h4>
              <span className="toggle-icon">{expandedSections.queryStructure ? '▼' : '▶'}</span>
            </div>
            
            {expandedSections.queryStructure && (
              <div className="section-content">
                {renderQueryStructure()}
              </div>
            )}
          </div>
        )}
        
        {/* Children/Subqueries section */}
        {children.length > 0 && (
          <div className="detail-section">
            <div 
              className={`section-header ${expandedSections.children ? 'expanded' : ''}`}
              onClick={() => toggleSection('children')}
            >
              <h4>Subqueries ({children.length})</h4>
              <span className="toggle-icon">{expandedSections.children ? '▼' : '▶'}</span>
            </div>
            
            {expandedSections.children && (
              <div className="section-content">
                <div className="subqueries-list">
                  {children.map((child, index) => (
                    <div key={child.id || index} className="subquery-item">
                      <div className="subquery-header">
                        <h5>{child.type || child.queryName || 'Subquery'}</h5>
                        <div className="subquery-metrics">
                          <span className="subquery-time">{formatDuration(child.time_ms || child.totalDuration || 0)}</span>
                          <span className="subquery-percentage">({safeToFixed(child.percentage || 0, 1)}%)</span>
                        </div>
                      </div>
                      {child.description && <p className="subquery-description">{child.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Query Explanation section */}
        <div className="detail-section">
          <div 
            className={`section-header ${expandedSections.explanation ? 'expanded' : ''}`}
            onClick={() => toggleSection('explanation')}
          >
            <h4>Query Explanation</h4>
            <span className="toggle-icon">{expandedSections.explanation ? '▼' : '▶'}</span>
          </div>
          
          {expandedSections.explanation && (
            <div className="section-content">
              <div className="query-explanation">
                <pre>{queryDescription}</pre>
                <div className="explanation-note">
                  <p>
                    <strong>Query type:</strong> {queryType}
                  </p>
                  <p>
                    This is a {queryIntentLabel.toLowerCase()} that took {formatDuration(timeMs)} 
                    ({safeToFixed(percentage, 1)}% of the total query execution time).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueryDetail; 