export const API = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000',
  ENDPOINTS: {
    QUERY_PROFILER: '/api/query-profiler',
    EXECUTE_QUERY: '/api/execute-query',
  },
  TIMEOUT: 10000,
};

export const QUERY_TEMPLATES = {
  DEFAULT: {
    query: {
      match_all: {},
    },
  },
  TERM_QUERY: {
    query: {
      term: {
        'process.name': 'cron',
      },
    },
  },
  BOOL_QUERY: {
    query: {
      bool: {
        must: [
          { match: { 'process.name': 'cron' } },
        ],
        should: [
          { match: { tags: 'preserve_original_event' } },
          { match: { 'input.type': 'aws-cloudwatch' } },
        ],
        minimum_should_match: 1,
      },
    },
    sort: [
      { '@timestamp': { order: 'desc' } },
    ],
  },
};

export const BREAKDOWN_GROUPS = {
  BUILD_SCORER: ['build_scorer', 'build_scorer_count'],
  CREATE_WEIGHT: ['create_weight', 'create_weight_count'],
  NEXT_DOC: ['next_doc', 'next_doc_count'],
  ADVANCE: ['advance', 'advance_count'],
  SCORE: ['score', 'score_count'],
  MATCH: ['match', 'match_count'],
  COMPUTE_MAX_SCORE: ['compute_max_score', 'compute_max_score_count'],
  SET_MIN_COMPETITIVE_SCORE: ['set_min_competitive_score', 'set_min_competitive_score_count'],
  SHALLOW_ADVANCE: ['shallow_advance', 'shallow_advance_count'],
};

export const ERROR_MESSAGES = {
  NO_DATA: 'No profiling data available',
  LOADING: 'Loading profiler data...',
  ERROR: 'Error loading profiler data',
  INVALID_JSON: 'Invalid JSON file',
  CONNECTION_ERROR: 'Cannot connect to OpenSearch',
};

export const DEBUG = {
  ENABLED: process.env.NODE_ENV === 'development',
  CONSOLE: {
    DATA: 'Profiler data updated:',
    QUERY: 'Executing query to OpenSearch...',
    ERROR: 'Error executing query:',
  },
}; 