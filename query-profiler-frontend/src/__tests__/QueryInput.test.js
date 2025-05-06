import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueryInput from '../components/features/ProfilerDashboard/QueryInput/QueryInput';

describe('QueryInput', () => {
  const mockOnQueryExecuted = jest.fn();

  beforeEach(() => {
    mockOnQueryExecuted.mockClear();
  });

  it('renders without crashing', () => {
    render(<QueryInput onQueryExecuted={mockOnQueryExecuted} />);
    expect(screen.getByPlaceholderText(/Enter your query here/i)).toBeInTheDocument();
  });

  it('calls onQueryExecuted when Execute button is clicked', () => {
    render(<QueryInput onQueryExecuted={mockOnQueryExecuted} />);
    const executeButton = screen.getByText(/Execute/i);
    fireEvent.click(executeButton);
    expect(mockOnQueryExecuted).toHaveBeenCalled();
  });

  it('displays error message when test connection fails', async () => {
    render(<QueryInput onQueryExecuted={mockOnQueryExecuted} />);
    const testConnectionButton = screen.getByText(/Test Connection/i);
    fireEvent.click(testConnectionButton);
    const errorMessage = await screen.findByText(/Connection failed/i);
    expect(errorMessage).toBeInTheDocument();
  });
}); 