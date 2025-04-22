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
    children: true,    // Start with subqueries section expanded to show the hierarchy
    explanation: false,
    queryStructure: false,  // We're removing this section
    collectors: true,  // Start with collectors section expanded by default
    aggregations: true,  // Start with aggregations section expanded
    aggTypeBreakdown: true  // Auto-expand aggregation breakdown for aggregation types
  });

  // Add state to track expanded query nodes in the hierarchy view
  const [expandedQueryNodes, setExpandedQueryNodes] = useState({});

  // Get the original query from the query object
  const originalQueryData = query.originalQueryData || null;

  if (!query) return null;

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
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            return (
              <div key={key} className="breakdown-item">
                <div className="breakdown-label">
                  <span>{displayKey}</span>
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
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            return (
              <div key={key} className="breakdown-item">
                <div className="breakdown-label">
                  <span>{displayKey}</span>
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
  const queryIntentLabel = getQueryIntentLabel();
  
  // Check if this is a collector type or query rewrite that doesn't have breakdown data
  const isCollector = queryType === 'Collectors' || queryIntentLabel === 'Query Collectors';
  const isConstantScore = queryType === 'ConstantScoreQuery' || query.queryName === 'ConstantScoreQuery';
  const isQueryRewrite = (queryType === 'QueryRewrite' || queryIntentLabel === 'Query Rewrite') && !isConstantScore;
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
  
  // Check if there are aggregations available
  const hasAggregations = aggregations && aggregations.length > 0;
  
  // Get collector data if this is the Query Collectors section
  const hasCollectorData = isCollector && query.collectorData && query.collectorData.length > 0;

  // Function to determine if the current query matches a specific type
  const isCurrentQueryType = (type) => {
    if (type === 'ConstantScoreQuery') return isConstantScore;
    if (type === 'QueryRewrite') return isQueryRewrite;
    if (type === 'Collectors') return isCollector;
    if (type === 'Aggregations') return isAggregationType;
    // Add more type checks as needed
    return false;
  };

  // Get explanation content for current query type
  const renderExplanationContent = () => {
    if (isConstantScore) {
      return (
        <div className="constant-score-explanation">
          <p>
            ConstantScoreQuery wraps a filter query and gives all matching documents a constant score equal to the query boost.
            Unlike regular queries, filter queries don't calculate relevance scores, making them more efficient for filtering operations.
          </p>
          <p>
            This query type is optimized for scenarios where you need to filter documents without caring about scoring relevance.
            It generally performs better than equivalent queries that calculate scores.
          </p>
        </div>
      );
    } else if (isQueryRewrite) {
      return (
        <div className="rewrite-explanation">
          <p>
            Query rewriting is the process where OpenSearch transforms and optimizes the query before execution. 
            This includes tasks such as analyzing text, expanding wildcards, simplifying Boolean expressions, 
            and other optimizations to improve search performance.
          </p>
          <p>
            A higher rewrite time relative to the total query time might indicate a complex query structure
            that required extensive preprocessing before execution.
          </p>
        </div>
      );
    } else if (isCollector) {
      return (
        <div className="collector-explanation">
          <p>
            Query Collectors are responsible for gathering the matching documents after the query execution phase.
            They handle tasks like sorting, scoring, and organizing the final result set that will be returned to the client.
          </p>
          {hasCollectorData && (
            <p>
              This query used the following collectors:
              <ul>
                {query.collectorData.map((collector, index) => (
                  <li key={index}>
                    <strong>{collector.name}</strong> ({formatDuration(collector.time_ms)}): 
                    {collector.reason ? ` ${collector.reason}` : ' Document collection phase'}
                  </li>
                ))}
              </ul>
            </p>
          )}
        </div>
      );
    } else if (isAggregationType) {
      // Handle specific aggregation type explanations
      const aggType = query.type || query.queryName || '';
      
      if (aggType.includes('AvgAggregator')) {
        return (
          <div className="aggregation-explanation">
            <p>
              The Average (Avg) Aggregator computes the average of numeric values extracted from the matched documents. 
              It's commonly used to calculate mean values across a dataset.
            </p>
            <p>
              This aggregation type requires two phases: collecting values from all matched documents, 
              and then computing the final average by dividing the sum by the count.
            </p>
          </div>
        );
      } else if (aggType.includes('TermsAggregator') || aggType.includes('NonCollectingAggregator')) {
        return (
          <div className="aggregation-explanation">
            <p>
              The Terms Aggregator groups documents based on field values, creating "buckets" of documents 
              that share the same terms. It's used for categorizing results by specific field values.
            </p>
            <p>
              This aggregation type involves building specialized collectors to gather and organize terms,
              and then post-processing to construct the final term buckets with counts.
            </p>
          </div>
        );
      } else {
        return (
          <div className="aggregation-explanation">
            <p>
              Aggregations are operations that process the matched documents to compute metrics, statistics, 
              or to organize documents into buckets based on criteria like field values or ranges.
            </p>
            <p>
              This aggregation type ({aggType}) involves several phases including initialization, 
              collecting values from matched documents, and computing final results.
            </p>
          </div>
        );
      }
    } else {
      return <pre>{queryDescription}</pre>;
    }
  };

  // Helper function to toggle a query node's expanded state
  const toggleQueryNode = (queryId) => {
    setExpandedQueryNodes(prev => ({
      ...prev,
      [queryId]: !prev[queryId]
    }));
  };

  // Recursive function to render query hierarchy with proper indentation
  const renderQueryHierarchy = (queryChildren, level) => {
    if (!queryChildren || queryChildren.length === 0) return null;
    
    return (
      <div className={`query-hierarchy-level level-${level}`}>
        {queryChildren.map((child, index) => {
          const queryId = child.id || `child-${level}-${index}`;
          const isExpanded = expandedQueryNodes[queryId] !== false; // Default to expanded
          const hasChildren = child.children && child.children.length > 0;
          const queryType = child.type || child.queryName || 'Unknown';
          
          return (
            <div key={queryId} className="query-hierarchy-item">
              <div className="query-node-connector"></div>
              <div 
                className={`query-node ${hasChildren ? 'has-children' : ''}`}
                data-type={queryType}
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
                  <h5>{queryType}</h5>
                  <div className="query-node-metrics">
                    <span className="query-node-time">{formatDuration(child.time_ms || child.totalDuration || 0)}</span>
                    <span className="query-node-percentage">({safeToFixed(child.percentage || 0, 1)}%)</span>
                  </div>
                </div>
                {child.description && (
                  <p className="query-node-description">{child.description}</p>
                )}
                
                {/* Render breakdown summary */}
                {child.breakdown && Object.keys(child.breakdown).length > 0 && (
                  <div className="query-node-breakdown">
                    <div className="query-node-breakdown-summary">
                      {Object.entries(child.breakdown)
                        .filter(([key, value]) => 
                          typeof value === 'number' && 
                          value > 0 && 
                          !key.endsWith('_count') && 
                          ['next_doc', 'advance', 'build_scorer', 'match'].includes(key)
                        )
                        .sort(([_, a], [__, b]) => b - a)
                        .slice(0, 3) // Show top 3 operations
                        .map(([key, value]) => (
                          <span key={key} className="query-node-operation">
                            {key.replace(/_/g, ' ')}: {formatNumber(value)} ns
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}
                
                {/* Recursively render children */}
                {hasChildren && isExpanded && (
                  <div className="query-node-children">
                    {renderQueryHierarchy(child.children, level + 1)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="query-detail">
      <div className="detail-header">
        <h3 className={`query-type-${queryType.toLowerCase().replace(/\s+/g, '-')}`}>
          <span className="query-label">{queryIntentLabel}</span>
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
          <span className="metric-label">Percentage of total execution:</span>
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
        
        {/* Query Structure section - REMOVED */}
        
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
                    <div className="query-node query-node-root" data-type={queryType}>
                      <div className="query-node-header">
                        <h5>{queryType}</h5>
                        <div className="query-node-metrics">
                          <span className="query-node-time">{formatDuration(timeMs)}</span>
                          <span className="query-node-percentage">({safeToFixed(percentage, 1)}%)</span>
                        </div>
                      </div>
                      <p className="query-node-description">{queryDescription}</p>
                      {/* Render children with connecting lines */}
                      <div className="query-node-children">
                        {renderQueryHierarchy(children, 0)}
                      </div>
                    </div>
                  </div>
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
                {renderExplanationContent()}
                <div className="explanation-note">
                  <p>
                    <strong>Query type:</strong> {queryType}
                  </p>
                  <p>
                    This is a {queryIntentLabel.toLowerCase()} that took {formatDuration(timeMs)} 
                    ({safeToFixed(percentage, 1)}% of the total execution time).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

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
                  {aggregations.map((agg, index) => (
                    <div key={index} className="aggregation-item">
                      <div className="aggregation-header">
                        <h5>{agg.description || agg.type || `Aggregation ${index + 1}`}</h5>
                        <div className="aggregation-metrics">
                          <span className="aggregation-time">{formatDuration(agg.time_in_nanos / 1000000)}</span>
                          <span className="aggregation-percentage">({safeToFixed((agg.time_in_nanos / 1000000 / timeMs) * 100, 1)}%)</span>
                        </div>
                      </div>
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
                      </div>
                    </div>
                  ))}
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
    </div>
  );
};

export default QueryDetail;