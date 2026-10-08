# Agentic DevOps Academy

A two-part web app for the **5-hour Agentic DevOps training** (Day 1 + Day 2, 2.5h each):

1. **Learning Portal** (`/learn`): 12 interactive modules that follow the course outline. They include animated lifecycle loops, agent-anatomy hubs, pipelines, risk tiers, the maturity ladder, Python/TypeScript LangGraph starter code, knowledge checks, a presenter countdown timer per module and progress tracking.
2. **Live Agent Lab** (`/lab`): real-world incidents worked through by **multi-agent LangGraph workflows** with reasoning on **Groq**. You watch agents fan out in parallel, call tools, message each other, merge evidence, pause at a **human approval gate** (`interrupt()`), execute, validate recovery on a live chart and write the post-incident report.

Plus **Agent Ops Copilot**, a LangGraph ReAct assistant (Groq + tools over the course and lab content), available on every page.

## Quick start

```bash
npm install
cp .env.example .env.local      # then paste your key: GROQ_API_KEY=gsk_...
npm run dev                     # http://localhost:3000
```

With no key, everything still works. The lab runs in **simulated mode** with scripted agent reasoning, which is useful as an offline fallback in the training room. You can also paste a key at runtime via the ⚙️ icon in the top bar. It is stored only in that browser.

For the session itself, use a production build (it's faster and smoother):

```bash
npm run build && npm start
```

## Lab scenarios

| Scenario | Industry | Highlights | Fix risk |
|---|---|---|---|
| Broken main after a dependency bump | FinTech | Build Failure Resolution Agent (Day 1 hands-on) | low |
| Transcoder pods in CrashLoopBackOff | Media | Kubernetes troubleshooting path, GitOps revert | medium |
| Accounts API latency +300% | Banking | 9-step investigation, DB agent, high-risk gate | high |
| Checkout API returning HTTP 500s | E-commerce | **Capstone**: 12 agents, 4 in parallel, runbook RAG | medium |
| Drift exposes a patient database | Healthcare | IaC + security + compliance + CloudTrail audit | medium |

**Facilitator tricks**
- **Human-in-the-loop vs Autonomous** toggle: LOW risk auto-approves, MEDIUM needs approval, HIGH always needs a human (Module 8.4).
- **Reject** the remediation to show conditional routing to escalation.
- **Run a scenario twice.** The Knowledge Agent recalls the earlier run from long-term incident memory (Module 9.3).
- **Speed** 1× / 2× / 4×, and `?autorun=1&speed=2&mode=autonomous` in the URL starts a run on page load.

## How it's built

```
src/lib/scenarios/*.ts        Scenario data: agents, tools + outputs, stages, remediation, guardrails, metrics
src/lib/agents/lab-graph.ts   Compiles a scenario into a LangGraph StateGraph:
                              parallel fan-out/fan-in, interrupt() approval gate, conditional
                              routing, MemorySaver checkpointer, reducers, long-term memory
src/lib/agents/assistant-graph.ts  ReAct assistant: ChatGroq.bindTools + ToolNode loop
src/app/api/lab/run           SSE stream of agent events (config.writer -> streamMode "custom"); resumes with Command({resume})
src/app/api/assistant         NDJSON token stream (streamMode "messages")
src/lib/course.ts             All 12 modules of course content
src/components/lab/*          React Flow agent graph, comms feed, metrics, inspector, audit trail, approval modal
```

Tool outputs in the lab are realistic **simulated** telemetry, so no real cluster, cloud or repo is touched. The LLM reasoning over that telemetry is real when a Groq key is configured.

Environment variables: `GROQ_API_KEY` (required for live LLM), `GROQ_MODEL` (default `openai/gpt-oss-120b`).
