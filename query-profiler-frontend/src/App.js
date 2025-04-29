import React, { useState, useEffect } from 'react';
import { useQueryProfiler } from './hooks/useQueryProfiler';
import ProfilerDashboard from './components/ProfilerDashboard/Dashboard';
import './styles/global.css';

// Error boundary component to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught in error boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <details>
            <summary>Error details</summary>
            <p>{this.state.error && this.state.error.toString()}</p>
            <p>Component Stack: {this.state.errorInfo && this.state.errorInfo.componentStack}</p>
          </details>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const { data: initialData, isLoading, error } = useQueryProfiler();
  const [data, setData] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  
  // Set initial data when it's loaded
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);
  
  // Enable console debugging
  useEffect(() => {
    window.debugProfiler = {
      getData: () => data,
      toggleDebug: () => setDebugMode(prev => !prev)
    };
    console.log("Debug mode available. Access data with window.debugProfiler.getData()");
  }, [data]);

  // Log data updates
  useEffect(() => {
    if (data) {
      console.log("Profiler data updated:", {
        executionTime: data.executionTime || data.took,
        hitCount: data.hitsInfo?.total || (data.hits?.total?.value || data.hits?.total || 0),
        shardInfo: data.shardInfo || data._shards,
        queryCount: data.profileData?.shards?.[0]?.searches?.[0]?.query?.length || 0
      });
    }
  }, [data]);
  
  // Handle data updates from custom queries
  const handleDataUpdate = (newData) => {
    console.log("Updating profiler data with custom query results");
    setData(newData);
  };

  if (isLoading) {
    return <div className="loading">Loading profiler data...</div>;
  }

  if (error && !data) {
    return (
      <div className="error">
        <h2>Error loading profiler data</h2>
        <p>{error.message}</p>
        <p>Please check that the OpenSearch server is running and accessible.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="loading">No data available. Please execute a query.</div>;
  }

  return (
    <div className="App">
      <ErrorBoundary>
        <ProfilerDashboard 
          data={data} 
          updateData={handleDataUpdate}
        />
        
        {debugMode && (
          <div className="debug-panel">
            <h3>Debug Information</h3>
            <pre>{JSON.stringify({
              executionTime: data.executionTime || data.took,
              hits: data.hitsInfo || data.hits,
              shards: data.shardInfo || data._shards,
              queries: data.profileData?.shards?.[0]?.searches?.[0]?.query?.length || 0
            }, null, 2)}</pre>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
};

export default App;
