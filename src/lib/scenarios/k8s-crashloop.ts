import type { Scenario } from "../types";

// Module 6.3: Kubernetes Troubleshooting Agent.
export const k8sCrashloop: Scenario = {
  id: "k8s-crashloop",
  title: "Transcoder pods stuck in CrashLoopBackOff",
  industry: "Media & Streaming",
  company: "StreamNova (fictional)",
  service: "video-transcoder",
  icon: "Container",
  gradient: "from-emerald-500 via-teal-500 to-cyan-500",
  accent: "#14b8a6",
  severity: "SEV2",
  summary:
    "The video transcoding fleet loses replicas one by one. New uploads queue up and creators can't publish. The Kubernetes agent follows the classic path from alert to pod, logs, events and configuration, finds an over-aggressive cost-optimisation change, and proposes a safe fix through GitOps.",
  alert: {
    title: "KubeDeploymentReplicasMismatch: video-transcoder 0/8 available",
    source: "kube-state-metrics → Alertmanager",
    time: "21:17 UTC",
    details: "namespace=media deployment=video-transcoder cluster=gke-prod-eu-west1 queue_depth=12,480",
  },
  modules: ["m6", "m8"],
  stages: [
    ["k8s"],
    ["logs", "events"],
    ["config"],
    ["rca"],
    ["human"],
    ["executor"],
    ["validator"],
    ["reporter"],
  ],
  agents: [
    {
      id: "k8s",
      name: "Kubernetes Agent",
      role: "Checks pod status and delegates diagnostics",
      icon: "Container",
      color: "#2dd4bf",
      kind: "supervisor",
      tools: [
        {
          name: "kubectl_get_pods",
          args: { namespace: "media", selector: "app=video-transcoder" },
          output:
            "NAME                       READY STATUS            RESTARTS  AGE\nvideo-transcoder-5d8-4kq   0/1   CrashLoopBackOff  9         24m\nvideo-transcoder-5d8-9wz   0/1   OOMKilled         8         24m\nvideo-transcoder-5d8-tt2   0/1   CrashLoopBackOff  9         24m\n... 8/8 pods not ready",
        },
        {
          name: "kubectl_describe_pod",
          args: { pod: "video-transcoder-5d8-9wz" },
          output:
            "Last State: Terminated  Reason: OOMKilled  Exit Code: 137\nLimits: memory 512Mi cpu 2\nRequests: memory 512Mi cpu 1\nImage: transcoder:4.2.1 (unchanged for 9 days)",
        },
      ],
      fallback:
        "All 8 transcoder pods are failing: CrashLoopBackOff with 8–9 restarts each. The last termination reason is OOMKilled (exit 137) with a 512Mi memory limit. The image has not changed in 9 days, so the change is probably in configuration. Delegating to the Log and Events agents.",
    },
    {
      id: "logs",
      name: "Log Analyst Agent",
      role: "Reads container logs from previous instances",
      icon: "ScrollText",
      color: "#38bdf8",
      kind: "investigator",
      tools: [
        {
          name: "kubectl_logs",
          args: { pod: "video-transcoder-5d8-9wz", previous: true, tail: 20 },
          output:
            "[ffmpeg] loading job 88231 (4K HDR, 2160p60)\n[worker] allocating frame buffers: 3 x 410MB\n[worker] RSS 498Mi... 507Mi...\n<process killed>",
        },
      ],
      fallback:
        "The previous container logs show a 4K HDR job allocating 3 × 410MB frame buffers. RSS climbs to about 507Mi and then the process is killed. 4K jobs need roughly 1.3–1.6Gi at peak, so the 512Mi limit is far too small.",
    },
    {
      id: "events",
      name: "Events Agent",
      role: "Analyses cluster events and node pressure",
      icon: "Radar",
      color: "#a78bfa",
      kind: "investigator",
      tools: [
        {
          name: "kubectl_get_events",
          args: { namespace: "media", since: "30m" },
          output:
            "20:52 Normal  ScalingReplicaSet  Scaled up replica set video-transcoder-5d8 to 8\n20:53 Warning OOMKilling        Memory cgroup out of memory: Killed process (ffmpeg)\n20:54 Warning BackOff           Back-off restarting failed container",
        },
        {
          name: "kubectl_top_nodes",
          args: { pool: "media-pool" },
          output: "media-pool nodes: 4  MEM 31% avg  CPU 22% avg  (no node pressure)",
        },
      ],
      fallback:
        "A new ReplicaSet (5d8) rolled out at 20:52, and OOMKilling events started one minute later. The media-pool nodes are at 31% memory with no node pressure, so the kills come from the container cgroup limit, not the node.",
    },
    {
      id: "config",
      name: "Config Analyst (GitOps)",
      role: "Diffs manifests in Git and Argo CD history",
      icon: "GitCompare",
      color: "#f472b6",
      kind: "analyst",
      tools: [
        {
          name: "argocd_app_history",
          args: { app: "video-transcoder-prod" },
          output: "rev 3e1a9f0  20:51Z  'chore(cost): right-size media workloads' by finops-bot (PR #233)",
        },
        {
          name: "git_diff",
          args: { commit: "3e1a9f0", path: "apps/media/transcoder/deployment.yaml" },
          output:
            "resources:\n  requests:\n-   memory: 1536Mi\n+   memory: 512Mi\n  limits:\n-   memory: 2Gi\n+   memory: 512Mi",
        },
      ],
      fallback:
        "Argo CD synced commit 3e1a9f0 at 20:51, 'right-size media workloads' (PR #233 by finops-bot). It cut the memory request from 1536Mi to 512Mi and the limit from 2Gi to 512Mi. The right-sizing used 7-day average memory, which ignores peaks from 4K jobs.",
    },
    {
      id: "rca",
      name: "Root Cause Analyst",
      role: "Builds the causal chain and remediation options",
      icon: "Microscope",
      color: "#fbbf24",
      kind: "planner",
      instructions:
        "Give the root cause with confidence, then compare 2 remediation options (revert vs. patch), recommend one and state its risk.",
      fallback:
        "Root cause (confidence 96%): PR #233 lowered the memory limit to 512Mi using average memory, but 4K jobs peak around 1.5Gi, so ffmpeg is OOMKilled. Options: (A) git revert 3e1a9f0 through Argo CD; (B) kubectl patch directly, which causes drift from Git. Recommend A: it keeps GitOps as the source of truth and is risk MEDIUM, limited to one deployment.",
    },
    {
      id: "human",
      name: "Human Approval Gate",
      role: "Platform engineer approves the GitOps revert",
      icon: "UserCheck",
      color: "#f8fafc",
      kind: "human",
      fallback: "",
    },
    {
      id: "executor",
      name: "GitOps Executor Agent",
      role: "Applies the change via Git and Argo CD",
      icon: "Rocket",
      color: "#4ade80",
      kind: "executor",
      tools: [
        {
          name: "git_revert",
          args: { commit: "3e1a9f0", repo: "platform-gitops", push: "main" },
          output: "[main 7c2d114] Revert 'chore(cost): right-size media workloads' (agent, approved)",
        },
        {
          name: "argocd_app_sync",
          args: { app: "video-transcoder-prod", prune: false },
          output: "Sync OK: deployment.apps/video-transcoder configured (memory limit 2Gi)\nHealth: Progressing → Healthy",
        },
      ],
      fallback:
        "Pushed the revert commit 7c2d114 to platform-gitops/main and synced Argo CD with prune disabled. The deployment now has memory request 1536Mi and limit 2Gi, and the rollout is progressing to Healthy.",
    },
    {
      id: "validator",
      name: "Validation Agent",
      role: "Verifies pods, restarts and queue drain",
      icon: "BadgeCheck",
      color: "#2dd4bf",
      kind: "validator",
      tools: [
        {
          name: "kubectl_get_deploy",
          args: { name: "video-transcoder", namespace: "media" },
          output: "READY 8/8  UP-TO-DATE 8  AVAILABLE 8  restarts(10m)=0",
        },
        {
          name: "query_metrics",
          args: { metric: "transcode_queue_depth" },
          output: "12,480 → 6,210 → 1,904 → 212 (draining at ~1.1k jobs/min)\npeak container memory (4K job): 1.46Gi / 2Gi",
        },
      ],
      fallback:
        "8/8 replicas are available with zero restarts in 10 minutes. The upload queue is draining from 12,480 to 212 jobs. A 4K job peaked at 1.46Gi against the 2Gi limit, which confirms the hypothesis. Service restored.",
    },
    {
      id: "reporter",
      name: "Postmortem Agent",
      role: "Writes the incident summary",
      icon: "FileText",
      color: "#e879f9",
      kind: "reporter",
      fallback: "",
    },
  ],
  remediation: {
    title: "Revert commit 3e1a9f0 (memory right-sizing) via Argo CD",
    command: "git revert 3e1a9f0 && git push && argocd app sync video-transcoder-prod",
    risk: "medium",
    blastRadius: "1 deployment (media/video-transcoder), 8 pods; no other workloads in PR #233 affected",
    rollbackPlan: "Re-apply PR #233 with p99-based sizing (1.6Gi request / 2Gi limit)",
    guardrails: [
      { check: "GitOps only", pass: true, detail: "Change flows through Git; no direct kubectl mutation" },
      { check: "Environment boundary", pass: true, detail: "Namespace media in gke-prod-eu-west1" },
      { check: "Capacity check", pass: true, detail: "media-pool has 69% free memory for 2Gi limits" },
      { check: "Audit logging", pass: true, detail: "Commit signed by agent identity + approver" },
    ],
  },
  metric: {
    name: "Available replicas",
    unit: "",
    threshold: 8,
    badWhen: "lower",
    before: [8, 8, 8, 8, 6, 4, 2, 1, 0, 0, 0],
    after: [1, 3, 6, 8, 8, 8],
  },
  lessons: [
    "Right-size memory from p99 and peak usage, not 7-day averages",
    "FinOps bots should open PRs that need workload-owner approval",
    "Add a canary stage to Argo CD for resource changes",
  ],
};
