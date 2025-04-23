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
  const [expandedSections, setExpandedSections] = useState({
    executionTime: true,
    queryStructure: false
  });

  // Format breakdown key - shared helper function for displaying metrics consistently
  const formatBreakdownKey = (key) => {
    // Skip metrics that end with _count
    if (key.endsWith('_count')) return { operation: key };
    
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
      
      // Return a simplified operation name without query types
      if (operations.length > 0) {
        const operation = operations.join(' ').replace(/\b\w/g, c => c.toUpperCase());
        return {
          operation: operation.length > 25 ? operation.substring(0, 22) + '...' : operation,
          // Store the queryTypes but don't display them (they'll be visible in tooltips)
          queryTypes: queryTypes.join(' → ')
        };
      }
    }
    
    // For collector operations, simplify to just the operation name
    if (displayKey.startsWith('collector ')) {
      const parts = displayKey.split(' ');
      if (parts.length > 2) {
        // Just return the operation part without the collector name
        return { 
          operation: parts.slice(2).join(' ').replace(/\b\w/g, c => c.toUpperCase()),
          collectorType: parts[1]
        };
      }
    }
    
    // For aggregation operations, simplify to just the operation name
    if (displayKey.startsWith('agg ')) {
      const parts = displayKey.split(' ');
      if (parts.length > 2) {
        // Just return the operation part without the aggregation type
        return { 
          operation: parts.slice(2).join(' ').replace(/\b\w/g, c => c.toUpperCase()),
          aggType: parts[1]
        };
      }
    }
    
    // Clean up common prefixes for easier reading
    displayKey = displayKey
      .replace(/^agg /i, '')
      .replace(/^collector /i, '');
    
    // Make first letter of each word uppercase
    displayKey = displayKey.replace(/\b\w/g, c => c.toUpperCase());
    
    // Shorten long keys
    if (displayKey.length > 25) {
      displayKey = displayKey.substring(0, 22) + '...';
    }
    
    return { operation: displayKey };
  };

  // Function to extract breakdown data from a profile
  const getBreakdown = (profile) => {
    // Start with an empty object for collecting breakdowns
    let combinedBreakdown = {};
    
    // Check if breakdown is directly available
    if (profile.breakdown && Object.keys(profile.breakdown).length > 0) {
      combinedBreakdown = {...profile.breakdown};
    }
    
    // Check if profileData is available with breakdowns
    if (profile.profileData?.shards && profile.profileData.shards.length > 0) {
      const firstShard = profile.profileData.shards[0];
      
      // Check for query breakdowns
      if (firstShard.searches && firstShard.searches.length > 0) {
        const search = firstShard.searches[0];
        
        // Get rewrite time
        if (search.rewrite_time) {
          combinedBreakdown['rewrite_time'] = search.rewrite_time;
        }
        
        // Process all query breakdowns
        if (search.query && search.query.length > 0) {
          search.query.forEach((query, index) => {
            // Add main query breakdown
            if (query.breakdown) {
              Object.entries(query.breakdown).forEach(([key, value]) => {
                const metricKey = index === 0 ? key : `${query.type}_${key}`;
                combinedBreakdown[metricKey] = value;
              });
            }
            
            // Recursively process all child query breakdowns
            const processChildren = (children, prefix) => {
              if (!children || children.length === 0) return;
              
              children.forEach((child, childIndex) => {
                if (child.breakdown) {
                  const childPrefix = `${prefix ? prefix + '_' : ''}${child.type}_${childIndex}`;
                  Object.entries(child.breakdown).forEach(([key, value]) => {
                    // Only add significant values to avoid cluttering
                    if (value > 1000) { // Only metrics with > 1000 nanoseconds (1μs)
                      combinedBreakdown[`${childPrefix}_${key}`] = value;
                    }
                  });
                }
                
                // Process further nested children
                if (child.children && child.children.length > 0) {
                  processChildren(child.children, `${prefix ? prefix + '_' : ''}${child.type}_${childIndex}`);
                }
              });
            };
            
            // Process children with proper prefixing
            if (query.children && query.children.length > 0) {
              processChildren(query.children, query.type);
            }
          });
        }
        
        // Process collector breakdowns
        if (search.collector && search.collector.length > 0) {
          search.collector.forEach((collector, index) => {
            // Add collector time
            combinedBreakdown[`collector_${collector.name}`] = collector.time_in_nanos || 0;
            
            // Process collector children
            if (collector.children && collector.children.length > 0) {
              collector.children.forEach((child, childIndex) => {
                combinedBreakdown[`collector_${collector.name}_${child.name}`] = child.time_in_nanos || 0;
              });
            }
          });
        }
      }
      
      // Process aggregation breakdowns
      if (firstShard.aggregations && firstShard.aggregations.length > 0) {
        firstShard.aggregations.forEach((agg, index) => {
          // Add total aggregation time
          combinedBreakdown[`agg_${agg.type || 'unknown'}`] = agg.time_in_nanos || 0;
          
          // Add specific breakdown metrics
          if (agg.breakdown) {
            Object.entries(agg.breakdown).forEach(([key, value]) => {
              combinedBreakdown[`agg_${agg.type}_${key}`] = value;
            });
          }
          
          // Process aggregation children
          if (agg.children && agg.children.length > 0) {
            agg.children.forEach((child, childIndex) => {
              combinedBreakdown[`agg_${agg.type}_${child.type || 'child'}`] = child.time_in_nanos || 0;
            });
          }
        });
      }
    }
    
    // Log to debug breakdown extraction for each profile
    console.log(`Extracted breakdown for ${profile.name || 'profile'}:`, combinedBreakdown);
    
    return combinedBreakdown;
  };

  // Parse original queries if they exist
  const query1 = profiles[0].originalQueryData 
    ? (typeof profiles[0].originalQueryData === 'string' 
        ? JSON.parse(profiles[0].originalQueryData) 
        : profiles[0].originalQueryData) 
    : {};
  const query2 = profiles[1].originalQueryData 
    ? (typeof profiles[1].originalQueryData === 'string' 
        ? JSON.parse(profiles[1].originalQueryData) 
        : profiles[1].originalQueryData) 
    : {};

  useEffect(() => {
    if (profiles && profiles.length === 2) {
      try {
        // Calculate comparison metrics
        const data = calculateComparisonData(profiles[0], profiles[1]);
        setComparisonData(data);
      } catch (error) {
        console.error("Error calculating comparison data:", error);
      }
    }
  }, [profiles]);
  
  const calculateComparisonData = (profile1, profile2) => {
    if (!profile1 || !profile2) {
      return null;
    }
    
    // Get execution times - enhanced to extract from profile data if needed
    const extractTime = (profile) => {
      // Check for execution time in originalQueryData first
      if (profile.originalQueryData) {
        let originalData = profile.originalQueryData;
        if (typeof originalData === 'string') {
          try {
            originalData = JSON.parse(originalData);
          } catch (e) {
            console.error("Failed to parse originalQueryData", e);
          }
        }
        
        if (originalData && originalData.took) {
          return originalData.took; // Return milliseconds
        }
      }
    
      // First check standard fields
      if (profile.time_in_nanos) return profile.time_in_nanos / 1000000;
      if (profile.timeInMillis) return profile.timeInMillis;
      if (profile.executionTime) return profile.executionTime;
      if (profile.took) return profile.took;
      
      // If not found, try to extract from the profile data
      if (profile.profileData && profile.profileData.shards && profile.profileData.shards.length > 0) {
        const searchData = profile.profileData.shards[0].searches?.[0];
        
        if (!searchData) return 0;
        
        // If took_in_millis is available directly, use it
        if (searchData.took_in_millis) {
          return searchData.took_in_millis; // Return milliseconds
        }
        
        // Sum up all query times
        const queryTime = (searchData.query || []).reduce(
          (sum, q) => sum + (q.time_in_nanos || 0), 
          0
        );
        
        // Add rewrite time
        const rewriteTime = searchData.rewrite_time || 0;
        
        // Add collector time
        const collectorTime = (searchData.collector || []).reduce(
          (sum, c) => sum + (c.time_in_nanos || 0),
          0
        );
        
        // Add aggregation time
        const aggregationTime = (profile.profileData.shards[0].aggregations || []).reduce(
          (sum, agg) => sum + (agg.time_in_nanos || 0),
          0
        );
        
        // Convert to milliseconds
        const totalTimeInMillis = (queryTime + rewriteTime + collectorTime + aggregationTime) / 1000000;
        
        return totalTimeInMillis > 0 ? totalTimeInMillis : 0;
      }
      
      return 0;
    };
    
    const time1 = extractTime(profile1);
    const time2 = extractTime(profile2);
    
    // Calculate time difference and percentage
    const timeDiff = time2 - time1;
    const timePercentage = time1 > 0 ? ((time2 - time1) / time1) * 100 : 0;
    
    // Determine performance rating
    let performanceRating;
    if (Math.abs(timePercentage) < 1 || Math.abs(timeDiff) < 0.1) {
      performanceRating = 'similar';
    } else if (timePercentage < 0) {
      performanceRating = 'better';
    } else {
      performanceRating = 'worse';
    }
    
    // Get query type differences - enhanced to extract from profile data if needed
    const getQueryType = (profile) => {
      if (profile.query_type || profile.queryType) {
        return profile.query_type || profile.queryType;
      }
      
      // Try to get from the profile data
      if (profile.profileData?.shards?.[0]?.searches?.[0]?.query?.[0]?.type) {
        return profile.profileData.shards[0].searches[0].query[0].type;
      }
      
      return 'Unknown';
    };
    
    const queryType1 = getQueryType(profile1);
    const queryType2 = getQueryType(profile2);
    const queryTypeDiff = queryType1 !== queryType2;
    
    // Get breakdown differences
    const breakdown1 = getBreakdown(profile1);
    const breakdown2 = getBreakdown(profile2);
    
    // Log both breakdowns to help identify issues
    console.log('Breakdown 1:', breakdown1);
    console.log('Breakdown 2:', breakdown2);
    
    // Get all possible keys from both breakdowns
    const allKeys = [...new Set([...Object.keys(breakdown1), ...Object.keys(breakdown2)])];
    console.log('All breakdown keys:', allKeys);
    
    const breakdownDiff = allKeys.reduce((diff, key) => {
      const val1 = breakdown1[key] || 0;
      const val2 = breakdown2[key] || 0;
      diff[key] = {
        value1: val1,
        value2: val2,
        diff: val2 - val1,
        percentage: val1 > 0 ? ((val2 - val1) / val1) * 100 : 0
      };
      return diff;
    }, {});
    
    // Log the final breakdown diff result
    console.log('Calculated breakdown diff:', breakdownDiff);
    
    return {
      profile1Name: profile1.name || 'Profile 1',
      profile2Name: profile2.name || 'Profile 2',
      times: {
        time1,
        time2,
        diff: timeDiff,
        percentage: timePercentage,
        performanceRating
      },
      queryTypes: {
        type1: queryType1,
        type2: queryType2,
        isDifferent: queryTypeDiff
      },
      breakdown: breakdownDiff
    };
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
    
    const { times, queryTypes } = comparisonData;
    
    // Get the most significant performance factors
    const getSignificantFactors = () => {
      return Object.entries(comparisonData.breakdown)
        // Filter out count metrics and metrics with identical values or extremely small values
        .filter(([key, data]) => {
          // Skip metrics that end with _count
          if (key.endsWith('_count')) return false;
          
          // Skip metrics that have identical values
          if (Math.abs(data.diff) < 0.001) return false;
          
          // Skip metrics where both values are extremely small (< 1000 ns)
          if (data.value1 < 1000 && data.value2 < 1000) return false;
          
          return true;
        })
        // Sort primarily by absolute difference
        .sort((a, b) => {
          // Compare by absolute difference (higher difference first)
          return Math.abs(b[1].diff) - Math.abs(a[1].diff);
        })
        // Take top 5 factors
        .slice(0, 5);
    };
    
    return (
      <div className="comparison-summary">
        <div className="comparison-overview">
          <h3>Execution Time</h3>
          <div className={`performance-${times.performanceRating}`}>
            {Math.abs(times.diff) < 0.001 ? (
              <div className="metric-large">
                <span className="metric-value">Identical</span>
                <span className="metric-label">execution times</span>
              </div>
            ) : (
              <div className="metric-large">
                <span className="metric-value">{formatTime(Math.abs(times.diff))}</span>
                <span className="metric-label">
                  {times.diff >= 0 ? 'slower' : 'faster'}
                </span>
              </div>
            )}
            <div className="metric-percentage">
              {Math.abs(times.percentage) < 0.01 ? 'No difference' : formatPercentage(times.percentage)}
            </div>
          </div>
        </div>
        
        <div className="comparison-details">
          <div className="comparison-item">
            <h4>Query Types</h4>
            <div className={queryTypes.isDifferent ? 'highlight-diff' : ''}>
              <div>{queryTypes.type1} → {queryTypes.type2}</div>
              {queryTypes.isDifferent && (
                <div className="diff-note">Different query types may affect performance</div>
              )}
            </div>
          </div>
          
          <div className="comparison-item">
            <h4>Top Performance Factors</h4>
            {getSignificantFactors().length > 0 ? (
              <ul className="factors-list">
                {getSignificantFactors().map(([key, data]) => {
                  const formattedKey = formatBreakdownKey(key);
                  return (
                    <li key={key} className={`performance-${data.diff < 0 ? 'better' : 'worse'}`}>
                      <span className="factor-name" title={key}>
                        {formattedKey.operation}
                      </span>
                      <span className="factor-change">
                        {formatTime(Math.abs(data.diff))} ({formatPercentage(data.percentage)})
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="no-factors">No significant performance factors found</div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  const renderDetailedView = () => {
    if (!comparisonData) return <div>Loading comparison data...</div>;
    
    // Log breakdown data to identify any issues
    console.log('Breakdown data in detailed view:', comparisonData.breakdown);
    
    // Organize metrics hierarchically based on the OpenSearch profile structure
    const organizeMetrics = () => {
      const hierarchicalMetrics = {
        general: [
          { key: 'executionTime', label: 'Execution Time', data: comparisonData.times },
          { key: 'queryType', label: 'Query Type', data: comparisonData.queryTypes }
        ],
        queries: {
          metrics: [],
          children: {}
        },
        collectors: {
          metrics: [],
          children: {}
        },
        aggregations: {
          metrics: [],
          children: {}
        }
      };

      // Create a map to store count operations with their corresponding time operations
      const countMetricsMap = {};
      Object.entries(comparisonData.breakdown).forEach(([key, data]) => {
        if (key.endsWith('_count')) {
          const baseKey = key.replace('_count', '');
          countMetricsMap[baseKey] = {
            countKey: key,
            countData: data
          };
        }
      });

      // Helper to extract query type from key
      const extractQueryInfo = (key) => {
        const parts = key.split('_');
        let queryType = '';
        let operation = '';
        let isNested = false;
        
        // Extract query type
        if (key.includes('Query')) {
          const queryMatch = key.match(/(\w+Query)/g);
          queryType = queryMatch ? queryMatch.join(' ') : '';
        }
        
        // Check if this is a nested query operation
        if (parts.length > 2 && parts.some(p => p.includes('Query'))) {
          isNested = true;
        }
        
        // Extract operation name
        operation = parts[parts.length - 1];
        
        return { queryType, operation, isNested };
      };

      // Process and group breakdown items
      Object.entries(comparisonData.breakdown).forEach(([key, data]) => {
        // Skip count metrics - they'll be handled with their corresponding time metrics
        if (key.endsWith('_count')) return;
        
        const formattedKey = formatBreakdownKey(key);
        const countInfo = countMetricsMap[key];
        
        const metricItem = {
          key,
          label: formattedKey.operation,
          queryType: formattedKey.queryTypes,
          data,
          countData: countInfo?.countData
        };

        // Group based on key patterns
        if (key.startsWith('collector') || key.includes('collect_')) {
          // Handle collector metrics
          if (key.includes('_')) {
            // This is a nested collector operation
            const collectorName = key.split('_')[1]; // Get collector name
            if (!hierarchicalMetrics.collectors.children[collectorName]) {
              hierarchicalMetrics.collectors.children[collectorName] = [];
            }
            hierarchicalMetrics.collectors.children[collectorName].push(metricItem);
          } else {
            hierarchicalMetrics.collectors.metrics.push(metricItem);
          }
        } else if (key.includes('agg')) {
          // Handle aggregation metrics
          if (key.split('_').length > 2) {
            // This is a nested aggregation operation
            const aggType = key.split('_')[1]; // Get aggregation type
            if (!hierarchicalMetrics.aggregations.children[aggType]) {
              hierarchicalMetrics.aggregations.children[aggType] = [];
            }
            hierarchicalMetrics.aggregations.children[aggType].push(metricItem);
          } else {
            hierarchicalMetrics.aggregations.metrics.push(metricItem);
          }
        } else {
          // Handle query operations
          const { queryType, isNested } = extractQueryInfo(key);
          
          if (queryType && isNested) {
            // This is a nested query operation
            if (!hierarchicalMetrics.queries.children[queryType]) {
              hierarchicalMetrics.queries.children[queryType] = [];
            }
            hierarchicalMetrics.queries.children[queryType].push(metricItem);
          } else {
            // These are general query operations
            hierarchicalMetrics.queries.metrics.push(metricItem);
          }
        }
      });

      // Sort metrics within each group by absolute difference
      const sortMetricsByDiff = (metrics) => {
        return metrics.sort((a, b) => {
          if (!a.data.diff) return -1;
          if (!b.data.diff) return 1;
          return Math.abs(b.data.diff) - Math.abs(a.data.diff);
        });
      };

      hierarchicalMetrics.queries.metrics = sortMetricsByDiff(hierarchicalMetrics.queries.metrics);
      hierarchicalMetrics.collectors.metrics = sortMetricsByDiff(hierarchicalMetrics.collectors.metrics);
      hierarchicalMetrics.aggregations.metrics = sortMetricsByDiff(hierarchicalMetrics.aggregations.metrics);
      
      // Sort nested children too
      Object.keys(hierarchicalMetrics.queries.children).forEach(queryType => {
        hierarchicalMetrics.queries.children[queryType] = sortMetricsByDiff(hierarchicalMetrics.queries.children[queryType]);
      });
      
      Object.keys(hierarchicalMetrics.collectors.children).forEach(collectorName => {
        hierarchicalMetrics.collectors.children[collectorName] = sortMetricsByDiff(hierarchicalMetrics.collectors.children[collectorName]);
      });
      
      Object.keys(hierarchicalMetrics.aggregations.children).forEach(aggType => {
        hierarchicalMetrics.aggregations.children[aggType] = sortMetricsByDiff(hierarchicalMetrics.aggregations.children[aggType]);
      });

      return hierarchicalMetrics;
    };

    const hierarchicalMetrics = organizeMetrics();

    // Render a metric row
    const renderMetricRow = (item) => {
      if (item.key === 'executionTime') {
        // Handle execution time
        return (
          <React.Fragment key={item.key}>
            <div className="metric-name">{item.label}</div>
            <div className="metric-value">{formatTime(item.data.time1)}</div>
            <div className="metric-value">{formatTime(item.data.time2)}</div>
            <div className={`metric-diff performance-${item.data.diff < 0 ? 'better' : item.data.diff > 0 ? 'worse' : 'similar'}`}>
              {Math.abs(item.data.diff) < 0.001 ? 
                'Identical' : 
                `${formatTime(Math.abs(item.data.diff))} (${formatPercentage(item.data.percentage)})`
              }
            </div>
          </React.Fragment>
        );
      } else if (item.key === 'queryType') {
        // Handle query type
        return (
          <React.Fragment key={item.key}>
            <div className="metric-name">{item.label}</div>
            <div className="metric-value">{item.data.type1}</div>
            <div className="metric-value">{item.data.type2}</div>
            <div className={`metric-diff ${item.data.isDifferent ? 'highlight-diff' : ''}`}>
              {item.data.isDifferent ? 'Different' : 'Same'}
            </div>
          </React.Fragment>
        );
      } else {
        // Handle regular metrics - simplify to just show the operation name
        return (
          <React.Fragment key={item.key}>
            <div className="metric-name" title={item.key}>
              {item.label}
              {item.countData && (
                <span className="metric-count-label" title="Has count data">
                  <span style={{ fontSize: '0.85em', marginLeft: '6px', color: '#555' }}>
                    (calls: {item.countData.value1} → {item.countData.value2})
                  </span>
                </span>
              )}
            </div>
            <div className="metric-value">{formatTime(item.data.value1)}</div>
            <div className="metric-value">{formatTime(item.data.value2)}</div>
            <div className={`metric-diff performance-${item.data.diff < 0 ? 'better' : item.data.diff > 0 ? 'worse' : 'similar'}`}>
              {Math.abs(item.data.diff) < 0.001 ? 
                'Identical' : 
                `${formatTime(Math.abs(item.data.diff))} (${formatPercentage(item.data.percentage)})`
              }
            </div>
          </React.Fragment>
        );
      }
    };

    // Function to render section headers
    const renderSectionHeader = (title, level = 1) => {
      const bgColor = level === 1 ? '#e8f4fd' : '#f1faff';
      const fontWeight = level === 1 ? '600' : '500';
      const fontSize = level === 1 ? '1em' : '0.95em';
      const paddingLeft = level === 1 ? '16px' : '24px';
      
      return (
        <div 
          className={`metric-section-header level-${level}`} 
          style={{ 
            gridColumn: 'span 4', 
            backgroundColor: bgColor, 
            padding: `10px ${paddingLeft}`, 
            fontWeight, 
            fontSize 
          }}
        >
          {title}
        </div>
      );
    };

    return (
      <div className="comparison-detailed">
        <div className="comparison-grid-container">
          <div className="comparison-grid">
            <div className="comparison-header">Metric</div>
            <div className="comparison-header">{comparisonData.profile1Name}</div>
            <div className="comparison-header">{comparisonData.profile2Name}</div>
            <div className="comparison-header">Difference</div>
            
            {/* General Section */}
            {renderSectionHeader('General')}
            {hierarchicalMetrics.general.map(renderMetricRow)}
            
            {/* Query Operations Section */}
            {(hierarchicalMetrics.queries.metrics.length > 0 || Object.keys(hierarchicalMetrics.queries.children).length > 0) && (
              <>
                {renderSectionHeader('Queries')}
                {hierarchicalMetrics.queries.metrics.map(renderMetricRow)}
                
                {/* Render nested query operations by query type */}
                {Object.entries(hierarchicalMetrics.queries.children).map(([queryType, metrics]) => (
                  <React.Fragment key={queryType}>
                    {renderSectionHeader(`${queryType}`, 2)}
                    {metrics.map(renderMetricRow)}
                  </React.Fragment>
                ))}
              </>
            )}
            
            {/* Collector Operations Section */}
            {(hierarchicalMetrics.collectors.metrics.length > 0 || Object.keys(hierarchicalMetrics.collectors.children).length > 0) && (
              <>
                {renderSectionHeader('Collectors')}
                {hierarchicalMetrics.collectors.metrics.map(renderMetricRow)}
                
                {/* Render nested collector operations by collector name */}
                {Object.entries(hierarchicalMetrics.collectors.children).map(([collectorName, metrics]) => (
                  <React.Fragment key={collectorName}>
                    {renderSectionHeader(`${collectorName}`, 2)}
                    {metrics.map(renderMetricRow)}
                  </React.Fragment>
                ))}
              </>
            )}
            
            {/* Aggregation Operations Section */}
            {(hierarchicalMetrics.aggregations.metrics.length > 0 || Object.keys(hierarchicalMetrics.aggregations.children).length > 0) && (
              <>
                {renderSectionHeader('Aggregations')}
                {hierarchicalMetrics.aggregations.metrics.map(renderMetricRow)}
                
                {/* Render nested aggregation operations by aggregation type */}
                {Object.entries(hierarchicalMetrics.aggregations.children).map(([aggType, metrics]) => (
                  <React.Fragment key={aggType}>
                    {renderSectionHeader(`${aggType}`, 2)}
                    {metrics.map(renderMetricRow)}
                  </React.Fragment>
                ))}
              </>
            )}

            {/* If no breakdown data at all */}
            {Object.entries(comparisonData.breakdown).length === 0 && (
              <div className="metric-name" style={{ gridColumn: 'span 4', textAlign: 'center' }}>
                No breakdown data available
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
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
      // Check for execution time in originalQueryData first
      if (profile.originalQueryData) {
        let originalData = profile.originalQueryData;
        if (typeof originalData === 'string') {
          try {
            originalData = JSON.parse(originalData);
          } catch (e) {
            console.error("Failed to parse originalQueryData", e);
          }
        }
        
        if (originalData && originalData.took) {
          return originalData.took / 1000; // Convert to seconds
        }
      }
      
      // First check standard fields
      if (profile.time_in_nanos) return profile.time_in_nanos / 1000000 / 1000; // Convert to seconds
      if (profile.timeInMillis) return profile.timeInMillis / 1000; // Convert to seconds
      if (profile.executionTime) return profile.executionTime / 1000; // Convert to seconds
      if (profile.took) return profile.took / 1000; // Convert to seconds
      
      // If not found, try to extract from the profile data
      if (profile.profileData && profile.profileData.shards && profile.profileData.shards.length > 0) {
        const searchData = profile.profileData.shards[0].searches?.[0];
        
        if (!searchData) return 0;
        
        // If took_in_millis is available directly, use it
        if (searchData.took_in_millis) {
          return searchData.took_in_millis / 1000; // Convert to seconds
        }
        
        // Sum up all query times
        const queryTime = (searchData.query || []).reduce(
          (sum, q) => sum + (q.time_in_nanos || 0), 
          0
        );
        
        // Add rewrite time
        const rewriteTime = searchData.rewrite_time || 0;
        
        // Add collector time
        const collectorTime = (searchData.collector || []).reduce(
          (sum, c) => sum + (c.time_in_nanos || 0),
          0
        );
        
        // Add aggregation time
        const aggregationTime = (profile.profileData.shards[0].aggregations || []).reduce(
          (sum, agg) => sum + (agg.time_in_nanos || 0),
          0
        );
        
        // Convert to seconds (from nanoseconds)
        const totalTimeInSeconds = (queryTime + rewriteTime + collectorTime + aggregationTime) / 1000000000;
        
        return totalTimeInSeconds > 0 ? totalTimeInSeconds : 0;
      }
      
      return 0;
    };
    
    const time1 = extractExecutionTime(profiles[0]);
    const time2 = extractExecutionTime(profiles[1]);
    
    const { diff, percentage, isImprovement } = calculateDiff(time1, time2);
    
    // Extract shard info from profile data
    const getShardInfo = (profile) => {
      // First check standard fields
      if (profile._shards?.successful !== undefined) {
        return {
          total: profile._shards.total || 0,
          successful: profile._shards.successful || 0,
          failed: profile._shards.failed || 0
        };
      }
      
      // Then check shardInfo property
      if (profile.shardInfo?.successful !== undefined) {
        return profile.shardInfo;
      }
      
      // Finally check profile data
      if (profile.profileData?.shards) {
        return {
          total: profile.profileData.shards.length,
          successful: profile.profileData.shards.length,
          failed: 0
        };
      }
      
      return { total: 0, successful: 0, failed: 0 };
    };
    
    const shardInfo1 = getShardInfo(profiles[0]);
    const shardInfo2 = getShardInfo(profiles[1]);
    
    return (
      <div className="comparison-section">
        <div className="section-header" onClick={() => toggleSection('executionTime')}>
          {expandedSections.executionTime ? <FaChevronDown className="toggle-icon expanded" /> : <FaChevronRight className="toggle-icon" />}
          <h3>Execution Time Comparison</h3>
        </div>
        
        {expandedSections.executionTime && (
          <div className="section-content">
            <div className="comparison-grid-container">
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
                <div className="metric-value">{formatNumber(profiles[0].hits?.total?.value)}</div>
                <div className="metric-value">{formatNumber(profiles[1].hits?.total?.value)}</div>
                <div className="metric-diff">
                  {profiles[0].hits?.total?.value !== undefined && profiles[1].hits?.total?.value !== undefined ? 
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
          </div>
        )}
      </div>
    );
  };

  const renderQueryHierarchyComparison = () => {
    if (!profiles || profiles.length < 2) {
      return null;
    }
    
    // Helper function to extract query hierarchy from profile data
    const extractQueryHierarchy = (profile) => {
      if (!profile || !profile.profileData?.shards?.[0]?.searches?.[0]?.query) {
        return [];
      }
      
      // Get the root queries
      return profile.profileData.shards[0].searches[0].query.map(q => ({
        type: q.type || 'Unknown',
        description: q.description || '',
        time_ns: q.time_in_nanos || 0,
        breakdown: q.breakdown || {},
        children: q.children || []
      }));
    };
    
    const queries1 = extractQueryHierarchy(profiles[0]);
    const queries2 = extractQueryHierarchy(profiles[1]);
    
    // Helper function to render a query node and its children
    const renderQueryNode = (query, depth = 0) => {
      if (!query) return null;
      
      return (
        <div className="query-hierarchy-node" style={{ marginLeft: `${depth * 20}px` }}>
          <div className="query-node-header">
            <span className="query-node-type">{query.type}</span>
            <span className="query-node-time">{formatTime(query.time_ns / 1000000)}</span>
          </div>
          {query.description && (
            <div className="query-node-description">{query.description}</div>
          )}
          {query.children && query.children.length > 0 && (
            <div className="query-node-children">
              {query.children.map((child, index) => (
                <div key={index} className="query-child-connector">
                  {renderQueryNode(child, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };
    
    return (
      <div className="comparison-section">
        <div className="section-header" onClick={() => toggleSection('queryStructure')}>
          {expandedSections.queryStructure ? <FaChevronDown className="toggle-icon expanded" /> : <FaChevronRight className="toggle-icon" />}
          <h3>Query Hierarchy Comparison</h3>
        </div>
        
        {expandedSections.queryStructure && (
          <div className="section-content">
            <div className="query-hierarchy-container">
              <div className="query-column">
                <h4>{profiles[0]?.name || "Profile 1"} Query Hierarchy</h4>
                <div className="query-hierarchy">
                  {queries1.length > 0 ? (
                    queries1.map((query, index) => (
                      <div key={index} className="query-root-node">
                        {renderQueryNode(query)}
                      </div>
                    ))
                  ) : (
                    <div className="no-hierarchy-data">No query hierarchy data available</div>
                  )}
                </div>
              </div>
              
              <div className="query-column">
                <h4>{profiles[1]?.name || "Profile 2"} Query Hierarchy</h4>
                <div className="query-hierarchy">
                  {queries2.length > 0 ? (
                    queries2.map((query, index) => (
                      <div key={index} className="query-root-node">
                        {renderQueryNode(query)}
                      </div>
                    ))
                  ) : (
                    <div className="no-hierarchy-data">No query hierarchy data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  return (
    <div className="comparison-results-overlay">
      <div className="comparison-results-modal">
        <div className="comparison-results-header">
          <h2>Query Comparison</h2>
          <div className="view-toggle">
            <button
              className={viewMode === 'summary' ? 'active' : ''}
              onClick={() => setViewMode('summary')}
            >
              Summary
            </button>
            <button
              className={viewMode === 'detailed' ? 'active' : ''}
              onClick={() => setViewMode('detailed')}
            >
              Detailed
            </button>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="comparison-results-content">
          {(!profiles || profiles.length < 2) ? (
            <div className="comparison-error">
              Insufficient data for comparison. Please select two profiles to compare.
            </div>
          ) : (
            <>
              {viewMode === 'summary' && (
                !comparisonData ? (
                  <div className="loading-indicator">Loading comparison data...</div>
                ) : (
                  renderSummaryView()
                )
              )}
              {viewMode === 'detailed' && (
                !comparisonData ? (
                  <div className="loading-indicator">Loading comparison data...</div>
                ) : (
                  renderDetailedView()
                )
              )}
              {renderExecutionTimeComparison()}
              {renderQueryHierarchyComparison()}
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