import React, { useState, useEffect } from 'react';

const ProfilerComparisonResults = ({ profiles, comparisonType, onClose }) => {
  const [comparisonData, setComparisonData] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  // Add detailed logging of the profiles prop
  console.log('ProfilerComparisonResults received props:', {
    profiles,
    comparisonType,
    profilesLength: profiles?.length,
    profile1Structure: profiles?.[0] ? Object.keys(profiles[0]) : 'no profile 1',
    profile2Structure: profiles?.[1] ? Object.keys(profiles[1]) : 'no profile 2',
    fullProfile1: profiles?.[0],
    fullProfile2: profiles?.[1]
  });

  // Format breakdown key - shared helper function for displaying metrics consistently
  const formatBreakdownKey = (key) => {
    // Return the original key without any modifications
    return { operation: key };
  };

  useEffect(() => {
    console.log('useEffect triggered with profiles:', {
      profilesExist: !!profiles,
      profilesLength: profiles?.length,
      profile1: profiles?.[0],
      profile2: profiles?.[1]
    });
    
    if (profiles && profiles.length === 2) {
      // Check if we need to transform the data structure
      const transformedProfile1 = profiles[0]?.profile ? profiles[0] : { profile: profiles[0] };
      const transformedProfile2 = profiles[1]?.profile ? profiles[1] : { profile: profiles[1] };
      
      console.log('Transformed profiles:', {
        profile1: transformedProfile1,
        profile2: transformedProfile2
      });
      
      const data = calculateComparisonData(transformedProfile1, transformedProfile2);
      console.log('Calculated comparison data:', data);
      setComparisonData(data);
    }
  }, [profiles]);
  
  const calculateComparisonData = (profile1, profile2) => {
    console.log('Calculating comparison data for profiles:', profile1, profile2);

    // Handle both direct profile objects and objects with profile property
    const prof1 = profile1?.profile || profile1;
    const prof2 = profile2?.profile || profile2;

    if (!prof1?.shards?.[0]?.searches?.[0] || !prof2?.shards?.[0]?.searches?.[0]) {
      console.warn('Invalid profile data structure:', { prof1, prof2 });
      return { differences: [] };
    }

    const differences = [];

    // Helper function to get ordered fields from a breakdown object
    const getOrderedFields = (breakdown) => {
      if (!breakdown) return [];
      return Object.keys(breakdown).map((field, index) => ({
        field,
        originalIndex: index
      }));
    };

    // Helper function to compare two objects and find field differences
    const compareObjects = (obj1, obj2, context) => {
      const fields1 = getOrderedFields(obj1);
      const fields2 = getOrderedFields(obj2);

      console.log(`Comparing fields at ${context.path}:`, { fields1, fields2 });

      const fieldSet1 = new Set(fields1.map(f => f.field));
      const fieldSet2 = new Set(fields2.map(f => f.field));
      
      // Create a map of field positions in obj2
      const fieldPositionsInObj2 = new Map(
        fields2.map(f => [f.field, f.originalIndex])
      );

      // Check for reordered fields
      fields1.forEach(field1 => {
        if (fieldSet2.has(field1.field)) {
          const pos1 = field1.originalIndex;
          const pos2 = fieldPositionsInObj2.get(field1.field);
          
          if (pos1 !== pos2) {
            differences.push({
              type: 'reorder',
              field: field1.field,
              path: context.path,
              queryType: context.queryType,
              description: context.description,
              oldPosition: pos1 + 1,
              newPosition: pos2 + 1
            });
          }
        }
      });

      // Check for missing fields
      fields1.forEach(field => {
        if (!fieldSet2.has(field.field)) {
          differences.push({
            type: 'missing',
            field: field.field,
            path: context.path,
            queryType: context.queryType,
            description: context.description
          });
        }
      });

      // Check for added fields
      fields2.forEach(field => {
        if (!fieldSet1.has(field.field)) {
          differences.push({
            type: 'added',
            field: field.field,
            path: context.path,
            queryType: context.queryType,
            description: context.description
          });
        }
      });
    };

    // Compare main query breakdown
    const query1 = prof1.shards[0].searches[0].query[0];
    const query2 = prof2.shards[0].searches[0].query[0];
    
    if (query1?.breakdown && query2?.breakdown) {
      compareObjects(query1.breakdown, query2.breakdown, {
        path: 'Query Breakdown',
        queryType: query1.type,
        description: query1.description
      });
    }

    // Compare child queries recursively
    const compareChildQueries = (children1, children2, parentPath) => {
      if (!children1 || !children2) return;
      
      children1.forEach((child1, index) => {
        const child2 = children2[index];
        if (child1?.breakdown && child2?.breakdown) {
          compareObjects(child1.breakdown, child2.breakdown, {
            path: `${parentPath} → Child Query`,
            queryType: child1.type,
            description: child1.description
          });
        }
        // Recursively compare nested children
        if (child1.children && child2.children) {
          compareChildQueries(child1.children, child2.children, `${parentPath} → ${child1.type}`);
        }
      });
    };

    if (query1?.children && query2?.children) {
      compareChildQueries(query1.children, query2.children, query1.type);
    }

    // Compare collector fields
    const collector1 = prof1.shards[0].searches[0].collector[0];
    const collector2 = prof2.shards[0].searches[0].collector[0];
    if (collector1 && collector2) {
      compareObjects(collector1, collector2, {
        path: 'Collector',
        queryType: collector1.name,
        description: collector1.reason
      });
    }

    // Compare aggregations recursively
    const compareAggregations = (aggs1, aggs2, parentPath = 'Aggregation') => {
      if (!aggs1 || !aggs2) return;
      aggs1.forEach((agg1, index) => {
        const agg2 = aggs2[index];
        if (!agg1 || !agg2) {
          differences.push({
            type: 'missing',
            field: `Aggregation ${index + 1}`,
            path: `${parentPath} → Aggregation ${index + 1}`
          });
          return;
        }
        // Compare aggregation fields
        if (agg1.breakdown && agg2.breakdown) {
          compareObjects(agg1.breakdown, agg2.breakdown, {
            path: `${parentPath} → ${agg1.type || 'Aggregation'} (${agg1.description || ''})`,
            queryType: agg1.type,
            description: agg1.description
          });
        }
        // Recursively compare aggregation children
        if (agg1.children && agg2.children) {
          compareAggregations(agg1.children, agg2.children, `${parentPath} → ${agg1.type || 'Aggregation'}`);
        }
      });
    };

    // Compare aggregations recursively
    const aggs1 = prof1.shards[0].aggregations || [];
    const aggs2 = prof2.shards[0].aggregations || [];
    if (aggs1.length > 0 || aggs2.length > 0) {
      compareAggregations(aggs1, aggs2, 'Aggregation');
    }

    console.log('Calculated differences:', differences);
    return { differences };
  };
  
  const formatTime = (time) => {
    if (time === undefined || time === null) return 'N/A';
    
    // Handle nanosecond level values (less than 0.001 milliseconds)
    if (time < 0.001) {
      return `${(time * 1000).toFixed(2)}μs`;
    }
    
    // Handle microsecond level values (less than 1 millisecond)
    if (time < 1) {
      return `${time.toFixed(2)}μs`;
    } 
    
    // Handle millisecond level values (less than 1000 milliseconds)
    if (time < 1000) {
      return `${time.toFixed(2)}ms`;
    }
    
    // Handle seconds
    return `${(time / 1000).toFixed(2)}s`;
  };
  
  const renderSummaryView = () => {
    if (!comparisonData) return <div>Loading comparison data...</div>;
    
    const { differences } = comparisonData;
    
    return (
      <div className="comparison-summary">
        <div className="comparison-details">
          <div className="comparison-item">
            <h4>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" fill="#1a73e8"/>
                <path d="M7 7H17V9H7V7ZM7 11H17V13H7V11ZM7 15H14V17H7V15Z" fill="#1a73e8"/>
              </svg>
              Structure Differences
            </h4>
            {renderStructureDifferences(differences)}
          </div>
        </div>
      </div>
    );
  };
  
  const renderHierarchicalComparison = () => {
    if (!profiles || profiles.length < 2) return null;

    const profile1 = profiles[0]?.profile;
    const profile2 = profiles[1]?.profile;

    const renderNode = (node1, node2, level = 0, type = 'query') => {
      if (!node1 && !node2) return null;

      // For collectors, we need to handle the structure differently
      const nodeType = type === 'collector' ? (node1?.name || node2?.name) : (node1?.type || node2?.type || type);
      const nodeDesc = type === 'collector' ? (node1?.reason || node2?.reason) : (node1?.description || node2?.description);
      
      const isExpanded = expandedSections[`${type}-${nodeType}-${level}`];
      const time1 = node1?.time_in_nanos ? node1.time_in_nanos / 1000000 : 0;
      const time2 = node2?.time_in_nanos ? node2.time_in_nanos / 1000000 : 0;
      const diff = time2 - time1;
      const percentage = time1 ? ((diff / time1) * 100) : 0;
      const percentageFormatted = percentage.toFixed(1);

      // Get breakdown data from both nodes
      const breakdown1 = node1?.breakdown || {};
      const breakdown2 = node2?.breakdown || {};
      const allMetrics = new Set([...Object.keys(breakdown1), ...Object.keys(breakdown2)]);

      // Get children based on node type
      const getChildren = (node) => {
        if (!node) return [];
        if (type === 'collector') {
          // Handle collector children
          return node.children || [];
        }
        // Default handling for query and aggregation
        return node.children || [];
      };

      const children1 = getChildren(node1);
      const children2 = getChildren(node2);
      const hasChildren = children1.length > 0 || children2.length > 0;

      const getDiffClass = (value1, value2, diffValue, diffPercentage) => {
        if (value1 === undefined || value2 === undefined) return 'missing-field';
        if (diffValue === 0) return 'identical';
        return 'different';
      };

      return (
        <div key={`${type}-${nodeType}-${level}`} className="query-hierarchy-item">
          <div className="query-node-connector"></div>
          <div 
            className={`query-node ${hasChildren ? 'has-children' : ''}`}
            data-type={nodeType}
          >
            <div 
              className="query-node-header"
              onClick={() => toggleSection(`${type}-${nodeType}-${level}`)}
            >
              {hasChildren && (
                <span className="query-node-toggle">
                  {isExpanded ? '▼' : '▶'}
                </span>
              )}
              <h5>{nodeType}</h5>
              <div className="query-node-metrics">
                <div className="profile-comparison">
                  <div className="profile-column">
                    <div className="profile-header">{profiles[0]?.name || 'Profile 1'}</div>
                  </div>
                  <div className="profile-column">
                    <div className="profile-header">{profiles[1]?.name || 'Profile 2'}</div>
                  </div>
                  <div className="profile-column">
                    <div className="profile-header">Difference</div>
                    <span className={`query-node-time ${getDiffClass(time1, time2, diff, percentage)}`}>{diff !== 0 ? `${diff > 0 ? '+' : ''}${formatTime(Math.abs(diff))} (${percentageFormatted}%)` : 'Identical'}</span>
                  </div>
                </div>
              </div>
            </div>
            {nodeDesc && (
              <p className="query-node-description">{nodeDesc}</p>
            )}
            {isExpanded && (
              <>
                {/* Node total time row */}
                <div className="node-time-row" style={{ width: '100%' }}>
                  <table className="comparison-table" style={{ marginBottom: 0 }}>
                    <tbody>
                      <tr>
                        <td style={{ textAlign: 'left', fontWeight: 600 }}>time_in_nanos</td>
                        <td className="metric-value">{formatTime(time1)}</td>
                        <td className="metric-value">{formatTime(time2)}</td>
                        <td className={`metric-diff ${getDiffClass(time1, time2, diff, percentage)}`}>{diff !== 0 ? `${diff > 0 ? '+' : ''}${formatTime(Math.abs(diff))} (${percentageFormatted}%)` : 'Identical'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {allMetrics.size > 0 && (
                  <div className="query-node-breakdown">
                    <table className="comparison-table">
                      <tbody>
                        {Array.from(allMetrics).sort().map(metric => {
                          const value1 = breakdown1[metric];
                          const value2 = breakdown2[metric];
                          const metricDiff = value2 - value1;
                          const metricPercentage = value1 ? ((metricDiff / value1) * 100) : 0;
                          const metricPercentageFormatted = metricPercentage.toFixed(1);
                          
                          return (
                            <tr key={metric}>
                              <td>{formatBreakdownKey(metric).operation}</td>
                              <td className="metric-value">{value1 !== undefined ? formatTime(value1) : '—'}</td>
                              <td className="metric-value">{value2 !== undefined ? formatTime(value2) : '—'}</td>
                              <td className={`metric-diff ${getDiffClass(value1, value2, metricDiff, metricPercentage)}`}>
                                {value1 !== undefined && value2 !== undefined ? (
                                  metricDiff === 0 ? 'Identical' : 
                                  `${metricDiff > 0 ? '+' : ''}${formatTime(Math.abs(metricDiff))} (${metricPercentageFormatted}%)`
                                ) : 'Missing field'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {hasChildren && (
                  <div className="query-node-children">
                    {children1.map((child1, index) => {
                      const child2 = children2[index];
                      return renderNode(child1, child2, level + 1, type);
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    };

    const renderSection = (title, nodes1, nodes2, type) => {
      if (!nodes1?.length && !nodes2?.length) return null;
      
      return (
        <div className="hierarchy-section">
          <h3 className="hierarchy-section-title">{title}</h3>
          <div className="hierarchy-section-content">
            {(nodes1 || []).map((node1, index) => {
              const node2 = (nodes2 || [])[index];
              return renderNode(node1, node2, index, type);
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="query-hierarchy">
        <div className="query-hierarchy-root">
          {/* Query Section */}
          {renderSection(
            "Query Hierarchy",
            profile1?.shards?.[0]?.searches?.[0]?.query,
            profile2?.shards?.[0]?.searches?.[0]?.query,
            'query'
          )}

          {/* Collector Section */}
          {renderSection(
            "Collector Hierarchy",
            profile1?.shards?.[0]?.searches?.[0]?.collector,
            profile2?.shards?.[0]?.searches?.[0]?.collector,
            'collector'
          )}

          {/* Aggregation Section */}
          {renderSection(
            "Aggregation Hierarchy",
            profile1?.shards?.[0]?.aggregations,
            profile2?.shards?.[0]?.aggregations,
            'aggregation'
          )}
        </div>
      </div>
    );
  };

  const toggleSection = (path) => {
    setExpandedSections(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const renderStructureDifferences = (differences) => {
    if (!differences || differences.length === 0) {
      return (
        <div className="no-differences">
          No structural differences found between the profiles.
        </div>
      );
    }

    // Helper to show a hierarchy of node types, filtering out verbose descriptions/values
    const formatPath = (diff) => {
      // Acceptable node type patterns
      const nodeTypeRegex = /Query$|Aggregation$|Collector$|^Child Query$/;
      let parts = [];
      if (diff.path) {
        parts = diff.path.split('→').map(p => p.trim()).filter(Boolean);
        // Only keep node type parts
        parts = parts.filter(p => nodeTypeRegex.test(p));
      }
      // Append queryType if not already last
      if (diff.queryType && (!parts.length || parts[parts.length - 1] !== diff.queryType)) {
        parts.push(diff.queryType);
      }
      return parts.join(' → ');
    };

    return (
      <div className="structure-differences">
        <ul className="difference-list">
          {differences.filter(diff => diff.type !== 'reorder').map((diff, index) => {
            let className = '';
            let message = '';
            if (diff.type === 'missing') {
              className = 'field-missing';
              message = `Field "${diff.field}" is present in Profile 1 but missing in Profile 2 at: ${formatPath(diff)}`;
            } else if (diff.type === 'added') {
              className = 'field-added';
              message = `Field "${diff.field}" is present in Profile 2 but missing in Profile 1 at: ${formatPath(diff)}`;
            }
            return (
              <li key={index} className={className}>
                {message}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="comparison-results-overlay">
      <div className="comparison-results-modal">
        <div className="comparison-results-header">
          <h2>Query Comparison</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="comparison-results-content">
          {(!profiles || profiles.length < 2) ? (
            <div className="comparison-error">
              Insufficient data for comparison. Please select two profiles to compare.
            </div>
          ) : (
            <>
              {!comparisonData ? (
                <div className="loading-indicator">Loading comparison data...</div>
              ) : (
                <>
                  <div className="comparison-section">
                    <h3>Summary</h3>
                    {renderSummaryView()}
                  </div>
                  
                  <div className="comparison-section">
                    <h3>Hierarchical Comparison</h3>
                    {renderHierarchicalComparison()}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        
        <div className="comparison-results-footer">
          <button className="close-button-large" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ProfilerComparisonResults; 