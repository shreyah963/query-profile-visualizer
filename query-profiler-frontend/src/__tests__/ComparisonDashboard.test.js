import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ComparisonDashboard from '../components/features/ProfilerDashboard/ComparisonDashboard/ComparisonDashboard';

describe('ComparisonDashboard', () => {
  const mockOnExit = jest.fn();

  beforeEach(() => {
    mockOnExit.mockClear();
  });

  it('renders without crashing', () => {
    render(<ComparisonDashboard onExit={mockOnExit} />);
    expect(screen.getByText(/Profile Comparison Mode/i)).toBeInTheDocument();
  });

  it('calls onExit when Exit Comparison Mode button is clicked', () => {
    render(<ComparisonDashboard onExit={mockOnExit} />);
    const exitButton = screen.getByText(/Exit Comparison Mode/i);
    fireEvent.click(exitButton);
    expect(mockOnExit).toHaveBeenCalled();
  });

  it('displays error message when JSON is invalid', () => {
    render(<ComparisonDashboard onExit={mockOnExit} />);
    const jsonInput = screen.getByPlaceholderText(/Paste profile output in JSON format here/i);
    fireEvent.change(jsonInput, { target: { value: 'invalid json' } });
    const errorMessage = screen.getByText(/Invalid JSON/i);
    expect(errorMessage).toBeInTheDocument();
  });
}); 