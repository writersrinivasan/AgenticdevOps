import { notFound } from "next/navigation";
import { modules, getModule } from "@/lib/course";
import { ModuleView } from "@/components/learn/ModuleView";

export function generateStaticParams() {
  return modules.map((m) => ({ moduleId: m.id }));
}

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const mod = getModule(moduleId);
  if (!mod) notFound();
  return <ModuleView moduleId={mod.id} />;
}
