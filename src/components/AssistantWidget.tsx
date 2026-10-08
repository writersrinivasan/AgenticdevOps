"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, Sparkles, Trash2, Wrench, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSettings } from "./providers";
import { getModule } from "@/lib/course";
import { getScenario } from "@/lib/scenarios";

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
}

const SUGGESTIONS = [
  "What's the difference between AI-assisted and agentic DevOps?",
  "Explain how the human approval gate works in LangGraph",
  "Which guardrails should a Kubernetes agent have?",
  "Give me a Python LangGraph skeleton for a log-analysis agent",
];

function pageContext(path: string): string | undefined {
  const m = path.match(/^\/learn\/(m\d+)/);
  if (m) {
    const mod = getModule(m[1]);
    if (mod) return `Module ${mod.number}: ${mod.title}`;
  }
  const s = path.match(/^\/lab\/([\w-]+)/);
  if (s) {
    const sc = getScenario(s[1]);
    if (sc) return `Lab scenario "${sc.title}" (${sc.id})`;
  }
  return undefined;
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { headers } = useSettings();
  const path = usePathname();
  const ctx = pageContext(path);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs]);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs([...history, { role: "assistant", content: "", tools: [] }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), context: ctx }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { t: string; v?: string };
          setMsgs((prev) => {
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            if (ev.t === "token") last.content += ev.v;
            if (ev.t === "tool" && ev.v) last.tools = [...(last.tools ?? []), ev.v];
            if (ev.t === "error") last.content += `\n\n⚠️ ${ev.v}`;
            next[next.length - 1] = last;
            return next;
          });
        }
      }
    } catch (e) {
      setMsgs((p) => [...p.slice(0, -1), { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-4 py-3 font-medium text-white shadow-2xl shadow-fuchsia-500/40"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        <span className="hidden sm:inline">{open ? "Close" : "Ask Copilot"}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="glass fixed bottom-20 right-5 z-50 flex h-[min(640px,75vh)] w-[min(440px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-violet-500/20 to-cyan-500/10 px-4 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Agent Ops Copilot</div>
                <div className="truncate text-xs text-muted">LangGraph ReAct agent · Groq{ctx ? ` · viewing ${ctx}` : ""}</div>
              </div>
              {msgs.length > 0 && (
                <button onClick={() => setMsgs([])} className="text-muted hover:text-white" title="Clear chat">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div ref={scroller} className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted">Ask anything about the course, the lab, or LangGraph. Try:</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="block w-full rounded-xl border border-line bg-white/5 px-3 py-2 text-left text-sm hover:border-violet-400/50 hover:bg-violet-500/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-sm text-white"
                        : "md max-w-full text-sm text-ink"
                    }
                  >
                    {m.tools && m.tools.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {m.tools.map((t, j) => (
                          <span key={j} className="inline-flex items-center gap-1 rounded-full bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                            <Wrench className="h-3 w-3" /> {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" ? (
                      m.content ? (
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                      )
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex gap-2 border-t border-line p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about agents, LangGraph, guardrails…"
                className="flex-1 rounded-xl border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
              <button
                disabled={busy || !input.trim()}
                className="rounded-xl bg-violet-500 px-3 text-white disabled:opacity-40"
                aria-label="Send"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
