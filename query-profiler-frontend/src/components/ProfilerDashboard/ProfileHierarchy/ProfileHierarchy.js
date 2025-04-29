import React, { useState } from 'react';
import './ProfileHierarchy.css';

const ProfileHierarchy = ({ profileData }) => {
  const [expandedSections, setExpandedSections] = useState({
    search: false,
    aggregations: false
  });

  const [expandedSearchSections, setExpandedSearchSections] = useState({
    query: false,
    rewrite: false,
    collector: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleSearchSection = (section) => {
    setExpandedSearchSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatTime = (nanos) => {
    if (nanos < 1000) return `${nanos}ns`;
    if (nanos < 1000000) return `${(nanos / 1000).toFixed(2)}µs`;
    return `${(nanos / 1000000).toFixed(2)}ms`;
  };

  const renderQueryNode = (query, depth = 0) => {
    return (
      <div className="query-node" style={{ marginLeft: `${depth * 20}px` }}>
        <div className="query-header">
          <span className="query-type">{query.type}</span>
          <span className="query-time">{formatTime(query.time_in_nanos)}</span>
        </div>
        <div className="query-description">{query.description}</div>
        {query.children && query.children.length > 0 && (
          <div className="query-children">
            {query.children.map((child, index) => renderQueryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderCollectorNode = (collector, depth = 0) => {
    return (
      <div className="collector-node" style={{ marginLeft: `${depth * 20}px` }}>
        <div className="collector-header">
          <span className="collector-name">{collector.name}</span>
          <span className="collector-time">{formatTime(collector.time_in_nanos)}</span>
        </div>
        <div className="collector-reason">{collector.reason}</div>
        {collector.children && collector.children.length > 0 && (
          <div className="collector-children">
            {collector.children.map((child, index) => renderCollectorNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderAggregationNode = (agg, depth = 0) => {
    return (
      <div className="aggregation-node" style={{ marginLeft: `${depth * 20}px` }}>
        <div className="aggregation-header">
          <span className="aggregation-type">{agg.type}</span>
          <span className="aggregation-time">{formatTime(agg.time_in_nanos)}</span>
        </div>
        <div className="aggregation-description">{agg.description}</div>
        {agg.children && agg.children.length > 0 && (
          <div className="aggregation-children">
            {agg.children.map((child, index) => renderAggregationNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const shard = profileData.shards[0];
  const search = shard.searches[0];

  return (
    <div className="profile-hierarchy">
      <div className="main-sections">
        <div className="section">
          <div 
            className="section-header"
            onClick={() => toggleSection('search')}
          >
            <span className="section-title">Search</span>
            <span className="section-time">
              {formatTime(search.query.reduce((acc, q) => acc + q.time_in_nanos, 0))}
            </span>
            <span className="toggle-icon">{expandedSections.search ? '▼' : '▶'}</span>
          </div>
          
          {expandedSections.search && (
            <div className="search-sections">
              <div 
                className="search-section"
                onClick={() => toggleSearchSection('query')}
              >
                <span className="search-section-title">Query</span>
                <span className="toggle-icon">{expandedSearchSections.query ? '▼' : '▶'}</span>
              </div>
              {expandedSearchSections.query && (
                <div className="query-section">
                  {search.query.map((q, i) => renderQueryNode(q))}
                </div>
              )}

              <div 
                className="search-section"
                onClick={() => toggleSearchSection('rewrite')}
              >
                <span className="search-section-title">Rewrite Time</span>
                <span className="search-section-time">{formatTime(search.rewrite_time)}</span>
                <span className="toggle-icon">{expandedSearchSections.rewrite ? '▼' : '▶'}</span>
              </div>

              <div 
                className="search-section"
                onClick={() => toggleSearchSection('collector')}
              >
                <span className="search-section-title">Collector</span>
                <span className="toggle-icon">{expandedSearchSections.collector ? '▼' : '▶'}</span>
              </div>
              {expandedSearchSections.collector && (
                <div className="collector-section">
                  {search.collector.map((c, i) => renderCollectorNode(c))}
                </div>
              )}
            </div>
          )}
        </div>

        {shard.aggregations && shard.aggregations.length > 0 && (
          <div className="section">
            <div 
              className="section-header"
              onClick={() => toggleSection('aggregations')}
            >
              <span className="section-title">Aggregations</span>
              <span className="section-time">
                {formatTime(shard.aggregations.reduce((acc, agg) => acc + agg.time_in_nanos, 0))}
              </span>
              <span className="toggle-icon">{expandedSections.aggregations ? '▼' : '▶'}</span>
            </div>
            {expandedSections.aggregations && (
              <div className="aggregations-section">
                {shard.aggregations.map((agg, i) => renderAggregationNode(agg))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileHierarchy; 