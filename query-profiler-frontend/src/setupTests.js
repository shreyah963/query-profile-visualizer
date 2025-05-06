// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Light: {
    registerLanguage: jest.fn(),
    __esModule: true
  },
  Prism: {
    registerLanguage: jest.fn(),
    __esModule: true
  }
}));

jest.mock('react-syntax-highlighter/dist/esm/languages/hljs/json', () => ({
  __esModule: true,
  default: {}
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/hljs', () => ({
  __esModule: true,
  atomOneDark: {}
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  __esModule: true,
  tomorrow: {}
}));
