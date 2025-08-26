import React, { useState } from 'react';
import MainLayout from './layouts/MainLayout.jsx';
import ProfilerDashboard from './components/features/ProfilerDashboard/MainDashboard/ProfilerDashboard.jsx';
import { ERROR_MESSAGES, DEBUG } from './config/constants';
import './App.css'

// Test CI/CD pipeline trigger

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
          <h2>{ERROR_MESSAGES.ERROR}</h2>
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
  const [data, setData] = useState(null);
  const [debugMode, setDebugMode] = useState(DEBUG.ENABLED);
  
  // Enable console debugging
  React.useEffect(() => {
    if (debugMode) {
      window.debugProfiler = {
        getData: () => data,
        toggleDebug: () => setDebugMode(prev => !prev)
      };
      console.log(DEBUG.CONSOLE.DATA, {
        executionTime: data?.executionTime || data?.took,
        hitCount: data?.hitsInfo?.total || (data?.hits?.total?.value || data?.hits?.total || 0),
        shardInfo: data?.shardInfo || data?._shards,
        queryCount: data?.profileData?.shards?.[0]?.searches?.[0]?.query?.length || 0
      });
    }
  }, [data, debugMode]);
  
  // Handle data updates from custom queries
  const handleDataUpdate = (newData) => {
    console.log(DEBUG.CONSOLE.DATA, newData);
    setData(newData);
  };

  return (
    <MainLayout>
      <ErrorBoundary>
        <ProfilerDashboard 
          data={data} 
          updateData={handleDataUpdate}
        />
      </ErrorBoundary>
    </MainLayout>
  );
};

export default App;
