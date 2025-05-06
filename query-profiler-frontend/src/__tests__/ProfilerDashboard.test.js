import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerDashboard from '../components/features/ProfilerDashboard/Dashboard/ProfilerDashboard';

describe('ProfilerDashboard', () => {
  const mockData = {
    profileData: {
      took: 100,
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

  const mockUpdateData = jest.fn();

  beforeEach(() => {
    mockUpdateData.mockClear();
  });

  it('renders without crashing', () => {
    render(<ProfilerDashboard data={mockData} updateData={mockUpdateData} />);
    expect(screen.getByText(/Query Profiler Dashboard/i)).toBeInTheDocument();
  });

  it('displays no data message when data is not available', () => {
    render(<ProfilerDashboard data={null} updateData={mockUpdateData} />);
    expect(screen.getByText(/No profiling data available/i)).toBeInTheDocument();
  });

  it('calls updateData when a profile is uploaded', () => {
    render(<ProfilerDashboard data={mockData} updateData={mockUpdateData} />);
    const fileInput = screen.getByLabelText(/Upload File/i);
    const file = new File(['{"took": 100}'], 'test.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUpdateData).toHaveBeenCalled();
  });
}); 