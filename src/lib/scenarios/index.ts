import type { Scenario } from "../types";
import { checkout500 } from "./checkout-500";
import { ciBuildFailure } from "./ci-build-failure";
import { k8sCrashloop } from "./k8s-crashloop";
import { apiLatency } from "./api-latency";
import { terraformDrift } from "./terraform-drift";

export const scenarios: Scenario[] = [
  ciBuildFailure,
  k8sCrashloop,
  apiLatency,
  checkout500,
  terraformDrift,
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}

/** Agents a given agent hands its findings to (the next stage). */
export function downstreamOf(s: Scenario, agentId: string): string[] {
  const idx = s.stages.findIndex((st) => st.includes(agentId));
  return idx >= 0 && idx < s.stages.length - 1 ? s.stages[idx + 1] : [];
}
