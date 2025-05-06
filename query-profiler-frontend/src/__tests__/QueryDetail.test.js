import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueryDetail from '../components/features/ProfilerDashboard/QueryDetail/QueryDetail';

describe('QueryDetail', () => {
  const mockQuery = {
    type: 'Test Query',
    queryName: 'Test Query Name',
    description: 'Test Description',
    time_ms: 100,
    percentage: 50,
    breakdown: {
      score: 10,
      create_weight: 20,
      build_scorer: 30,
      next_doc: 40,
      match: 50,
      create_weight_count: 1,
      next_doc_count: 2,
      match_count: 3,
      score_count: 4
    }
  };

  it('renders without crashing', () => {
    render(<QueryDetail query={mockQuery} />);
    expect(screen.getByText(/Test Query Name/i)).toBeInTheDocument();
  });

  it('displays query details correctly', () => {
    render(<QueryDetail query={mockQuery} />);
    expect(screen.getByText(/Test Description/i)).toBeInTheDocument();
    expect(screen.getByText(/100.0 ms/i)).toBeInTheDocument();
    expect(screen.getByText(/50.0%/i)).toBeInTheDocument();
  });

  it('displays breakdown details when available', () => {
    render(<QueryDetail query={mockQuery} />);
    expect(screen.getByText(/Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Weight/i)).toBeInTheDocument();
    expect(screen.getByText(/Build Scorer/i)).toBeInTheDocument();
    expect(screen.getByText(/Next Doc/i)).toBeInTheDocument();
    expect(screen.getByText(/Match/i)).toBeInTheDocument();
  });
}); 