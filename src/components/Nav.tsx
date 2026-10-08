"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bot, FlaskConical, GraduationCap, KeyRound, Settings, X } from "lucide-react";
import { useSettings } from "./providers";

export function Nav() {
  const path = usePathname();
  const { status, setSettingsOpen } = useSettings();
  const link = (href: string, label: string, Icon: typeof Bot) => {
    const active = path === href || (href !== "/" && path.startsWith(href));
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
          active ? "bg-white/10 text-white" : "text-muted hover:text-white hover:bg-white/5"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-violet-500/30">
            <Bot className="h-5 w-5 text-white" />
          </span>
          <span className="hidden md:inline">
            Agentic <span className="text-gradient">DevOps</span> Academy
          </span>
        </Link>
        <nav className="ml-2 flex items-center gap-1">
          {link("/learn", "Learning Portal", GraduationCap)}
          {link("/lab", "Live Agent Lab", FlaskConical)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
              status?.groq
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/40 bg-amber-400/10 text-amber-300"
            }`}
            title="LLM status"
          >
            <span className={`h-2 w-2 rounded-full ${status?.groq ? "bg-emerald-400 pulse-ring" : "bg-amber-400"}`} />
            {status?.groq ? `Groq live · ${status.model}` : "Simulated mode"}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
      <SettingsDialog />
    </header>
  );
}

const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"];

function SettingsDialog() {
  const { settingsOpen } = useSettings();
  return settingsOpen ? <SettingsForm /> : null;
}

function SettingsForm() {
  const { setSettingsOpen, groqKey, model, save, status, refreshStatus } = useSettings();
  const [key, setKey] = useState(groqKey);
  const [m, setM] = useState(model);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setSettingsOpen(false)}>
      <div className="glass w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-violet-300" /> Groq LLM settings
          </h2>
          <button onClick={() => setSettingsOpen(false)} className="text-muted hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          The agents and the AI assistant use LangGraph with Groq. {status?.serverKey ? (
            <span className="text-emerald-300">A server key is configured in .env.local.</span>
          ) : (
            <>Add <code className="text-violet-300">GROQ_API_KEY</code> to <code>.env.local</code>, or paste a key here (stored only in this browser).</>
          )}
        </p>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-faint">API key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={status?.serverKey ? "Using server key (optional override)" : "gsk_…"}
          className="mb-4 w-full rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-violet-400"
        />
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-faint">Model</label>
        <select
          value={m}
          onChange={(e) => setM(e.target.value)}
          className="mb-6 w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400"
        >
          <option value="">Server default ({status?.model ?? "openai/gpt-oss-120b"})</option>
          {MODELS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setKey("");
              save({ groqKey: "" });
              setTimeout(refreshStatus, 50);
            }}
            className="rounded-lg px-4 py-2 text-sm text-muted hover:text-white"
          >
            Clear key
          </button>
          <button
            onClick={() => {
              save({ groqKey: key.trim(), model: m });
              setSettingsOpen(false);
              setTimeout(refreshStatus, 50);
            }}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
