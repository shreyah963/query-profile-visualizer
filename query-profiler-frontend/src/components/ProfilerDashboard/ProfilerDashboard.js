import React, { useState, useEffect } from 'react';
import ProfilerSummary from './ProfilerSummary';
import ProfilerQueries from './ProfilerQueries';
import QueryInput from './QueryInput';
import ProfilerComparisonResults from './ProfilerComparisonResults';
import './ProfilerDashboard.css';

// Define query templates - consistent with the ones in QueryInput.js and ProfilerComparisonResults.js
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

const ProfilerDashboard = ({ data, updateData }) => {
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileToCompare, setProfileToCompare] = useState(null);
  const [showComparisonResults, setShowComparisonResults] = useState(false);
  const [comparisonType, setComparisonType] = useState('detailed');
  const [showDualQueryInput, setShowDualQueryInput] = useState(false);
  const [query1, setQuery1] = useState(null);
  const [query2, setQuery2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [inlineComparisonResults, setInlineComparisonResults] = useState(false);
  const [query1Template, setQuery1Template] = useState('default');
  const [query2Template, setQuery2Template] = useState('default');
  const [uploadError, setUploadError] = useState(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonInput, setShowJsonInput] = useState(false);
  
  // Update query text when template changes
  const updateQueryFromTemplate = (templateName, queryId) => {
    if (templateName && queryTemplates[templateName]) {
      const templateText = JSON.stringify(queryTemplates[templateName], null, 2);
      const queryInput = document.getElementById(queryId);
      if (queryInput) {
        queryInput.value = templateText;
      }
    }
  };

  // Handle template selection for Query 1
  const handleQuery1TemplateChange = (e) => {
    const templateName = e.target.value;
    setQuery1Template(templateName);
    updateQueryFromTemplate(templateName, 'query1-input');
  };

  // Handle template selection for Query 2
  const handleQuery2TemplateChange = (e) => {
    const templateName = e.target.value;
    setQuery2Template(templateName);
    updateQueryFromTemplate(templateName, 'query2-input');
  };
  
  if (!data && !showDualQueryInput) {
    return <div className="no-data">No profiling data available</div>;
  }

  // Handle custom query execution
  const handleQueryExecuted = (newQueryData) => {
    if (updateData && typeof updateData === 'function') {
      updateData(newQueryData);
    }
    
    // Reset selection when a new query is executed
    setSelectedProfile(null);
    setProfileToCompare(null);
  };

  const handleDualQueryComparison = () => {
    setShowDualQueryInput(true);
    setInlineComparisonResults(false);
    setQueryError(null);
    setShowJsonInput(false); // Ensure JSON input is hidden
  };

  const handleVisualizeProfile = () => {
    setShowJsonInput(!showJsonInput);
    setShowDualQueryInput(false); // Ensure dual query mode is disabled
    setQueryError(null);
  };

  const executeAndCompareQueries = async () => {
    setIsLoading(true);
    setQueryError(null);
    
    try {
      // Get query inputs from the DOM
      const query1Input = document.getElementById('query1-input');
      const query2Input = document.getElementById('query2-input');
      
      if (!query1Input || !query2Input) {
        throw new Error('Query input elements not found');
      }
      
      const query1Text = query1Input.value.trim();
      const query2Text = query2Input.value.trim();
      
      if (!query1Text || !query2Text) {
        throw new Error('Both query inputs must be filled');
      }
      
      // Parse both queries
      let parsedQuery1, parsedQuery2;
      try {
        parsedQuery1 = JSON.parse(query1Text);
        parsedQuery2 = JSON.parse(query2Text);
      } catch (e) {
        throw new Error('Invalid JSON in one or both queries: ' + e.message);
      }
      
      // Execute both queries in parallel
      const [result1, result2] = await Promise.all([
        fetch('http://localhost:5000/api/execute-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: parsedQuery1 })
        }).then(res => res.json()),
        
        fetch('http://localhost:5000/api/execute-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: parsedQuery2 })
        }).then(res => res.json())
      ]);
      
      // Store results and display comparison
      setQuery1(result1);
      setQuery2(result2);
      setSelectedProfile(result1);
      setProfileToCompare(result2);
      setInlineComparisonResults(true);
      
    } catch (error) {
      console.error('Error executing comparison:', error);
      setQueryError(error.message || 'Failed to execute queries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuery1Executed = (queryData) => {
    setQuery1(queryData);
  };

  const handleQuery2Executed = (queryData) => {
    setQuery2(queryData);
  };

  const exitDualQueryMode = () => {
    setShowDualQueryInput(false);
    setInlineComparisonResults(false);
    setQuery1(null);
    setQuery2(null);
    setQueryError(null);
  };

  const closeInlineComparison = () => {
    setInlineComparisonResults(false);
  };

  // Extract execution time information
  // Attempt to get it from multiple sources, prioritizing the most reliable ones
  const extractExecutionTime = () => {
    // From the took field in the response
    if (data.executionTime) {
      return data.executionTime;
    }
    
    // From raw took field
    if (data.took) {
      return data.took;
    }
    
    // From the profile data
    if (data.profileData?.shards?.[0]?.searches?.[0]?.took_in_millis) {
      return data.profileData.shards[0].searches[0].took_in_millis;
    }
    
    // From the first query's time
    if (data.profileData?.shards?.[0]?.searches?.[0]?.query?.[0]?.time_in_nanos) {
      return data.profileData.shards[0].searches[0].query[0].time_in_nanos / 1000000;
    }
    
    // Default
    return 0;
  };
  
  // Extract hits information
  const extractHitsInfo = () => {
    // If the hits info is already processed in the backend
    if (data.hitsInfo?.total !== undefined) {
      return {
        total: data.hitsInfo.total,
        maxScore: data.hitsInfo.maxScore || 0
      };
    }
    
    // Try to get from the raw hits property
    if (data.hits?.total) {
      // Handle both object and number format
      const totalHits = typeof data.hits.total === 'object' ? 
        data.hits.total.value : data.hits.total;
      
      return {
        total: totalHits,
        maxScore: data.hits.max_score || 0
      };
    }
    
    // Fallback to query results array length
    if (data.queryResults && Array.isArray(data.queryResults)) {
      return {
        total: data.queryResults.length,
        maxScore: data.queryResults[0]?._score || 0
      };
    }
    
    // Default
    return { total: 0, maxScore: 0 };
  };
  
  const executionTime = extractExecutionTime();
  
  const shardInfo = {
    total: data.profileData?._shards?.total || data._shards?.total || data.shardInfo?.total || 1,
    successful: data.profileData?._shards?.successful || data._shards?.successful || data.shardInfo?.successful || 1,
    failed: data.profileData?._shards?.failed || data._shards?.failed || data.shardInfo?.failed || 0
  };
  
  const hitsInfo = extractHitsInfo();

  // Handle template query execution from comparison modal
  const handleExecuteTemplateQueries = (templateQuery) => {
    setShowDualQueryInput(true);
    setInlineComparisonResults(false);
    setShowComparisonResults(false);
    
    // Find the query input elements
    setTimeout(() => {
      const query1Input = document.getElementById('query1-input');
      const query2Input = document.getElementById('query2-input');
      
      if (query1Input && query2Input) {
        // Set both inputs to the same template query
        query1Input.value = templateQuery;
        query2Input.value = templateQuery;
        
        // Try to find the template name to update the dropdowns
        const templateName = Object.keys(queryTemplates).find(
          name => JSON.stringify(queryTemplates[name], null, 2) === templateQuery
        );
        
        if (templateName) {
          setQuery1Template(templateName);
          setQuery2Template(templateName);
          
          // Update the select dropdowns if they exist
          const query1Select = document.getElementById('query1-template');
          const query2Select = document.getElementById('query2-template');
          
          if (query1Select) query1Select.value = templateName;
          if (query2Select) query2Select.value = templateName;
        }
      }
    }, 100);
  };

  // Transform profile data into the expected format
  const transformProfileData = (profileData) => {
    console.log('Original profile data:', profileData);

    // If the data is already in the correct format, return it as is
    if (profileData.profileData && profileData.profileData.shards) {
      console.log('Data already in correct format');
      return profileData;
    }

    // Handle data that's nested under a 'profile' key
    if (profileData.profile) {
      console.log('Data found under profile key');
      return {
        profileData: profileData.profile
      };
    }

    // Create the expected structure
    const transformedData = {
      profileData: {
        shards: [{
          id: '0',
          searches: [{
            query: [],
            collector: [],
            aggregations: [],
            rewrite_time: 0
          }]
        }]
      }
    };

    // Process queries
    if (profileData.queries) {
      console.log('Processing queries:', profileData.queries);
      transformedData.profileData.shards[0].searches[0].query = profileData.queries.map(query => ({
        type: query.type || 'Unknown',
        description: query.description || '',
        time_in_nanos: query.time_in_nanos || 0,
        breakdown: query.breakdown || {},
        children: query.children || []
      }));
    }

    // Process collectors
    if (profileData.collectors) {
      console.log('Processing collectors:', profileData.collectors);
      transformedData.profileData.shards[0].searches[0].collector = profileData.collectors.map(collector => ({
        name: collector.name || 'Unknown',
        reason: collector.reason || '',
        time_in_nanos: collector.time_in_nanos || 0,
        breakdown: collector.breakdown || {},
        children: collector.children || []
      }));
    }

    // Process aggregations
    if (profileData.aggregations) {
      console.log('Processing aggregations:', profileData.aggregations);
      transformedData.profileData.shards[0].searches[0].aggregations = profileData.aggregations.map(agg => ({
        type: agg.type || 'Unknown',
        description: agg.description || '',
        time_in_nanos: agg.time_in_nanos || 0,
        breakdown: agg.breakdown || {},
        children: agg.children || []
      }));
    }

    // Add rewrite time if available
    if (profileData.rewrite_time) {
      console.log('Adding rewrite time:', profileData.rewrite_time);
      transformedData.profileData.shards[0].searches[0].rewrite_time = profileData.rewrite_time;
    }

    console.log('Transformed data:', transformedData);
    return transformedData;
  };

  // Handle profile file upload
  const handleProfileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const profileData = JSON.parse(e.target.result);
        console.log('Parsed profile data:', profileData);
        // Transform the profile data into the expected format
        const transformedData = transformProfileData(profileData);
        console.log('Final transformed data:', transformedData);
        if (updateData && typeof updateData === 'function') {
          updateData(transformedData);
          setUploadError(null);
          setShowJsonInput(false);
        }
      } catch (error) {
        setUploadError('Invalid JSON format. Please upload a valid profile output file.');
        console.error('Error parsing profile JSON:', error);
      }
    };
    reader.readAsText(file);
  };

  // Handle direct JSON input
  const handleJsonInput = () => {
    try {
      const profileData = JSON.parse(jsonInput);
      console.log('Parsed JSON input:', profileData);
      // Transform the profile data into the expected format
      const transformedData = transformProfileData(profileData);
      console.log('Final transformed data:', transformedData);
      if (updateData && typeof updateData === 'function') {
        updateData(transformedData);
        setUploadError(null);
      }
    } catch (error) {
      setUploadError('Invalid JSON format. Please enter valid JSON.');
      console.error('Error parsing JSON input:', error);
    }
  };

  // Render dual query comparison UI
  if (showDualQueryInput) {
    return (
      <div className="profiler-dashboard dual-query-mode">
        <header className="dashboard-header">
          <h1>Query Comparison Mode</h1>
          <button className="exit-dual-mode-btn" onClick={exitDualQueryMode}>
            Exit Comparison Mode
          </button>
        </header>

        <div className="dual-query-container">
          <div className="query-column">
            <h2>Query 1</h2>
            <div className="template-selector">
              <label htmlFor="query1-template">Template:</label>
              <select 
                id="query1-template"
                value={query1Template}
                onChange={handleQuery1TemplateChange}
                className="template-dropdown"
              >
                {Object.keys(queryTemplates).map(template => (
                  <option key={template} value={template}>
                    {template.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="query-textarea-container">
              <textarea
                id="query1-input"
                placeholder="Enter your first query in JSON format"
                rows={10}
                className="query-textarea"
                defaultValue={JSON.stringify(queryTemplates[query1Template], null, 2)}
              />
            </div>
          </div>
          <div className="query-column">
            <h2>Query 2</h2>
            <div className="template-selector">
              <label htmlFor="query2-template">Template:</label>
              <select 
                id="query2-template"
                value={query2Template}
                onChange={handleQuery2TemplateChange}
                className="template-dropdown"
              >
                {Object.keys(queryTemplates).map(template => (
                  <option key={template} value={template}>
                    {template.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="query-textarea-container">
              <textarea
                id="query2-input"
                placeholder="Enter your second query in JSON format"
                rows={10}
                className="query-textarea"
                defaultValue={JSON.stringify(queryTemplates[query2Template], null, 2)}
              />
            </div>
          </div>
        </div>

        <div className="dual-query-actions">
          {queryError && <div className="query-error">{queryError}</div>}
          <button 
            className="compare-profiles-btn"
            onClick={executeAndCompareQueries}
            disabled={isLoading}
          >
            {isLoading ? 'Comparing...' : 'Compare Profile Output'}
          </button>
        </div>

        {inlineComparisonResults && selectedProfile && profileToCompare && (
          <div className="inline-comparison-results">
            <ProfilerComparisonResults 
              profiles={[selectedProfile, profileToCompare]} 
              comparisonType={comparisonType}
              onClose={closeInlineComparison} 
              onExecuteTemplateQueries={handleExecuteTemplateQueries}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="profiler-dashboard">
      <header className="dashboard-header">
        <h1>Query Profiler Dashboard</h1>
        <div className="search-container">
          <input type="text" placeholder="Search profiler" className="search-input" />
          <button className="download-btn">
            <i className="download-icon">↓</i>
          </button>
        </div>
      </header>

      <div className="dashboard-actions">
        <div className="profile-actions">
          <div className="profile-actions-left">
            <button
              className="visualize-btn"
              onClick={handleVisualizeProfile}
            >
              Visualize Profile
            </button>
            <input
              type="file"
              id="profile-upload"
              accept=".json"
              onChange={handleProfileUpload}
              style={{ display: 'none' }}
            />
            <button
              className="upload-btn"
              onClick={() => document.getElementById('profile-upload').click()}
            >
              Upload File
            </button>
          </div>
          <button
            className="compare-btn"
            onClick={handleDualQueryComparison}
          >
            Compare Profiles
          </button>
        </div>
        {showJsonInput && (
          <div className="json-input-container">
            <textarea
              className="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Paste your profile output in JSON format here..."
              rows={10}
            />
            <div className="action-buttons">
              <button
                className="submit-json-btn"
                onClick={handleJsonInput}
                disabled={!jsonInput.trim()}
              >
                Visualize
              </button>
            </div>
          </div>
        )}
        {uploadError && <div className="upload-error">{uploadError}</div>}
      </div>

      <div className="summary-separator">
        <ProfilerSummary 
          executionTime={executionTime} 
          shardInfo={shardInfo} 
          hitsInfo={hitsInfo} 
        />
      </div>

      {data && data.profileData && (
        <ProfilerQueries 
          data={data} 
          selectedProfile={selectedProfile}
          setSelectedProfile={setSelectedProfile}
          setProfileToCompare={showComparisonResults ? setProfileToCompare : () => {}}
          profileToCompare={showComparisonResults ? profileToCompare : null}
        />
      )}

      {showComparisonResults && selectedProfile && profileToCompare && (
        <ProfilerComparisonResults 
          profiles={[selectedProfile, profileToCompare]} 
          comparisonType={comparisonType}
          onClose={() => setShowComparisonResults(false)}
          onExecuteTemplateQueries={handleExecuteTemplateQueries}
        />
      )}
    </div>
  );
};

export default ProfilerDashboard;
