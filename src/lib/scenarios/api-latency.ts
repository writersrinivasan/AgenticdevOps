import type { Scenario } from "../types";

// Module 7.4: Autonomous incident investigation - API latency +300%.
export const apiLatency: Scenario = {
  id: "api-latency",
  title: "Accounts API latency up 300%",
  industry: "Banking",
  company: "NovaBank (fictional)",
  service: "accounts-api",
  icon: "Landmark",
  gradient: "from-amber-400 via-yellow-500 to-lime-400",
  accent: "#eab308",
  severity: "SEV2",
  summary:
    "The mobile banking statement screen is crawling. p95 latency went from 180ms to 720ms. The investigation follows the 9-step method: identify the service, then check metrics, logs, traces, deployments, infrastructure and correlated alerts, before naming a root cause. The fix is a high-risk production database change, so a human must approve it even in autonomous mode.",
  alert: {
    title: "p95 latency 720ms on accounts-api /v2/statements (SLO: 250ms)",
    source: "Datadog APM monitor",
    time: "08:12 UTC",
    details: "service=accounts-api endpoint=GET /v2/statements env=prod apdex=0.61",
  },
  modules: ["m7", "m8", "m11"],
  stages: [
    ["supervisor"],
    ["metrics", "traces", "deploy", "infra"],
    ["db"],
    ["rca"],
    ["human"],
    ["executor"],
    ["validator"],
    ["reporter"],
  ],
  agents: [
    {
      id: "supervisor",
      name: "Incident Supervisor",
      role: "Identifies the affected service and correlates alerts",
      icon: "BrainCircuit",
      color: "#a78bfa",
      kind: "supervisor",
      tools: [
        {
          name: "correlate_alerts",
          args: { window: "30m", service: "accounts-api" },
          output:
            "3 related alerts: [accounts-api p95 latency] [postgres-ledger CPU 88%] [mobile-bff timeout rate 4%]\nunrelated: [marketing-email queue lag]",
        },
      ],
      fallback:
        "The affected service is accounts-api, and only GET /v2/statements is degraded. Three alerts correlate: API latency, postgres-ledger CPU at 88%, and mobile-bff timeouts. The marketing queue alert is unrelated. Dispatching metrics, traces, deployment and infrastructure agents in parallel.",
    },
    {
      id: "metrics",
      name: "Metrics Agent",
      role: "Analyses latency, throughput and saturation",
      icon: "ChartLine",
      color: "#22d3ee",
      kind: "investigator",
      tools: [
        {
          name: "query_metrics",
          args: { metric: "trace.http.request.duration.p95", by: "endpoint", range: "2h" },
          output:
            "/v2/statements   180ms → 720ms (+300%) from 07:46\n/v2/balance      42ms → 45ms\n/v2/transfers    95ms → 101ms\nrequests/min: 8.4k (normal for Monday morning)",
        },
      ],
      fallback:
        "Only /v2/statements regressed: p95 went from 180ms to 720ms (+300%) starting 07:46. Balance and transfers are flat. Traffic is a normal 8.4k rpm Monday peak, so this is a code or data-path regression, not load.",
    },
    {
      id: "traces",
      name: "Tracing Agent",
      role: "Inspects distributed traces for the slowest spans",
      icon: "Waypoints",
      color: "#38bdf8",
      kind: "investigator",
      tools: [
        {
          name: "query_traces",
          args: { endpoint: "/v2/statements", percentile: "p95", limit: 20 },
          output:
            "span breakdown (p95 trace 731ms):\n  postgres.query SELECT ... FROM transactions WHERE account_id=$1 AND merchant_category=$2 ... 655ms (90%)\n  redis.get 3ms | serialization 18ms",
        },
      ],
      fallback:
        "90% of the p95 trace time (655ms) is in a single Postgres query: SELECT … FROM transactions WHERE account_id=$1 AND merchant_category=$2. Redis and serialization are negligible, so the latency is in the database query path.",
    },
    {
      id: "deploy",
      name: "Change Agent",
      role: "Compares recent deployments and migrations",
      icon: "GitCommitHorizontal",
      color: "#f472b6",
      kind: "investigator",
      tools: [
        {
          name: "list_deployments",
          args: { service: "accounts-api", since: "6h" },
          output: "v5.3.0 07:44Z 'Statements: filter by merchant category' incl. migration 0047_add_merchant_category",
        },
        {
          name: "git_diff",
          args: { path: "migrations/0047_add_merchant_category.sql" },
          output: "ALTER TABLE transactions ADD COLUMN merchant_category text;\n-- TODO: index (deferred to follow-up)",
        },
      ],
      fallback:
        "v5.3.0 deployed at 07:44, two minutes before the regression. It added a merchant_category filter and migration 0047, which adds the column but no index: the SQL has '-- TODO: index (deferred to follow-up)'.",
    },
    {
      id: "infra",
      name: "Infrastructure Agent",
      role: "Checks hosts, pods and DB resources",
      icon: "Server",
      color: "#34d399",
      kind: "investigator",
      tools: [
        {
          name: "db_stats",
          args: { cluster: "postgres-ledger" },
          output: "CPU 88% (baseline 35%) | IOPS read 14k (baseline 3k) | connections 210/500 | buffer cache hit 71% (baseline 99%)",
        },
      ],
      fallback:
        "postgres-ledger CPU is at 88% (baseline 35%), read IOPS are 4.6x baseline, and the buffer cache hit ratio dropped from 99% to 71%. That pattern points to large sequential scans. App pods and connections are fine.",
    },
    {
      id: "db",
      name: "Database Agent",
      role: "Runs read-only EXPLAIN plans",
      icon: "Database",
      color: "#fb7185",
      kind: "analyst",
      tools: [
        {
          name: "explain_analyze",
          args: { query: "statements_by_category", read_only: true },
          output:
            "Seq Scan on transactions (rows=48,201,113) Filter: (account_id = $1 AND merchant_category = $2)\nRows Removed by Filter: 48,200,960  Execution Time: 641.3 ms",
        },
      ],
      fallback:
        "EXPLAIN ANALYZE (read-only) shows a sequential scan over 48.2M transaction rows, discarding 99.99% of them, in 641ms. The new predicate stops the planner from using the existing account_id index efficiently. A composite index on (account_id, merchant_category) should bring this to about 2ms.",
    },
    {
      id: "rca",
      name: "Root Cause Analyst",
      role: "Determines probable root cause and remediation",
      icon: "Microscope",
      color: "#fbbf24",
      kind: "planner",
      instructions:
        "State the root cause with confidence, list remediation options (index vs. feature-flag off vs. rollback), recommend one, and explain why this is HIGH risk.",
      fallback:
        "Root cause (confidence 92%): migration 0047 added merchant_category without an index, so /v2/statements runs a 48M-row sequential scan. Recommend CREATE INDEX CONCURRENTLY on (account_id, merchant_category), which takes no table lock. The alternative is to turn off the feature flag 'stmt_category_filter' first. Risk is HIGH because this is a schema change on the production ledger database, so a human is always required.",
    },
    {
      id: "human",
      name: "Human Approval Gate",
      role: "DBA + incident commander approval",
      icon: "UserCheck",
      color: "#f8fafc",
      kind: "human",
      fallback: "",
    },
    {
      id: "executor",
      name: "DB Change Agent",
      role: "Executes the approved, non-blocking index build",
      icon: "Rocket",
      color: "#4ade80",
      kind: "executor",
      tools: [
        {
          name: "run_sql",
          args: { db: "postgres-ledger", statement_timeout: "30m", role: "agent_ddl_limited" },
          output:
            "CREATE INDEX CONCURRENTLY idx_tx_account_category ON transactions (account_id, merchant_category);\nCREATE INDEX (duration 6m 12s, no locks held)",
        },
      ],
      fallback:
        "Built idx_tx_account_category with CREATE INDEX CONCURRENTLY in 6m12s without holding table locks. It used the limited DDL role agent_ddl_limited with a 30-minute statement timeout.",
    },
    {
      id: "validator",
      name: "Validation Agent",
      role: "Confirms latency and DB health",
      icon: "BadgeCheck",
      color: "#2dd4bf",
      kind: "validator",
      tools: [
        {
          name: "explain_analyze",
          args: { query: "statements_by_category", read_only: true },
          output: "Index Scan using idx_tx_account_category (rows=153) Execution Time: 1.9 ms",
        },
        {
          name: "query_metrics",
          args: { metric: "p95 /v2/statements", range: "15m" },
          output: "720ms → 410ms → 190ms → 176ms | DB CPU 37% | cache hit 99%",
        },
      ],
      fallback:
        "The query now uses idx_tx_account_category: 1.9ms instead of 641ms. p95 for /v2/statements recovered to 176ms (SLO 250ms), DB CPU is back to 37%, and the cache hit ratio is 99%. Incident mitigated.",
    },
    {
      id: "reporter",
      name: "Postmortem Agent",
      role: "Communicates status and writes the report",
      icon: "FileText",
      color: "#e879f9",
      kind: "reporter",
      fallback: "",
    },
  ],
  remediation: {
    title: "CREATE INDEX CONCURRENTLY on transactions(account_id, merchant_category)",
    command:
      "CREATE INDEX CONCURRENTLY idx_tx_account_category ON transactions (account_id, merchant_category);",
    risk: "high",
    blastRadius: "Production ledger DB (48M rows); non-blocking build, ~6 min of extra IO",
    rollbackPlan: "DROP INDEX CONCURRENTLY idx_tx_account_category; disable flag stmt_category_filter",
    guardrails: [
      { check: "Restricted commands", pass: true, detail: "DDL limited to CREATE/DROP INDEX CONCURRENTLY" },
      { check: "Least privilege", pass: true, detail: "Role agent_ddl_limited, no DML, no DROP TABLE" },
      { check: "Replication lag budget", pass: true, detail: "Replica lag 0.4s < 5s budget" },
      { check: "High-risk policy", pass: false, detail: "Production schema change → human approval mandatory" },
    ],
  },
  metric: {
    name: "p95 latency /v2/statements",
    unit: "ms",
    threshold: 250,
    badWhen: "higher",
    before: [182, 178, 185, 180, 176, 410, 655, 720, 712, 731, 725],
    after: [690, 410, 190, 176, 174],
  },
  lessons: [
    "Add a migration linter: any new WHERE column needs an index or an explicit waiver",
    "Load-test against production-sized data (48M rows) in staging",
    "Ship schema-dependent features behind flags that default off",
  ],
};
