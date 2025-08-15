import React, { useState, useEffect, useCallback, useRef } from 'react';
import QueryDetail from '../QueryDetail';
    
// Helper function to format duration with precision
const formatDuration = (ms) => {
  if (!ms && ms !== 0) return '0 ms';
  if (ms < 0.1) {
    return `${ms.toFixed(4)} ms`; // Extra precision for very small values
  } else if (ms < 1) {
    return `${ms.toFixed(3)} ms`; // More precision for small values
  } else if (ms < 1000) {
    return `${ms.toFixed(2)} ms`; // Standard precision for normal values
  }
  return `${(ms / 1000).toFixed(3)} s`; // Convert to seconds for large values
};
    
    // Helper function to recursively transform a query and its children
const transformQueryWithChildren = (query, index, parentTimeNanos, path = '', queryCounts = {}, allQueries = [], rootTimeNanos = null) => {
      const nodeId = path ? `${path}-${index}` : `${index}`;
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
      const thisTimeNanos = query.time_in_nanos || 0;
  
  // If rootTimeNanos is not set, this is the root node
  if (rootTimeNanos == null) rootTimeNanos = thisTimeNanos;
  
  // Calculate percentage relative to root
  const percentage = rootTimeNanos > 0 ? (thisTimeNanos / rootTimeNanos) * 100 : 0;
  
  // Handle query name with suffix for root queries
  let queryName = query.type || 'Unknown Query';
  if (!path) { // Only for root queries
    const count = queryCounts[queryName] || 0;
    if (count > 1) {
      // Find the current instance number
      let instanceNumber = 1;
      for (let i = 0; i < index; i++) {
        if (allQueries[i]?.type === query.type) {
          instanceNumber++;
        }
      }
      queryName = `${queryName}${instanceNumber}`;
    }
  }
  
      const transformedChildren = (query.children || []).map((child, childIndex) => 
    transformQueryWithChildren(child, childIndex, thisTimeNanos, nodeId, queryCounts, allQueries, rootTimeNanos)
      );
  
      return {
        id: `query-${nodeId}`,
    queryName: queryName,
        type: query.type || 'Unknown Query',
        description: query.description || '',
        operation: query.description || query.type,
        totalDuration: thisTimeNanos / 1000000,
        time_ms: thisTimeNanos / 1000000,
    percentage: percentage, // Use actual percentage instead of hardcoding 100% for root
        breakdown: formattedBreakdown,
        rawBreakdown: query.breakdown || {},
        children: transformedChildren
      };
    };
    
// Helper function to recursively process collector children
const processCollectorChildren = (collector, parentCollectorTimeNanos, index = 0) => {
  const id = collector.name ? `collector-${collector.name.replace(/\s+/g, '-')}-${index}` : `collector-${index}`;
  const type = collector.name || 'Collector'; // Use actual name if available
  const queryName = collector.name || 'Collector'; // Use actual name if available
  const description = collector.reason || '';
  const thisTimeNanos = collector.time_in_nanos || 0;
  const totalDuration = thisTimeNanos / 1000000;
  const time_ms = thisTimeNanos / 1000000;
  const percentage = parentCollectorTimeNanos > 0 ? (thisTimeNanos / parentCollectorTimeNanos) * 100 : 0;
  const breakdown = collector.breakdown || {};
  const rawBreakdown = collector.breakdown || {};
  const children = (collector.children || []).map((child, idx) => processCollectorChildren(child, thisTimeNanos, idx));
        return {
    id,
    type,
      queryName,
    description,
    totalDuration,
    time_ms,
    percentage,
    breakdown,
    rawBreakdown,
    children,
  };
};
    
    // Helper function to recursively transform an aggregation and its children
    const transformAggregation = (agg, index, totalQueryTimeNanos, path = '') => {
      const nodeId = path ? `${path}-${index}` : `${index}`;
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
  const transformedChildren = (agg.children || []).map((child, childIndex) =>
    transformAggregation(child, childIndex, totalQueryTimeNanos, nodeId)
  );
      return {
        id: `agg-${nodeId}`,
        queryName: agg.type || 'Unknown Aggregation',
        type: agg.type || 'Unknown Aggregation',
        description: agg.description || '',
        operation: agg.type || 'Unknown Aggregation',
        totalDuration: agg.time_in_nanos ? (agg.time_in_nanos / 1000000) : 0,
        time_ms: agg.time_in_nanos ? (agg.time_in_nanos / 1000000) : 0,
        percentage: agg.time_in_nanos ? (agg.time_in_nanos / totalQueryTimeNanos) * 100 : 0,
        breakdown: formattedBreakdown,
        rawBreakdown: rawBreakdown,
        children: transformedChildren
      };
    };

// Helper function to recursively transform a fetch phase and its children
const transformFetchPhase = (phase, index, parentTimeNanos, path = '') => {
  const nodeId = path ? `${path}-${index}` : `${index}`;
  const thisTimeNanos = phase.time_in_nanos || 0;

  let formattedBreakdown = {};
  const rawBreakdown = phase.breakdown || {};

  if (phase.breakdown) {
    // Determine if this is a root fetch phase or a sub-phase based on breakdown keys
    const isSubPhase = Object.prototype.hasOwnProperty.call(phase.breakdown, 'process');

    const breakdownGroups = isSubPhase
        ? {
          process: ['process', 'process_count'],
          set_next_reader: ['set_next_reader', 'set_next_reader_count'],
        }
        : {
          load_stored_fields: ['load_stored_fields', 'load_stored_fields_count'],
          load_source: ['load_source', 'load_source_count'],
          create_stored_fields_visitor: ['create_stored_fields_visitor', 'create_stored_fields_visitor_count'],
          build_sub_phase_processors: ['build_sub_phase_processors', 'build_sub_phase_processors_count'],
          get_next_reader: ['get_next_reader', 'get_next_reader_count'],
        };

    Object.entries(breakdownGroups).forEach(([groupKey, keys]) => {
      if (keys.some((k) => phase.breakdown[k] > 0)) {
        formattedBreakdown[groupKey] = keys.reduce((sum, key) => {
          if (key.endsWith('_count')) return sum;
          return sum + (phase.breakdown[key] || 0);
        }, 0);
      }
    });

    Object.entries(phase.breakdown).forEach(([key, value]) => {
      if (key.endsWith('_count')) return;
      const isInGroup = Object.values(breakdownGroups).some((groupKeys) => groupKeys.includes(key));
      if (!isInGroup && typeof value === 'number' && value > 0) {
        formattedBreakdown[key] = value;
      }
    });
  }

  const children = [];
  (phase.children || []).forEach((child, childIndex) => {
    children.push(transformFetchPhase(child, childIndex, thisTimeNanos, nodeId));
  });
  // InnerHitsPhase can have its own fetch phases
  if (phase.fetch) {
    phase.fetch.forEach((child, childIndex) => {
      children.push(transformFetchPhase(child, childIndex, thisTimeNanos, `${nodeId}-fetch`));
    });
  }
  return {
    id: `fetch-${nodeId}`,
    queryName: phase.type || 'Fetch',
    type: phase.type || 'Fetch',
    description: phase.description || '',
    operation: phase.description || phase.type || 'Fetch',
    totalDuration: thisTimeNanos / 1000000,
    time_ms: thisTimeNanos / 1000000,
    percentage: parentTimeNanos > 0 ? (thisTimeNanos / parentTimeNanos) * 100 : 0,
    breakdown: formattedBreakdown,
    rawBreakdown: rawBreakdown,
    children,
  };
};
    
// Dynamic color map for query types (use pastel colors for all types)
const typeColorMap = {
  ConstantScoreQuery: '#ffe0b2', // pastel orange
  BooleanQuery: '#d1c4e9',      // pastel purple
  TermQuery: '#b2dfdb',         // pastel teal
  RangeQuery: '#ffcdd2',        // pastel red
  MatchAllDocsQuery: '#fff9c4', // pastel yellow
  Aggregations: '#b3e5fc',      // pastel blue
  Rewrite: '#c8e6c9',           // pastel green
  Collectors: '#f2959b',        // pink for collectors
  Collector: '#a4b0fe',         // purple for individual collector nodes
  Query: '#bbdefb',             // pastel blue
};
const getTypeColor = (type) => typeColorMap[type] || '#e0e7ef';

const ProfilerQueries = ({
  data,
  compareMode,
  profileToCompare = null,
  setProfileToCompare = () => {},
}) => {
  const [processedQueryData, setProcessedQueryData] = useState([]);
  const [processedAggData, setProcessedAggData] = useState([]);
  const [processedFetchData, setProcessedFetchData] = useState([]);
  const [showHierarchy, setShowHierarchy] = useState('query'); // 'query', 'agg', or 'fetch'
  const [expandedNodes, setExpandedNodes] = useState({}); // Empty by default means all nodes are collapsed
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(320);

  // Process query and aggregation data
  const processData = useCallback((data) => {
    if (!data || !data.profileData || !data.profileData.shards) {
      return { queries: [], aggs: [], fetch: [] };
    }
    try {
      const queries = data.profileData.shards[0]?.searches?.[0]?.query || [];
      const rewrite_time = data.profileData.shards[0]?.searches?.[0]?.rewrite_time;
      const collectors = data.profileData.shards[0]?.searches?.[0]?.collector || [];
      const totalQueryTimeNanos = queries.reduce((sum, q) => sum + (q.time_in_nanos || 0), 0);
      
      // Initialize queryCounts object
      const queryCounts = {};
      
      // First pass to count query types
      queries.forEach(query => {
        const type = query.type || 'Unknown Query';
        queryCounts[type] = (queryCounts[type] || 0) + 1;
      });
      
      const children = queries.map((q, i) => transformQueryWithChildren(q, i, totalQueryTimeNanos, '', queryCounts, queries));
      
      if (rewrite_time) {
        children.push({
          id: 'rewrite',
          queryName: 'Rewrite',
          type: 'Rewrite',
          description: 'Query Rewrite Phase',
          totalDuration: rewrite_time / 1000000,
          time_ms: rewrite_time / 1000000,
          percentage: totalQueryTimeNanos > 0 ? (rewrite_time / totalQueryTimeNanos) * 100 : 0,
          children: [],
          breakdown: {},
          rawBreakdown: {},
        });
      }
      if (collectors.length > 0) {
        const totalCollectorTime = collectors.reduce((sum, c) => sum + (c.time_in_nanos || 0), 0);
        const processedCollectors = collectors.map((c, i) => {
          const processed = processCollectorChildren(c, totalCollectorTime, i);
        return {
            ...processed,
            id: `collector-${i}`,
            type: c.name || 'Collector',
            queryName: c.name || 'Collector',
            displayName: c.name || 'Collector',
            children: processed.children || [],
        };
      });
        children.push({
          id: 'collectors',
          queryName: 'Collectors',
          type: 'Collectors',
          displayName: 'Collectors',
          description: 'Query Collectors',
          totalDuration: totalCollectorTime / 1000000,
          time_ms: totalCollectorTime / 1000000,
          percentage: totalQueryTimeNanos > 0 ? (totalCollectorTime / totalQueryTimeNanos) * 100 : 0,
          children: processedCollectors,
          collectorData: processedCollectors,
          breakdown: {},
          rawBreakdown: {},
        });
      }
      const queryChild = children.length > 0 ? [{
        id: 'query-group',
        queryName: 'Query',
        type: 'Query',
        description: '',
        operation: 'Query',
        totalDuration: totalQueryTimeNanos / 1000000,
        time_ms: totalQueryTimeNanos / 1000000,
        percentage: 100,
        children,
      }] : [];

      // Aggregations
      const searchAggregations = data.profileData.shards[0]?.searches?.[0]?.aggregations || [];
      const shardAggregations = data.profileData.shards[0]?.aggregations || [];
      const allAggs = [...searchAggregations, ...shardAggregations];
      const totalAggTimeNanos = allAggs.reduce((sum, a) => sum + (a.time_in_nanos || 0), 0);
      const aggChild = allAggs.length > 0 ? [{
        id: 'agg-group',
        queryName: 'Aggregations',
        type: 'Aggregations',
        description: '',
        operation: 'Aggregations',
        totalDuration: totalAggTimeNanos / 1000000,
        time_ms: totalAggTimeNanos / 1000000,
        percentage: 100,
        children: allAggs.flatMap((a, i) => {
          const aggNode = transformAggregation(a, i, totalAggTimeNanos);
          if (a.debug && Object.keys(a.debug).length > 0) {
            return [
              aggNode,
              {
                id: `agg-debug-${i}`,
                queryName: `Debug: ${a.description || a.type || 'Aggregation'}`,
                type: 'AggregationDebug',
                description: a.description || a.type || 'Aggregation',
                debug: a.debug,
                parentAggIndex: i,
              }
            ];
          } else {
            return [aggNode];
          }
        })
      }] : [];

      // Fetch phases
      const fetchPhases = data.profileData.shards[0]?.fetch || data.profileData.shards[0]?.searches?.[0]?.fetch || [];
      const totalFetchTimeNanos = fetchPhases.reduce((sum, f) => sum + (f.time_in_nanos || 0), 0);
      const fetchChild = fetchPhases.length > 0 ? [{
        id: 'fetch-group',
        queryName: 'Fetch',
        type: 'Fetch',
        description: '',
        operation: 'Fetch',
        totalDuration: totalFetchTimeNanos / 1000000,
        time_ms: totalFetchTimeNanos / 1000000,
        percentage: 100,
        children: fetchPhases.map((f, i) => transformFetchPhase(f, i, totalFetchTimeNanos)),
      }] : [];
      return { queries: queryChild, aggs: aggChild, fetch: fetchChild };
    } catch (error) {
      console.error('[ProfilerQueries] Error extracting queries/aggregations:', error);
      return { queries: [], aggs: [], fetch: [] };
    }
  }, []);

  useEffect(() => {
    const { queries, aggs, fetch } = processData(data);
    setProcessedQueryData(queries);
    setProcessedAggData(aggs);
    setProcessedFetchData(fetch);
    // Reset expanded nodes when new data is loaded
    setExpandedNodes({});
  }, [data, processData]);
    
  // Helper to find a node by ID in the tree
  const findNodeById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Automatically select the first node in the shown hierarchy
  useEffect(() => {
    const dataList = showHierarchy === 'query'
        ? processedQueryData
        : showHierarchy === 'agg'
            ? processedAggData
            : processedFetchData;
    if (dataList.length > 0 && dataList[0].children.length > 0 && !selectedProfileId) {
      // Find the first leaf node in the hierarchy
      const findFirstLeaf = (nodes) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            const leaf = findFirstLeaf(node.children);
            if (leaf) return leaf;
          } else {
            return node;
          }
        }
        return nodes[0]; // If no leaf found, return first node
      };
      const firstNode = findFirstLeaf(dataList[0].children);
      if (firstNode) {
        setSelectedProfileId(firstNode.id);
      }
    }
  }, [showHierarchy, processedQueryData, processedAggData, processedFetchData, selectedProfileId]);
    
  // Expand/collapse logic
  const toggleExpand = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Render the hierarchy as a collapsible tree
  const renderHierarchy = (nodes, depth = 0) => {
    // Find max and min time among root nodes for scaling
    const rootTimes = depth === 0 ? nodes.map(node => node.time_ms || 0) : [];
    const totalRootTime = depth === 0 ? rootTimes.reduce((a, b) => a + b, 0) : 0;
    
    // Function to get color based on relative time
    const getTimeColor = (timeMs) => {
      // Always use blue for root nodes
      return '#3b82f6cc';
    };
    
    return (
    <ul
      className="query-hierarchy-list"
      style={{ marginLeft: depth === 0 ? 0 : 16, paddingLeft: 0 }}
      key={`ul-${depth}-${nodes[0]?.id || 'root'}`}
    >
      {nodes.map((node, idx) => {
        const hasChildren = node.children && node.children.length > 0;
          const expanded = expandedNodes[node.id] === true; // Explicitly check for true
        const nodeKey = node.id ? `${node.id}-${depth}-${idx}` : `node-${depth}-${idx}`;
          
    return (
          <li
            key={nodeKey}
            className={"query-hierarchy-node"}
            style={{
              paddingLeft: hasChildren ? 0 : 8,
              borderLeft: `3px solid ${getTypeColor(node.type)}`,
            }}
          >
              <div 
                className={`query-hierarchy-row${selectedProfileId === node.id ? ' selected' : ''}`} 
                onClick={e => { 
                  e.stopPropagation(); 
                  setSelectedProfileId(node.id);
                }}
                title={node.queryName}
                data-testid="query-node"
              >
              {hasChildren && (
                <span
                  className={`tree-chevron${expanded ? ' expanded' : ''}`}
                  onClick={e => { e.stopPropagation(); toggleExpand(node.id); }}
                  tabIndex={0}
                  role="button"
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? '▾' : '▸'}
                </span>
              )}
                <div className="query-hierarchy-content">
                  <div className="query-name-container">
                    <span className="query-type-name">
                      {node.queryName}
                    </span>
                  </div>
                  <div className="query-hierarchy-metrics">
                    {depth === 0 ? (
                      <>
                        <div 
                          className="timestamp-block" 
                          style={{ 
                            width: totalRootTime > 0 ? `${Math.max(4, (node.time_ms / totalRootTime) * 120)}px` : '0px',
                            background: getTimeColor(node.time_ms)
                          }}
                        ></div>
                        <span className="query-node-time">{formatDuration(node.time_ms)}</span>
                      </>
                    ) : (
                      <>
                        <div className="timestamp-block" style={{ width: '0px', background: 'transparent' }}></div>
                        <span className="query-hierarchy-percentage" style={{ minWidth: '56px', display: 'inline-block', textAlign: 'right' }}>
                          {node.percentage && node.type !== 'Rewrite' ? `${node.percentage.toFixed(1)}%` : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>
          </div>
            {hasChildren && expanded && renderHierarchy(node.children, depth + 1)}
          </li>
        );
      })}
    </ul>
    );
  };

  // Resizer drag logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      const min = 180, max = 600;
      let containerLeft = 0;
      if (containerRef.current) {
        containerLeft = containerRef.current.getBoundingClientRect().left;
      }
      const mouseX = e.clientX - containerLeft;
      let newWidth = mouseX;
      if (newWidth < min) newWidth = min;
      if (newWidth > max) newWidth = max;
      setLeftPanelWidth(newWidth);
    };
    const handleMouseUp = () => { dragging.current = false; };
    if (dragging.current) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Layout: two columns with tabs
  const hasQueryData = processedQueryData.length > 0 && processedQueryData[0].children.length > 0;
  const hasAggData = processedAggData.length > 0 && processedAggData[0].children.length > 0;
  const hasFetchData = processedFetchData.length > 0 && processedFetchData[0].children.length > 0;

  return (
    <div
      className="profiler-queries-clean-layout"
      ref={containerRef}
      style={{ display: 'flex', height: '100vh', minWidth: 0, minHeight: 0, position: 'relative' }}
    >
      <div 
        className="profiler-queries-left-panel"
        style={{ width: leftPanelWidth, minWidth: 180, maxWidth: 600, height: '100%', minHeight: 0, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {hasQueryData || hasAggData || hasFetchData ? (
          <>
            <div className="query-tabs">
              <button
                className={`query-tab${showHierarchy === 'query' ? ' active' : ''}`}
                onClick={() => setShowHierarchy('query')}
              >
                Searches
              </button>
              {hasAggData && (
                <button
                  className={`query-tab${showHierarchy === 'agg' ? ' active' : ''}`}
                  onClick={() => setShowHierarchy('agg')}
                  disabled={!hasAggData}
                >
                  Aggregations
                </button>
              )}
              {hasFetchData && (
                  <button
                      className={`query-tab${showHierarchy === 'fetch' ? ' active' : ''}`}
                      onClick={() => setShowHierarchy('fetch')}
                      disabled={!hasFetchData}
                  >
                    Fetch
                  </button>
              )}
            </div>
            {showHierarchy === 'query' && hasQueryData && (
              <div className="query-hierarchy-container" style={{ flex: 1, overflowY: 'auto', height: '100%', minHeight: 0 }}>
                {renderHierarchy(processedQueryData[0].children)}
              </div>
            )}
            {showHierarchy === 'agg' && hasAggData && (
              <div className="query-hierarchy-container" style={{ flex: 1, overflowY: 'auto', height: '100%', minHeight: 0 }}>
                {renderHierarchy(processedAggData[0].children)}
              </div>
            )}
            {showHierarchy === 'fetch' && hasFetchData && (
                <div className="query-hierarchy-container" style={{ flex: 1, overflowY: 'auto', height: '100%', minHeight: 0 }}>
                  {renderHierarchy(processedFetchData[0].children)}
                </div>
            )}
          </>
        ) : null}
      </div>
      <div
        className="resizer"
        onMouseDown={e => {
          dragging.current = true;
          dragStartX.current = e.clientX;
          dragStartWidth.current = leftPanelWidth;
        }}
        style={{ cursor: 'col-resize', width: 7, background: '#dbeafe', zIndex: 10, position: 'relative' }}
      />
      <div
        className="profiler-queries-right-panel"
        style={{ flex: 1, minWidth: 0, height: '100%', minHeight: 0, boxSizing: 'border-box', overflowY: 'auto' }}
      >
        {hasQueryData || hasAggData || hasFetchData ? (
          selectedProfileId ? (
            <QueryDetail
              query={findNodeById(
                  showHierarchy === 'query'
                      ? (processedQueryData[0]?.children || [])
                      : showHierarchy === 'agg'
                          ? (processedAggData[0]?.children || [])
                          : (processedFetchData[0]?.children || []),
                selectedProfileId
              )}
              rootId={
                showHierarchy === 'query'
                  ? processedQueryData[0]?.id
                    : showHierarchy === 'agg'
                        ? processedAggData[0]?.id
                        : processedFetchData[0]?.id
              }
              compareQuery={profileToCompare}
              compareMode={compareMode}
            />
          ) : (
            <div className="query-detail-placeholder" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
              Select a node in the hierarchy to view its operational breakdown and children.
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};

export default ProfilerQueries; 