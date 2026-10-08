import Link from "next/link";
import { ArrowRight, Clock, FlaskConical, GraduationCap, Network, ShieldCheck, Zap } from "lucide-react";
import { days, modules, totalMinutes } from "@/lib/course";
import { scenarios } from "@/lib/scenarios";
import { Icon } from "@/components/ui/Icon";

export default function Home() {
  const agentCount = new Set(scenarios.flatMap((s) => s.agents.map((a) => a.name))).size;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24">
      {/* Hero */}
      <section className="relative pt-14 pb-10 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 5-hour program · 2 days × 2.5h · LangGraph + Groq
        </div>
        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Learn <span className="text-gradient">Agentic DevOps</span>,
          <br /> then watch agents run it live.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          A learning portal for the concepts, plus a live lab where LangGraph agents investigate real-world incidents,
          talk to each other, ask for your approval and fix production.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-muted">
          <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-violet-300" /> {Math.round(totalMinutes / 60 * 10) / 10}h of modules</span>
          <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-cyan-300" /> {modules.length} modules</span>
          <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-pink-300" /> {scenarios.length} industry scenarios</span>
          <span className="flex items-center gap-2"><Network className="h-4 w-4 text-amber-300" /> {agentCount} collaborating agents</span>
        </div>
      </section>

      {/* Two doors */}
      <section className="grid gap-6 md:grid-cols-2">
        <Door
          href="/learn"
          title="Learning Portal"
          subtitle="Day 1 & Day 2 · 12 interactive modules"
          desc="Visual explanations, lifecycle diagrams, starter code, knowledge checks and progress tracking. Follows the official 5-hour outline."
          gradient="from-violet-600/40 via-fuchsia-600/25 to-transparent"
          icon={<GraduationCap className="h-7 w-7" />}
          iconBg="from-violet-500 to-fuchsia-500"
          cta="Start learning"
          bullets={["Evolution → architecture → CI/CD", "Observability, SRE & self-healing", "Governance & maturity model"]}
        />
        <Door
          href="/lab"
          title="Live Agent Lab"
          subtitle="Hands-on · real industry incidents"
          desc="Multi-agent LangGraph workflows on Groq. Watch agents fan out, call tools, message each other, pause for your approval and validate recovery."
          gradient="from-cyan-600/40 via-sky-600/25 to-transparent"
          icon={<FlaskConical className="h-7 w-7" />}
          iconBg="from-cyan-500 to-sky-500"
          cta="Enter the lab"
          bullets={["E-commerce, FinTech, Banking, Media, Healthcare", "Human-in-the-loop approval gates", "Live metrics, audit log & postmortem"]}
        />
      </section>

      {/* Agenda */}
      <section className="mt-16">
        <h2 className="mb-6 text-2xl font-semibold">Program agenda</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {days.map((d) => {
            const mods = modules.filter((m) => m.day === d.day);
            return (
              <div key={d.day} className="glass overflow-hidden rounded-2xl">
                <div className={`bg-gradient-to-r ${d.gradient} px-5 py-4`}>
                  <div className="text-xs font-semibold uppercase tracking-widest text-white/80">Day {d.day} · {d.duration}</div>
                  <div className="text-lg font-semibold text-white">{d.title}</div>
                </div>
                <ol className="divide-y divide-line">
                  {mods.map((m) => (
                    <li key={m.id}>
                      <Link href={`/learn/${m.id}`} className="group flex items-center gap-3 px-5 py-3 hover:bg-white/5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${m.color}22`, color: m.color }}>
                          <Icon name={m.icon} className="h-5 w-5" />
                        </span>
                        <span className="flex-1">
                          <span className="text-sm text-faint">{m.number}.</span> <span className="font-medium">{m.title}</span>
                          <span className="block text-xs text-muted">{m.tagline}</span>
                        </span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted">{m.minutes}m</span>
                        <ArrowRight className="h-4 w-4 text-faint transition group-hover:translate-x-1 group-hover:text-white" />
                      </Link>
                    </li>
                  ))}
                </ol>
                <div className="border-t border-line px-5 py-3 text-xs text-muted">
                  <span className="font-semibold text-ink">Outcome:</span> {d.outcome}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Under the hood */}
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          { icon: <Network className="h-5 w-5" />, color: "text-violet-300", title: "LangGraph StateGraph", desc: "Each lab scenario compiles into a graph with parallel fan-out, fan-in, conditional routing and checkpointed state." },
          { icon: <Zap className="h-5 w-5" />, color: "text-amber-300", title: "Groq-powered reasoning", desc: "Agents stream their reasoning token by token from Groq. Without a key, a simulated mode keeps the demo working offline." },
          { icon: <ShieldCheck className="h-5 w-5" />, color: "text-emerald-300", title: "Governed autonomy", desc: "interrupt()-based approval gates, risk-tiered policy, guardrail checks, audit trail and long-term incident memory." },
        ].map((f) => (
          <div key={f.title} className="glass rounded-2xl p-5">
            <div className={`mb-2 flex items-center gap-2 font-semibold ${f.color}`}>{f.icon} {f.title}</div>
            <p className="text-sm text-muted">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Door(props: {
  href: string;
  title: string;
  subtitle: string;
  desc: string;
  gradient: string;
  icon: React.ReactNode;
  iconBg: string;
  cta: string;
  bullets: string[];
}) {
  return (
    <Link
      href={props.href}
      className="glass group relative overflow-hidden rounded-3xl p-7 transition hover:-translate-y-1 hover:border-white/25"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${props.gradient}`} />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative">
        <div className={`mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${props.iconBg} text-white shadow-xl`}>
          {props.icon}
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">{props.subtitle}</div>
        <h3 className="mt-1 text-3xl font-bold">{props.title}</h3>
        <p className="mt-3 max-w-lg text-muted">{props.desc}</p>
        <ul className="mt-4 space-y-1.5 text-sm">
          {props.bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60" /> {b}
            </li>
          ))}
        </ul>
        <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-semibold text-black transition group-hover:gap-3">
          {props.cta} <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}
