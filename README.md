# Query Profiler Frontend

## Getting Started

To run the Query Profiler Frontend locally:

1. **Navigate to the project directory:**
   ```sh
   cd query-profiler-frontend
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Start the development server:**
   ```sh
   npm start
   ```
   This will launch the app in your browser at [http://localhost:3000](http://localhost:3000).

4. **Run tests (optional):**
   ```sh
   npm test
   ```

---

## Project Structure

## Directory Structure

```
src/
├── assets/              # Static assets
│   ├── images/         # Image files
│   └── icons/          # Icon files
├── components/          # Reusable UI components
│   ├── common/         # Shared components
│   └── features/       # Feature-specific components
├── config/             # Configuration files
│   ├── constants.js    # Application constants
│   └── theme.js        # Theme configuration
├── hooks/              # Custom React hooks
├── layouts/            # Layout components
├── pages/              # Page components
├── services/           # API and business logic
├── store/              # State management
│   ├── slices/         # Redux slices
│   └── index.js        # Store configuration
├── styles/             # Global styles
│   ├── base/          # Base styles
│   ├── components/    # Component-specific styles
│   └── theme/         # Theme styles
├── utils/              # Utility functions
├── App.js              # Root component
├── App.test.js         # Root component tests
├── index.js            # Application entry point
└── setupTests.js       # Test setup
```

## Best Practices

### 1. Component Organization
- Use feature-based folder structure
- Keep components small and focused
- Follow atomic design principles
- Use index.js files for cleaner imports

### 2. State Management
- Use Redux for global state
- Use React Context for theme/UI state
- Keep component state local when possible

### 3. Styling
- Use CSS Modules for component styles
- Follow BEM naming convention
- Use CSS variables for theming
- Implement responsive design

### 4. Testing
- Write unit tests for components
- Use integration tests for features
- Follow AAA pattern (Arrange, Act, Assert)
- Use mock data for testing

### 5. Code Quality
- Use ESLint for code linting
- Follow consistent naming conventions
- Write meaningful comments
- Use TypeScript for type safety

### 6. Performance
- Implement code splitting
- Use React.memo for optimization
- Lazy load components
- Optimize images and assets

### 7. Security
- Sanitize user input
- Implement proper authentication
- Use environment variables
- Follow security best practices

### 8. Documentation
- Document components with JSDoc
- Keep README files updated
- Document API endpoints
- Include setup instructions 
