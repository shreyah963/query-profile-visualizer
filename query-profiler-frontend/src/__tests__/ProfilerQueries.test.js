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
    const queryElements = screen.getAllByText(/Test Query/i);
    expect(queryElements.length).toBeGreaterThan(0);
  });

  it('displays query details correctly', () => {
    render(<ProfilerQueries data={mockData} setSelectedProfile={mockSetSelectedProfile} />);
    const descElements = screen.getAllByText(/Test Description/i);
    expect(descElements.length).toBeGreaterThan(0);
    const timeElements = screen.getAllByText(/100\.?0* ms/i);
    expect(timeElements.length).toBeGreaterThan(0);
  });
}); 