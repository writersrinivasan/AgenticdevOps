import { notFound } from "next/navigation";
import { getScenario, scenarios } from "@/lib/scenarios";
import { LabRunner } from "@/components/lab/LabRunner";

export function generateStaticParams() {
  return scenarios.map((s) => ({ scenarioId: s.id }));
}

export default async function LabScenarioPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  if (!getScenario(scenarioId)) notFound();
  return <LabRunner scenarioId={scenarioId} key={scenarioId} />;
}
