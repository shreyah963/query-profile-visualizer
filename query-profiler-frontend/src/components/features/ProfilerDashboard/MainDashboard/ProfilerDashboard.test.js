import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerDashboard from './ProfilerDashboard';

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

  beforeAll(() => {
    global.FileReader = class {
      onload = null;
      readAsText() {
        if (this.onload) {
          this.onload({ target: { result: '{"took": 100}' } });
        }
      }
    };
  });

  it('renders without crashing', () => {
    render(<ProfilerDashboard data={mockData} updateData={mockUpdateData} />);
    expect(screen.getByText(/Query Profiler Dashboard/i)).toBeInTheDocument();
  });

  it('displays input area when data is not available', () => {
    render(<ProfilerDashboard data={null} updateData={mockUpdateData} />);
    expect(screen.getByPlaceholderText(/Paste your profile output in JSON format here/i)).toBeInTheDocument();
  });

  it('calls updateData when a profile is uploaded', () => {
    render(<ProfilerDashboard data={mockData} updateData={mockUpdateData} />);
    // Click the visible Upload File button
    const uploadButton = screen.getByText('Upload File');
    uploadButton.click();
    // Find the hidden file input by id
    const fileInput = document.getElementById('profile-upload');
    const file = new File(['{"took": 100}'], 'test.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockUpdateData).toHaveBeenCalled();
  });
}); 