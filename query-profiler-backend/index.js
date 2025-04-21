const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = 5000;

// Add middleware to parse JSON request bodies
app.use(express.json());

// Add CORS middleware to allow requests from the frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Root endpoint to display a welcome message
app.get('/', (req, res) => {
  res.send('Welcome to the Query Profiler API. Use /api/query-profiler to fetch profiling data.');
});

// Endpoint to fetch query profiling data using cURL command
app.get('/api/query-profiler', (req, res) => {
  // Default query for profiling
  const defaultQuery = {
    profile: true,
    query: {
      bool: {
        must: [
          { match: { "process.name": "cron" } },
          { match_phrase: { "message": "minnow hiss" } }
        ],
        filter: [
          { range: { "@timestamp": { "gte": "2023-01-01", "lte": "2024-03-31" } } },
          { term: { "cloud.region": "us-west-2" } }
        ],
        should: [
          { match: { "tags": "preserve_original_event" } },
          { match: { "input.type": "aws-cloudwatch" } }
        ],
        minimum_should_match: 1
      }
    },
    sort: [
      { "@timestamp": { "order": "desc" } }
    ]
  };

  // Add -s flag to suppress progress meter and --fail to return errors properly
  const curlCommand = `curl -X GET "http://localhost:9200/big5/_search?pretty" -H 'Content-Type: application/json' --fail --silent --show-error --connect-timeout 10 -d '${JSON.stringify(defaultQuery)}'`;

  console.log('Executing query to OpenSearch...');
  
  // Execute cURL command to fetch data
  exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Exec error: ${error}`);
      
      // Check if OpenSearch is not available
      if (error.code === 7 || error.code === 28) {
        return res.status(503).json({
          error: 'OpenSearch server connection error',
          details: `Cannot connect to OpenSearch: ${error.message}`,
          code: error.code
        });
      }
      
      return res.status(500).json({
        error: 'Error executing query',
        details: error.message,
        code: error.code
      });
    }
    
    // Check for stderr content
    if (stderr && stderr.trim() !== '') {
      console.error(`Error in stderr: ${stderr}`);
      return res.status(500).json({
        error: 'Error in OpenSearch response',
        details: stderr,
        raw: stdout
      });
    }

    // Check for empty response
    if (!stdout || stdout.trim() === '') {
      return res.status(500).json({
        error: 'Empty response from OpenSearch',
        details: 'The OpenSearch server returned an empty response'
      });
    }

    // Send the cURL response back to frontend
    try {
      const parsedData = JSON.parse(stdout);
      
      // Check for OpenSearch errors in the response
      if (parsedData.error) {
        return res.status(400).json({
          error: 'OpenSearch query error',
          details: parsedData.error.reason || JSON.stringify(parsedData.error),
          status: parsedData.status,
          raw: parsedData
        });
      }
      
      // Format the response for the frontend
      const formattedResponse = {
        // Pass the raw hits directly for better access in frontend
        hits: parsedData.hits,
        // Pass just the search results array
        queryResults: parsedData.hits ? parsedData.hits.hits : [],
        // Pass the full profile data
        profileData: parsedData.profile,
        // Include the original query data
        originalQueryData: defaultQuery,
        // Process and extract chart data
        chartData: processChartData(parsedData.profile),
        // Pass the raw response for debugging
        rawResponse: {
          took: parsedData.took,
          _shards: parsedData._shards,
          timed_out: parsedData.timed_out
        }
      };
      
      // Add useful metrics for the dashboard
      if (parsedData.took) {
        formattedResponse.executionTime = parsedData.took;
      }
      
      if (parsedData._shards) {
        formattedResponse.shardInfo = {
          total: parsedData._shards.total || 0,
          successful: parsedData._shards.successful || 0,
          failed: parsedData._shards.failed || 0
        };
      }
      
      if (parsedData.hits && parsedData.hits.total) {
        formattedResponse.hitsInfo = {
          total: typeof parsedData.hits.total === 'object' ? 
            parsedData.hits.total.value : parsedData.hits.total,
          maxScore: parsedData.hits.max_score || 0
        };
      }
      
      // Log for debugging
      console.log("Processed OpenSearch response successfully");
      console.log(`Query took ${formattedResponse.executionTime}ms, found ${formattedResponse.hitsInfo?.total || 0} hits`);
      
      res.json(formattedResponse);
    } catch (parseError) {
      console.error(`JSON parse error: ${parseError}`);
      console.error(`Raw stdout: ${stdout}`);
      return res.status(500).json({
        error: 'Error parsing JSON response',
        details: parseError.message,
        raw: stdout.substring(0, 1000) // Limit the raw response to first 1000 chars
      });
    }
  });
});

// Endpoint to execute custom queries
app.post('/api/execute-query', (req, res) => {
  // Validate the request body
  if (!req.body || !req.body.query) {
    console.error('Missing query in request body');
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Request body must contain a query object'
    });
  }

  // Log the request body for debugging
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));

  // Store the original query for passing to the frontend
  const originalQuery = req.body.query;

  // Ensure the query has the profile parameter set to true
  const queryBody = {
    ...req.body.query,
    profile: true  // Force profiling to be enabled
  };

  // Convert the query object to a properly escaped JSON string for cURL
  let queryJson;
  try {
    queryJson = JSON.stringify(queryBody).replace(/"/g, '\\"');
  } catch (e) {
    console.error('Error stringifying query:', e);
    return res.status(400).json({
      error: 'Invalid query format',
      details: e.message
    });
  }

  console.log('Executing custom query to OpenSearch...');
  console.log('Query:', JSON.stringify(queryBody, null, 2));

  // Simplify curl command for testing and better reliability
  const curlCommand = `curl -X GET "http://localhost:9200/big5/_search" -H 'Content-Type: application/json' -d "${queryJson}"`;
  console.log('Executing curl command (simplified):', curlCommand);

  exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Exec error (code ${error.code}):`, error);
      console.error('Error details:', error.message);
      
      // Check if OpenSearch is not available
      if (error.code === 7 || error.code === 28) {
        return res.status(503).json({
          error: 'OpenSearch server connection error',
          details: `Cannot connect to OpenSearch: ${error.message}`,
          code: error.code
        });
      }
      
      return res.status(500).json({
        error: 'Error executing query',
        details: error.message,
        code: error.code
      });
    }
    
    // Always log stderr for debugging
    if (stderr) {
      console.log('curl stderr output:', stderr);
    }

    // Log stdout summary for debugging
    console.log('curl stdout summary:', stdout.length > 100 ? `${stdout.substring(0, 100)}...` : stdout);

    // Check for empty response
    if (!stdout || stdout.trim() === '') {
      return res.status(500).json({
        error: 'Empty response from OpenSearch',
        details: 'The OpenSearch server returned an empty response'
      });
    }

    // Send the cURL response back to frontend
    try {
      const parsedData = JSON.parse(stdout);
      
      // Check for OpenSearch errors in the response
      if (parsedData.error) {
        console.error('OpenSearch returned an error:', parsedData.error);
        return res.status(400).json({
          error: 'OpenSearch query error',
          details: parsedData.error.reason || JSON.stringify(parsedData.error),
          status: parsedData.status,
          raw: parsedData
        });
      }
      
      // Format the response for the frontend
      const formattedResponse = {
        // Pass the raw hits directly for better access in frontend
        hits: parsedData.hits,
        // Pass just the search results array
        queryResults: parsedData.hits ? parsedData.hits.hits : [],
        // Pass the full profile data
        profileData: parsedData.profile,
        // Include the original query data
        originalQueryData: originalQuery,
        // Process and extract chart data
        chartData: processChartData(parsedData.profile),
        // Pass the raw response for debugging
        rawResponse: {
          took: parsedData.took,
          _shards: parsedData._shards,
          timed_out: parsedData.timed_out
        }
      };
      
      // Add useful metrics for the dashboard
      if (parsedData.took) {
        formattedResponse.executionTime = parsedData.took;
      }
      
      if (parsedData._shards) {
        formattedResponse.shardInfo = {
          total: parsedData._shards.total || 0,
          successful: parsedData._shards.successful || 0,
          failed: parsedData._shards.failed || 0
        };
      }
      
      if (parsedData.hits && parsedData.hits.total) {
        formattedResponse.hitsInfo = {
          total: typeof parsedData.hits.total === 'object' ? 
            parsedData.hits.total.value : parsedData.hits.total,
          maxScore: parsedData.hits.max_score || 0
        };
      }
      
      // Log for debugging
      console.log("Processed custom OpenSearch query response successfully");
      console.log(`Query took ${formattedResponse.executionTime}ms, found ${formattedResponse.hitsInfo?.total || 0} hits`);
      
      res.json(formattedResponse);
    } catch (parseError) {
      console.error(`JSON parse error: ${parseError}`);
      console.error(`Raw stdout: ${stdout}`);
      return res.status(500).json({
        error: 'Error parsing JSON response',
        details: parseError.message,
        raw: stdout.substring(0, 1000) // Limit the raw response to first 1000 chars
      });
    }
  });
});

// Simple connection test endpoint for the frontend
app.get('/api/test-connection', (req, res) => {
  console.log('Testing connection to OpenSearch...');
  
  // Simple match_all query to test connection
  const curlCommand = `curl -X GET "http://localhost:9200/_cat/indices?v" --connect-timeout 5`;
  
  exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Connection test failed with code ${error.code}:`, error.message);
      return res.status(503).json({
        connected: false,
        error: 'Connection failed',
        details: error.message,
        code: error.code
      });
    }
    
    // Connection successful
    console.log('Connection test successful');
    return res.json({
      connected: true,
      message: 'Successfully connected to OpenSearch'
    });
  });
});

// Helper function to process profile data for charts
function processChartData(profileData) {
  if (!profileData || !profileData.shards || !profileData.shards[0] || !profileData.shards[0].searches) {
    console.error("Missing required profile data structure");
    return [];
  }
  
  const searchData = profileData.shards[0].searches[0];
  const result = [];
  
  if (!searchData) {
    console.error("Missing search data in profile");
    return [];
  }
  
  // Debug the available profile data structure
  console.log("Processing profile data from shard:", profileData.shards[0].id);
  
  // Process query part if available
  if (searchData.query) {
    // Extract timing data for chart visualization with more detailed breakdown
    const queryChartData = searchData.query.map(query => {
      const queryData = {
        type: query.type,
        description: query.description || '',
        time_ms: query.time_in_nanos / 1000000, // Convert to milliseconds
        time_nanos: query.time_in_nanos, // Keep the raw nanosecond value
        breakdown: normalizeBreakdown(query.breakdown || {}),
        children: []
      };
      
      // Process children with detailed data
      if (query.children && query.children.length > 0) {
        queryData.children = query.children.map(child => ({
          type: child.type,
          description: child.description || '',
          time_ms: child.time_in_nanos / 1000000,
          time_nanos: child.time_in_nanos, // Keep raw nanosecond value
          breakdown: normalizeBreakdown(child.breakdown || {}),
          children: processNestedChildren(child.children)
        }));
      }
      
      return queryData;
    });
    
    result.push(...queryChartData);
  }
  
  // Process collector part
  if (searchData.collector && searchData.collector.length > 0) {
    const collectorData = searchData.collector.map(collector => ({
      type: collector.name,
      description: collector.reason || 'Collection phase',
      time_ms: collector.time_in_nanos / 1000000,
      time_nanos: collector.time_in_nanos,
      breakdown: normalizeBreakdown(collector.breakdown || {})
    }));
    
    result.push(...collectorData);
  }
  
  // Process aggregation part if available
  if (searchData.aggregations && searchData.aggregations.length > 0) {
    const aggregationData = searchData.aggregations.map(agg => {
      const aggData = {
        type: `Aggregation: ${agg.type || 'Unknown'}`,
        description: agg.description || 'Aggregation phase',
        time_ms: agg.time_in_nanos / 1000000,
        time_nanos: agg.time_in_nanos,
        breakdown: normalizeBreakdown(agg.breakdown || {}),
        children: []
      };
      
      // Process children aggregations if available
      if (agg.children && agg.children.length > 0) {
        aggData.children = agg.children.map(child => ({
          type: `Aggregation: ${child.type || 'Unknown'}`,
          description: child.description || '',
          time_ms: child.time_in_nanos / 1000000,
          time_nanos: child.time_in_nanos,
          breakdown: normalizeBreakdown(child.breakdown || {}),
          children: processNestedAggregations(child.children)
        }));
      }
      
      return aggData;
    });
    
    result.push(...aggregationData);
  }
  
  return result;
}

// Helper function to process nested children in the query hierarchy
function processNestedChildren(children) {
  if (!children || !Array.isArray(children) || children.length === 0) {
    return [];
  }
  
  return children.map(child => ({
    type: child.type,
    description: child.description || '',
    time_ms: child.time_in_nanos / 1000000,
    time_nanos: child.time_in_nanos, // Keep raw nanosecond value
    breakdown: normalizeBreakdown(child.breakdown || {}),
    children: processNestedChildren(child.children)
  }));
}

// Helper function for processing nested aggregations
function processNestedAggregations(children) {
  if (!children || !Array.isArray(children) || children.length === 0) {
    return [];
  }
  
  return children.map(child => ({
    type: `Aggregation: ${child.type || 'Unknown'}`,
    description: child.description || '',
    time_ms: child.time_in_nanos / 1000000,
    time_nanos: child.time_in_nanos,
    breakdown: normalizeBreakdown(child.breakdown || {}),
    children: processNestedAggregations(child.children)
  }));
}

// Helper function to normalize breakdown values to nanoseconds
function normalizeBreakdown(breakdown) {
  const result = {};
  
  for (const [key, value] of Object.entries(breakdown)) {
    // Some values might be in milliseconds instead of nanoseconds
    // We want to ensure all time values are consistently in nanoseconds
    if (typeof value === 'number') {
      if (value < 1000 && key.includes('time')) {
        // If the value is very small and has 'time' in the key, it's likely ms
        result[key] = value * 1000000; // Convert ms to ns
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
