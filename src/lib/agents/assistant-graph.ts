import "server-only";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createGroq } from "./llm";
import { getModule, modules } from "../course";
import { getScenario, scenarios } from "../scenarios";
import { getIncidentMemory } from "./lab-graph";

// ---- Tools the assistant can call (grounding in course + lab data) ----

const searchCourse = tool(
  async ({ query }) => {
    const q = query.toLowerCase();
    const hits = modules.flatMap((m) =>
      m.sections
        .filter((s) => `${s.title} ${s.lead} ${JSON.stringify(s.visual)}`.toLowerCase().includes(q))
        .map((s) => `Module ${m.number} (${m.id}) §${s.id} ${s.title}: ${s.lead}`),
    );
    return hits.slice(0, 6).join("\n") || "No direct match. Try list_modules.";
  },
  {
    name: "search_course",
    description: "Keyword search across the Agentic DevOps course sections. Use for any concept question.",
    schema: z.object({ query: z.string().describe("one or two keywords, e.g. 'guardrails' or 'drift'") }),
  },
);

const getModuleTool = tool(
  async ({ moduleId }) => {
    const m = getModule(moduleId);
    if (!m) return `Unknown module. Valid ids: ${modules.map((x) => x.id).join(", ")}`;
    const body = m.sections
      .map((s) => {
        const v = s.visual;
        const items =
          "items" in v
            ? v.items.map((i) => `  - ${i.title}${i.desc ? `: ${i.desc}` : ""}`).join("\n")
            : v.kind === "compare"
              ? `  ${v.left.title}: ${v.left.points.join("; ")}\n  ${v.right.title}: ${v.right.points.join("; ")}`
              : v.kind === "code"
                ? `  (code sample in ${v.language})`
                : "";
        return `§${s.id} ${s.title}: ${s.lead}\n${items}${s.note ? `\n  Note: ${s.note}` : ""}`;
      })
      .join("\n");
    return `Module ${m.number}: ${m.title} (Day ${m.day}, ${m.minutes} min)\n${body}\nTakeaways: ${m.takeaways.join(" | ")}`;
  },
  {
    name: "get_module",
    description: "Get the full content of a course module by id (m1..m12).",
    schema: z.object({ moduleId: z.string() }),
  },
);

const listLab = tool(
  async () =>
    scenarios
      .map((s) => `${s.id}: ${s.title} [${s.industry}, ${s.severity}], agents: ${s.agents.map((a) => a.name).join(", ")}`)
      .join("\n"),
  {
    name: "list_lab_scenarios",
    description: "List the hands-on Live Agent Lab scenarios and their agents.",
    schema: z.object({}),
  },
);

const explainScenario = tool(
  async ({ scenarioId }) => {
    const s = getScenario(scenarioId);
    if (!s) return "Unknown scenario id.";
    return `${s.title} (${s.company})\nSummary: ${s.summary}\nStages: ${s.stages.map((st) => st.join(" ‖ ")).join(" → ")}\nRemediation: ${s.remediation.title} (risk ${s.remediation.risk})\nGuardrails: ${s.remediation.guardrails.map((g) => g.check).join(", ")}`;
  },
  {
    name: "explain_scenario",
    description: "Explain how a lab scenario's LangGraph workflow is wired (stages, parallelism, remediation, guardrails).",
    schema: z.object({ scenarioId: z.string() }),
  },
);

const incidentMemory = tool(
  async () => {
    const mem = getIncidentMemory();
    return mem.length ? mem.map((m) => `${m.id} ${m.title}: ${m.rootCause} → ${m.resolution}`).join("\n") : "No incidents stored yet. Run a lab scenario first.";
  },
  {
    name: "get_incident_memory",
    description: "Read the long-term incident memory written by lab runs in this session.",
    schema: z.object({}),
  },
);

export const assistantTools = [searchCourse, getModuleTool, listLab, explainScenario, incidentMemory];

const SYSTEM = `You are "Agent Ops Copilot", the AI teaching assistant for a 5-hour training program on Agentic DevOps (Day 1: foundations, CI/CD, coding agents; Day 2: infra, observability, SRE, multi-agent, governance).
You run on LangGraph + Groq. Learners will ask about concepts, the lab scenarios, LangGraph code, and how to apply this at work.
- Use tools to ground answers in the course content or lab scenarios when relevant. Cite modules as "Module N §x.y".
- Be practical: give concrete DevOps examples (kubectl, terraform, GitHub Actions, PromQL) and short code where useful (Python LangGraph by default).
- Keep answers focused: usually under 200 words, use markdown bullets and code blocks.
- If asked something outside DevOps/AI, answer briefly and steer back to the course.`;

export function buildAssistantGraph(apiKey: string, model: string, pageContext?: string) {
  const llm = createGroq(apiKey, model, 0.4).bindTools(assistantTools);

  const callModel = async (state: typeof MessagesAnnotation.State) => {
    const sys = new SystemMessage(SYSTEM + (pageContext ? `\nThe learner is currently viewing: ${pageContext}` : ""));
    const res = await llm.invoke([sys, ...state.messages]);
    return { messages: [res] };
  };

  const route = (state: typeof MessagesAnnotation.State) => {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    return last.tool_calls?.length ? "tools" : END;
  };

  return new StateGraph(MessagesAnnotation)
    .addNode("assistant", callModel)
    .addNode("tools", new ToolNode(assistantTools))
    .addEdge(START, "assistant")
    .addConditionalEdges("assistant", route, ["tools", END])
    .addEdge("tools", "assistant")
    .compile();
}
