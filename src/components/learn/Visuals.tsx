"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, Check, Copy, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { Item, Visual } from "@/lib/course";
import { Icon } from "../ui/Icon";

const fade = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
};

export function VisualBlock({ visual, accent }: { visual: Visual; accent: string }) {
  switch (visual.kind) {
    case "timeline":
      return <Timeline items={visual.items} />;
    case "cards":
      return <Cards items={visual.items} cols={visual.cols ?? 3} />;
    case "compare":
      return <Compare left={visual.left} right={visual.right} />;
    case "cycle":
      return <Cycle items={visual.items} accent={accent} />;
    case "flow":
      return <Flow items={visual.items} />;
    case "hub":
      return <Hub center={visual.center} items={visual.items} />;
    case "steps":
      return <Steps items={visual.items} accent={accent} />;
    case "tiers":
      return <Tiers items={visual.items} />;
    case "ladder":
      return <Ladder items={visual.items} />;
    case "code":
      return <CodeBlock code={visual.code} language={visual.language} caption={visual.caption} />;
  }
}

function Timeline({ items }: { items: Item[] }) {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-[34px] hidden h-1 rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-pink-500 opacity-60 lg:block" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {items.map((it, i) => (
          <motion.div key={it.title} {...fade} transition={{ delay: i * 0.08 }} className="relative">
            <div
              className="relative z-10 mx-auto mb-3 grid h-[68px] w-[68px] place-items-center rounded-2xl border-2 bg-panelsolid shadow-lg"
              style={{ borderColor: it.color, color: it.color, boxShadow: `0 0 24px ${it.color}40` }}
            >
              <Icon name={it.icon} className="h-7 w-7" />
            </div>
            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: it.color }}>{it.tag}</div>
              <div className="font-semibold">{it.title}</div>
              <p className="mt-1 text-xs text-muted">{it.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Cards({ items, cols }: { items: Item[]; cols: number }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <div className={`grid gap-3 ${grid}`}>
      {items.map((it, i) => (
        <motion.div
          key={it.title}
          {...fade}
          transition={{ delay: i * 0.05 }}
          whileHover={{ y: -3 }}
          className="group relative overflow-hidden rounded-xl border border-line bg-white/[0.03] p-4"
        >
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: it.color }} />
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition group-hover:opacity-40"
            style={{ background: it.color }}
          />
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${it.color}22`, color: it.color }}>
              <Icon name={it.icon} className="h-4 w-4" />
            </span>
            <span className="font-semibold">{it.title}</span>
          </div>
          {it.desc && <p className="text-sm text-muted">{it.desc}</p>}
        </motion.div>
      ))}
    </div>
  );
}

function Compare({ left, right }: { left: { title: string; points: string[] }; right: { title: string; points: string[] } }) {
  return (
    <div className="relative grid gap-4 md:grid-cols-2">
      <motion.div {...fade} className="rounded-2xl border border-line bg-white/[0.03] p-5">
        <div className="mb-3 font-semibold text-slate-300">{left.title}</div>
        <ul className="space-y-2">
          {left.points.map((p) => (
            <li key={p} className="flex gap-2 text-sm text-muted">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" /> {p}
            </li>
          ))}
        </ul>
      </motion.div>
      <div className="absolute left-1/2 top-1/2 z-10 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-panelsolid text-xs font-bold md:grid">
        VS
      </div>
      <motion.div
        {...fade}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-cyan-500/10 p-5 shadow-lg shadow-violet-500/10"
      >
        <div className="mb-3 font-semibold text-violet-200">{right.title}</div>
        <ul className="space-y-2">
          {right.points.map((p) => (
            <li key={p} className="flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {p}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

/** Interactive circular loop; auto-advances and can be clicked. */
function Cycle({ items, accent }: { items: Item[]; accent: string }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setActive((a) => (a + 1) % items.length), 1800);
    return () => clearInterval(t);
  }, [auto, items.length]);
  const cur = items[active];
  const R = 42; // % radius

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-[460px]">
        <div className="spin-slow absolute inset-[8%] rounded-full border-2 border-dashed" style={{ borderColor: `${accent}55` }} />
        <div className="absolute inset-[30%] grid place-items-center rounded-full border border-line bg-panelsolid text-center shadow-2xl" style={{ boxShadow: `0 0 50px ${cur.color}30` }}>
          <div>
            <Icon name={cur.icon} className="mx-auto mb-1 h-8 w-8" style={{ color: cur.color }} />
            <div className="text-lg font-bold">{cur.title}</div>
            <div className="text-[11px] text-faint">step {active + 1} / {items.length}</div>
          </div>
        </div>
        {items.map((it, i) => {
          const ang = (i / items.length) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + R * Math.cos(ang);
          const y = 50 + R * Math.sin(ang);
          const on = i === active;
          return (
            <button
              key={it.title}
              onClick={() => {
                setActive(i);
                setAuto(false);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <motion.div
                animate={{ scale: on ? 1.15 : 1 }}
                className="grid h-14 w-14 place-items-center rounded-full border-2 bg-panelsolid"
                style={{ borderColor: it.color, color: it.color, boxShadow: on ? `0 0 28px ${it.color}` : "none" }}
              >
                <Icon name={it.icon} className="h-6 w-6" />
              </motion.div>
              <div className={`mt-1 whitespace-nowrap text-xs font-medium ${on ? "text-white" : "text-muted"}`}>{it.title}</div>
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <button
            key={it.title}
            onClick={() => {
              setActive(i);
              setAuto(false);
            }}
            className={`flex w-full items-start gap-3 rounded-xl border px-4 py-2.5 text-left transition ${
              i === active ? "border-white/25 bg-white/10" : "border-transparent hover:bg-white/5"
            }`}
          >
            <span className="mt-0.5 text-xs font-bold" style={{ color: it.color }}>{String(i + 1).padStart(2, "0")}</span>
            <span>
              <span className="font-semibold">{it.title}</span>
              {it.desc && <span className="block text-sm text-muted">{it.desc}</span>}
            </span>
          </button>
        ))}
        <button onClick={() => setAuto((a) => !a)} className="mt-2 flex items-center gap-2 text-xs text-muted hover:text-white">
          {auto ? <RotateCcw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} {auto ? "Auto-playing (click a step to pause)" : "Resume auto-play"}
        </button>
      </div>
    </div>
  );
}

/** Pipeline with a travelling highlight. */
function Flow({ items }: { items: Item[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % items.length), 1100);
    return () => clearInterval(t);
  }, [items.length]);
  return (
    <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      {items.map((it, i) => (
        <div key={it.title} className="flex flex-col items-center gap-2 lg:flex-row">
          <motion.div
            animate={{ scale: i === active ? 1.06 : 1 }}
            className="flex min-w-[140px] items-center gap-2 rounded-xl border bg-white/[0.03] px-3 py-2.5"
            style={{
              borderColor: i === active ? it.color : "var(--border)",
              boxShadow: i === active ? `0 0 22px ${it.color}55` : "none",
            }}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${it.color}22`, color: it.color }}>
              <Icon name={it.icon} className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">{it.title}</span>
              {it.desc && <span className="block text-[11px] text-muted">{it.desc}</span>}
            </span>
          </motion.div>
          {i < items.length - 1 && (
            <>
              <ArrowRight className={`hidden h-4 w-4 lg:block ${i === active ? "text-white" : "text-faint"}`} />
              <ArrowDown className={`h-4 w-4 lg:hidden ${i === active ? "text-white" : "text-faint"}`} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Hub({ center, items }: { center: Item; items: Item[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const R = 40;
  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-[520px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {items.map((it, i) => {
            const ang = (i / items.length) * 2 * Math.PI - Math.PI / 2;
            const on = hover === i;
            return (
              <line
                key={it.title}
                x1="50"
                y1="50"
                x2={50 + R * Math.cos(ang)}
                y2={50 + R * Math.sin(ang)}
                stroke={it.color}
                strokeOpacity={on ? 0.9 : 0.35}
                strokeWidth={on ? 0.6 : 0.3}
                strokeDasharray="1.5 1.2"
              >
                <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1.5s" repeatCount="indefinite" />
              </line>
            );
          })}
        </svg>
        <div
          className="absolute left-1/2 top-1/2 grid h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-panelsolid p-2 text-center"
          style={{ borderColor: center.color, boxShadow: `0 0 60px ${center.color}55` }}
        >
          <div>
            <Icon name={center.icon} className="mx-auto h-8 w-8" style={{ color: center.color }} />
            <div className="text-sm font-bold leading-tight">{center.title}</div>
          </div>
        </div>
        {items.map((it, i) => {
          const ang = (i / items.length) * 2 * Math.PI - Math.PI / 2;
          return (
            <div
              key={it.title}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${50 + R * Math.cos(ang)}%`, top: `${50 + R * Math.sin(ang)}%` }}
            >
              <div
                className="grid h-12 w-12 place-items-center rounded-xl border-2 bg-panelsolid transition"
                style={{ borderColor: it.color, color: it.color, boxShadow: hover === i ? `0 0 22px ${it.color}` : "none" }}
              >
                <Icon name={it.icon} className="h-5 w-5" />
              </div>
              <div className="mt-1 max-w-[110px] text-center text-[11px] font-medium leading-tight">{it.title}</div>
            </div>
          );
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <div className="rounded-xl border px-4 py-2.5" style={{ borderColor: `${center.color}66`, background: `${center.color}12` }}>
          <div className="font-semibold" style={{ color: center.color }}>{center.title}</div>
          {center.desc && <div className="text-sm text-muted">{center.desc}</div>}
        </div>
        {items.map((it, i) => (
          <div
            key={it.title}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`rounded-xl border px-4 py-2 transition ${hover === i ? "border-white/25 bg-white/10" : "border-line bg-white/[0.02]"}`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ background: it.color }} /> {it.title}
            </div>
            {it.desc && <div className="text-xs text-muted">{it.desc}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Numbered steps with a "simulate" button that walks through them. */
function Steps({ items, accent }: { items: Item[]; accent: string }) {
  const [done, setDone] = useState(-1);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    if (done >= items.length - 1) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setDone((d) => d + 1), 650);
    return () => clearTimeout(t);
  }, [running, done, items.length]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => {
            setDone(-1);
            setRunning(true);
          }}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
          style={{ background: accent }}
        >
          <Play className="h-3.5 w-3.5" /> Simulate agent run
        </button>
        {done >= 0 && (
          <button onClick={() => { setDone(-1); setRunning(false); }} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-white">
            Reset
          </button>
        )}
      </div>
      <ol className="grid gap-2 md:grid-cols-2">
        {items.map((it, i) => {
          const isDone = i <= done;
          const isNext = i === done + 1 && running;
          return (
            <motion.li
              key={it.title}
              {...fade}
              transition={{ delay: i * 0.03 }}
              onClick={() => setDone(i)}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                isDone ? "border-emerald-400/40 bg-emerald-400/10" : isNext ? "border-white/30 bg-white/5" : "border-line bg-white/[0.02] hover:bg-white/5"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isNext ? "pulse-ring" : ""}`}
                style={{ background: isDone ? "#34d399" : `${accent}33`, color: isDone ? "#052e16" : accent }}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-medium">
                  <Icon name={it.icon} className="h-4 w-4 text-muted" /> {it.title}
                </span>
                {it.desc && <span className="block text-xs text-muted">{it.desc}</span>}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

function Tiers({ items }: { items: (Item & { level: "low" | "medium" | "high"; examples: string[] })[] }) {
  const style = {
    low: { c: "#34d399", bg: "from-emerald-500/20", label: "Autonomous" },
    medium: { c: "#fbbf24", bg: "from-amber-500/20", label: "Approval required" },
    high: { c: "#f87171", bg: "from-red-500/20", label: "Human performs / co-pilots" },
  };
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((it, i) => {
        const s = style[it.level];
        return (
          <motion.div
            key={it.title}
            {...fade}
            transition={{ delay: i * 0.1 }}
            className={`rounded-2xl border bg-gradient-to-b ${s.bg} to-transparent p-5`}
            style={{ borderColor: `${s.c}66` }}
          >
            <div className="mb-2 flex items-center gap-2" style={{ color: s.c }}>
              <Icon name={it.icon} className="h-6 w-6" />
              <span className="text-lg font-bold">{it.title}</span>
            </div>
            <div className="mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${s.c}22`, color: s.c }}>
              {it.desc} · {s.label}
            </div>
            <ul className="space-y-1.5 text-sm">
              {it.examples.map((e) => (
                <li key={e} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.c }} /> {e}
                </li>
              ))}
            </ul>
          </motion.div>
        );
      })}
    </div>
  );
}

function Ladder({ items }: { items: Item[] }) {
  const [here, setHere] = useState<number | null>(null);
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Click the level your organisation is at today.</p>
      <div className="flex flex-col-reverse gap-2">
        {items.map((it, i) => (
          <motion.button
            key={it.title}
            {...fade}
            transition={{ delay: i * 0.08 }}
            onClick={() => setHere(i)}
            className="flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition"
            style={{
              marginLeft: `${i * 6}%`,
              borderColor: here === i ? it.color : "var(--border)",
              background: here === i ? `${it.color}22` : here !== null && i < here ? `${it.color}0d` : "rgba(255,255,255,0.02)",
              boxShadow: here === i ? `0 0 30px ${it.color}44` : "none",
            }}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: `${it.color}22`, color: it.color }}>
              <Icon name={it.icon} className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{it.title}</span>
              <span className="block text-sm text-muted">{it.desc}</span>
            </span>
            {here === i && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-black">We are here</span>}
            {here !== null && i === here + 1 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: it.color, color: "#000" }}>Next goal</span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ code, language, caption }: { code: string; language: string; caption?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0a0d1a]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs text-muted">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
        </span>
        <span className="ml-2 font-mono">{language}</span>
        {caption && <span className="ml-2 hidden truncate font-mono text-faint md:inline">{caption}</span>}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroll-thin max-h-[560px] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed">
        {code.split("\n").map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-4 w-6 shrink-0 select-none text-right text-faint">{i + 1}</span>
            <span className={/^\s*(#|\/\/)/.test(line) ? "text-emerald-400/80" : /^\s*(@tool|def |class |from |import |const |export )/.test(line) ? "text-violet-300" : "text-slate-200"}>
              {line || " "}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

