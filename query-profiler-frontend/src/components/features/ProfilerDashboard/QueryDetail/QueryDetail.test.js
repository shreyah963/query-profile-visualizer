import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueryDetail from './QueryDetail';

describe('QueryDetail', () => {
  const mockQuery = {
    queryName: 'Test Query Name',
    type: 'Test Query',
    description: 'Test Description',
    time_ms: 100,
    percentage: 50,
    breakdown: {
      'Match': 50,
      'Next Doc': 40,
      'Build Scorer': 30,
      'Create Weight': 20,
      'Score': 10,
      'Score Count': 4,
      'Match Count': 3,
      'Next Doc Count': 2,
      'Create Weight Count': 1
    }
  };

  it('renders without crashing', () => {
    render(<QueryDetail query={mockQuery} />);
    expect(screen.getByText('Test Query Name')).toBeInTheDocument();
  });

  it('displays query details correctly', () => {
    render(<QueryDetail query={mockQuery} />);
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('100.00 ms')).toBeInTheDocument();
  });

  it('displays breakdown details when available', () => {
    render(<QueryDetail query={mockQuery} />);
    
    // Use getAllByText and check the first occurrence
    const scoreElements = screen.getAllByText('Score');
    expect(scoreElements[0]).toBeInTheDocument();
    
    const createWeightElements = screen.getAllByText('Create Weight');
    expect(createWeightElements[0]).toBeInTheDocument();
    
    const buildScorerElements = screen.getAllByText('Build Scorer');
    expect(buildScorerElements[0]).toBeInTheDocument();
    
    const nextDocElements = screen.getAllByText('Next Doc');
    expect(nextDocElements[0]).toBeInTheDocument();
  });

  it('displays correct timing values', () => {
    render(<QueryDetail query={mockQuery} />);
    expect(screen.getByText('50 ns')).toBeInTheDocument();
    expect(screen.getByText('40 ns')).toBeInTheDocument();
    expect(screen.getByText('30 ns')).toBeInTheDocument();
    expect(screen.getByText('20 ns')).toBeInTheDocument();
    expect(screen.getByText('10 ns')).toBeInTheDocument();
  });
}); 