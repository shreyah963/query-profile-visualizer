import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerChart from '../components/features/ProfilerDashboard/ProfilerChart/ProfilerChart';

describe('ProfilerChart', () => {
  const mockData = [
    {
      type: 'Test Query 1',
      time_ms: 100,
      children: [
        {
          type: 'Child Query 1',
          description: 'Child Description 1',
          time_ms: 50
        }
      ]
    },
    {
      type: 'Test Query 2',
      time_ms: 200,
      children: [
        {
          type: 'Child Query 2',
          description: 'Child Description 2',
          time_ms: 100
        }
      ]
    }
  ];

  it('renders without crashing', () => {
    render(<ProfilerChart data={mockData} />);
    expect(screen.getByText(/Query Execution Profile/i)).toBeInTheDocument();
  });

  it('displays total query time correctly', () => {
    render(<ProfilerChart data={mockData} />);
    expect(screen.getByText(/300.00 ms/i)).toBeInTheDocument();
  });

  it('displays query blocks correctly', () => {
    render(<ProfilerChart data={mockData} />);
    expect(screen.getByText(/Test Query 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Query 2/i)).toBeInTheDocument();
  });

  it('displays child blocks correctly', () => {
    render(<ProfilerChart data={mockData} />);
    expect(screen.getByText(/Child Query 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Child Query 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Child Description 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Child Description 2/i)).toBeInTheDocument();
  });
}); 