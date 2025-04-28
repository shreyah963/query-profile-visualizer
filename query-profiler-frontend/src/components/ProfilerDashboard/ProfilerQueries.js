import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown } from 'react-feather';
import './ProfilerQueries.css';
import QueryDetail from './QueryDetail';

// Helper function to recursively transform a query and its children
const transformQueryWithChildren = (query, index, totalQueryTimeNanos) => {
  const formattedBreakdown = {};
  if (query.breakdown) {
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
    Object.entries(breakdownGroups).forEach(([groupKey, keys]) => {
      if (keys.some(key => query.breakdown[key] > 0)) {
        formattedBreakdown[groupKey] = keys.reduce((sum, key) => {
          if (key.endsWith('_count')) return sum;
          return sum + (query.breakdown[key] || 0);
        }, 0);
      }
    });
    Object.entries(query.breakdown).forEach(([key, value]) => {
      if (key.endsWith('_count')) return;
      const isInGroup = Object.values(breakdownGroups).some(
        groupKeys => groupKeys.includes(key)
      );
      if (!isInGroup && typeof value === 'number' && value > 0) {
        formattedBreakdown[key] = value;
      }
    });
  }
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

// Helper function to recursively process collector children
const processCollectorChildren = (collector, totalQueryTimeNanos) => {
  const result = {
    name: collector.name,
    reason: collector.reason,
    time_ms: collector.time_in_nanos / 1000000,
    percentage: (collector.time_in_nanos / totalQueryTimeNanos) * 100
  };
  if (collector.children && collector.children.length > 0) {
    result.children = collector.children.map(child =>
      processCollectorChildren(child, totalQueryTimeNanos)
    );
  }
  return result;
};

// Helper function to recursively transform an aggregation and its children
const transformAggregation = (agg, index, totalQueryTimeNanos) => {
  const formattedBreakdown = {};
  const rawBreakdown = agg.breakdown || {};
  if (agg.breakdown) {
    const breakdownGroups = {
      'build_aggregation': ['build_aggregation', 'build_aggregation_count'],
      'collect': ['collect', 'collect_count'],
      'initialize': ['initialize', 'initialize_count'],
      'post_collection': ['post_collection', 'post_collection_count'],
      'reduce': ['reduce', 'reduce_count'],
      'build_leaf_collector': ['build_leaf_collector', 'build_leaf_collector_count'],
    };
    Object.entries(breakdownGroups).forEach(([groupKey, keys]) => {
      if (keys.some(key => agg.breakdown[key] > 0)) {
        formattedBreakdown[groupKey] = keys.reduce((sum, key) => {
          if (key.endsWith('_count')) return sum;
          return sum + (agg.breakdown[key] || 0);
        }, 0);
      }
    });
    Object.entries(agg.breakdown).forEach(([key, value]) => {
      if (key.endsWith('_count')) return;
      const isInGroup = Object.values(breakdownGroups).some(
        groupKeys => groupKeys.includes(key)
      );
      if (!isInGroup && typeof value === 'number' && value > 0) {
        formattedBreakdown[key] = value;
      }
    });
  }
  // Do not include children for flat aggregation rows
  return {
    id: `agg-${index}`,
    queryName: agg.type || 'Unknown Aggregation',
    type: agg.type || 'Unknown Aggregation',
    description: '',
    operation: agg.type || 'Unknown Aggregation',
    totalDuration: agg.time_in_nanos ? (agg.time_in_nanos / 1000000) : 0,
    time_ms: agg.time_in_nanos ? (agg.time_in_nanos / 1000000) : 0,
    percentage: agg.time_in_nanos ? (agg.time_in_nanos / totalQueryTimeNanos) * 100 : 0,
    breakdown: formattedBreakdown,
    rawBreakdown: rawBreakdown,
    children: []
  };
};

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
    if (!data || !data.profileData || !data.profileData.shards) {
      return [];
    }
    try {
      // Extract from the first shard's first search
      const queries = data.profileData.shards[0]?.searches?.[0]?.query || [];
      const collectors = data.profileData.shards[0]?.searches?.[0]?.collector || [];
      const rewriteTime = data.profileData.shards[0]?.searches?.[0]?.rewrite_time || 0;
      const searchAggregations = data.profileData.shards[0]?.searches?.[0]?.aggregations || [];
      const shardAggregations = data.profileData.shards[0]?.aggregations || [];
      const aggregations = [...searchAggregations, ...shardAggregations];

      // Calculate total query time
      const totalQueryTimeNanos =
        queries.reduce((sum, q) => sum + (q.time_in_nanos || 0), 0) +
        collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) +
        aggregations.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0) +
        rewriteTime;

      // Transform queries
      const totalQueryTime = queries.reduce((sum, q) => sum + (q.time_in_nanos || 0), 0);
      const queryChild = queries.length > 0 ? [{
        id: 'query-group',
        queryName: 'Query',
        type: 'Query',
        description: '',
        operation: 'Query',
        totalDuration: totalQueryTime / 1000000,
        time_ms: totalQueryTime / 1000000,
        percentage: (totalQueryTime / totalQueryTimeNanos) * 100,
        children: []
      }] : [];
      // Rewrite time as child
      const rewriteChild = rewriteTime > 0 ? [{
        id: 'query-rewrite-group',
        queryName: 'Rewrite Time',
        type: 'QueryRewrite',
        description: '',
        operation: 'Rewrite Time',
        totalDuration: rewriteTime / 1000000,
        time_ms: rewriteTime / 1000000,
        percentage: (rewriteTime / totalQueryTimeNanos) * 100,
        children: []
      }] : [];
      // Collectors as child
      const collectorChildren = collectors.length > 0 ? [{
        id: `collector-group`,
        queryName: 'Collectors',
        type: 'Collectors',
        description: '',
        operation: 'Collectors',
        totalDuration: collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / 1000000,
        time_ms: collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / 1000000,
        percentage: collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0) / totalQueryTimeNanos * 100,
        collectorData: collectors.map(c => processCollectorChildren(c, totalQueryTimeNanos)),
        children: []
      }] : [];

      // SEARCH GROUP
      const searchChildren = [
        ...queryChild,
        ...rewriteChild,
        ...collectorChildren
      ];
      const searchGroup = {
        name: 'Search',
        queries: searchChildren,
        totalDuration: searchChildren.reduce((sum, q) => sum + q.totalDuration, 0),
        count: searchChildren.length,
        type: 'Search'
      };

      // AGGREGATIONS GROUP
      const transformedAggs = aggregations.map((agg, i) => transformAggregation(agg, i, totalQueryTimeNanos));
      const aggsGroup = transformedAggs.length > 0 ? {
        name: 'Aggregations',
        queries: transformedAggs,
        totalDuration: transformedAggs.reduce((sum, a) => sum + a.totalDuration, 0),
        count: transformedAggs.length,
        type: 'Aggregations'
      } : null;

      // Only return groups that have children
      return aggsGroup ? [searchGroup, aggsGroup] : [searchGroup];
    } catch (error) {
      console.error('[ProfilerQueries] Error extracting queries:', error);
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

  // Render query/aggregation children recursively
  const renderChildren = (children, groupName, depth = 1) => {
    return children.map((child) => (
      <div
        key={child.id}
        className={`query-child${selectedProfile && selectedProfile.id === child.id ? ' selected' : ''}`}
        style={{ marginLeft: depth * 20 }}
        onClick={() => handleQuerySelect(child, groupName)}
        data-query-type={child.type || child.queryName || ''}
      >
        <div className="query-header">
          <div className="query-indent"></div>
          <div className="query-name">{child.operation || child.description || child.queryName}</div>
        </div>
        <div className="query-metrics">
          <div className="metric">{formatDuration(child.totalDuration)}</div>
        </div>
        {child.children && child.children.length > 0 && (
          <div className="query-children-nested">
            {renderChildren(child.children, groupName, depth + 1)}
          </div>
        )}
      </div>
    ));
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
          <div
            key={group.name}
            className="query-group"
            data-type={group.type}
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
                  data-expanded={expandedQueries[group.name] ? 'true' : 'false'}
                  aria-label={expandedQueries[group.name] ? 'Collapse' : 'Expand'}
                >
                  {expandedQueries[group.name] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="query-name">
                  <span className="bullet">•</span>
                  {group.name}
                </div>
              </div>
              <div className="query-metrics">
                <div className="metric">{group.count} items</div>
                <div className="metric">{formatDuration(group.totalDuration)}</div>
              </div>
            </div>
            {expandedQueries[group.name] && (
              <div
                className="query-children"
                data-expanded={newlyExpandedId === group.name ? 'new' : 'true'}
              >
                {renderChildren(group.queries, group.name)}
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