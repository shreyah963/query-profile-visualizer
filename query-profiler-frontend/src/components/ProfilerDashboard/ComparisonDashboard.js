import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'react-feather';
import './ComparisonDashboard.css';
import ProfilerComparisonResults from './ProfilerComparisonResults';

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

const ComparisonDashboard = ({ onExit }) => {
  const [query1, setQuery1] = useState(null);
  const [query2, setQuery2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [showComparisonResults, setShowComparisonResults] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileToCompare, setProfileToCompare] = useState(null);

  const handleTemplateChange = (queryNumber, templateName) => {
    const textarea = document.getElementById(`query${queryNumber}-input`);
    if (textarea && queryTemplates[templateName]) {
      textarea.value = JSON.stringify(queryTemplates[templateName], null, 2);
    }
  };

  const executeAndCompareQueries = async () => {
    setIsLoading(true);
    setQueryError(null);
    
    try {
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
      
      let parsedQuery1, parsedQuery2;
      try {
        parsedQuery1 = JSON.parse(query1Text);
        parsedQuery2 = JSON.parse(query2Text);
      } catch (e) {
        throw new Error('Invalid JSON in one or both queries: ' + e.message);
      }
      
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
      
      setQuery1(result1);
      setQuery2(result2);
      setSelectedProfile(result1);
      setProfileToCompare(result2);
      setShowComparisonResults(true);
      
    } catch (error) {
      console.error('Error executing comparison:', error);
      setQueryError(error.message || 'Failed to execute queries');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="profiler-dashboard dual-query-mode">
      <header className="dashboard-header">
        <h1>Query Profiler Dashboard</h1>
        <div className="search-container">
          <input type="text" placeholder="Search profiler" className="search-input" />
          <button className="download-btn">↓</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dual-query-container">
          <div className="query-column">
            <div className="query-header">
              <h2>Query 1</h2>
              <select 
                className="template-select"
                onChange={(e) => handleTemplateChange(1, e.target.value)}
              >
                <option value="">Select a template</option>
                <option value="default">Default Query</option>
                <option value="term_query">Term Query</option>
                <option value="bool_query">Boolean Query</option>
                <option value="aggregation_query">Aggregation Query</option>
                <option value="complex_query">Complex Query</option>
              </select>
            </div>
            <div className="query-textarea-container">
              <textarea
                id="query1-input"
                placeholder="Enter your first query in JSON format"
                rows={10}
                className="query-textarea"
              />
            </div>
          </div>
          <div className="query-column">
            <div className="query-header">
              <h2>Query 2</h2>
              <select 
                className="template-select"
                onChange={(e) => handleTemplateChange(2, e.target.value)}
              >
                <option value="">Select a template</option>
                <option value="default">Default Query</option>
                <option value="term_query">Term Query</option>
                <option value="bool_query">Boolean Query</option>
                <option value="aggregation_query">Aggregation Query</option>
                <option value="complex_query">Complex Query</option>
              </select>
            </div>
            <div className="query-textarea-container">
              <textarea
                id="query2-input"
                placeholder="Enter your second query in JSON format"
                rows={10}
                className="query-textarea"
              />
            </div>
          </div>
        </div>

        <div className="dual-query-actions">
          {queryError && <div className="query-error">{queryError}</div>}
          <div className="action-buttons">
            <button 
              className="compare-profiles-btn"
              onClick={executeAndCompareQueries}
              disabled={isLoading}
            >
              {isLoading ? 'Comparing...' : 'Compare Profile Output'}
            </button>
            <button className="exit-dual-mode-btn" onClick={onExit}>
              Exit Comparison Mode
            </button>
          </div>
        </div>

        {showComparisonResults && selectedProfile && profileToCompare && (
          <ProfilerComparisonResults 
            profiles={[selectedProfile, profileToCompare]} 
            onClose={() => setShowComparisonResults(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ComparisonDashboard; 