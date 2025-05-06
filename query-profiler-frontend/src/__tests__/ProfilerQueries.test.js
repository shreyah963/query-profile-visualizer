import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerQueries from '../components/features/ProfilerDashboard/ProfilerQueries/ProfilerQueries';

describe('ProfilerQueries', () => {
  const mockData = {
    profileData: {
      shards: [
        {
          searches: [
            {
              query: [
                {
                  type: 'Test Query',
                  description: 'Test Description',
                  time_in_nanos: 100000000,
                  breakdown: {
                    score: 10,
                    create_weight: 20,
                    build_scorer: 30,
                    next_doc: 40,
                    match: 50
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  };

  const mockSetSelectedProfile = jest.fn();

  beforeEach(() => {
    mockSetSelectedProfile.mockClear();
  });

  it('renders without crashing', () => {
    render(<ProfilerQueries data={mockData} setSelectedProfile={mockSetSelectedProfile} />);
    expect(screen.getByText(/Test Query/i)).toBeInTheDocument();
  });

  it('displays query details correctly', () => {
    render(<ProfilerQueries data={mockData} setSelectedProfile={mockSetSelectedProfile} />);
    expect(screen.getByText(/Test Description/i)).toBeInTheDocument();
    expect(screen.getByText(/100.0 ms/i)).toBeInTheDocument();
  });

  it('calls setSelectedProfile when a query is clicked', () => {
    render(<ProfilerQueries data={mockData} setSelectedProfile={mockSetSelectedProfile} />);
    const queryElement = screen.getByText(/Test Query/i);
    fireEvent.click(queryElement);
    expect(mockSetSelectedProfile).toHaveBeenCalled();
  });
}); 