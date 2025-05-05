import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './QueryInput.css';

const QueryInput = ({ 
  onQueryExecuted, 
  hideTemplate = false, 
  label = "Query",
  alwaysExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded);
  const [queryTemplate, setQueryTemplate] = useState('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectStatus, setConnectStatus] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (alwaysExpanded) {
      setIsExpanded(true);
    }
  }, [alwaysExpanded]);

  // Define query templates
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

  // Initialize query input with the default template
  const [queryInput, setQueryInput] = useState(
    JSON.stringify(queryTemplates[queryTemplate], null, 2)
  );

  // Update queryInput when template changes
  useEffect(() => {
    setQueryInput(JSON.stringify(queryTemplates[queryTemplate], null, 2));
  }, [queryTemplate]);

  // Function to toggle the expanded state
  const toggleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    
    // Focus the textarea when expanded
    if (newExpandedState && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current.focus();
      }, 100);
    }
  };

  // Test connection to OpenSearch
  const testConnection = async () => {
    setConnectStatus('testing');
    setError(null);
    
    try {
      console.log('Testing connection to OpenSearch...');
      
      const response = await axios.get('http://localhost:5000/api/test-connection');
      
      console.log('Connection test successful:', response.data);
      setConnectStatus('success');
      setTimeout(() => setConnectStatus(null), 3000);
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectStatus('failed');
      
      // Customize the error message
      let errorMessage = 'Connection test failed';
      if (err.response?.data?.error) {
        errorMessage = `${err.response.data.error}: ${err.response.data.details || ''}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  const handleTemplateChange = (e) => {
    const template = e.target.value;
    setQueryTemplate(template);
  };

  const handleExecuteQuery = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let parsedQuery;
      try {
        // Make sure we're parsing valid JSON
        if (!queryInput || queryInput.trim() === '') {
          throw new Error('Query is empty');
        }
        
        parsedQuery = JSON.parse(queryInput);
        
        if (!parsedQuery || typeof parsedQuery !== 'object') {
          throw new Error('Invalid query structure');
        }
        
      } catch (parseError) {
        throw new Error('Invalid JSON: ' + parseError.message);
      }
      
      console.log('Submitting query:', parsedQuery);
      
      const response = await axios.post('http://localhost:5000/api/execute-query', {
        query: parsedQuery
      });
      
      console.log('Query execution successful:', response.data);
      setIsLoading(false);
      
      if (onQueryExecuted) {
        onQueryExecuted(response.data);
      }
    } catch (err) {
      console.error('Query execution error:', err);
      setIsLoading(false);
      
      let errorMessage = 'Failed to execute query';
      
      if (err.response?.data?.error) {
        errorMessage = `${err.response.data.error}: ${err.response.data.details || ''}`;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  };

  const handleQueryInputChange = (e) => {
    setQueryInput(e.target.value);
  };

  const resetToTemplate = () => {
    setQueryInput(JSON.stringify(queryTemplates[queryTemplate], null, 2));
    setError(null);
  };

  return (
    <div className={`query-input-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div 
        className="query-input-header" 
        onClick={toggleExpand}
        id="query-input-trigger"
      >
        <h3>{label}</h3>
        <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>
      
      {isExpanded && (
        <div className="query-input-expanded">
          {!hideTemplate && (
            <div className="template-selector">
              <label>
                Select a template:
                <select value={queryTemplate} onChange={handleTemplateChange}>
                  <option value="default">Default (match_all)</option>
                  <option value="term_query">Term Query</option>
                  <option value="bool_query">Boolean Query</option>
                  <option value="aggregation_query">Aggregation Query</option>
                  <option value="complex_query">Complex Query</option>
                </select>
              </label>
              <button 
                className="reset-template-btn" 
                onClick={resetToTemplate}
                title="Reset to selected template"
              >
                ↺
              </button>
            </div>
          )}
          
          <div className="query-textarea-container">
            <div className="query-input-wrapper">
              <div className="line-numbers">
                {queryInput.split('\n').map((_, i) => (
                  <div key={i} style={{ height: '1.5em' }}>{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={queryInput}
                onChange={handleQueryInputChange}
                placeholder="Enter your query in JSON format"
                rows={10}
                className="query-input"
                style={{ lineHeight: '1.5em' }}
              />
            </div>
          </div>
          
          <div className="query-input-actions">
            <div className="connection-status">
              {connectStatus === 'testing' && <span className="testing">Testing connection...</span>}
              {connectStatus === 'success' && <span className="success">Connection successful!</span>}
              {connectStatus === 'failed' && <span className="failed">Connection failed</span>}
              <button 
                className="test-connection-btn"
                onClick={testConnection}
                disabled={isLoading}
              >
                Test Connection
              </button>
            </div>
            
            <button 
              className="execute-query-btn"
              onClick={handleExecuteQuery}
              disabled={isLoading}
            >
              {isLoading ? 'Executing...' : 'Execute Query'}
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>
      )}
    </div>
  );
};

export default QueryInput; 