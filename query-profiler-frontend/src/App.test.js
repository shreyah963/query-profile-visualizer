import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Query Profiler Dashboard', () => {
  render(<App />);

  // Check for the main dashboard title
  const titleElement = screen.getByText(/Query Profiler Dashboard/i);
  expect(titleElement).toBeInTheDocument();

  // Check for the JSON input textarea
  const jsonInput = screen.getByPlaceholderText(/Paste your profile output in JSON format here/i);
  expect(jsonInput).toBeInTheDocument();

  // Check for the upload button
  const uploadButton = screen.getByText(/Upload File/i);
  expect(uploadButton).toBeInTheDocument();

  // Check for the visualize button
  const visualizeButton = screen.getByText(/Visualize/i);
  expect(visualizeButton).toBeInTheDocument();
});
