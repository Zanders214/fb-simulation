window.BENCHMARK_DATA = {
  "lastUpdate": 1782410204491,
  "repoUrl": "https://github.com/Zanders214/fb-simulation",
  "entries": {
    "fb-simulation engine": [
      {
        "commit": {
          "author": {
            "email": "152227414+Zanders214@users.noreply.github.com",
            "name": "Dennis Zanders",
            "username": "Zanders214"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "22e8101aad3fb0aa5e996379a9e7f5537164f067",
          "message": "Merge pull request #38 from Zanders214/ci/perf-benchmark-dashboard\n\nCI: performance-trend benchmark dashboard (gh-pages)",
          "timestamp": "2026-06-25T20:55:40+03:00",
          "tree_id": "7571e52f00b11499edf6f538f3dd74ab866628be",
          "url": "https://github.com/Zanders214/fb-simulation/commit/22e8101aad3fb0aa5e996379a9e7f5537164f067"
        },
        "date": 1782410204208,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "world-gen + setup",
            "value": 36.59,
            "unit": "ms"
          },
          {
            "name": "per-season avg",
            "value": 928.18,
            "unit": "ms"
          },
          {
            "name": "per-matchday median",
            "value": 30.062,
            "unit": "ms"
          },
          {
            "name": "retained heap / season",
            "value": 0.619,
            "unit": "MiB"
          }
        ]
      }
    ]
  }
}