"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, FlaskConical, Trophy } from "lucide-react";
import { days, modules, totalMinutes } from "@/lib/course";
import { Icon } from "@/components/ui/Icon";
import { useProgress } from "@/components/providers";

export default function LearnHome() {
  const { completed, quizScores } = useProgress();
  const pct = Math.round((completed.length / modules.length) * 100);
  const doneMinutes = modules.filter((m) => completed.includes(m.id)).reduce((a, m) => a + m.minutes, 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-10">
      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-violet-300">Learning Portal</div>
          <h1 className="mt-1 text-4xl font-bold">Agentic DevOps: 5-Hour Program</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Twelve modules across two days. Each module has visual explanations, a knowledge check and, where it fits, a
            direct link into the Live Agent Lab to see the concept running.
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(148,163,255,0.15)" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="url(#pg)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
                />
                <defs>
                  <linearGradient id="pg">
                    <stop offset="0" stopColor="#a78bfa" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center text-sm font-bold">{pct}%</div>
            </div>
            <div>
              <div className="font-semibold">Your progress</div>
              <div className="text-sm text-muted">
                {completed.length}/{modules.length} modules · {doneMinutes}/{totalMinutes} min
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-amber-300">
                <Trophy className="h-3.5 w-3.5" /> {Object.values(quizScores).filter((s) => s === 100).length} perfect quizzes
              </div>
            </div>
          </div>
        </div>
      </div>

      {days.map((d) => (
        <section key={d.day} className="mb-12">
          <div className={`mb-5 rounded-2xl bg-gradient-to-r ${d.gradient} p-[1px]`}>
            <div className="rounded-2xl bg-bg/90 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted">Day {d.day} · {d.duration}</div>
              <div className="text-xl font-semibold">{d.title}</div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules
              .filter((m) => m.day === d.day)
              .map((m) => {
                const done = completed.includes(m.id);
                return (
                  <Link
                    key={m.id}
                    href={`/learn/${m.id}`}
                    className="glass group relative flex flex-col overflow-hidden rounded-2xl p-5 transition hover:-translate-y-1 hover:border-white/25"
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-3xl" style={{ background: m.color }} />
                    <div className="mb-4 flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${m.color}22`, color: m.color }}>
                        <Icon name={m.icon} className="h-6 w-6" />
                      </span>
                      {done ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                      ) : (
                        <span className="text-3xl font-black text-white/10">{String(m.number).padStart(2, "0")}</span>
                      )}
                    </div>
                    <div className="text-lg font-semibold leading-snug">{m.title}</div>
                    <p className="mt-1 flex-1 text-sm text-muted">{m.tagline}</p>
                    <div className="mt-4 flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {m.minutes} min</span>
                      <span>{m.sections.length} sections</span>
                      {m.lab && <span className="flex items-center gap-1 text-cyan-300"><FlaskConical className="h-3.5 w-3.5" /> lab</span>}
                      <ArrowRight className="ml-auto h-4 w-4 transition group-hover:translate-x-1 group-hover:text-white" />
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
