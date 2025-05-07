import React, { useState, useMemo } from 'react';

const ShardVisualization = ({ profileData, onShardSelect }) => {
  const [topN, setTopN] = useState(5);
  const [topNAgg, setTopNAgg] = useState(5);
  
  // Calculate execution times for each shard
  const shardMetrics = useMemo(() => {
    if (!profileData?.shards) return [];
    
    return profileData.shards.map((shard, index) => {
      // Calculate search execution time including root queries, rewrites, and collectors
      const searchTime = shard.searches?.[0]?.query?.reduce((sum, q) => {
        // Add root query time
        return sum + (q.time_in_nanos || 0);
      }, 0) || 0;

      // Add rewrite time
      const rewriteTime = shard.searches?.[0]?.rewrite_time || 0;

      // Add all root collectors' times
      const collectorsTime = shard.searches?.[0]?.collector?.reduce((sum, collector) => 
        sum + (collector.time_in_nanos || 0), 0) || 0;

      // Calculate aggregation time by summing up all aggregation types at the shard level
      const aggTime = shard.aggregations?.reduce((sum, agg) => {
        // Add the time_in_nanos for each aggregation
        return sum + (agg.time_in_nanos || 0);
      }, 0) || 0;

      // Log the components for debugging
      console.log('Time components for shard', index, {
        queriesTime: searchTime / 1000000,
        rewriteTime: rewriteTime / 1000000,
        collectorsTime: collectorsTime / 1000000,
        aggTime: aggTime / 1000000,
        total: (searchTime + rewriteTime + collectorsTime) / 1000000
      });
      
      return {
        id: shard.id || `shard-${index}`,
        name: shard.id || `Shard ${index + 1}`,
        searchTime: (searchTime + rewriteTime + collectorsTime) / 1000000, // Convert to milliseconds
        aggTime: aggTime / 1000000, // Convert to milliseconds
        index
      };
    });
  }, [profileData]);

  // Check if any shard has aggregations
  const hasAggregations = useMemo(() => 
    shardMetrics.some(shard => shard.aggTime > 0),
    [shardMetrics]
  );

  // Sort and get top N shards for each metric
  const topSearchShards = useMemo(() => {
    const sortedShards = [...shardMetrics].sort((a, b) => b.searchTime - a.searchTime);
    return topN === 'all' ? sortedShards : sortedShards.slice(0, topN);
  }, [shardMetrics, topN]);

  const topAggShards = useMemo(() => {
    // Only include shards with non-zero aggregation time
    const shardsWithAggregations = shardMetrics.filter(shard => shard.aggTime > 0);
    const sortedShards = [...shardsWithAggregations].sort((a, b) => b.aggTime - a.aggTime);
    return topNAgg === 'all' ? sortedShards : sortedShards.slice(0, topNAgg);
  }, [shardMetrics, topNAgg]);

  // Calculate max time for scaling
  const maxSearchTime = Math.max(...topSearchShards.map(s => s.searchTime));
  const maxAggTime = Math.max(...topAggShards.map(s => s.aggTime));

  const handleShardClick = (shardIndex) => {
    onShardSelect(shardIndex);
  };

  return (
    <div className="shard-visualization">
      <div className="shard-charts">
        <div className="shard-chart">
          <div className="shard-controls">
            <label htmlFor="top-n-select">Show: </label>
            <select 
              id="top-n-select" 
              value={topN} 
              onChange={(e) => setTopN(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="top-n-select"
            >
              <option value="all">All Shards</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>
          </div>
          <h3>{topN === 'all' ? 'All Shards' : `Top ${topN} Shards`} by Search Time</h3>
          <div className="chart-container">
            {topSearchShards.map((shard) => (
              <div 
                key={`search-${shard.id}`}
                className="chart-bar-container"
                onClick={() => handleShardClick(shard.index)}
                title={`${shard.name}: ${shard.searchTime.toFixed(2)}ms`}
              >
                <div className="bar-label">{shard.name}</div>
                <div className="bar-wrapper">
                  <div 
                    className="bar" 
                    style={{ 
                      width: `${(shard.searchTime / maxSearchTime) * 100}%`,
                      backgroundColor: '#285badcc'
                    }}
                  />
                  <div className="bar-value">{shard.searchTime.toFixed(2)}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {hasAggregations && (
          <div className="shard-chart">
            <div className="shard-controls">
              <label htmlFor="top-n-agg-select">Show: </label>
              <select 
                id="top-n-agg-select" 
                value={topNAgg} 
                onChange={(e) => setTopNAgg(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="top-n-select"
              >
                <option value="all">All Shards</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
              </select>
            </div>
            <h3>{topNAgg === 'all' ? 'All Shards' : `Top ${topNAgg} Shards`} by Aggregation Time</h3>
            <div className="chart-container">
              {topAggShards.map((shard) => (
                <div 
                  key={`agg-${shard.id}`}
                  className="chart-bar-container"
                  onClick={() => handleShardClick(shard.index)}
                  title={`${shard.name}: ${shard.aggTime.toFixed(2)}ms`}
                >
                  <div className="bar-label">{shard.name}</div>
                  <div className="bar-wrapper">
                    <div 
                      className="bar" 
                      style={{ 
                        width: `${(shard.aggTime / maxAggTime) * 100}%`,
                        backgroundColor: '#285badcc'
                      }}
                    />
                    <div className="bar-value">{shard.aggTime.toFixed(2)}ms</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShardVisualization; 