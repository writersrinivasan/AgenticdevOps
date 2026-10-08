"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { memo, useEffect, useMemo, useState } from "react";
import { Check, Hourglass } from "lucide-react";
import type { AgentDef, Scenario } from "@/lib/types";
import { Icon } from "../ui/Icon";
import type { LabState } from "./useLabRun";

type AgentNodeData = {
  agent: AgentDef;
  status: LabState["agents"][string]["status"];
  text: string;
  toolName?: string;
  selected: boolean;
};

const AgentNode = memo(function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const { agent, status, text, toolName, selected } = data;
  const active = status === "active";
  const waiting = status === "waiting";
  const done = status === "done";
  const isHuman = agent.kind === "human";
  const snippet = text.length > 90 ? "…" + text.slice(-90) : text;

  return (
    <div className="relative w-[172px]" style={{ ["--ring" as string]: `${agent.color}aa` }}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-white/30" />
      <div
        className={`rounded-2xl border-2 bg-panelsolid/95 px-3 py-2.5 transition-all duration-300 ${active || waiting ? "pulse-ring" : ""}`}
        style={{
          borderColor: active || waiting || selected ? agent.color : done ? `${agent.color}88` : "rgba(148,163,255,0.18)",
          boxShadow: active ? `0 0 30px ${agent.color}88` : done ? `0 0 12px ${agent.color}33` : "none",
          opacity: status === "idle" ? 0.62 : 1,
          borderStyle: isHuman ? "dashed" : "solid",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ background: active ? agent.color : `${agent.color}26`, color: active ? "#0b0b14" : agent.color }}
          >
            <Icon name={agent.icon} className="h-5 w-5" />
            {done && (
              <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 text-black">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold leading-tight text-white">{agent.name}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: agent.color }}>
              {waiting ? "awaiting human" : active ? (toolName ? "using tool" : "reasoning") : done ? "done" : agent.kind}
            </div>
          </div>
        </div>
        {active && toolName && (
          <div className="mt-1.5 truncate rounded-md bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">⚙ {toolName}()</div>
        )}
        {waiting && (
          <div className="mt-1.5 flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">
            <Hourglass className="h-3 w-3 animate-pulse" /> interrupt(): waiting for approval
          </div>
        )}
      </div>
      {active && snippet && !toolName && (
        <div className="caret absolute left-1/2 top-full z-10 mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-line bg-black/85 px-2.5 py-1.5 text-[10.5px] leading-snug text-slate-200 shadow-xl">
          {snippet}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-white/30" />
    </div>
  );
});

type PacketEdgeData = { color: string; active: boolean; done: boolean; reject?: boolean };

function PacketEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<Edge<PacketEdgeData>>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  const color = data?.reject ? "#f87171" : data?.color ?? "#64748b";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: data?.active || data?.done ? color : "rgba(148,163,255,0.22)",
          strokeWidth: data?.active ? 3 : data?.done ? 2 : 1.4,
          strokeOpacity: data?.active ? 1 : data?.done ? 0.55 : 1,
          strokeDasharray: data?.reject ? "6 6" : undefined,
          filter: data?.active ? `drop-shadow(0 0 6px ${color})` : undefined,
        }}
      />
      {data?.active && (
        <>
          <circle r={5} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
            <animateMotion dur="1.1s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r={3} fill="#fff">
            <animateMotion dur="1.1s" begin="0.35s" repeatCount="indefinite" path={path} />
          </circle>
        </>
      )}
    </>
  );
}

const nodeTypes = { agent: AgentNode };
const edgeTypes = { packet: PacketEdge };

export function AgentGraph({
  scenario,
  state,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  state: LabState;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  // Re-render every 400ms so pulses fade out after ~2.5s
  const [, tick] = useState(0);
  useEffect(() => {
    if (state.status !== "running") return;
    const t = setInterval(() => tick((x) => x + 1), 400);
    return () => clearInterval(t);
  }, [state.status]);

  const byId = useMemo(() => new Map(scenario.agents.map((a) => [a.id, a])), [scenario]);

  const computedNodes: Node<AgentNodeData>[] = useMemo(() => {
    const out: Node<AgentNodeData>[] = [];
    scenario.stages.forEach((stage, i) => {
      stage.forEach((id, j) => {
        const agent = byId.get(id)!;
        const st = state.agents[id];
        const runningTool = st?.tools.find((t) => !t.output);
        out.push({
          id,
          type: "agent",
          position: { x: i * 215, y: (j - (stage.length - 1) / 2) * 112 },
          data: {
            agent,
            status: st?.status ?? "idle",
            text: st?.text ?? "",
            toolName: st?.status === "active" ? runningTool?.tool : undefined,
            selected: selected === id,
          },
          draggable: false,
        });
      });
    });
    return out;
  }, [scenario, byId, state.agents, selected]);

  // Keep React Flow's measured dimensions: merge new data into existing nodes
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>(computedNodes);
  useEffect(() => {
    setNodes((prev) =>
      computedNodes.map((n) => {
        const p = prev.find((x) => x.id === n.id);
        return p ? { ...p, position: n.position, data: n.data } : n;
      }),
    );
  }, [computedNodes, setNodes]);

  const now = Date.now();
  const edges: Edge<PacketEdgeData>[] = useMemo(() => {
    const out: Edge<PacketEdgeData>[] = [];
    const reporterId = scenario.stages[scenario.stages.length - 1][0];
    scenario.stages.forEach((stage, i) => {
      if (i === 0) return;
      const prev = scenario.stages[i - 1];
      for (const from of prev)
        for (const to of stage) {
          const key = `${from}->${to}`;
          const pulse = state.edgePulses[key];
          out.push({
            id: key,
            source: from,
            target: to,
            type: "packet",
            data: {
              color: byId.get(from)?.color ?? "#888",
              active: !!pulse && now - pulse < 2600,
              done: !!pulse,
            },
          });
        }
    });
    // Rejection path from the human gate straight to the reporter
    const humanStage = scenario.stages.findIndex((st) => st.length === 1 && byId.get(st[0])?.kind === "human");
    if (humanStage >= 0 && humanStage < scenario.stages.length - 2) {
      const h = scenario.stages[humanStage][0];
      const pulse = state.edgePulses[`${h}->${reporterId}`];
      out.push({
        id: `${h}->${reporterId}`,
        source: h,
        target: reporterId,
        type: "packet",
        data: { color: "#f87171", reject: true, active: !!pulse && now - pulse < 2600, done: !!pulse },
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, byId, state.edgePulses, Math.floor(now / 400)]);

  return (
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      colorMode="dark"
      fitViewOptions={{ padding: 0.08 }}
      minZoom={0.3}
      maxZoom={1.6}
      nodesConnectable={false}
      elementsSelectable
      onNodeClick={(_, n) => onSelect(n.id)}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="rgba(148,163,255,0.12)" gap={22} size={1.2} />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}
