import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ShardVisualization from './ShardVisualization';

describe('ShardVisualization', () => {
  const mockProfileData = {
    shards: [
      {
        id: 'shard-1',
        searches: [
          {
            query: [{ time_in_nanos: 1000000 }],
            rewrite_time: 0,
            collector: [{ time_in_nanos: 2000000 }],
          },
        ],
        aggregations: [
          { time_in_nanos: 3000000 },
        ],
      },
      {
        id: 'shard-2',
        searches: [
          {
            query: [{ time_in_nanos: 4000000 }],
            rewrite_time: 0,
            collector: [{ time_in_nanos: 1000000 }],
          },
        ],
        aggregations: [
          { time_in_nanos: 0 },
        ],
      },
    ],
  };

  it('renders without crashing and displays correct number of search bars', () => {
    render(<ShardVisualization profileData={mockProfileData} onShardSelect={() => {}} />);
    // Find the search chart by heading (matches both Top N and All)
    const searchChartHeading = screen.getByText(/Shards by Search Time/i);
    const searchChart = searchChartHeading.closest('.shard-chart');
    const searchBarLabels = searchChart.querySelectorAll('.bar-label');
    expect(searchBarLabels.length).toBe(2);
    // Check that the bar labels are present in the search chart
    const barLabels = Array.from(searchBarLabels).map(label => label.textContent);
    expect(barLabels).toContain('shard-1');
    expect(barLabels).toContain('shard-2');
  });

  it('calls onShardSelect when a bar is clicked', () => {
    const onShardSelect = jest.fn();
    render(<ShardVisualization profileData={mockProfileData} onShardSelect={onShardSelect} />);
    const searchBars = screen.getAllByTitle(/shard/i);
    fireEvent.click(searchBars[0]);
    expect(onShardSelect).toHaveBeenCalled();
  });
}); 