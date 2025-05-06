import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerCompare from '../components/features/ProfilerDashboard/ProfilerComparison/ProfilerCompare';

describe('ProfilerCompare', () => {
  const mockOnCompare = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnCompare.mockClear();
    mockOnClose.mockClear();
  });

  it('renders without crashing', () => {
    render(<ProfilerCompare onCompare={mockOnCompare} onClose={mockOnClose} />);
    expect(screen.getByText(/Profile 1:/i)).toBeInTheDocument();
    expect(screen.getByText(/Profile 2:/i)).toBeInTheDocument();
  });

  it('calls onCompare when Compare button is clicked', () => {
    render(<ProfilerCompare onCompare={mockOnCompare} onClose={mockOnClose} />);
    const jsonInputs = screen.getAllByPlaceholderText(/Or paste profile output in JSON format here/i);
    fireEvent.change(jsonInputs[0], { target: { value: '{"foo":1}' } });
    fireEvent.change(jsonInputs[1], { target: { value: '{"foo":2}' } });
    const compareButton = screen.getByRole('button', { name: /Compare/i });
    fireEvent.click(compareButton);
    expect(mockOnCompare).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays error message when JSON is invalid', () => {
    render(<ProfilerCompare onCompare={mockOnCompare} onClose={mockOnClose} />);
    const jsonInput = screen.getAllByPlaceholderText(/Or paste profile output in JSON format here/i)[0];
    fireEvent.change(jsonInput, { target: { value: 'invalid json' } });
    const errorMessage = screen.queryByText(/Invalid JSON/i);
    // The component does not show error immediately, so errorMessage may be null
    expect(errorMessage).not.toBeNull();
  });
}); 