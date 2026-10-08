"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ---------------- Settings (Groq key / model) ----------------

interface Settings {
  groqKey: string;
  model: string;
}

interface Status {
  groq: boolean;
  serverKey: boolean;
  model: string;
  incidentsInMemory: number;
}

interface SettingsCtx extends Settings {
  save: (s: Partial<Settings>) => void;
  headers: () => Record<string, string>;
  status: Status | null;
  refreshStatus: () => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsCtx | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

// ---------------- Course progress ----------------

interface ProgressCtx {
  completed: string[];
  toggle: (id: string) => void;
  quizScores: Record<string, number>;
  setQuizScore: (id: string, score: number) => void;
}
const ProgressContext = createContext<ProgressCtx | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ groqKey: "", model: "" });
  const [status, setStatus] = useState<Status | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [quizScores, setQuizScores] = useState<Record<string, number>>({});

  useEffect(() => {
    setSettings(read("ado.settings", { groqKey: "", model: "" }));
    setCompleted(read("ado.completed", []));
    setQuizScores(read("ado.quiz", {}));
  }, []);

  const headers = useCallback(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (settings.groqKey) h["x-groq-key"] = settings.groqKey;
    if (settings.model) h["x-groq-model"] = settings.model;
    return h;
  }, [settings]);

  const refreshStatus = useCallback(() => {
    fetch("/api/status", { headers: headers() })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [headers]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const save = useCallback((s: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      write("ado.settings", next);
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      write("ado.completed", next);
      return next;
    });
  }, []);

  const setQuizScore = useCallback((id: string, score: number) => {
    setQuizScores((prev) => {
      const next = { ...prev, [id]: score };
      write("ado.quiz", next);
      return next;
    });
  }, []);

  const settingsValue = useMemo(
    () => ({ ...settings, save, headers, status, refreshStatus, settingsOpen, setSettingsOpen }),
    [settings, save, headers, status, refreshStatus, settingsOpen],
  );
  const progressValue = useMemo(
    () => ({ completed, toggle, quizScores, setQuizScore }),
    [completed, toggle, quizScores, setQuizScore],
  );

  return (
    <SettingsContext.Provider value={settingsValue}>
      <ProgressContext.Provider value={progressValue}>{children}</ProgressContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("useSettings outside Providers");
  return c;
}

export function useProgress() {
  const c = useContext(ProgressContext);
  if (!c) throw new Error("useProgress outside Providers");
  return c;
}
