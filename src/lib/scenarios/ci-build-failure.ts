import type { Scenario } from "../types";

// Day 1 (Module 3.5 + Module 5): Build Failure Resolution Agent.
export const ciBuildFailure: Scenario = {
  id: "ci-build-failure",
  title: "Broken main branch after a dependency bump",
  industry: "FinTech / Payments",
  company: "PayFlow (fictional)",
  service: "payments-service",
  icon: "Hammer",
  gradient: "from-sky-500 via-indigo-500 to-violet-500",
  accent: "#6366f1",
  severity: "SEV3",
  summary:
    "A Dependabot PR bumped pydantic from 1.10 to 2.7 and was auto-merged. The main branch is now red, and 37 tests fail in CI. Agents detect the failure, read the logs, find the breaking change, write a patch, run tests and security scans, request approval and re-run the pipeline.",
  alert: {
    title: "GitHub Actions: build #4821 failed on main (payments-service)",
    source: "GitHub webhook → CI Agent",
    time: "09:41 UTC",
    details: "workflow=ci.yml job=test conclusion=failure commit=a91c2e4 'Bump pydantic from 1.10.13 to 2.7.1 (#612)'",
  },
  modules: ["m3", "m4", "m5"],
  stages: [
    ["ci"],
    ["logs", "repo"],
    ["code"],
    ["test", "security"],
    ["human"],
    ["executor"],
    ["validator"],
    ["reporter"],
  ],
  agents: [
    {
      id: "ci",
      name: "CI Agent",
      role: "Detects the failed build and gathers pipeline context",
      icon: "Workflow",
      color: "#818cf8",
      kind: "supervisor",
      tools: [
        {
          name: "gh_run_view",
          args: { run_id: 4821, repo: "payflow/payments-service" },
          output:
            "build #4821  main  a91c2e4  FAILED in 3m12s\n  ✓ lint (24s)\n  ✓ build (51s)\n  ✗ test (1m47s)  37 failed, 211 passed\n  - security-scan (skipped)\nprevious run #4820 on 7be01f3: SUCCESS",
        },
      ],
      instructions:
        "Summarise what failed, what changed since the last green build, and delegate to the Log Analyst and Repository Agent.",
      fallback:
        "Build #4821 on main failed in the test stage: 37 failed, 211 passed. Lint and build passed. The last green run (#4820) was one commit earlier, so the only change is a91c2e4, Dependabot's pydantic bump 1.10.13 → 2.7.1. Delegating: Log Analyst → failure signatures; Repository Agent → where pydantic is used.",
    },
    {
      id: "logs",
      name: "Log Analyst Agent",
      role: "Parses the CI logs for failure signatures",
      icon: "ScrollText",
      color: "#38bdf8",
      kind: "investigator",
      tools: [
        {
          name: "gh_run_logs",
          args: { run_id: 4821, job: "test", grep: "Error" },
          output:
            "tests/test_settings.py:3: in <module>\n    from pydantic import BaseSettings\nE   pydantic.errors.PydanticImportError: `BaseSettings` has been moved to the `pydantic-settings` package.\n... 37 errors share the same import chain: app/config.py:4",
        },
      ],
      fallback:
        "All 37 failures share one error: PydanticImportError: `BaseSettings` has been moved to the `pydantic-settings` package. They are collection errors from importing app/config.py line 4, not assertion failures, so the business logic is probably fine.",
    },
    {
      id: "repo",
      name: "Repository Agent",
      role: "Navigates the codebase and analyses dependencies",
      icon: "FolderGit2",
      color: "#f472b6",
      kind: "investigator",
      tools: [
        {
          name: "grep_repo",
          args: { pattern: "from pydantic import|\\.dict\\(|parse_obj", path: "app/" },
          output:
            "app/config.py:4      from pydantic import BaseSettings, Field\napp/models/payment.py:2  from pydantic import BaseModel, validator\napp/api/routes.py:88  payload.dict(exclude_none=True)\napp/api/routes.py:121 PaymentRequest.parse_obj(body)",
        },
        {
          name: "read_file",
          args: { path: "requirements.txt" },
          output: "fastapi==0.111.0\npydantic==2.7.1\nuvicorn==0.29.0\nsqlalchemy==2.0.30",
        },
      ],
      fallback:
        "pydantic is used in 3 files. The hard break is app/config.py (BaseSettings import). Deprecated but working in v2: @validator in models/payment.py, plus .dict() and parse_obj() in routes.py. requirements.txt is missing pydantic-settings.",
    },
    {
      id: "code",
      name: "Coding Agent",
      role: "Generates the minimal patch",
      icon: "CodeXml",
      color: "#fbbf24",
      kind: "planner",
      tools: [
        {
          name: "create_patch",
          args: { branch: "fix/pydantic-v2-settings", files: 3 },
          output:
            "app/config.py\n-from pydantic import BaseSettings, Field\n+from pydantic import Field\n+from pydantic_settings import BaseSettings\nrequirements.txt\n+pydantic-settings==2.3.4\napp/api/routes.py\n-payload.dict(exclude_none=True)\n+payload.model_dump(exclude_none=True)\n-PaymentRequest.parse_obj(body)\n+PaymentRequest.model_validate(body)",
        },
      ],
      instructions:
        "Describe the minimal patch, why it is minimal, and what you deliberately left out of scope.",
      fallback:
        "Patch on branch fix/pydantic-v2-settings: import BaseSettings from pydantic_settings, add pydantic-settings==2.3.4, and migrate .dict()/parse_obj() to model_dump()/model_validate(). The @validator → @field_validator migration is left for a follow-up PR so this fix stays small and easy to review.",
    },
    {
      id: "test",
      name: "Test Agent",
      role: "Runs the suite in a sandbox and selects impacted tests",
      icon: "FlaskConical",
      color: "#34d399",
      kind: "investigator",
      tools: [
        {
          name: "run_tests",
          args: { cmd: "pytest -q", sandbox: "docker:python3.12" },
          output: "248 passed, 3 warnings in 41.2s\nwarnings: PydanticDeprecatedSince20 @validator (models/payment.py:17)",
        },
        {
          name: "coverage",
          args: { report: "diff" },
          output: "total 87.4% (+0.0) | changed lines covered 100%",
        },
      ],
      fallback:
        "All 248 tests pass in the sandbox (python 3.12) in 41s. 3 deprecation warnings remain for @validator, which is expected and tracked. Coverage stays at 87.4%, and every changed line is covered.",
    },
    {
      id: "security",
      name: "Security Agent",
      role: "Scans dependencies and licences",
      icon: "ShieldCheck",
      color: "#f87171",
      kind: "investigator",
      tools: [
        {
          name: "pip_audit",
          args: { requirements: "requirements.txt" },
          output: "No known vulnerabilities found (pydantic 2.7.1, pydantic-settings 2.3.4)",
        },
        {
          name: "license_check",
          args: { new_deps: "pydantic-settings" },
          output: "pydantic-settings: MIT ✓ (allowed)",
        },
      ],
      fallback:
        "pip-audit found no known CVEs in pydantic 2.7.1 or pydantic-settings 2.3.4. The new dependency is MIT-licensed, which is on the allowlist. No secrets appear in the diff. Security gate: PASS.",
    },
    {
      id: "human",
      name: "Human Approval Gate",
      role: "Tech lead approves merge to main",
      icon: "UserCheck",
      color: "#f8fafc",
      kind: "human",
      fallback: "",
    },
    {
      id: "executor",
      name: "Release Agent",
      role: "Opens the PR, merges and re-runs the pipeline",
      icon: "GitPullRequestArrow",
      color: "#4ade80",
      kind: "executor",
      tools: [
        {
          name: "gh_pr_create",
          args: { head: "fix/pydantic-v2-settings", base: "main", labels: "agent-generated,deps" },
          output: "Created PR #614 'fix: migrate settings to pydantic-settings for pydantic v2'",
        },
        {
          name: "gh_workflow_run",
          args: { workflow: "ci.yml", ref: "fix/pydantic-v2-settings" },
          output: "run #4823 queued → in_progress",
        },
      ],
      fallback:
        "Opened PR #614 with an AI-generated description and labels agent-generated and deps, then triggered pipeline run #4823 on the fix branch. Merge happens automatically when checks pass, per the approved policy.",
    },
    {
      id: "validator",
      name: "Validation Agent",
      role: "Confirms the pipeline is green",
      icon: "BadgeCheck",
      color: "#2dd4bf",
      kind: "validator",
      tools: [
        {
          name: "gh_run_view",
          args: { run_id: 4823 },
          output: "build #4823 SUCCESS in 3m31s\n  ✓ lint ✓ build ✓ test (248 passed) ✓ security-scan ✓ container-image",
        },
      ],
      fallback:
        "Pipeline #4823 is green in 3m31s: lint, build, 248 tests, the security scan and the container image all passed. PR #614 auto-merged, and main is healthy again.",
    },
    {
      id: "reporter",
      name: "Summary Agent",
      role: "Writes the execution summary and PR notes",
      icon: "FileText",
      color: "#e879f9",
      kind: "reporter",
      fallback: "",
    },
  ],
  remediation: {
    title: "Open PR #614 with the pydantic v2 fix and re-run CI",
    command: "gh pr create --fill && gh pr merge --auto --squash && gh workflow run ci.yml",
    risk: "low",
    blastRadius: "Non-production: feature branch + CI only; merge gated by required checks",
    rollbackPlan: "git revert of the squash commit; pin pydantic<2 as a fallback",
    guardrails: [
      { check: "Action allowlist", pass: true, detail: "PR creation + workflow dispatch allowed for Release Agent" },
      { check: "Sandboxed execution", pass: true, detail: "Tests ran in an isolated Docker sandbox" },
      { check: "Branch protection", pass: true, detail: "Required checks + CODEOWNERS still enforced" },
      { check: "Secrets scan", pass: true, detail: "No credentials in diff (gitleaks)" },
    ],
  },
  metric: {
    name: "Failing tests on main",
    unit: "",
    threshold: 0,
    badWhen: "higher",
    before: [0, 0, 0, 0, 0, 37, 37, 37, 37],
    after: [37, 0, 0, 0],
  },
  lessons: [
    "Group major-version Dependabot bumps and require a human review on them",
    "Add a migration-guide lookup tool to the Coding Agent",
    "Schedule a follow-up PR for the @validator → @field_validator migration",
  ],
};
