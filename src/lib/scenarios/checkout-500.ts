import type { Scenario } from "../types";

// Capstone (Module 10): production app suddenly returns HTTP 500s.
export const checkout500: Scenario = {
  id: "checkout-500",
  title: "Checkout API returning HTTP 500s",
  industry: "E-commerce / Retail",
  company: "ShopSphere (fictional)",
  service: "checkout-api",
  icon: "ShoppingCart",
  gradient: "from-rose-500 via-orange-500 to-amber-400",
  accent: "#f43f5e",
  severity: "SEV1",
  summary:
    "Minutes after a Friday deployment, 18% of checkout requests fail with HTTP 500. Revenue is bleeding at ~$42k/min. A supervisor agent dispatches observability, log, deployment and infrastructure agents in parallel, correlates evidence, pulls the runbook and proposes a governed rollback.",
  alert: {
    title: "HTTP 5xx rate 18.4% on checkout-api (SLO: < 0.5%)",
    source: "Prometheus Alertmanager → PagerDuty",
    time: "14:02 UTC",
    details:
      "alertname=HighErrorRate service=checkout-api env=prod region=us-east-1 severity=critical",
  },
  modules: ["m7", "m8", "m9", "m10"],
  stages: [
    ["supervisor"],
    ["observability", "logs", "deploy", "infra"],
    ["rca"],
    ["knowledge"],
    ["planner"],
    ["human"],
    ["executor"],
    ["validator"],
    ["reporter"],
  ],
  agents: [
    {
      id: "supervisor",
      name: "DevOps Supervisor",
      role: "Classifies the incident, sets severity and delegates investigation",
      icon: "BrainCircuit",
      color: "#a78bfa",
      kind: "supervisor",
      tools: [
        {
          name: "get_alert",
          args: { alert_id: "PD-88213" },
          output:
            "alert=HighErrorRate service=checkout-api env=prod\nvalue=18.4% threshold=0.5% for=3m\nfirst_seen=14:02:11Z  affected_endpoints=[POST /api/v1/checkout, POST /api/v1/payment/intent]",
        },
        {
          name: "get_service_catalog",
          args: { service: "checkout-api" },
          output:
            "owner=team-payments tier=0 (revenue critical)\ndependencies=[postgres-orders, payment-gateway, inventory-svc, redis-cart]\noncall=@payments-oncall",
        },
      ],
      instructions:
        "Classify the incident, assign severity (SEV1-SEV3) with justification, then state which specialist agents you are delegating to and what each must check.",
      fallback:
        "Classified as SEV1: tier-0 revenue service, 18.4% of checkouts failing (37x the SLO). Delegating in parallel: Observability Agent → error/latency metrics; Log Analyst → error signatures; Deployment Agent → changes in the last 30 min; Infrastructure Agent → pods, nodes and database health.",
    },
    {
      id: "observability",
      name: "Observability Agent",
      role: "Analyses metrics and golden signals",
      icon: "Activity",
      color: "#22d3ee",
      kind: "investigator",
      tools: [
        {
          name: "query_metrics",
          args: { promql: 'sum(rate(http_requests_total{svc="checkout-api",code=~"5.."}[1m]))', range: "30m" },
          output:
            "13:50 0.2%  13:54 0.3%  13:56 0.2%  13:58 7.9%  14:00 14.2%  14:02 18.4%\np95 latency: 180ms → 30,040ms (timeouts)\nthroughput: stable 2.1k rpm (not a traffic spike)",
        },
        {
          name: "query_traces",
          args: { service: "checkout-api", status: "error", limit: 50 },
          output:
            "48/50 error traces stall in span `OrderRepository.save` → `HikariPool.getConnection` (30.0s)\ndownstream payment-gateway spans: healthy (p95 210ms)",
        },
      ],
      fallback:
        "Error rate jumped from 0.2% to 18.4% starting 13:58 with flat traffic, so this is not load. p95 latency hit 30s, matching a timeout. Traces show 96% of failures stall in HikariPool.getConnection — requests are waiting for DB connections, not on the payment gateway.",
    },
    {
      id: "logs",
      name: "Log Analyst Agent",
      role: "Clusters error logs and extracts signatures",
      icon: "ScrollText",
      color: "#38bdf8",
      kind: "investigator",
      tools: [
        {
          name: "query_logs",
          args: { index: "prod-checkout-*", level: "ERROR", since: "15m" },
          output:
            "[14:01:52] ERROR c.s.checkout.OrderRepository - HikariPool-1 - Connection is not available, request timed out after 30000ms (total=5, active=5, idle=0, waiting=187)\n[14:01:52] ERROR c.s.web.ErrorHandler - 500 POST /api/v1/checkout traceId=7f3a...\n[14:01:53] WARN  HikariPool-1 - Thread starvation or clock leap detected",
        },
        {
          name: "cluster_log_patterns",
          args: { window: "15m" },
          output:
            "pattern#1 'Connection is not available ... total=5' x 4,912 (91%)\npattern#2 '500 POST /api/v1/checkout' x 4,880\npattern#3 'payment declined' x 41 (baseline, unrelated)",
        },
      ],
      fallback:
        "91% of 4,912 errors share one signature: 'HikariPool-1 – Connection is not available (total=5, active=5, waiting=187)'. The pool size is only 5 connections with 187 threads waiting. Payment-declined errors are at baseline and unrelated.",
    },
    {
      id: "deploy",
      name: "Deployment Agent",
      role: "Inspects recent releases, Git changes and config diffs",
      icon: "GitCommitHorizontal",
      color: "#f472b6",
      kind: "investigator",
      tools: [
        {
          name: "list_deployments",
          args: { service: "checkout-api", since: "2h" },
          output:
            "rev 42  v2.14.0  13:56Z  by ci-bot (PR #1873 'switch payment client to async pool')  status=deployed\nrev 41  v2.13.2  yesterday 10:12Z  status=superseded",
        },
        {
          name: "git_diff",
          args: { range: "v2.13.2..v2.14.0", path: "deploy/helm/values-prod.yaml" },
          output:
            "-  DB_POOL_MAX: \"50\"\n+  DB_POOL_MAX: \"5\"      # copied from values-dev.yaml\n-  DB_POOL_TIMEOUT_MS: \"5000\"\n+  DB_POOL_TIMEOUT_MS: \"30000\"",
        },
      ],
      fallback:
        "v2.14.0 (PR #1873) was deployed at 13:56, 2 minutes before errors began. The prod Helm values changed DB_POOL_MAX from 50 to 5 (copied from dev) and raised the pool timeout to 30s. That matches the 30s timeouts exactly.",
    },
    {
      id: "infra",
      name: "Infrastructure Agent",
      role: "Checks Kubernetes, nodes and database health",
      icon: "Server",
      color: "#34d399",
      kind: "investigator",
      tools: [
        {
          name: "kubectl_get_pods",
          args: { namespace: "prod", selector: "app=checkout-api" },
          output:
            "checkout-api-7c9f-2xk  1/1 Running 0  6m\ncheckout-api-7c9f-8hd  1/1 Running 0  6m\n... 6/6 Running, CPU 41%, MEM 58%",
        },
        {
          name: "db_stats",
          args: { cluster: "postgres-orders" },
          output:
            "connections: 30 used / 400 max\nactive queries: 12, avg query time 4ms, no locks, replication lag 0s",
        },
      ],
      fallback:
        "Infrastructure is healthy: 6/6 pods running at 41% CPU, and postgres-orders uses only 30 of 400 connections with 4ms queries and no locks. The database has plenty of capacity; the bottleneck is on the client side.",
    },
    {
      id: "rca",
      name: "Root Cause Analyst",
      role: "Correlates evidence across agents into a root-cause hypothesis",
      icon: "Microscope",
      color: "#fbbf24",
      kind: "analyst",
      instructions:
        "Correlate the findings of all investigators. Give ONE probable root cause with a confidence percentage, the causal chain, and any alternative hypotheses you ruled out.",
      fallback:
        "Root cause (confidence 94%): a config regression in v2.14.0 cut DB_POOL_MAX from 50 to 5 in prod. Causal chain: deploy at 13:56 → pool of 5 saturates at 2.1k rpm → 187 threads wait → 30s timeout → HTTP 500. Ruled out: traffic spike (flat), database capacity (30/400 conns), payment gateway (healthy).",
    },
    {
      id: "knowledge",
      name: "Knowledge Agent",
      role: "Retrieves runbooks and similar past incidents (RAG over the knowledge base)",
      icon: "BookOpenText",
      color: "#c084fc",
      kind: "analyst",
      tools: [
        {
          name: "search_runbooks",
          args: { query: "connection pool exhaustion after deploy", top_k: 2 },
          output:
            "RB-112 'DB connection pool exhaustion' (score 0.91)\n  1. If a deploy happened in the last 60m → helm rollback to the previous revision\n  2. Otherwise raise DB_POOL_MAX within DB max_connections / replicas\nRB-007 'Generic SEV1 rollback procedure' (score 0.78)",
        },
        {
          name: "search_incident_history",
          args: { service: "checkout-api", similarity: ">0.8" },
          output:
            "INC-2291 (2026-03-14) 'Pool misconfig after env copy' MTTR 47m; fix: rollback + values lint rule (never merged)",
        },
      ],
      fallback:
        "Runbook RB-112 (match 0.91) prescribes a Helm rollback to the previous revision when a deploy happened in the last 60 minutes. Similar incident INC-2291 (March 2026) was a pool misconfiguration copied between environments, resolved by rollback in 47 minutes. Its follow-up action, a values lint rule, was never merged.",
    },
    {
      id: "planner",
      name: "Incident Commander",
      role: "Chooses the remediation and assesses risk",
      icon: "ShieldAlert",
      color: "#fb923c",
      kind: "planner",
      instructions:
        "Recommend the single best remediation, explain why it beats the alternatives, state risk level and blast radius, and say that it requires approval per policy.",
      fallback:
        "Recommend: helm rollback checkout-api to rev 41 (v2.13.2), per RB-112. A rollback is faster and safer than hot-patching the pool size because rev 41 is a known-good state. Risk: MEDIUM. Blast radius: checkout-api only, rolling 6 pods with maxUnavailable=1. Policy requires human approval for production changes.",
    },
    {
      id: "human",
      name: "Human Approval Gate",
      role: "On-call SRE approves or rejects the action",
      icon: "UserCheck",
      color: "#f8fafc",
      kind: "human",
      fallback: "",
    },
    {
      id: "executor",
      name: "Release Agent",
      role: "Executes the approved action inside guardrails",
      icon: "Rocket",
      color: "#4ade80",
      kind: "executor",
      tools: [
        {
          name: "helm_rollback",
          args: { release: "checkout-api", revision: 41, namespace: "prod", dry_run: false },
          output:
            "Rollback was a success! Happy Helming!\nrelease \"checkout-api\" rolled back to revision 41 (v2.13.2)",
        },
        {
          name: "kubectl_rollout_status",
          args: { deployment: "checkout-api", namespace: "prod" },
          output:
            "Waiting for rollout: 2 of 6 updated replicas are available...\nWaiting for rollout: 5 of 6 updated replicas are available...\ndeployment \"checkout-api\" successfully rolled out",
        },
      ],
      fallback:
        "Executed the approved rollback: checkout-api is now on rev 41 (v2.13.2). The rolling update finished with 6/6 replicas available and zero failed pods. The action was recorded in the audit log under the approver's identity.",
    },
    {
      id: "validator",
      name: "Validation Agent",
      role: "Verifies recovery against SLOs",
      icon: "BadgeCheck",
      color: "#2dd4bf",
      kind: "validator",
      tools: [
        {
          name: "query_metrics",
          args: { promql: "5xx rate checkout-api", range: "5m" },
          output: "14:09 11.2%  14:10 4.1%  14:11 0.9%  14:12 0.3%  14:13 0.2%\np95 latency 186ms | pool active 9/50 | waiting 0",
        },
        {
          name: "synthetic_check",
          args: { journey: "guest-checkout", runs: 20 },
          output: "20/20 passed, median 1.4s end-to-end",
        },
      ],
      fallback:
        "Recovery confirmed: the 5xx rate fell from 18.4% to 0.2% (within the 0.5% SLO), p95 latency is back to 186ms, and no threads are waiting on the pool (9/50 active). All 20 synthetic checkout journeys passed. Closing the mitigation phase.",
    },
    {
      id: "reporter",
      name: "Comms & Postmortem Agent",
      role: "Writes stakeholder updates and the post-incident report",
      icon: "FileText",
      color: "#e879f9",
      kind: "reporter",
      fallback: "",
    },
  ],
  remediation: {
    title: "Roll back checkout-api to revision 41 (v2.13.2)",
    command: "helm rollback checkout-api 41 -n prod --wait --timeout 5m",
    risk: "medium",
    blastRadius: "Single service (checkout-api), 6 pods, rolling update maxUnavailable=1",
    rollbackPlan: "Re-deploy v2.14.0 with corrected values (DB_POOL_MAX=50) via the normal pipeline",
    guardrails: [
      { check: "Action allowlist", pass: true, detail: "helm rollback is an allowlisted action for the Release Agent" },
      { check: "Environment boundary", pass: true, detail: "Scoped to namespace prod/checkout-api only" },
      { check: "Blast-radius control", pass: true, detail: "1 service, rolling strategy, no schema changes" },
      { check: "Change freeze", pass: true, detail: "No active freeze window" },
      { check: "Credential scope", pass: true, detail: "Short-lived token, role: deployer-checkout" },
    ],
  },
  metric: {
    name: "HTTP 5xx error rate",
    unit: "%",
    threshold: 0.5,
    badWhen: "higher",
    before: [0.2, 0.3, 0.2, 0.2, 0.3, 0.2, 7.9, 14.2, 18.4, 18.1, 18.6, 18.3],
    after: [11.2, 4.1, 0.9, 0.3, 0.2, 0.2],
  },
  lessons: [
    "Add a CI policy check that blocks dev values from being copied into values-prod.yaml",
    "Merge the lint rule proposed after INC-2291",
    "Alert on Hikari 'waiting' threads > 0 for 1m, before errors reach users",
  ],
};
