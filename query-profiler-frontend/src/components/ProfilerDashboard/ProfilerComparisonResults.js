import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ProfilerComparisonResults.css';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';

// Query templates - consistent with the ones in QueryInput.js
const queryTemplates = {
  default: {
    query: {
      match_all: {}
    }
  },
  term_query: {
    query: {
      term: {
        "process.name": "cron"
      }
    }
  },
  bool_query: {
    query: {
      bool: {
        must: [
          { match: { "process.name": "cron" } }
        ],
        should: [
          { match: { tags: "preserve_original_event" } },
          { match: { "input.type": "aws-cloudwatch" } }
        ],
        minimum_should_match: 1
      }
    },
    sort: [
      { "@timestamp": { order: "desc" } }
    ]
  },
  aggregation_query: {
    query: {
      match_all: {}
    },
    aggs: {
      process_names: {
        terms: {
          field: "process.name.keyword",
          size: 10
        }
      },
      avg_metrics: {
        avg: {
          field: "metrics.size"
        }
      }
    }
  },
  complex_query: {
    query: {
      bool: {
        must: [
          {
            range: {
              "@timestamp": {
                gte: "2023-01-01",
                lte: "now"
              }
            }
          },
          {
            bool: {
              should: [
                { term: { "process.name": "cron" } },
                { term: { "process.name": "systemd" } }
              ],
              minimum_should_match: 1
            }
          }
        ],
        must_not: [
          { term: { "cloud.region": "eu-west-1" } }
        ],
        filter: [
          { exists: { field: "metrics.size" } }
        ]
      }
    },
    aggs: {
      processes_by_region: {
        terms: {
          field: "cloud.region.keyword",
          size: 5
        },
        aggs: {
          process_types: {
            terms: {
              field: "process.name.keyword",
              size: 5
            }
          }
        }
      }
    },
    sort: [
      { "metrics.size": { order: "desc" } }
    ]
  }
};

const ProfilerComparisonResults = ({ profiles, comparisonType, onClose }) => {
  const [viewMode, setViewMode] = useState(comparisonType || 'detailed');
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
  
  const getBreakdown = (profile) => {
    if (!profile) return {};
    
    console.log('Extracting breakdown for profile:', profile);
    
    // First try to get breakdown from the standard location
    if (profile.profile?.shards?.[0]?.searches?.[0]?.query?.[0]?.breakdown) {
      const breakdown = profile.profile.shards[0].searches[0].query[0].breakdown;
      console.log('Found breakdown in standard location:', breakdown);
      return breakdown;
    }
    
    // If not found, try alternative locations
    if (profile.breakdown) {
      console.log('Found breakdown in root:', profile.breakdown);
      return profile.breakdown;
    }
    
    // If still not found, try to extract from query data
    if (profile.query?.breakdown) {
      console.log('Found breakdown in query:', profile.query.breakdown);
      return profile.query.breakdown;
    }
    
    console.log('No breakdown data found in profile');
    return {};
  };

  // Helper function to extract fields and their order
  const extractFieldsWithOrder = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    
    const fields = [];
    const keys = Object.keys(obj);
    
    keys.forEach((key, index) => {
      // For breakdown objects, we want to track the exact position
      if (key === 'breakdown') {
        const breakdownKeys = Object.keys(obj[key]);
        breakdownKeys.forEach((bKey, bIndex) => {
          fields.push({
            field: `${key}.${bKey}`,
            order: bIndex,
            parentField: key
          });
        });
      } else {
        fields.push({
          field: key,
          order: index,
          parentField: null
        });
        
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]) && key !== 'breakdown') {
          const nestedFields = extractFieldsWithOrder(obj[key]).map(nested => ({
            field: `${key}.${nested.field}`,
            order: nested.order,
            parentField: key
          }));
          fields.push(...nestedFields);
        }
      }
    });
    
    return fields;
  };

  // Helper function to compare two objects structurally
  const compareStructures = (obj1, obj2, queryPath = '') => {
    const differences = [];
    
    // Get all fields with their order from both objects
    const fields1 = extractFieldsWithOrder(obj1);
    const fields2 = extractFieldsWithOrder(obj2);
    
    // Create maps of fields to their orders
    const fieldMap1 = new Map(fields1.map(f => [f.field, { order: f.order, parentField: f.parentField }]));
    const fieldMap2 = new Map(fields2.map(f => [f.field, { order: f.order, parentField: f.parentField }]));
    
    // Find fields present in obj1 but not in obj2
    fields1.forEach(({ field }) => {
      if (!fieldMap2.has(field)) {
        const path = queryPath ? `${queryPath} → ${field}` : field;
        differences.push({
          type: 'missing',
          field,
          path
        });
      }
    });
    
    // Find fields present in obj2 but not in obj1
    fields2.forEach(({ field }) => {
      if (!fieldMap1.has(field)) {
        const path = queryPath ? `${queryPath} → ${field}` : field;
        differences.push({
          type: 'added',
          field,
          path
        });
      }
    });
    
    // Find fields that exist in both but have different orders
    // Group fields by their parent field to compare order within the same context
    const fieldsByParent = new Map();
    
    fields1.forEach(f => {
      if (!fieldsByParent.has(f.parentField)) {
        fieldsByParent.set(f.parentField, { fields1: [], fields2: [] });
      }
      fieldsByParent.get(f.parentField).fields1.push(f);
    });
    
    fields2.forEach(f => {
      if (!fieldsByParent.has(f.parentField)) {
        fieldsByParent.set(f.parentField, { fields1: [], fields2: [] });
      }
      fieldsByParent.get(f.parentField).fields2.push(f);
    });
    
    fieldsByParent.forEach((value, parentField) => {
      const { fields1: parentFields1, fields2: parentFields2 } = value;
      
      // Compare order only for fields that exist in both profiles
      const commonFields = parentFields1.filter(f1 => 
        parentFields2.some(f2 => f2.field === f1.field)
      );
      
      commonFields.forEach(f1 => {
        const f2 = parentFields2.find(f => f.field === f1.field);
        if (f1.order !== f2.order) {
          const path = queryPath ? `${queryPath} → ${f1.field}` : f1.field;
          differences.push({
            type: 'reorder',
            field: f1.field,
            path,
            oldPosition: f1.order + 1,
            newPosition: f2.order + 1
            });
          }
        });
    });
    
    return differences;
  };

  // Compare query hierarchies
  const compareQueryHierarchies = (h1, h2) => {
    const differences = [];
    
    // Compare root queries
    if (h1.length !== h2.length) {
      differences.push(`Different number of root queries: ${h1.length} vs ${h2.length}`);
    }
    
    // Compare each query and its children
    const maxLength = Math.max(h1.length, h2.length);
    for (let i = 0; i < maxLength; i++) {
      const q1 = h1[i];
      const q2 = h2[i];
      
      if (!q1 || !q2) {
        differences.push(`Query ${i + 1} is missing in ${!q1 ? 'Profile 1' : 'Profile 2'}`);
        continue;
      }
      
      const queryPath = `Query ${i + 1} (${q1.type})`;
      
      // Compare query fields
      const fieldDifferences = compareStructures(q1, q2, queryPath);
      if (fieldDifferences.length > 0) {
        differences.push(...fieldDifferences);
      }
      
      // Compare children
      if (q1.children.length !== q2.children.length) {
        differences.push(`${queryPath} has different number of children: ${q1.children.length} vs ${q2.children.length}`);
      }
      
      // Compare each child
      const maxChildren = Math.max(q1.children.length, q2.children.length);
      for (let j = 0; j < maxChildren; j++) {
        const child1 = q1.children[j];
        const child2 = q2.children[j];
        
        if (!child1 || !child2) {
          differences.push(`${queryPath} child ${j + 1} is missing in ${!child1 ? 'Profile 1' : 'Profile 2'}`);
          continue;
        }
        
        const childPath = `${queryPath} → Child ${j + 1} (${child1.type})`;
        
        // Compare child fields
        const childFieldDifferences = compareStructures(child1, child2, childPath);
        if (childFieldDifferences.length > 0) {
          differences.push(...childFieldDifferences);
        }
      }
    }
    
    return differences;
  };

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
  
  const formatPercentage = (percentage) => {
    const value = Math.abs(percentage).toFixed(1);
    return percentage >= 0 ? `+${value}%` : `-${value}%`;
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
        if (value1 === undefined || value2 === undefined) return 'high-difference';
        if (Math.abs(diffPercentage) > 50) return 'high-difference';
        return 'low-difference';
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
                    <span className="query-node-time">{formatTime(time1)}</span>
                  </div>
                  <div className="profile-column">
                    <div className="profile-header">{profiles[1]?.name || 'Profile 2'}</div>
                    <span className="query-node-time">{formatTime(time2)}</span>
                  </div>
                  <div className="profile-column">
                    <div className="profile-header">Difference</div>
                    <span className={`query-node-time ${getDiffClass(time1, time2, diff, percentage)}`}>
                      {diff !== 0 ? `${diff > 0 ? '+' : ''}${formatTime(Math.abs(diff))} (${percentageFormatted}%)` : 'Identical'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {nodeDesc && (
              <p className="query-node-description">{nodeDesc}</p>
            )}
            {isExpanded && (
              <>
                {allMetrics.size > 0 && (
                  <div className="query-node-breakdown">
                    <table className="breakdown-table">
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

  const formatDuration = (time) => {
    if (time === undefined || time === null) return 'N/A';
    
    // Handle micro-second level values (less than 0.001 seconds)
    if (time < 0.001) {
      // Convert to microseconds (1 second = 1,000,000 microseconds)
      const microseconds = time * 1000000;
      return `${microseconds.toFixed(2)}μs`;
    }
    
    // Handle milli-second level values (less than 1 second)
    if (time < 1) {
      // Convert to milliseconds (1 second = 1000 milliseconds)
      const milliseconds = time * 1000;
      return `${milliseconds.toFixed(2)}ms`;
    }
    
    // Handle seconds (show 2 decimal places for precision)
    return `${time.toFixed(2)}s`;
  };

  const calculateDiff = (value1, value2) => {
    if (value1 === undefined || value2 === undefined || value1 === null || value2 === null) {
      return { diff: 'N/A', percentage: 0, isImprovement: false };
    }
    
    const diff = value2 - value1;
    
    // Handle the case where both values are very small but technically different
    if (Math.abs(diff) < 0.0001) {
      return { diff, percentage: "0.00", isImprovement: false };
    }
    
    // Calculate percentage, handling the case where value1 is very small
    let percentage;
    if (value1 < 0.001 && value2 > 0) {
      // When first value is extremely small, show a large percentage increase
      percentage = 9999;
    } else if (value1 === 0 && value2 > 0) {
      // When first value is zero and second value is positive
      percentage = 9999;
    } else if (value1 === 0 && value2 === 0) {
      // Both values are zero
      percentage = 0;
    } else {
      // Normal case
      percentage = (Math.abs(diff) / value1) * 100;
    }
    
    // For execution time, lower is better
    const isImprovement = diff < 0;
    
    return { 
      diff, 
      percentage: percentage > 9999 ? "9999+" : percentage.toFixed(2), 
      isImprovement 
    };
  };

  const renderExecutionTimeComparison = () => {
    if (!profiles || profiles.length < 2) {
      return null;
    }
    
    // Extract execution time from profile data
    const extractExecutionTime = (profile) => {
      if (!profile?.profile?.shards?.[0]?.searches?.[0]?.query?.[0]) {
        return 0;
      }
      
      const query = profile.profile.shards[0].searches[0].query[0];
      return query.time_in_nanos / 1000000; // Convert to milliseconds
    };
    
    const time1 = extractExecutionTime(profiles[0]);
    const time2 = extractExecutionTime(profiles[1]);
    
    const { diff, percentage, isImprovement } = calculateDiff(time1, time2);
    
    // Extract shard info from profile data
    const getShardInfo = (profile) => {
      if (!profile?.profile?.shards?.[0]) {
        return { total: 0, successful: 0, failed: 0 };
      }
      
      const shard = profile.profile.shards[0];
        return {
        total: 1,
        successful: 1,
          failed: 0
        };
    };
    
    const shardInfo1 = getShardInfo(profiles[0]);
    const shardInfo2 = getShardInfo(profiles[1]);
    
    return (
      <div className="execution-time-content">
              <div className="comparison-grid">
                <div className="metric-label">Metric</div>
                <div className="profile-label">{profiles[0]?.name || "Profile 1"}</div>
                <div className="profile-label">{profiles[1]?.name || "Profile 2"}</div>
                <div className="diff-label">Difference</div>
                
                <div className="metric-name">Execution Time</div>
                <div className="metric-value">{formatDuration(time1)}</div>
                <div className="metric-value">{formatDuration(time2)}</div>
                <div className={`metric-diff ${isImprovement ? 'improvement' : Math.abs(diff) < 0.0001 ? 'similar' : 'regression'}`}>
                  {diff !== 'N/A' ? 
                    (Math.abs(diff) < 0.0001 ? 
                      'Identical execution times' : 
                      `${isImprovement ? '-' : '+'}${formatDuration(Math.abs(diff))} (${percentage}%)`) : 
                    'N/A'}
                </div>
                
                <div className="metric-name">Total Hits</div>
          <div className="metric-value">{formatNumber(profiles[0]?.hits?.total?.value || 0)}</div>
          <div className="metric-value">{formatNumber(profiles[1]?.hits?.total?.value || 0)}</div>
                <div className="metric-diff">
            {profiles[0]?.hits?.total?.value !== undefined && profiles[1]?.hits?.total?.value !== undefined ? 
                    (profiles[0].hits.total.value === profiles[1].hits.total.value ? 
                      'Identical' : 
                      formatNumber(profiles[1].hits.total.value - profiles[0].hits.total.value)) : 
                    'N/A'}
                </div>
                
                <div className="metric-name">Successful Shards</div>
                <div className="metric-value">{formatNumber(shardInfo1.successful)}</div>
                <div className="metric-value">{formatNumber(shardInfo2.successful)}</div>
                <div className="metric-diff">
                  {shardInfo1.successful !== undefined && shardInfo2.successful !== undefined ? 
                    (shardInfo1.successful === shardInfo2.successful ? 
                      'Identical' : 
                      formatNumber(shardInfo2.successful - shardInfo1.successful)) : 
                    'N/A'}
                </div>
              </div>
      </div>
    );
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const renderStructureDifferences = (differences) => {
    if (!differences || differences.length === 0) {
      return (
        <div className="no-differences">
          No structural differences found between the profiles.
        </div>
      );
    }

    // Filter out reorder differences and group remaining differences by path and queryType
    const groupedDifferences = differences
      .filter(diff => diff.type !== 'reorder') // Filter out reorder differences
      .reduce((acc, diff) => {
        const key = `${diff.path}${diff.queryType ? ` (${diff.queryType})` : ''}`;
        if (!acc[key]) {
          acc[key] = {
            path: diff.path,
            queryType: diff.queryType,
            description: diff.description,
            differences: []
          };
        }
        acc[key].differences.push(diff);
        return acc;
      }, {});
      
      return (
      <div className="structure-differences">
        {Object.values(groupedDifferences).map((group, groupIndex) => (
          <div key={groupIndex} className="difference-group">
            <h4 className="difference-path">
              {group.path}
              {group.queryType && (
                <span className="query-type">
                  {group.queryType}
                  {group.description && (
                    <span className="query-description">
                      {' - '}{group.description}
                    </span>
                  )}
                </span>
              )}
            </h4>
            <ul className="difference-list">
              {group.differences.map((diff, index) => {
                let className = '';
                let message = '';
                
                if (diff.type === 'missing') {
                  className = 'field-missing';
                  message = (
                    <span className="missing-field-message">
                      Field "{diff.field}" is present in Profile 1 but missing in Profile 2
                    </span>
                  );
                } else if (diff.type === 'added') {
                  className = 'field-added';
                  message = (
                    <span className="missing-field-message">
                      Field "{diff.field}" is present in Profile 2 but missing in Profile 1
                    </span>
                  );
                }
    
    return (
                  <li key={index} className={className}>
                    {message}
                  </li>
                );
              })}
            </ul>
        </div>
        ))}
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