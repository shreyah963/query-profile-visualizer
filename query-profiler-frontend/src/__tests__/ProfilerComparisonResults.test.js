import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerComparisonResults from '../components/features/ProfilerDashboard/ProfilerComparison/ProfilerComparisonResults';

describe('ProfilerComparisonResults', () => {
  const mockProfiles = [
    {
      took: 100,
      shards: { total: 5, successful: 5, failed: 0 },
      hits: { total: 1000, max_score: 1.0 }
    },
    {
      took: 150,
      shards: { total: 5, successful: 5, failed: 0 },
      hits: { total: 1200, max_score: 1.2 }
    }
  ];

  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders without crashing', () => {
    render(<ProfilerComparisonResults profiles={mockProfiles} onClose={mockOnClose} />);
    expect(screen.getByText(/Comparison Results/i)).toBeInTheDocument();
  });

  it('displays execution time comparison correctly', () => {
    render(<ProfilerComparisonResults profiles={mockProfiles} onClose={mockOnClose} />);
    expect(screen.getByText(/100 ms/i)).toBeInTheDocument();
    expect(screen.getByText(/150 ms/i)).toBeInTheDocument();
  });

  it('displays shard information comparison correctly', () => {
    render(<ProfilerComparisonResults profiles={mockProfiles} onClose={mockOnClose} />);
    expect(screen.getByText(/5 shards/i)).toBeInTheDocument();
    expect(screen.getByText(/5 successful/i)).toBeInTheDocument();
    expect(screen.getByText(/0 failed/i)).toBeInTheDocument();
  });

  it('displays hits information comparison correctly', () => {
    render(<ProfilerComparisonResults profiles={mockProfiles} onClose={mockOnClose} />);
    expect(screen.getByText(/1000 hits/i)).toBeInTheDocument();
    expect(screen.getByText(/1200 hits/i)).toBeInTheDocument();
    expect(screen.getByText(/1.0 max score/i)).toBeInTheDocument();
    expect(screen.getByText(/1.2 max score/i)).toBeInTheDocument();
  });
}); 