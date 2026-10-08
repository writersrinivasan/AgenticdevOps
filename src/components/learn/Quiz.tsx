"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, RotateCcw, XCircle } from "lucide-react";
import type { QuizQ } from "@/lib/course";
import { useProgress } from "../providers";

export function Quiz({ moduleId, questions, color }: { moduleId: string; questions: QuizQ[]; color: string }) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const { setQuizScore, quizScores } = useProgress();
  const answered = answers.filter((a) => a !== null).length;
  const correct = answers.filter((a, i) => a === questions[i].answer).length;

  function choose(qi: number, oi: number) {
    if (answers[qi] !== null) return;
    const next = [...answers];
    next[qi] = oi;
    setAnswers(next);
    if (next.every((a) => a !== null)) {
      const score = Math.round((next.filter((a, i) => a === questions[i].answer).length / questions.length) * 100);
      setQuizScore(moduleId, score);
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <HelpCircle className="h-5 w-5" style={{ color }} />
        <h3 className="text-lg font-semibold">Knowledge check</h3>
        {quizScores[moduleId] !== undefined && (
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs">best: {quizScores[moduleId]}%</span>
        )}
      </div>
      <div className="space-y-5">
        {questions.map((q, qi) => (
          <div key={qi}>
            <div className="mb-2 font-medium">
              {qi + 1}. {q.q}
            </div>
            <div className="grid gap-2">
              {q.options.map((o, oi) => {
                const picked = answers[qi] === oi;
                const reveal = answers[qi] !== null;
                const isRight = oi === q.answer;
                return (
                  <button
                    key={oi}
                    onClick={() => choose(qi, oi)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      reveal && isRight
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : reveal && picked
                          ? "border-red-400/60 bg-red-400/10"
                          : "border-line hover:bg-white/5"
                    }`}
                  >
                    {reveal && isRight ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : reveal && picked ? (
                      <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                    ) : (
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-faint text-[9px]">
                        {String.fromCharCode(65 + oi)}
                      </span>
                    )}
                    {o}
                  </button>
                );
              })}
            </div>
            {answers[qi] !== null && <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-muted">{q.explain}</p>}
          </div>
        ))}
      </div>
      {answered === questions.length && (
        <div className="mt-5 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: `${color}22` }}>
          <span className="font-semibold">
            Score: {correct}/{questions.length} {correct === questions.length ? "🎉" : ""}
          </span>
          <button onClick={() => setAnswers(questions.map(() => null))} className="flex items-center gap-1 text-xs text-muted hover:text-white">
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}
