"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  FlaskConical,
  Lightbulb,
  MessagesSquare,
  Pause,
  Play,
  RotateCcw,
  Target,
  Timer,
} from "lucide-react";
import { getModule, modules } from "@/lib/course";
import { getScenario } from "@/lib/scenarios";
import { Icon } from "../ui/Icon";
import { useProgress } from "../providers";
import { VisualBlock } from "./Visuals";
import { Quiz } from "./Quiz";

export function ModuleView({ moduleId }: { moduleId: string }) {
  const mod = getModule(moduleId)!;
  const idx = modules.findIndex((m) => m.id === mod.id);
  const prev = modules[idx - 1];
  const next = modules[idx + 1];
  const { completed, toggle } = useProgress();
  const done = completed.includes(mod.id);
  const lab = mod.lab ? getScenario(mod.lab.scenarioId) : undefined;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-4 pb-24 pt-6 lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:block">
        <div className="scroll-thin sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
          <Link href="/learn" className="mb-3 flex items-center gap-2 text-sm text-muted hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All modules
          </Link>
          {[1, 2].map((day) => (
            <div key={day} className="mb-4">
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-widest text-faint">Day {day}</div>
              {modules
                .filter((m) => m.day === day)
                .map((m) => (
                  <Link
                    key={m.id}
                    href={`/learn/${m.id}`}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      m.id === mod.id ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {completed.includes(m.id) ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0" style={{ color: m.color }} />
                    )}
                    <span className="truncate">
                      {m.number}. {m.title}
                    </span>
                  </Link>
                ))}
            </div>
          ))}
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-widest text-faint">On this page</div>
            {mod.sections.map((s) => (
              <a key={s.id} href={`#s-${s.id}`} className="block truncate rounded px-2 py-1 text-xs text-muted hover:text-white">
                {s.id.replace(/[a-z]$/, "")} {s.title}
              </a>
            ))}
          </div>
        </div>
      </aside>

      <article className="min-w-0">
        {/* Header */}
        <header className="relative mb-8 overflow-hidden rounded-3xl border border-line p-6 md:p-8" style={{ background: `linear-gradient(135deg, ${mod.color}30, transparent 60%)` }}>
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative flex flex-wrap items-start gap-5">
            <span className="grid h-16 w-16 place-items-center rounded-2xl shadow-xl" style={{ background: mod.color, color: "#0b0b14" }}>
              <Icon name={mod.icon} className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: mod.color }}>
                Day {mod.day} · Module {mod.number}
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">{mod.title}</h1>
              <p className="mt-2 text-lg text-muted">{mod.tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {mod.minutes} minutes</span>
                <span>{mod.sections.length} sections</span>
              </div>
            </div>
            <PresenterTimer minutes={mod.minutes} color={mod.color} key={mod.id} />
          </div>
          <div className="relative mt-6 grid gap-2 sm:grid-cols-2">
            {mod.objectives.map((o) => (
              <div key={o} className="flex items-start gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm">
                <Target className="mt-0.5 h-4 w-4 shrink-0" style={{ color: mod.color }} /> {o}
              </div>
            ))}
          </div>
        </header>

        {/* Sections */}
        <div className="space-y-10">
          {mod.sections.map((s) => (
            <section key={s.id} id={`s-${s.id}`} className="scroll-mt-20">
              <div className="mb-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm font-bold" style={{ color: mod.color }}>
                    {s.id.replace(/[a-z]$/, "")}
                  </span>
                  <h2 className="text-2xl font-semibold">{s.title}</h2>
                </div>
                <p className="mt-1 max-w-3xl text-muted">{s.lead}</p>
              </div>
              <div className="glass rounded-2xl p-4 md:p-6">
                <VisualBlock visual={s.visual} accent={mod.color} />
              </div>
              {s.note && (
                <div className="mt-3 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">
                  <Lightbulb className="h-5 w-5 shrink-0 text-amber-300" />
                  <span>{s.note}</span>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Lab CTA */}
        {lab && mod.lab && (
          <Link
            href={`/lab/${lab.id}`}
            className={`group mt-10 flex flex-wrap items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r ${lab.gradient} p-[1px]`}
          >
            <div className="flex w-full items-center gap-4 rounded-2xl bg-bg/85 px-5 py-4">
              <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${lab.gradient} text-white`}>
                <FlaskConical className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted">Try it in the Live Agent Lab</div>
                <div className="font-semibold">{mod.lab.label}</div>
                <div className="text-sm text-muted">{lab.industry} · {lab.agents.length} agents · {lab.severity}</div>
              </div>
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </div>
          </Link>
        )}

        {/* Takeaways + quiz */}
        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          <div className="glass rounded-2xl p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Key takeaways
            </h3>
            <ul className="space-y-2">
              {mod.takeaways.map((t) => (
                <li key={t} className="flex gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: mod.color }} /> {t}
                </li>
              ))}
            </ul>
            {mod.discussion && (
              <>
                <h3 className="mb-2 mt-6 flex items-center gap-2 font-semibold">
                  <MessagesSquare className="h-5 w-5 text-cyan-300" /> Discussion
                </h3>
                <ul className="space-y-2">
                  {mod.discussion.map((d) => (
                    <li key={d} className="rounded-lg bg-white/5 px-3 py-2 text-sm italic">“{d}”</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <Quiz moduleId={mod.id} questions={mod.quiz} color={mod.color} />
        </div>

        {/* Footer nav */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          {prev ? (
            <Link href={`/learn/${prev.id}`} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm hover:bg-white/5">
              <ArrowLeft className="h-4 w-4" /> {prev.number}. {prev.title}
            </Link>
          ) : <span />}
          <button
            onClick={() => toggle(mod.id)}
            className={`mx-auto flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold ${
              done ? "bg-emerald-400/15 text-emerald-300" : "bg-white text-black"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" /> {done ? "Completed ✓" : "Mark module complete"}
          </button>
          {next ? (
            <Link href={`/learn/${next.id}`} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm hover:bg-white/5">
              {next.number}. {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/lab" className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm hover:bg-white/5">
              Go to the Lab <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}

/** Countdown for the facilitator to keep each module on time. */
function PresenterTimer({ minutes, color }: { minutes: number; color: string }) {
  const total = minutes * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);
  const pct = left / total;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const warn = pct < 0.15;

  return (
    <div className="rounded-2xl border border-line bg-black/30 px-4 py-3">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-faint">
        <Timer className="h-3.5 w-3.5" /> Session timer
      </div>
      <div className={`font-mono text-3xl font-bold tabular-nums ${warn ? "text-red-400" : ""}`}>
        {mm}:{ss}
      </div>
      <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: warn ? "#f87171" : color }} />
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => setRunning((r) => !r)} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
          {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />} {running ? "Pause" : "Start"}
        </button>
        <button onClick={() => { setLeft(total); setRunning(false); }} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-white">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
    </div>
  );
}
