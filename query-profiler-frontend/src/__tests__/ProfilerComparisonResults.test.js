import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerComparisonResults from '../components/features/ProfilerDashboard/ProfilerComparison/ProfilerComparisonResults';

describe('ProfilerComparisonResults', () => {
  const mockProfiles = [
    {
      profile: {
        shards: [
          {
            searches: [
              {
                query: [
                  { type: 'TestQuery', breakdown: { foo: 1, bar: 2 }, children: [] }
                ],
                collector: []
              }
            ]
          }
        ]
      }
    },
    {
      profile: {
        shards: [
          {
            searches: [
              {
                query: [
                  { type: 'TestQuery', breakdown: { foo: 1, bar: 3 }, children: [] }
                ],
                collector: []
              }
            ]
          }
        ]
      }
    }
  ];

  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders without crashing and shows Query Comparison', () => {
    render(<ProfilerComparisonResults profiles={mockProfiles} onClose={mockOnClose} />);
    expect(screen.getByText(/Query Comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/Structure Differences/i)).toBeInTheDocument();
  });

  it('shows an error message when less than two profiles are provided', () => {
    render(<ProfilerComparisonResults profiles={[mockProfiles[0]]} onClose={mockOnClose} />);
    expect(screen.getByText(/Insufficient data for comparison/i)).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    render(<ProfilerComparisonResults profiles={mockProfiles} onClose={mockOnClose} />);
    const closeButton = screen.getAllByRole('button', { name: /close/i })[0];
    closeButton.click();
    expect(mockOnClose).toHaveBeenCalled();
  });
}); 