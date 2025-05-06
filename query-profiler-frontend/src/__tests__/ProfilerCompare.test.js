import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilerCompare from '../components/features/ProfilerDashboard/ProfilerComparison/ProfilerCompare';

describe('ProfilerCompare', () => {
  const mockOnCompare = jest.fn();

  beforeEach(() => {
    mockOnCompare.mockClear();
  });

  it('renders without crashing', () => {
    render(<ProfilerCompare onCompare={mockOnCompare} />);
    expect(screen.getByText(/Profile 1:/i)).toBeInTheDocument();
    expect(screen.getByText(/Profile 2:/i)).toBeInTheDocument();
  });

  it('calls onCompare when Compare button is clicked', () => {
    render(<ProfilerCompare onCompare={mockOnCompare} />);
    // Fill both profile textareas with valid JSON
    const textareas = screen.getAllByPlaceholderText(/Or paste profile output in JSON format here/i);
    fireEvent.change(textareas[0], { target: { value: '{"foo":1}' } });
    fireEvent.change(textareas[1], { target: { value: '{"bar":2}' } });
    // Now the Compare button should be enabled
    const compareButtons = screen.getAllByText(/Compare/i);
    fireEvent.click(compareButtons[0]);
    expect(mockOnCompare).toHaveBeenCalled();
  });

  it('displays error message when JSON is invalid', () => {
    render(<ProfilerCompare onCompare={mockOnCompare} />);
    const jsonInput = screen.getAllByPlaceholderText(/Or paste profile output in JSON format here/i)[0];
    fireEvent.change(jsonInput, { target: { value: 'invalid json' } });
    const errorMessage = screen.queryByText(/Invalid JSON/i);
    // The component does not show error immediately, so errorMessage may be null
    expect(errorMessage).not.toBeNull();
  });
}); 