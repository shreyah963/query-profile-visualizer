// Profile template data
export const profileTemplate = {
  "profile": {
    "shards": [
      {
        "id": "[lhu-nAWHRjyUZ9H7nvHALA][big5][0]",
        "inbound_network_time_in_millis": 0,
        "outbound_network_time_in_millis": 0,
        "searches": [
          {
            "query": [
              {
                "type": "ConstantScoreQuery",
                "description": "ConstantScore(-cloud.region:eu-west-1 #((process.name:cron process.name:systemd)~1))",
                "time_in_nanos": 1109930,
                "breakdown": {
                  "set_min_competitive_score_count": 0,
                  "match_count": 295,
                  "shallow_advance_count": 0,
                  "next_doc": 168638,
                  "score_count": 0,
                  "compute_max_score_count": 0,
                  "advance": 0,
                  "advance_count": 0,
                  "score": 0,
                  "shallow_advance": 0,
                  "create_weight_count": 1,
                  "build_scorer": 742790,
                  "set_min_competitive_score": 0,
                  "match": 183044,
                  "next_doc_count": 301,
                  "compute_max_score": 0,
                  "build_scorer_count": 12,
                  "create_weight": 15458
                },
                "children": [
                  {
                    "type": "BooleanQuery",
                    "description": "-cloud.region:eu-west-1 #((process.name:cron process.name:systemd)~1)",
                    "time_in_nanos": 1063623,
                    "breakdown": {
                      "set_min_competitive_score_count": 0,
                      "match_count": 295,
                      "shallow_advance_count": 0,
                      "next_doc": 148133,
                      "score_count": 0,
                      "compute_max_score_count": 0,
                      "advance": 0,
                      "advance_count": 0,
                      "score": 0,
                      "shallow_advance": 0,
                      "create_weight_count": 1,
                      "build_scorer": 741583,
                      "set_min_competitive_score": 0,
                      "match": 160657,
                      "next_doc_count": 301,
                      "compute_max_score": 0,
                      "build_scorer_count": 12,
                      "create_weight": 13250
                    },
                    "children": [
                      {
                        "type": "TermQuery",
                        "description": "cloud.region:eu-west-1",
                        "time_in_nanos": 356586,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 0,
                          "next_doc": 0,
                          "score_count": 0,
                          "compute_max_score_count": 0,
                          "advance": 143796,
                          "advance_count": 56,
                          "score": 0,
                          "shallow_advance": 0,
                          "create_weight_count": 1,
                          "build_scorer": 207457,
                          "set_min_competitive_score": 0,
                          "match": 0,
                          "next_doc_count": 0,
                          "compute_max_score": 0,
                          "build_scorer_count": 12,
                          "create_weight": 5333
                        }
                      },
                      {
                        "type": "BooleanQuery",
                        "description": "(process.name:cron process.name:systemd)~1",
                        "time_in_nanos": 544717,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 0,
                          "next_doc": 113801,
                          "score_count": 0,
                          "compute_max_score_count": 0,
                          "advance": 0,
                          "advance_count": 0,
                          "score": 0,
                          "shallow_advance": 0,
                          "create_weight_count": 1,
                          "build_scorer": 427375,
                          "set_min_competitive_score": 0,
                          "match": 0,
                          "next_doc_count": 301,
                          "compute_max_score": 0,
                          "build_scorer_count": 18,
                          "create_weight": 3541
                        },
                        "children": [
                          {
                            "type": "TermQuery",
                            "description": "process.name:cron",
                            "time_in_nanos": 273869,
                            "breakdown": {
                              "set_min_competitive_score_count": 0,
                              "match_count": 0,
                              "shallow_advance_count": 0,
                              "next_doc": 53452,
                              "score_count": 0,
                              "compute_max_score_count": 0,
                              "advance": 0,
                              "advance_count": 0,
                              "score": 0,
                              "shallow_advance": 0,
                              "create_weight_count": 1,
                              "build_scorer": 220125,
                              "set_min_competitive_score": 0,
                              "match": 0,
                              "next_doc_count": 152,
                              "compute_max_score": 0,
                              "build_scorer_count": 18,
                              "create_weight": 292
                            }
                          },
                          {
                            "type": "TermQuery",
                            "description": "process.name:systemd",
                            "time_in_nanos": 134754,
                            "breakdown": {
                              "set_min_competitive_score_count": 0,
                              "match_count": 0,
                              "shallow_advance_count": 0,
                              "next_doc": 35170,
                              "score_count": 0,
                              "compute_max_score_count": 0,
                              "advance": 0,
                              "advance_count": 0,
                              "score": 0,
                              "shallow_advance": 0,
                              "create_weight_count": 1,
                              "build_scorer": 99292,
                              "set_min_competitive_score": 0,
                              "match": 0,
                              "next_doc_count": 155,
                              "compute_max_score": 0,
                              "build_scorer_count": 18,
                              "create_weight": 292
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ],
            "rewrite_time": 454417,
            "collector": [
              {
                "name": "MultiCollector",
                "reason": "search_multi",
                "time_in_nanos": 772789,
                "children": [
                  {
                    "name": "SimpleFieldCollector",
                    "reason": "search_top_hits",
                    "time_in_nanos": 655750
                  },
                  {
                    "name": "ProfilingAggregator: [processes_by_region]",
                    "reason": "aggregation",
                    "time_in_nanos": 52085
                  }
                ]
              }
            ]
          }
        ],
        "aggregations": [
          {
            "type": "NonCollectingAggregator",
            "description": "processes_by_region",
            "time_in_nanos": 40791,
            "breakdown": {
              "reduce": 0,
              "build_aggregation_count": 1,
              "post_collection": 2584,
              "initialize_count": 1,
              "reduce_count": 0,
              "collect_count": 280,
              "post_collection_count": 1,
              "build_leaf_collector": 5751,
              "build_aggregation": 5042,
              "build_leaf_collector_count": 6,
              "initialize": 16958,
              "collect": 10456
            },
            "children": [
              {
                "type": "NonCollectingAggregator",
                "description": "process_types",
                "time_in_nanos": 6206,
                "breakdown": {
                  "reduce": 0,
                  "build_aggregation_count": 0,
                  "post_collection": 1042,
                  "initialize_count": 1,
                  "reduce_count": 0,
                  "collect_count": 0,
                  "post_collection_count": 1,
                  "build_leaf_collector": 2373,
                  "build_aggregation": 0,
                  "build_leaf_collector_count": 6,
                  "initialize": 2791,
                  "collect": 0
                }
              }
            ]
          }
        ]
      }
    ]
  }
};

// Process the profile data for the frontend
export const processProfileData = (profileData) => {
  const formattedResponse = {
    hits: {
      total: { value: 301 },
      max_score: 1.0,
      hits: []
    },
    queryResults: [],
    profileData: profileData.profile,
    originalQueryData: {
      profile: true,
      query: {
        bool: {
          must: [
            { match: { "process.name": "cron" } },
            { match_phrase: { "message": "minnow hiss" } }
          ],
          filter: [
            { range: { "@timestamp": { "gte": "2023-01-01", "lte": "2024-03-31" } } },
            { term: { "cloud.region": "us-west-2" } }
          ],
          should: [
            { match: { "tags": "preserve_original_event" } },
            { match: { "input.type": "aws-cloudwatch" } }
          ],
          minimum_should_match: 1
        }
      },
      sort: [
        { "@timestamp": { "order": "desc" } }
      ]
    },
    chartData: processChartData(profileData.profile),
    rawResponse: {
      took: 1109930,
      _shards: {
        total: 1,
        successful: 1,
        failed: 0
      },
      timed_out: false
    },
    executionTime: 1109930,
    shardInfo: {
      total: 1,
      successful: 1,
      failed: 0
    },
    hitsInfo: {
      total: 301,
      maxScore: 1.0
    }
  };

  return formattedResponse;
};

// Process chart data from profile
const processChartData = (profileData) => {
  if (!profileData || !profileData.shards || !profileData.shards[0]) {
    return [];
  }

  const shard = profileData.shards[0];
  const queries = shard.searches[0].query;
  const chartData = [];

  queries.forEach(query => {
    const queryData = {
      type: query.type,
      description: query.description,
      time: query.time_in_nanos,
      breakdown: query.breakdown
    };

    if (query.children) {
      queryData.children = processNestedChildren(query.children);
    }

    chartData.push(queryData);
  });

  return chartData;
};

// Process nested children in the query tree
const processNestedChildren = (children) => {
  return children.map(child => {
    const childData = {
      type: child.type,
      description: child.description,
      time: child.time_in_nanos,
      breakdown: child.breakdown
    };

    if (child.children) {
      childData.children = processNestedChildren(child.children);
    }

    return childData;
  });
}; 