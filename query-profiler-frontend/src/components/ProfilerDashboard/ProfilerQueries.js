import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'react-feather';
import './ProfilerQueries.css';
import QueryDetail from './QueryDetail';

const ProfilerQueries = ({ 
  data, 
  compareMode, 
  selectedProfile, 
  setSelectedProfile,
  profileToCompare,
  setProfileToCompare
}) => {
  const [expandedQueries, setExpandedQueries] = useState({});
  const [processedData, setProcessedData] = useState([]);
  const [lastExpandAction, setLastExpandAction] = useState(null);
  const [newlyExpandedId, setNewlyExpandedId] = useState(null);

  // Process the raw query data into a grouped, hierarchical structure
  const processQueryData = useCallback((data) => {
    // Extract query data from the profileData structure
    const extractQueries = () => {
      if (!data || !data.profileData || !data.profileData.shards) {
        return [];
      }
      
      try {
        // Extract queries from the first shard's first search
        const queries = data.profileData.shards[0]?.searches?.[0]?.query || [];
        
        // Also get collector data
        const collectors = data.profileData.shards[0]?.searches?.[0]?.collector || [];
        const rewriteTime = data.profileData.shards[0]?.searches?.[0]?.rewrite_time || 0;
        
        // Get aggregation data - check both search level and shard level
        const searchAggregations = data.profileData.shards[0]?.searches?.[0]?.aggregations || [];
        const shardAggregations = data.profileData.shards[0]?.aggregations || [];
        // Combine both sources of aggregations
        const aggregations = [...searchAggregations, ...shardAggregations];
        
        console.debug('[ProfilerQueries] Aggregations found:', aggregations.length);
        console.debug('[ProfilerQueries] Search aggregations:', searchAggregations.length);
        console.debug('[ProfilerQueries] Shard aggregations:', shardAggregations.length);
        
        // Calculate total query time including rewrite time, collectors, and aggregations
        const totalQueryTimeNanos = 
          queries.reduce((sum, q) => sum + (q.time_in_nanos || 0), 0) + 
          collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) + 
          aggregations.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0) + 
          rewriteTime;
        
        // Transform queries with proper hierarchy preserved
        const transformedQueries = queries.map((q, index) => transformQueryWithChildren(q, index, totalQueryTimeNanos));
        
        // Add rewrite time as a separate query group if it's significant
        if (rewriteTime > 0) {
          transformedQueries.push({
            id: 'query-rewrite-group',
            queryName: 'Query Rewrite',
            type: 'QueryRewrite',
            description: 'Time spent rewriting and optimizing the query before execution',
            operation: 'Query rewriting phase',
            totalDuration: rewriteTime / 1000000,
            time_ms: rewriteTime / 1000000,
            percentage: (rewriteTime / totalQueryTimeNanos) * 100,
            children: []
          });
        }

        // Add collector data as a separate "query" group
        if (collectors.length > 0) {
          // Create a function to recursively process collector children
          const processCollectorChildren = (collector, totalQueryTimeNanos) => {
            const result = {
              name: collector.name,
              reason: collector.reason,
              time_ms: collector.time_in_nanos / 1000000,
              percentage: (collector.time_in_nanos / totalQueryTimeNanos) * 100
            };
            
            // Process children if they exist
            if (collector.children && collector.children.length > 0) {
              result.children = collector.children.map(child => 
                processCollectorChildren(child, totalQueryTimeNanos)
              );
            }
            
            return result;
          };
          
          transformedQueries.push({
            id: `collector-group`,
            queryName: 'Query Collectors',
            type: 'Collectors',
            description: 'Collection phase of the query execution',
            operation: 'Collection phase',
            totalDuration: collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / 1000000,
            time_ms: collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / 1000000,
            percentage: collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / totalQueryTimeNanos * 100,
            // Process collector data including children
            collectorData: collectors.map(c => processCollectorChildren(c, totalQueryTimeNanos)),
            children: []
          });
        }

        // Add aggregation data as a separate group
        if (aggregations.length > 0) {
          // Calculate total aggregation time
          const totalAggTime = aggregations.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0);
          
          // Skip the aggregation group header and just add individual entries
          // Add each aggregation as its own top-level item
          aggregations.forEach((agg, i) => {
            const transformedAgg = transformAggregation(agg, i, totalQueryTimeNanos);
            transformedAgg.id = `aggregation-${agg.type || 'unknown'}-${i}`;
            transformedAgg.type = 'AggregationType'; // Special type to identify individual aggregation types
            transformedAgg.operation = `${agg.description || agg.type} (Aggregation)`;
            transformedQueries.push(transformedAgg);
          });
        }
        
        return transformedQueries;
      } catch (error) {
        console.error('[ProfilerQueries] Error extracting queries:', error);
        return [];
      }
    };
    
    // Helper function to recursively transform an aggregation and its children
    const transformAggregation = (agg, index, totalQueryTimeNanos) => {
      // Format breakdown for better visualization
      const formattedBreakdown = {};
      const rawBreakdown = agg.breakdown || {};
      
      if (agg.breakdown) {
        // Group related operations for visualization
        const breakdownGroups = {
          'build_aggregation': ['build_aggregation', 'build_aggregation_count'],
          'collect': ['collect', 'collect_count'],
          'initialize': ['initialize', 'initialize_count'],
          'post_collection': ['post_collection', 'post_collection_count'],
          'reduce': ['reduce', 'reduce_count'],
          'build_leaf_collector': ['build_leaf_collector', 'build_leaf_collector_count'],
        };
        
        // Create a more structured breakdown
        Object.entries(breakdownGroups).forEach(([groupKey, keys]) => {
          // Only add the group if at least one key has a non-zero value
          if (keys.some(key => agg.breakdown[key] > 0)) {
            formattedBreakdown[groupKey] = keys.reduce((sum, key) => {
              // If key ends with '_count', don't add to time
              if (key.endsWith('_count')) return sum;
              return sum + (agg.breakdown[key] || 0);
            }, 0);
          }
        });
        
        // Process all breakdown fields to ensure we don't miss any
        Object.entries(agg.breakdown).forEach(([key, value]) => {
          // Skip count fields as they are not time measurements
          if (key.endsWith('_count')) return;
          
          // Check if this key is already part of a group we've processed
          const isInGroup = Object.values(breakdownGroups).some(
            groupKeys => groupKeys.includes(key)
          );
          
          // If not in a group and has a positive value, add it directly
          if (!isInGroup && typeof value === 'number' && value > 0) {
            formattedBreakdown[key] = value;
          }
        });
      }
      
      // Transform children recursively
      const transformedChildren = (agg.children || []).map((child, childIndex) => 
        transformAggregation(child, childIndex, totalQueryTimeNanos)
      );
      
      return {
        id: `agg-${index}`,
        queryName: agg.type || 'Unknown Aggregation',
        type: agg.type || 'Unknown Aggregation',
        description: agg.description || '',
        operation: agg.description || agg.type,
        totalDuration: agg.time_in_nanos ? (agg.time_in_nanos / 1000000) : 0,
        time_ms: agg.time_in_nanos ? (agg.time_in_nanos / 1000000) : 0,
        percentage: agg.time_in_nanos ? (agg.time_in_nanos / totalQueryTimeNanos) * 100 : 0,
        breakdown: formattedBreakdown,
        rawBreakdown: rawBreakdown,
        children: transformedChildren
      };
    };
    
    // Helper function to recursively transform a query and its children
    const transformQueryWithChildren = (query, index, totalQueryTimeNanos) => {
      // Format breakdown for better visualization
      const formattedBreakdown = {};
      
      if (query.breakdown) {
        // Group related operations
        const breakdownGroups = {
          'build_scorer': ['build_scorer', 'build_scorer_count'],
          'create_weight': ['create_weight', 'create_weight_count'],
          'next_doc': ['next_doc', 'next_doc_count'],
          'advance': ['advance', 'advance_count'],
          'score': ['score', 'score_count'],
          'match': ['match', 'match_count'],
          'compute_max_score': ['compute_max_score', 'compute_max_score_count'],
          'set_min_competitive_score': ['set_min_competitive_score', 'set_min_competitive_score_count'],
          'shallow_advance': ['shallow_advance', 'shallow_advance_count']
        };
        
        // Create a more structured breakdown
        Object.entries(breakdownGroups).forEach(([groupKey, keys]) => {
          // Only add the group if at least one key has a non-zero value
          if (keys.some(key => query.breakdown[key] > 0)) {
            formattedBreakdown[groupKey] = keys.reduce((sum, key) => {
              // If key ends with '_count', don't add to time
              if (key.endsWith('_count')) return sum;
              return sum + (query.breakdown[key] || 0);
            }, 0);
          }
        });
        
        // Process all breakdown fields to ensure we don't miss any
        Object.entries(query.breakdown).forEach(([key, value]) => {
          // Skip count fields as they are not time measurements
          if (key.endsWith('_count')) return;
          
          // Check if this key is already part of a group we've processed
          const isInGroup = Object.values(breakdownGroups).some(
            groupKeys => groupKeys.includes(key)
          );
          
          // If not in a group and has a positive value, add it directly
          if (!isInGroup && typeof value === 'number' && value > 0) {
            formattedBreakdown[key] = value;
          }
        });
      }
      
      // Transform children recursively
      const transformedChildren = (query.children || []).map((child, childIndex) => 
        transformQueryWithChildren(child, childIndex, totalQueryTimeNanos)
      );
      
      return {
        id: `query-${index}`,
        queryName: query.type || 'Unknown Query',
        type: query.type || 'Unknown Query',
        description: query.description || '',
        operation: query.description || query.type,
        totalDuration: query.time_in_nanos ? (query.time_in_nanos / 1000000) : 0,
        time_ms: query.time_in_nanos ? (query.time_in_nanos / 1000000) : 0,
        percentage: query.time_in_nanos ? (query.time_in_nanos / totalQueryTimeNanos) * 100 : 0,
        breakdown: formattedBreakdown,
        rawBreakdown: query.breakdown || {},
        children: transformedChildren
      };
    };
    
    const queries = extractQueries();
    console.debug('[ProfilerQueries] Processing query data:', queries.length, 'queries');
    
    if (queries.length === 0) {
      console.debug('[ProfilerQueries] No queries to process');
      return [];
    }

    try {
      // Group by queryName
      const groupedQueries = queries.reduce((acc, query) => {
        const key = query.queryName || 'Unknown Query';
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(query);
        return acc;
      }, {});

      // Convert to array format
      const result = Object.entries(groupedQueries).map(([queryName, queries]) => {
        const sortedQueries = [...queries].sort((a, b) => 
          b.totalDuration - a.totalDuration
        );

        return {
          name: queryName,
          queries: sortedQueries,
          totalDuration: sortedQueries.reduce((sum, q) => sum + q.totalDuration, 0),
          count: sortedQueries.length,
          // Use type to determine sort order
          type: sortedQueries[0]?.type || ''
        };
      });

      // Sort groups by type first, then by total duration
      return result.sort((a, b) => {
        // Order: 1. Regular queries, 2. Query Rewrite, 3. Aggregation Types, 4. Collectors
        if (a.type === 'Collectors' && b.type !== 'Collectors') return 1;
        if (a.type !== 'Collectors' && b.type === 'Collectors') return -1;
        
        if (a.type === 'AggregationType' && b.type !== 'AggregationType' && b.type !== 'Collectors') return 1;
        if (a.type !== 'AggregationType' && a.type !== 'Collectors' && b.type === 'AggregationType') return -1;
        
        if (a.type === 'QueryRewrite' && b.type !== 'QueryRewrite' && b.type !== 'AggregationType' && b.type !== 'Collectors') return 1;
        if (a.type !== 'QueryRewrite' && a.type !== 'AggregationType' && a.type !== 'Collectors' && b.type === 'QueryRewrite') return -1;
        
        // Within each category, sort by duration
        return b.totalDuration - a.totalDuration;
      });
    } catch (err) {
      console.error('[ProfilerQueries] Error processing query data:', err);
      return [];
    }
  }, []);

  // Auto-expand the first query group when data changes
  useEffect(() => {
    const processed = processQueryData(data);
    setProcessedData(processed);

    // Create a new expanded state object
    const newExpandedState = { ...expandedQueries };
    
    // Auto-expand the first group if it exists
    if (processed.length > 0) {
      const firstGroupName = processed[0].name;
      console.debug(`[ProfilerQueries] Auto-expanding first group: ${firstGroupName}`);
      newExpandedState[firstGroupName] = true;
    }
    
    // Always auto-expand important sections: QueryRewrite, Collectors, and Aggregations
    processed.forEach(group => {
      const queryType = group.queries[0]?.type || '';
      if (queryType === 'QueryRewrite' || queryType === 'Collectors' || 
          queryType === 'Aggregations' || queryType === 'AggregationType') {
        console.debug(`[ProfilerQueries] Auto-expanding special group: ${group.name}`);
        newExpandedState[group.name] = true;
      }
    });
    
    setExpandedQueries(newExpandedState);
  }, [data, processQueryData]);

  // Force expand a specific query
  const forceExpand = useCallback((queryName) => {
    console.debug(`[ProfilerQueries] Force expanding query: ${queryName}`);
    setExpandedQueries(prev => ({ ...prev, [queryName]: true }));
    setNewlyExpandedId(queryName);
    
    // Reset newly expanded ID after animation completes
    setTimeout(() => {
      setNewlyExpandedId(null);
    }, 1000);
  }, []);

  // Handle query expansion toggle
  const handleToggleExpand = (queryName) => {
    const newExpandedState = !expandedQueries[queryName];
    console.debug(`[ProfilerQueries] ${newExpandedState ? 'Expanding' : 'Collapsing'} query: ${queryName}`);
    
    setExpandedQueries(prev => ({ ...prev, [queryName]: newExpandedState }));
    setLastExpandAction({
      queryName,
      action: newExpandedState ? 'expanded' : 'collapsed',
      timestamp: new Date().toISOString()
    });
    
    if (newExpandedState) {
      setNewlyExpandedId(queryName);
      // Reset newly expanded ID after animation completes
      setTimeout(() => {
        setNewlyExpandedId(null);
      }, 1000);
    }
  };

  // Handle query selection
  const handleQuerySelect = (query) => {
    console.debug('[ProfilerQueries] Selecting query:', query.id);
    try {
      // Prepare the query with original query data
      const enhancedQuery = {
        ...query,
        originalQueryData: data.originalQueryData || null
      };

      // Special handling for aggregation type
      if (query.type === 'Aggregations') {
        console.debug('[ProfilerQueries] Selected an aggregation group with children:', query.children?.length || 0);
      }

      if (compareMode && !selectedProfile) {
        setSelectedProfile(enhancedQuery);
      } else if (compareMode && selectedProfile && selectedProfile.id !== query.id) {
        setProfileToCompare(enhancedQuery);
      } else if (!compareMode) {
        setSelectedProfile(enhancedQuery);
        setProfileToCompare(null);
      }
      
      // Auto-expand the selected query
      forceExpand(query.name);
    } catch (error) {
      console.error('[ProfilerQueries] Error selecting query:', error);
    }
  };

  // Format duration for display
  const formatDuration = (ms) => {
    if (ms < 1) {
      // Show precise value with 3 decimal places for small values
      return `${ms.toFixed(3)} ms`;
    }
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  // Check for data availability
  if (!data) {
    console.warn('[ProfilerQueries] No data available');
    return <div className="no-data">No data available</div>;
  }

  // If we have processed data but it's empty, show no queries message
  if (processedData.length === 0) {
    console.warn('[ProfilerQueries] No queries found in the data');
    return <div className="no-queries">No queries found in the profiler data</div>;
  }

  return (
    <div className="profiler-queries">
      <div className="queries-list">
        {processedData.map((group) => {
          // Determine query type from either the group name or first query
          const queryType = group.queries[0]?.type || 
                           (group.name === 'Query Rewrite' ? 'QueryRewrite' : 
                           (group.name === 'Query Collectors' ? 'Collectors' : 
                           group.queries[0]?.queryName || ''));
          
          // Check if this is an aggregation type
          const isAggregationType = queryType === 'AggregationType';
          
          // Skip rendering individual aggregation types here, they'll be grouped under Aggregations section
          if (isAggregationType) {
            return null;
          }
          
          return (
            <div 
              key={group.name} 
              className="query-group"
              data-type={queryType}
              data-name={group.name}
            >
              <div 
                className="query-item"
                onClick={() => handleToggleExpand(group.name)}
              >
                <div className="query-header">
                  <button 
                    className="expand-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleExpand(group.name);
                    }}
                    data-expanded={expandedQueries[group.name] ? "true" : "false"}
                    aria-label={expandedQueries[group.name] ? "Collapse query" : "Expand query"}
                  >
                    {expandedQueries[group.name] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="query-name">
                    <span className="bullet">•</span>
                    {group.name}
                  </div>
                </div>
                <div className="query-metrics">
                  <div className="metric">{group.count} calls</div>
                  <div className="metric">{formatDuration(group.totalDuration)}</div>
                </div>
              </div>
            
              {expandedQueries[group.name] && (
                <div 
                  className="query-children"
                  data-expanded={newlyExpandedId === group.name ? "new" : "true"}
                >
                  {group.queries.map((query) => (
                    <div
                      key={query.id}
                      className={`query-child ${selectedProfile && selectedProfile.id === query.id ? 'selected' : ''}`}
                      onClick={() => handleQuerySelect(query)}
                      data-query-type={query.type || query.queryName || ''}
                    >
                      <div className="query-header">
                        <div className="query-indent"></div>
                        <div className="query-name">{query.operation || 'Query Instance'}</div>
                      </div>
                      <div className="query-metrics">
                        <div className="metric">{formatDuration(query.totalDuration)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Create a single Aggregations parent section */}
        {(() => {
          // Filter out just the aggregation type groups
          const aggregationGroups = processedData.filter(group => 
            group.queries[0]?.type === 'AggregationType'
          );
          
          // Only render if we have aggregation types
          if (aggregationGroups.length === 0) return null;
          
          // Calculate total duration and count for all aggregation types
          const totalAggDuration = aggregationGroups.reduce((sum, group) => sum + group.totalDuration, 0);
          const totalAggCount = aggregationGroups.reduce((sum, group) => sum + group.count, 0);
          
          return (
            <div 
              key="aggregations-parent" 
              className="query-group"
              data-type="Aggregations"
              data-name="Aggregations"
            >
              <div 
                className="query-item"
                onClick={() => handleToggleExpand("Aggregations")}
              >
                <div className="query-header">
                  <button 
                    className="expand-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleExpand("Aggregations");
                    }}
                    data-expanded={expandedQueries["Aggregations"] ? "true" : "false"}
                    aria-label={expandedQueries["Aggregations"] ? "Collapse aggregations" : "Expand aggregations"}
                  >
                    {expandedQueries["Aggregations"] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="query-name">
                    <span className="bullet">•</span>
                    Aggregations
                  </div>
                </div>
                <div className="query-metrics">
                  <div className="metric">{aggregationGroups.length} types</div>
                  <div className="metric">{formatDuration(totalAggDuration)}</div>
                </div>
              </div>
            
              {expandedQueries["Aggregations"] && (
                <div 
                  className="query-children"
                  data-expanded={newlyExpandedId === "Aggregations" ? "new" : "true"}
                >
                  {aggregationGroups.map((group) => (
                    <div
                      key={group.name}
                      className={`query-child ${selectedProfile && selectedProfile.id === group.queries[0].id ? 'selected' : ''}`}
                      onClick={() => handleQuerySelect(group.queries[0])}
                      data-query-type={group.queries[0].type || group.queries[0].queryName || ''}
                    >
                      <div className="query-header">
                        <div className="query-indent"></div>
                        <div className="query-name">{group.name}</div>
                      </div>
                      <div className="query-metrics">
                        <div className="metric">{formatDuration(group.totalDuration)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      
      {/* Hidden debug info */}
      <div className="debug-info" style={{ display: 'none' }}>
        {lastExpandAction && JSON.stringify(lastExpandAction)}
      </div>

      {selectedProfile && (
        <QueryDetail 
          query={selectedProfile} 
          compareQuery={profileToCompare}
          compareMode={compareMode}
        />
      )}
    </div>
  );
};

export default ProfilerQueries; 