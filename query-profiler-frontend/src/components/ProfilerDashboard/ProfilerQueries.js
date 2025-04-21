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
        
        // Get aggregation data
        const aggregations = data.profileData.shards[0]?.searches?.[0]?.aggregations || [];
        
        // Calculate total query time including rewrite time, collectors, and aggregations
        const totalQueryTimeNanos = 
          queries.reduce((sum, q) => sum + (q.time_in_nanos || 0), 0) + 
          collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) + 
          aggregations.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0) + 
          rewriteTime;
        
        // Transform queries with proper hierarchy preserved
        const transformedQueries = queries.map((q, index) => transformQueryWithChildren(q, index, totalQueryTimeNanos));
        
        // Add collector data as a separate "query" group
        if (collectors.length > 0) {
          transformedQueries.push({
            id: `collector-group`,
            queryName: 'Query Collectors',
            type: 'Collectors',
            description: 'Collection phase of the query execution',
            operation: 'Collection phase',
            totalDuration: rewriteTime / 1000000 + collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / 1000000,
            time_ms: rewriteTime / 1000000 + collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / 1000000,
            percentage: (rewriteTime + collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0)) / totalQueryTimeNanos * 100,
            children: collectors.map((c, i) => ({
              id: `collector-${i}`,
              queryName: c.name,
              type: c.name,
              description: c.reason || 'Collector phase',
              operation: c.reason || 'Collector operation',
              totalDuration: c.time_in_nanos / 1000000,
              time_ms: c.time_in_nanos / 1000000,
              percentage: (c.time_in_nanos / totalQueryTimeNanos) * 100
            })).concat([{
              id: 'rewrite-time',
              queryName: 'Query Rewrite',
              type: 'QueryRewrite',
              description: 'Time spent rewriting the query',
              operation: 'Query rewriting',
              totalDuration: rewriteTime / 1000000,
              time_ms: rewriteTime / 1000000,
              percentage: (rewriteTime / totalQueryTimeNanos) * 100
            }])
          });
        }

        // Add aggregation data as a separate group
        if (aggregations.length > 0) {
          transformedQueries.push({
            id: 'aggregation-group',
            queryName: 'Aggregations',
            type: 'Aggregations',
            description: 'Aggregation phase of the query execution',
            operation: 'Aggregation phase',
            totalDuration: aggregations.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0) / 1000000,
            time_ms: aggregations.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0) / 1000000,
            percentage: aggregations.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0) / totalQueryTimeNanos * 100,
            children: aggregations.map((agg, i) => transformAggregation(agg, i, totalQueryTimeNanos))
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
      
      if (agg.breakdown) {
        Object.entries(agg.breakdown).forEach(([key, value]) => {
          if (typeof value === 'number' && value > 0) {
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
        rawBreakdown: agg.breakdown || {},
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
        };
      });

      // Sort groups by total duration
      return result.sort((a, b) => b.totalDuration - a.totalDuration);
    } catch (err) {
      console.error('[ProfilerQueries] Error processing query data:', err);
      return [];
    }
  }, []);

  // Auto-expand the first query group when data changes
  useEffect(() => {
    const processed = processQueryData(data);
    setProcessedData(processed);

    // Auto-expand the first group if it exists
    if (processed.length > 0) {
      const firstGroupName = processed[0].name;
      console.debug(`[ProfilerQueries] Auto-expanding first group: ${firstGroupName}`);
      
      setExpandedQueries(prev => {
        if (!prev[firstGroupName]) {
          return { ...prev, [firstGroupName]: true };
        }
        return prev;
      });
    }
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
      const enhancedQuery = {
        ...query,
        originalQueryData: data.originalQueryData || null
      };

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
        {processedData.map((group) => (
          <div key={group.name} className="query-group">
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
        ))}
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