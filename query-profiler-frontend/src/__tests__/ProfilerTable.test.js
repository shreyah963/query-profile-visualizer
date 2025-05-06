import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerTable from '../components/features/ProfilerDashboard/ProfilerTable/ProfilerTable';

describe('ProfilerTable', () => {
  const mockData = [
    { _id: 'doc1', _score: 10, _source: { fieldA: 'foo', fieldB: 123 } },
    { _id: 'doc2', _score: 20, _source: { fieldA: 'bar', fieldB: 456 } }
  ];

  it('renders without crashing', () => {
    render(<ProfilerTable data={mockData} />);
    expect(screen.getByText(/ID/i)).toBeInTheDocument();
    expect(screen.getByText(/Score/i)).toBeInTheDocument();
    expect(screen.getByText(/fieldA/i)).toBeInTheDocument();
    expect(screen.getByText(/fieldB/i)).toBeInTheDocument();
  });

  it('displays table data correctly', () => {
    render(<ProfilerTable data={mockData} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(3);
    expect(within(rows[1]).getByText('doc1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('10')).toBeInTheDocument();
    expect(within(rows[1]).getByText('foo')).toBeInTheDocument();
    expect(within(rows[1]).getByText('123')).toBeInTheDocument();
    expect(within(rows[2]).getByText('doc2')).toBeInTheDocument();
    expect(within(rows[2]).getByText('20')).toBeInTheDocument();
    expect(within(rows[2]).getByText('bar')).toBeInTheDocument();
    expect(within(rows[2]).getByText('456')).toBeInTheDocument();
  });

  it('displays no data message when data is empty', () => {
    render(<ProfilerTable data={[]} />);
    expect(screen.getByText(/No query results available/i)).toBeInTheDocument();
  });
}); 