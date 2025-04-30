import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Query Profiler Dashboard', () => {
  render(<App />);
  
  // Check for the main dashboard title
  const titleElement = screen.getByText(/Query Profiler Dashboard/i);
  expect(titleElement).toBeInTheDocument();
  
  // Check for the search input
  const searchInput = screen.getByPlaceholderText(/Search profiler/i);
  expect(searchInput).toBeInTheDocument();
  
  // Check for the download button
  const downloadButton = screen.getByRole('button', { name: /↓/i });
  expect(downloadButton).toBeInTheDocument();
});
