import React, { useState } from 'react';
import './QueryDetail.css';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Register the language
SyntaxHighlighter.registerLanguage('json', json);

const QueryDetail = ({ query, rootId }) => {
  const [showRawBreakdown, setShowRawBreakdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    breakdown: true,   // Start with breakdown section expanded
    children: true,    // Start with subqueries section expanded to show the hierarchy
    explanation: false,
    queryStructure: false,  // We're removing this section
    collectors: true,  // Start with collectors section expanded by default
    aggregations: true,  // Start with aggregations section expanded
    aggTypeBreakdown: true  // Auto-expand aggregation breakdown for aggregation types
  });
  // Add state to track expanded query nodes in the hierarchy view
  const [expandedQueryNodes, setExpandedQueryNodes] = useState({});

  if (!query) return null;

  // Get the original query from the query object
  const originalQueryData = query.originalQueryData || null;

  // Log the query object for debugging
  console.log('QueryDetail - received query object:', {
    id: query.id,
    queryName: query.queryName, 
    type: query.type,
    time_ms: query.time_ms,
    totalDuration: query.totalDuration,
    percentage: query.percentage,
    breakdown: query.breakdown ? Object.keys(query.breakdown).length : 0
  });

  // Helper function to format numbers with commas for thousands
  const formatNumber = (value) => {
    if (!value && value !== 0) return '0';
    return Math.round(value).toLocaleString();
  };

  // Function to determine color based on value (nanoseconds)
  const getPerformanceColor = (valueNs) => {
    if (!valueNs || valueNs === 0) return '#666666'; // Default gray for zero values
    const valueMs = valueNs / 1000000; // Convert to ms
    if (valueMs < 0.1) return '#4caf50'; // Green for fast
    if (valueMs < 1) return '#ff9800';   // Yellow/orange for medium
    return '#f44336';                    // Red for slow
  };

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
    if (query.type === 'QueryRewrite') {
      return 'Query Rewrite Phase';
    } else if (query.queryName === 'MatchAllDocsQuery') {
      // Always use the actual query name
      return 'MatchAllDocsQuery';
    } else if (query.queryName === 'ConstantScoreQuery') {
      // Always use the actual query name for ConstantScoreQuery
      return 'ConstantScoreQuery';
    } else if (query.queryName === 'Aggregations') {
      return 'Aggregation Operations';
    } else {
      return query.queryName;
    }
  };

  // Format breakdown key for better display
  const formatBreakdownKey = (key) => {
    // Replace underscores with spaces
    let displayKey = key.replace(/_/g, ' ');
    
    // Handle compound query types (like "ConstantScoreQuery BooleanQuery 0 Build Scorer")
    if (displayKey.includes('Query')) {
      // Split by space to separate query types from operations
      const parts = displayKey.split(' ');
      
      // Check if we have multiple parts that might contain query types
      const queryTypes = [];
      const operations = [];
      
      parts.forEach(part => {
        if (part.includes('Query')) {
          queryTypes.push(part);
        } else if (!isNaN(parseInt(part))) {
          // Skip numeric indices
        } else {
          operations.push(part);
        }
      });
      
      // Return as separate parts for rendering
      if (queryTypes.length > 0 && operations.length > 0) {
        return {
          operation: operations.join(' ').replace(/\b\w/g, c => c.toUpperCase()),
          queryTypes: queryTypes.join(' → ')
        };
      }
    }
    
    // Clean up common prefixes for easier reading
    displayKey = displayKey
      .replace(/^agg /i, 'Aggregation: ')
      .replace(/^collector /i, 'Collector: ');
    
    // Make first letter of each word uppercase
    displayKey = displayKey.replace(/\b\w/g, c => c.toUpperCase());
    
    return { operation: displayKey };
  };

  // Function to render breakdown data (visual style)
  const renderBreakdownItems = (breakdown) => {
    if (!breakdown || Object.keys(breakdown).length === 0) {
      return <div className="no-breakdown">No breakdown data available</div>;
    }

    console.log('Visual Breakdown - Full breakdown data:', breakdown);
    
    // First check if we have the expected structure with 'formatted' and 'raw' properties
    const formattedData = breakdown.formatted || breakdown;
    const rawData = breakdown.raw || breakdown;
    
    console.log('Visual Breakdown - Using formatted data:', formattedData);
    console.log('Visual Breakdown - Using raw data:', rawData);

    // Get all operations from the raw breakdown data (including both time and count fields)
    const uniqueOperations = new Set();
    if (rawData) {
      Object.keys(rawData).forEach(key => {
        const baseName = key.endsWith('_count') ? key.replace(/_count$/, '') : key;
        uniqueOperations.add(baseName);
      });
    }
    
    const totalOperationsCount = uniqueOperations.size;
    console.log('Visual Breakdown - Total unique operations:', totalOperationsCount);
    console.log('Visual Breakdown - Unique operations:', Array.from(uniqueOperations));

    // Ensure we use breakdown items for all fields, not just the top ones
    const breakdownItems = Object.entries(formattedData)
      .filter(([key, value]) => typeof value === 'number' && value > 0)
      .sort((a, b) => b[1] - a[1]);

    console.log('Visual Breakdown - Filtered items count:', breakdownItems.length);
    
    // If we don't have any items after filtering, try a different approach
    if (breakdownItems.length === 0) {
      console.log('Visual Breakdown - No items after filtering, trying direct approach');
      // Try direct approach if no formatted data is available
      return renderDirectBreakdown(breakdown);
    }

    // Get total for percentage calculation
    const total = breakdownItems.reduce((sum, [_, value]) => sum + value, 0);

    return (
      <>
        <div className="visual-breakdown-container">
          {breakdownItems.map(([key, value]) => {
            const color = getPerformanceColor(value);
            const percent = (value / total) * 100;
            const formattedKey = formatBreakdownKey(key);
            
            return (
              <div key={key} className="breakdown-item">
                <div className="breakdown-label">
                  <span>
                    {formattedKey.operation}
                    {formattedKey.queryTypes && (
                      <span className="query-type"> ({formattedKey.queryTypes})</span>
                    )}
                  </span>
                  <span className="breakdown-time" style={{ color }}>
                    {formatNumber(value)} ns
                  </span>
                </div>
                <div className="breakdown-bar-container">
                  <div
                    className="breakdown-bar"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // Alternative breakdown rendering when data structure doesn't match expected format
  const renderDirectBreakdown = (data) => {
    const items = Object.entries(data)
      .filter(([key, value]) => typeof value === 'number' && value > 0 && !key.includes('total') && !key.includes('formatted') && !key.includes('raw'))
      .sort((a, b) => b[1] - a[1]);
    
    console.log('Direct Breakdown - Items:', items);
    
    if (items.length === 0) {
      return <div className="no-breakdown">No breakdown data could be processed</div>;
    }
    
    // Get total for percentage calculation
    const total = items.reduce((sum, [_, value]) => sum + value, 0);
    
    return (
      <>
        <div className="visual-breakdown-container">
          {items.map(([key, value]) => {
            const color = getPerformanceColor(value);
            const percent = (value / total) * 100;
            const formattedKey = formatBreakdownKey(key);
            
            return (
              <div key={key} className="breakdown-item">
                <div className="breakdown-label">
                  <span>
                    {formattedKey.operation}
                    {formattedKey.queryTypes && (
                      <span className="query-type"> ({formattedKey.queryTypes})</span>
                    )}
                  </span>
                  <span className="breakdown-time" style={{ color }}>
                    {formatNumber(value)} ns
                  </span>
                </div>
                <div className="breakdown-bar-container">
                  <div
                    className="breakdown-bar"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // Render raw breakdown data
  const renderRawBreakdown = (rawBreakdown) => {
    if (!rawBreakdown || Object.keys(rawBreakdown).length === 0) {
      return <div className="no-breakdown">No raw breakdown data available</div>;
    }

    console.log('Raw Breakdown - Full data:', rawBreakdown);
    
    // Get all unique operation keys (excluding _count suffix)
    const uniqueOperations = new Set();
    const allKeys = Object.keys(rawBreakdown);
    
    allKeys.forEach(key => {
      const baseName = key.endsWith('_count') ? key.replace(/_count$/, '') : key;
      uniqueOperations.add(baseName);
    });
    
    const totalOperationsCount = uniqueOperations.size;
    console.log('Raw Breakdown - Total unique operations:', totalOperationsCount);
    console.log('Raw Breakdown - Unique operations:', Array.from(uniqueOperations));

    // Process all entries (don't filter any out)
    const processedData = Object.entries(rawBreakdown)
      .sort(([keyA], [keyB]) => {
        // Sort by operation type (non-count operations first)
        const isCountA = keyA.endsWith('_count');
        const isCountB = keyB.endsWith('_count');
        if (isCountA !== isCountB) return isCountA ? 1 : -1;
        
        // Next group related operations together
        const baseKeyA = isCountA ? keyA.replace(/_count$/, '') : keyA;
        const baseKeyB = isCountB ? keyB.replace(/_count$/, '') : keyB;
        
        if (baseKeyA !== baseKeyB) {
          return baseKeyA.localeCompare(baseKeyB);
        }
        
        // If base keys are the same, put the count after the time
        return isCountA ? 1 : -1;
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
        <div className="raw-breakdown-container">
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
                const formattedKey = formatBreakdownKey(key);
                const color = getPerformanceColor(value);
                
                // Find matching count operation
                const countKey = key + '_count';
                const countEntry = countOperations.find(([k]) => k === countKey);
                const countValue = countEntry ? countEntry[1] : 0;
                
                return (
                  <tr key={key}>
                    <td style={operationCellStyle}>
                      {formattedKey.operation}
                      {formattedKey.queryTypes && (
                        <span className="query-type"> ({formattedKey.queryTypes})</span>
                      )}
                    </td>
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
      </div>
    );
  };

  // Extract properties with default values to avoid undefined errors
  const timeMs = query.time_ms || query.totalDuration || 0;
  const percentage = query.percentage || 0;
  const queryType = typeof query.type === 'string' ? query.type : (typeof query.queryName === 'string' ? query.queryName : '');
  const queryDescription = query.description || '';
  const children = query.children || [];
  const breakdown = query.breakdown || {};
  const rawBreakdown = query.rawBreakdown || query.breakdown || {};
  
  // Log extracted timing information for debugging
  console.log('QueryDetail - extracted timing info:', {
    queryType,
    timeMs,
    percentage,
    time_ms: query.time_ms,
    totalDuration: query.totalDuration
  });
  
  // Extract aggregation data if available
  const aggregations = query.aggregations || [];
  
  // Combine breakdown data with aggregation breakdowns for complete view
  const combinedBreakdown = {...breakdown};
  const combinedRawBreakdown = {...rawBreakdown};
  
  // Add aggregation data to combined breakdowns if available
  if (aggregations && aggregations.length > 0) {
    const aggregationBreakdown = {
      formatted: {},
      raw: {},
      total: 0
    };
    
    // Process each aggregation and add its breakdown data
    aggregations.forEach(agg => {
      if (agg.breakdown) {
        // Add to raw breakdown
        Object.entries(agg.breakdown).forEach(([key, value]) => {
          // Add prefix to distinguish aggregation operations
          const prefixedKey = `${agg.description || 'agg'}_${key}`;
          combinedRawBreakdown[prefixedKey] = value;
          
          // For formatted view, summarize by aggregation type
          const displayKey = `${agg.description || agg.type || 'Aggregation'}`;
          if (!aggregationBreakdown.formatted[displayKey]) {
            aggregationBreakdown.formatted[displayKey] = 0;
          }
          aggregationBreakdown.formatted[displayKey] += value;
          aggregationBreakdown.total += value;
          
          // Keep count operations separate
          if (key.endsWith('_count')) {
            combinedRawBreakdown[prefixedKey] = value;
          }
        });
      }
      
      // Add total aggregation time if available
      if (agg.time_in_nanos) {
        const displayKey = `${agg.description || agg.type || 'Aggregation'} (Total)`;
        aggregationBreakdown.formatted[displayKey] = agg.time_in_nanos;
        combinedRawBreakdown[`${agg.description || 'agg'}_total_time`] = agg.time_in_nanos;
        aggregationBreakdown.total += agg.time_in_nanos;
      }
    });
    
    // Add the aggregation data to combined breakdown
    if (Object.keys(aggregationBreakdown.formatted).length > 0) {
      // If the breakdown has a formatted property, add aggregation data to it
      if (combinedBreakdown.formatted) {
        Object.entries(aggregationBreakdown.formatted).forEach(([key, value]) => {
          combinedBreakdown.formatted[key] = value;
        });
        
        // Update total if it exists
        if (combinedBreakdown.total) {
          combinedBreakdown.total += aggregationBreakdown.total;
        }
      } else {
        // Otherwise add directly to the combined breakdown
        Object.entries(aggregationBreakdown.formatted).forEach(([key, value]) => {
          combinedBreakdown[key] = value;
        });
      }
    }
  }

  // Get the query intent label
  const queryIntentLabel = getQueryIntentLabel() || '';
  
  // Check if there are aggregations available
  const hasAggregations = aggregations && aggregations.length > 0;
  
  // First define isConstantScore to check for constant score queries
  const isConstantScore = queryType === 'ConstantScoreQuery' || (query && query.queryName === 'ConstantScoreQuery');
  
  // Then define isQueryRewrite to explicitly exclude constant score queries
  const isQueryRewrite = !isConstantScore && (
    queryType === 'QueryRewrite' || 
    queryType === 'Query Rewrite' || 
    (query && (query.queryName === 'QueryRewrite' || query.queryName === 'Query Rewrite'))
  );
  
  const isCollector = queryType === 'Collector' || (query && query.queryName === 'Collector');
  
  // Add more type checks as needed
  const isAggregationType = query.type === 'AggregationType' || 
                           query.queryName?.includes('Aggregator') ||
                           (query.queryName && query.queryName !== 'Aggregations' && query.type !== 'Aggregations' && 
                            query.breakdown && Object.keys(query.breakdown).length > 0);
  
  const isAggregationGroup = query.type === 'Aggregations' && query.queryName === 'Aggregations';
  
  // Check for breakdown data - also check for direct aggregation data
  const hasBreakdownData = (!isCollector && !isQueryRewrite && Object.keys(breakdown).length > 0) || 
                            (aggregations && aggregations.length > 0 && aggregations.some(agg => agg.breakdown || agg.time_in_nanos)) ||
                            (isAggregationType && query.breakdown && Object.keys(query.breakdown).length > 0);
  
  // Add direct aggregation breakdown handling for aggregation types
  if (isAggregationType && query.breakdown && Object.keys(query.breakdown).length > 0) {
    combinedBreakdown.directAggregation = query.breakdown;
    Object.entries(query.breakdown).forEach(([key, value]) => {
      if (!key.endsWith('_count')) {
        combinedRawBreakdown[key] = value;
      }
    });
  }
  
  // Get collector data if this is the Query Collectors section
  const hasCollectorData = isCollector && query.collectorData && query.collectorData.length > 0;

  // Helper function to check current query type against a list of possible types
  const isCurrentQueryType = (types) => {
    if (types === 'ConstantScoreQuery') return isConstantScore;
    if (types === 'QueryRewrite') return isQueryRewrite;
    if (types === 'Collectors') return isCollector;
    if (types === 'Aggregations') return isAggregationType;
    // Add more type checks as needed
    return false;
  };

  // Helper function to toggle a query node's expanded state
  const toggleQueryNode = (queryId) => {
    setExpandedQueryNodes(prev => ({
      ...prev,
      [queryId]: !prev[queryId]
    }));
  };

  // Recursive function to render query hierarchy with proper indentation
  const renderQueryHierarchy = (queryChildren, level, rootTimeMs) => {
    return (
      <div className="query-hierarchy-level" style={{ marginLeft: level * 18 }}>
        {queryChildren.map((child, index) => {
          const queryId = child.id || `child-${level}-${index}`;
          const hasChildren = child.children && child.children.length > 0;
          const isExpanded = expandedQueryNodes[queryId] !== false;
          const childTimeMs = child.time_ms || 0;
          const percentage = rootTimeMs > 0 ? (childTimeMs / rootTimeMs) * 100 : 0;
          const queryType = child.type || child.queryName || 'Query';
          
          return (
            <div key={queryId} className="query-hierarchy-item">
              <div className="query-node-connector"></div>
              <div 
                className={`query-node ${hasChildren ? 'has-children' : ''} type-${queryType.toLowerCase()}`}
                data-type={queryType === 'Collector' ? 'Collector' : queryType}
              >
                <div 
                  className="query-node-header"
                  onClick={() => hasChildren && toggleQueryNode(queryId)}
                >
                  {hasChildren && (
                    <span className="query-node-toggle">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  )}
                  <h5>{queryType === 'Collector' && child.queryName ? child.queryName : queryType}</h5>
                  <div className="query-node-metrics">
                    <span className="query-node-percentage">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                {child.description && (
                  <p className="query-node-description">{child.description}</p>
                )}
                
                {hasChildren && isExpanded && (
                  <div className="query-node-children">
                    {renderQueryHierarchy(child.children, level + 1, rootTimeMs)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Utility to safely lowercase a string
  const safeLowerCase = (val) => (typeof val === 'string' ? val.toLowerCase() : '');

  // --- Add after extracting queryType, queryIntentLabel, etc. ---
  const isRewrite = query.type === 'Rewrite' || query.queryName === 'Rewrite';
  const collectorChildren = query.children || [];

  // Special rendering for AggregationDebug node
  if (query.type === 'AggregationDebug' && query.debug) {
    return (
      <div className="query-detail">
        <div className="detail-header">
          <h3 className="query-type-aggregationdebug">
            <span className="query-label">{query.queryName}</span>
            <span className="technical-type">(Debug Info)</span>
          </h3>
          {query.description && (
            <p className="query-description">{query.description}</p>
          )}
        </div>
        <div className="detail-section">
          <div className="section-header expanded">
            <h4>Debug Info</h4>
          </div>
          <div className="section-content">
            <div className="aggregation-debug">
              <div className="aggregation-debug-data">
                {Object.entries(query.debug).map(([key, value]) => (
                  <div key={key} className="debug-item-small">
                    <span className="debug-label-small">{key.replace(/_/g, ' ')}</span>
                    <span className="debug-value-small">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="query-detail">
      <div className="detail-header">
        {/* Header for Rewrite and Collector types */}
        {isRewrite ? (
          <h3 className="query-type-rewrite">
            <span className="query-label">Query Rewrite</span>
            <span className="technical-type">(Rewrite)</span>
          </h3>
        ) : isCollector ? (
          <h3 className="query-type-collector">
            <span className="query-label">Collector</span>
            <span className="technical-type">({queryType})</span>
          </h3>
        ) : (
          <h3 className={`query-type-${safeLowerCase(queryType).replace(/\s+/g, '-')}`}>
          <span className="query-label">{queryIntentLabel}</span>
          {queryIntentLabel !== queryType && (
            <span className="technical-type">({queryType})</span>
          )}
        </h3>
        )}
        {queryDescription && (
          <p className="query-description">{queryDescription}</p>
        )}
      </div>

      <div className="detail-metrics">
        <div className="detail-metric">
          <span className="metric-label"><strong>Total time:</strong></span>
          <span className="metric-value-total">{formatDuration(timeMs)}</span>
        </div>
        {/* Show percentage for all nodes except the Collectors root node and root query node */}
        {!isRewrite && !isCollector && queryType !== 'Collectors' && query.queryName !== 'Collectors' && query.id !== rootId && percentage !== 100 && (
          <div className="detail-metric">
            <span className="metric-label"><strong>Percentage of total execution:</strong></span>
            <span className="metric-value-percentage">{safeToFixed(percentage, 1)}%</span>
          </div>
        )}
      </div>

      {/* Special handling for Rewrite node */}
      {isRewrite && (
        <div className="detail-section">
          <div className="section-header expanded">
            <h4>Rewrite Phase</h4>
          </div>
          <div className="section-content">
            <div className="rewrite-explanation">
              <p>This node represents the time spent rewriting the query before execution. This phase includes optimizations and transformations performed by the search engine.</p>
            </div>
          </div>
        </div>
      )}

      {/* Render the rest of the sections as before, but skip for Rewrite/Collector */}
      {!isRewrite && !isCollector && (
        <>
      {/* Collapsible sections */}
      <div className="detail-sections">
        {/* Breakdown section - only show for non-collector queries and non-aggregation types */}
        {hasBreakdownData && !isAggregationType && (
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
                    renderBreakdownItems(combinedBreakdown) :
                    renderRawBreakdown(combinedRawBreakdown)
                  }
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Children/Subqueries section with hierarchical visualization */}
        {children.length > 0 && (
          <div className="detail-section">
            <div 
              className={`section-header ${expandedSections.children ? 'expanded' : ''}`}
              onClick={() => toggleSection('children')}
            >
              <h4>Query Hierarchy</h4>
              <span className="toggle-icon">{expandedSections.children ? '▼' : '▶'}</span>
            </div>
            
            {expandedSections.children && (
              <div className="section-content">
                <div className="section-intro">
                  This visualization shows the hierarchical structure of the query and its subqueries.
                </div>
                
                <div className="query-hierarchy">
                  {/* Root query node */}
                  <div className="query-hierarchy-root">
                        <div className={`query-node query-node-root type-collectors`} data-type="Collectors">
                      <div className="query-node-header">
                        <h5>{queryType}</h5>
                        <div className="query-node-metrics">
                              <span className="query-node-percentage">(100.0%)</span>
                        </div>
                      </div>
                      <p className="query-node-description">{queryDescription}</p>
                      <div className="query-node-children">
                        {renderQueryHierarchy(children, 0, timeMs)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collector Details section - only show for collector queries */}
        {isCollector && hasCollectorData && (
          <div className="detail-section collector-details-section">
            <div 
              className={`section-header ${expandedSections.collectors ? 'expanded' : ''}`}
              onClick={() => toggleSection('collectors')}
            >
              <h4>Collector Details</h4>
              <span className="toggle-icon">{expandedSections.collectors ? '▼' : '▶'}</span>
            </div>
            
            {expandedSections.collectors && (
              <div className="section-content">
                <div className="section-intro">
                  These collectors handle the gathering and processing of matching documents.
                </div>
                <div className="collectors-list">
                  {query.collectorData.map((collector, index) => (
                    <div key={index} className="collector-item">
                      <div className="collector-header">
                        <h5>{collector.name}</h5>
                        <div className="collector-metrics">
                          <span className="collector-time">{formatDuration(collector.time_ms)}</span>
                          <span className="collector-percentage">({safeToFixed(collector.percentage || 0, 1)}%)</span>
                        </div>
                      </div>
                      {collector.reason && (
                        <p className="collector-reason">{collector.reason}</p>
                      )}
                      
                      {/* Display collector children if they exist */}
                      {collector.children && collector.children.length > 0 && (
                        <div className="collector-children">
                          <h6 className="collector-children-header">Sub-Collectors:</h6>
                          <div className="collector-children-list">
                            {collector.children.map((child, childIndex) => (
                              <div key={childIndex} className="collector-child-item">
                                <div className="collector-child-header">
                                  <h6>{child.name}</h6>
                                  <div className="collector-child-metrics">
                                    <span className="collector-child-time">{formatDuration(child.time_ms)}</span>
                                    <span className="collector-child-percentage">({safeToFixed(child.percentage || 0, 1)}%)</span>
                                  </div>
                                </div>
                                {child.reason && (
                                  <p className="collector-child-reason">{child.reason}</p>
                                )}
                                
                                {/* Recursively display nested children if they exist */}
                                {child.children && child.children.length > 0 && (
                                  <div className="collector-nested-children">
                                    <h6 className="collector-nested-header">Nested Collectors:</h6>
                                    <div className="collector-nested-list">
                                      {child.children.map((nestedChild, nestedIndex) => (
                                        <div key={nestedIndex} className="collector-nested-item">
                                          <div className="collector-nested-header">
                                            <h6>{nestedChild.name}</h6>
                                            <div className="collector-nested-metrics">
                                              <span className="collector-nested-time">{formatDuration(nestedChild.time_ms)}</span>
                                              <span className="collector-nested-percentage">({safeToFixed(nestedChild.percentage || 0, 1)}%)</span>
                                            </div>
                                          </div>
                                          {nestedChild.reason && (
                                            <p className="collector-nested-reason">{nestedChild.reason}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Aggregations section - always show if there are aggregations, regardless of query type */}
        {hasAggregations && (
          <div className="detail-section aggregations-section">
            <div 
              className={`section-header ${expandedSections.aggregations ? 'expanded' : ''}`}
              onClick={() => toggleSection('aggregations')}
            >
              <h4>Aggregations ({aggregations.length})</h4>
              <span className="toggle-icon">{expandedSections.aggregations ? '▼' : '▶'}</span>
            </div>
            
            {expandedSections.aggregations && (
              <div className="section-content">
                <div className="section-intro">
                  Aggregations compute metrics and statistics by processing the matched documents.
                </div>
                <div className="aggregations-list">
                      {aggregations.map((agg, index) => {
                        console.log('Aggregation object:', agg);
                        return (
                    <div key={index} className="aggregation-item">
                      <div className="aggregation-header">
                              <h5>{agg.type || `Aggregation ${index + 1}`}</h5>
                        <div className="aggregation-metrics">
                          <span className="aggregation-time">{formatDuration(agg.time_in_nanos / 1000000)}</span>
                          <span className="aggregation-percentage">({safeToFixed((agg.time_in_nanos / 1000000 / timeMs) * 100, 1)}%)</span>
                        </div>
                      </div>
                            {/* Always show aggregation description below the header if present */}
                            {agg.description && (
                              <div className="aggregation-description" style={{ marginBottom: '0.5rem', color: '#555', fontStyle: 'italic' }}>
                                {agg.description}
                              </div>
                            )}
                      <div className="aggregation-details">
                        <p className="aggregation-type">
                          <strong>Type:</strong> {agg.type || 'Unknown type'}
                        </p>
                        {agg.breakdown && Object.keys(agg.breakdown).length > 0 && (
                          <div className="aggregation-breakdown">
                            <h6>Breakdown:</h6>
                            <div className="aggregation-breakdown-data">
                              {Object.entries(agg.breakdown)
                                .filter(([key, value]) => typeof value === 'number' && value > 0 && !key.endsWith('_count'))
                                .sort(([_, a], [__, b]) => b - a)
                                .map(([key, value]) => (
                                  <div key={key} className="breakdown-item-small">
                                    <span className="breakdown-label-small">{key.replace(/_/g, ' ')}</span>
                                    <span className="breakdown-value-small">{formatNumber(value)} ns</span>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        )}
                        {agg.debug && Object.keys(agg.debug).length > 0 && (
                          <div className="aggregation-debug">
                            <h6>Debug Info:</h6>
                            <div className="aggregation-debug-data">
                              {Object.entries(agg.debug).map(([key, value]) => (
                                <div key={key} className="debug-item-small">
                                  <span className="debug-label-small">{key.replace(/_/g, ' ')}</span>
                                  <span className="debug-value-small">{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                        );
                      })}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Display for individual aggregation type - Keep this section as it shows details for the selected aggregation */}
        {isAggregationType && query.breakdown && Object.keys(query.breakdown).length > 0 && (
          <div className="detail-section">
            <div 
              className={`section-header ${expandedSections.aggTypeBreakdown ? 'expanded' : ''}`} 
              onClick={() => toggleSection('aggTypeBreakdown')}
            >
              <h4>Operation Breakdown: {query.description || query.queryName || query.type}</h4>
              <span className="toggle-icon">{expandedSections.aggTypeBreakdown ? '▼' : '▶'}</span>
            </div>
            
            {expandedSections.aggTypeBreakdown && (
              <div className="section-content">
                <div className="section-intro">
                  This shows the detailed timing for each phase of the {query.queryName || query.type} aggregation.
                </div>
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
                    renderBreakdownItems(combinedBreakdown) :
                    renderRawBreakdown(combinedRawBreakdown)
                  }
                </div>
              </div>
            )}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

// --- Add this helper component at the bottom of the file: ---
function CollectorTree({ collector, level, formatDuration, safeToFixed }) {
  // Similar to renderQueryHierarchy, but for collectors
  return (
    <div className={`query-hierarchy-level level-${level}`} style={{ marginLeft: level * 18 }}>
      <div className="query-node" style={{ marginBottom: 10, background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 6, padding: 12 }}>
        <div className="query-node-header">
          <h5 style={{ margin: 0 }}>{collector.name || 'Collector'}</h5>
          <div className="query-node-metrics">
            <span className="query-node-time">{formatDuration(collector.time_ms)}</span>
            <span className="query-node-percentage">({safeToFixed(collector.percentage || 0, 1)}%)</span>
          </div>
        </div>
        {collector.reason && (
          <p className="query-node-description" style={{ margin: '6px 0 0 0', fontStyle: 'italic', color: '#475569' }}>{collector.reason}</p>
        )}
        {/* Recursively render children */}
        {collector.children && collector.children.length > 0 && (
          <div className="query-node-children">
            {collector.children.map((child, idx) => (
              
              <CollectorTree 
                key={child.name + '-' + idx} 
                collector={child} 
                level={level + 1}
                formatDuration={formatDuration}
                safeToFixed={safeToFixed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default QueryDetail;