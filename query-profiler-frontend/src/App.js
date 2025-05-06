import React, { useState, useEffect } from 'react';
import { useQueryProfiler } from './hooks/useQueryProfiler';
import MainLayout from './layouts/MainLayout';
import ProfilerDashboard from './components/features/ProfilerDashboard/MainDashboard/ProfilerDashboard';
import { ERROR_MESSAGES, DEBUG } from './config/constants';
import './styles/components/App.css';

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
  const { data: initialData, isLoading, error } = useQueryProfiler();
  const [data, setData] = useState(null);
  const [debugMode, setDebugMode] = useState(DEBUG.ENABLED);
  
  // Set initial data when it's loaded
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);
  
  // Enable console debugging
  useEffect(() => {
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

  if (isLoading) {
    return <MainLayout>{ERROR_MESSAGES.LOADING}</MainLayout>;
  }

  if (error && !data) {
    return (
      <MainLayout>
      <div className="error">
          <h2>{ERROR_MESSAGES.ERROR}</h2>
        <p>{error.message}</p>
          <p>{ERROR_MESSAGES.CONNECTION_ERROR}</p>
      </div>
      </MainLayout>
    );
  }

  if (!data) {
    return <MainLayout>{ERROR_MESSAGES.NO_DATA}</MainLayout>;
  }

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
