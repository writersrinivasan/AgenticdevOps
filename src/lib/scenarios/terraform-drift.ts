import type { Scenario } from "../types";

// Module 6.2 / 6.4 / 11: IaC drift + cloud security + governance.
export const terraformDrift: Scenario = {
  id: "terraform-drift",
  title: "Infrastructure drift exposes a patient database",
  industry: "Healthcare",
  company: "MediCore (fictional)",
  service: "patient-portal (AWS)",
  icon: "Cloud",
  gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
  accent: "#a855f7",
  severity: "SEV1",
  summary:
    "A nightly drift-detection run finds that production no longer matches Terraform. Someone opened the patient-records database security group to the internet during a late-night debug session. IaC, security, compliance and audit agents work together, and the fix is applied through Terraform with a full audit trail.",
  alert: {
    title: "Terraform drift: aws_security_group.portal_db modified outside IaC",
    source: "Scheduled drift detection (terraform plan -detailed-exitcode)",
    time: "02:30 UTC",
    details: "workspace=prod-us-east-1 exit_code=2 resources_changed=2 data_class=PHI",
  },
  modules: ["m6", "m11", "m12"],
  stages: [
    ["iac"],
    ["security", "audit", "compliance"],
    ["planner"],
    ["human"],
    ["executor"],
    ["validator"],
    ["reporter"],
  ],
  agents: [
    {
      id: "iac",
      name: "IaC Agent",
      role: "Runs Terraform plan and explains the drift",
      icon: "Boxes",
      color: "#c084fc",
      kind: "supervisor",
      tools: [
        {
          name: "terraform_plan",
          args: { workspace: "prod-us-east-1", refresh_only: true },
          output:
            "~ aws_security_group.portal_db\n    ~ ingress: + { from_port=5432 to_port=5432 cidr_blocks=[\"0.0.0.0/0\"] description=\"debug-temp\" }\n~ aws_db_instance.patients\n    ~ publicly_accessible: false → true\nPlan: 0 to add, 2 to change, 0 to destroy.",
        },
      ],
      fallback:
        "Drift found in 2 production resources. Security group portal_db has a new ingress rule allowing 0.0.0.0/0 on 5432 ('debug-temp'), and RDS instance 'patients' was switched to publicly_accessible=true. Together they expose the PHI database to the internet. Delegating to the Security, Audit and Compliance agents.",
    },
    {
      id: "security",
      name: "Security Agent",
      role: "Assesses exposure and active threats",
      icon: "ShieldAlert",
      color: "#f87171",
      kind: "investigator",
      tools: [
        {
          name: "cspm_findings",
          args: { resource: "sg-0a91portal", severity: "critical" },
          output: "CRITICAL: SG allows 0.0.0.0/0 to PostgreSQL (CIS AWS 5.2)\nCRITICAL: RDS instance publicly accessible (CIS AWS 2.3.3)",
        },
        {
          name: "vpc_flow_logs",
          args: { eni: "rds-patients", since: "4h", action: "ACCEPT", external: true },
          output: "1,284 inbound connection attempts from 37 external IPs (scanners)\nsuccessful auth: 0 | failed auth: 211 (pg_hba)",
        },
      ],
      fallback:
        "Two CRITICAL CSPM findings (CIS 5.2, 2.3.3). Flow logs show 1,284 inbound attempts from 37 external scanner IPs in 4 hours, with 211 failed and 0 successful authentications. There is no evidence of data access yet, but brute-force attempts are active, so close the exposure immediately.",
    },
    {
      id: "audit",
      name: "Audit Agent",
      role: "Traces who made the change (CloudTrail)",
      icon: "FingerprintPattern",
      color: "#38bdf8",
      kind: "investigator",
      tools: [
        {
          name: "cloudtrail_lookup",
          args: { resource: "sg-0a91portal", event: "AuthorizeSecurityGroupIngress" },
          output:
            "22:47Z AuthorizeSecurityGroupIngress by assumed-role/BreakGlassAdmin/j.doe (console)\n22:49Z ModifyDBInstance PubliclyAccessible=true by same principal\nticket reference: none",
        },
      ],
      fallback:
        "CloudTrail shows both changes were made at 22:47–22:49 UTC by the BreakGlassAdmin role (session j.doe) from the console, with no change ticket. It looks like a manual debugging shortcut rather than an attack, but break-glass use without a ticket breaks policy.",
    },
    {
      id: "compliance",
      name: "Compliance Agent",
      role: "Maps impact to HIPAA / SOC 2 controls",
      icon: "Scale",
      color: "#facc15",
      kind: "investigator",
      tools: [
        {
          name: "policy_check",
          args: { frameworks: "HIPAA,SOC2", data_class: "PHI" },
          output:
            "HIPAA §164.312(e)(1) Transmission security: VIOLATED\nSOC2 CC6.6 Boundary protection: VIOLATED\nBreach-assessment clock: started 22:47Z (exposure window 3h43m)",
        },
      ],
      fallback:
        "This violates HIPAA §164.312(e)(1) (transmission security) and SOC 2 CC6.6 (boundary protection). The PHI exposure window is 3h43m and growing. The privacy officer must be notified to start a breach risk assessment, though no successful logins have been seen so far.",
    },
    {
      id: "planner",
      name: "Remediation Planner",
      role: "Plans an IaC-native fix with minimal blast radius",
      icon: "ClipboardList",
      color: "#fb923c",
      kind: "planner",
      instructions:
        "Recommend a remediation that restores the Terraform desired state, explain why it must go through IaC rather than the console, list follow-ups, and give the risk level.",
      fallback:
        "Recommend a targeted terraform apply on aws_security_group.portal_db and aws_db_instance.patients to restore the desired state: remove the 0.0.0.0/0 rule and set publicly_accessible=false. Using IaC keeps state consistent and auditable. Risk is MEDIUM: private app-tier access is unaffected. Follow-ups: revoke the j.doe break-glass session and notify the privacy officer.",
    },
    {
      id: "human",
      name: "Human Approval Gate",
      role: "Security lead approves terraform apply",
      icon: "UserCheck",
      color: "#f8fafc",
      kind: "human",
      fallback: "",
    },
    {
      id: "executor",
      name: "Terraform Executor",
      role: "Applies the approved plan from a sandboxed runner",
      icon: "Rocket",
      color: "#4ade80",
      kind: "executor",
      tools: [
        {
          name: "terraform_apply",
          args: {
            workspace: "prod-us-east-1",
            target: "aws_security_group.portal_db,aws_db_instance.patients",
            plan_file: "drift-fix.tfplan",
          },
          output:
            "aws_security_group.portal_db: Modifying... [removed ingress 0.0.0.0/0:5432]\naws_db_instance.patients: Modifying... [publicly_accessible=false]\nApply complete! Resources: 0 added, 2 changed, 0 destroyed.",
        },
        {
          name: "revoke_session",
          args: { role: "BreakGlassAdmin", session: "j.doe" },
          output: "Session revoked; incident ticket SEC-4471 created and assigned to security-lead",
        },
      ],
      fallback:
        "Applied the saved plan drift-fix.tfplan from the sandboxed runner: removed the 0.0.0.0/0 ingress and set RDS publicly_accessible=false. Revoked the j.doe break-glass session and opened SEC-4471.",
    },
    {
      id: "validator",
      name: "Validation Agent",
      role: "Re-plans and probes externally",
      icon: "BadgeCheck",
      color: "#2dd4bf",
      kind: "validator",
      tools: [
        {
          name: "terraform_plan",
          args: { workspace: "prod-us-east-1" },
          output: "No changes. Your infrastructure matches the configuration.",
        },
        {
          name: "external_port_probe",
          args: { host: "patients.xxxx.rds.amazonaws.com", port: 5432 },
          output: "filtered (no route) | app-tier health checks: 100% OK",
        },
      ],
      fallback:
        "terraform plan reports no changes, so infrastructure matches code again. An external probe to port 5432 is filtered, while all app-tier health checks pass. The exposure is closed and patient-portal is unaffected.",
    },
    {
      id: "reporter",
      name: "Compliance Reporter",
      role: "Produces the incident and audit report",
      icon: "FileText",
      color: "#e879f9",
      kind: "reporter",
      fallback: "",
    },
  ],
  remediation: {
    title: "terraform apply (targeted) to restore SG + RDS desired state",
    command:
      "terraform apply -target=aws_security_group.portal_db -target=aws_db_instance.patients drift-fix.tfplan",
    risk: "medium",
    blastRadius: "2 resources in prod-us-east-1; private app-tier access unchanged",
    rollbackPlan: "Re-apply previous state file version (S3 versioned backend) if app connectivity breaks",
    guardrails: [
      { check: "Plan/apply separation", pass: true, detail: "Applying the exact reviewed plan file" },
      { check: "Sandboxed runner", pass: true, detail: "Ephemeral runner with OIDC role, no static keys" },
      { check: "Secrets management", pass: true, detail: "DB credentials untouched; fetched from Vault only by app" },
      { check: "Audit trail", pass: true, detail: "CloudTrail + agent action log + approver identity" },
    ],
  },
  metric: {
    name: "Cloud security risk score",
    unit: "",
    threshold: 20,
    badWhen: "higher",
    before: [8, 8, 9, 8, 8, 64, 92, 92, 93, 92],
    after: [92, 41, 9, 8],
  },
  lessons: [
    "Break-glass sessions must require a ticket and auto-expire after 60 minutes",
    "Use an SCP to deny 0.0.0.0/0 ingress on data-tier security groups",
    "Run drift detection hourly for PHI workloads instead of nightly",
  ],
};
