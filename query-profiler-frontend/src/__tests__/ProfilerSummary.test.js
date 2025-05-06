import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerSummary from '../components/features/ProfilerDashboard/ProfilerSummary/ProfilerSummary';

describe('ProfilerSummary', () => {
  // The component expects executionTime, shardInfo, and hitsInfo as props
  const executionTime = 100;
  const shardInfo = { total: 5, successful: 5, failed: 0 };
  const hitsInfo = { total: 1000, maxScore: 1.0 };

  it('renders without crashing', () => {
    render(<ProfilerSummary executionTime={executionTime} shardInfo={shardInfo} hitsInfo={hitsInfo} />);
    expect(screen.getByText(/Execution Time/i)).toBeInTheDocument();
  });

  it('displays execution time correctly', () => {
    render(<ProfilerSummary executionTime={executionTime} shardInfo={shardInfo} hitsInfo={hitsInfo} />);
    expect(screen.getByText(/100 ms/i)).toBeInTheDocument();
  });

  it('displays shard information correctly', () => {
    render(<ProfilerSummary executionTime={executionTime} shardInfo={shardInfo} hitsInfo={hitsInfo} />);
    expect(screen.getByText(/5 total/i)).toBeInTheDocument();
    expect(screen.getByText(/5 successful/i)).toBeInTheDocument();
    expect(screen.getByText(/0 failed/i)).toBeInTheDocument();
  });

  it('displays hits information correctly', () => {
    render(<ProfilerSummary executionTime={executionTime} shardInfo={shardInfo} hitsInfo={hitsInfo} />);
    expect(screen.getByText(/1000/i)).toBeInTheDocument();
    expect(screen.getByText(/max score: 1.00/i)).toBeInTheDocument();
  });
}); 