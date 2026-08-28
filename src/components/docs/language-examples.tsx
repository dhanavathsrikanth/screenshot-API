"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/docs/code-block";
import { exampleScenarios, languageExamples } from "@/lib/examples";

const scenarioIcons: Record<string, string> = {
  quickstart: "Save your first screenshot",
  advanced: "Full page + render options",
  bulk: "Capture many URLs at once",
  async: "Production pattern",
};

export function LanguageExamples() {
  const [langId, setLangId] = useState(languageExamples[0].id);
  const [scenarioId, setScenarioId] = useState(exampleScenarios[0].id);

  const language = languageExamples.find((l) => l.id === langId) ?? languageExamples[0];
  const scenario = exampleScenarios.find((s) => s.id === scenarioId) ?? exampleScenarios[0];
  const code = language.scenarios[scenario.id];

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1 rounded-xl border border-[var(--border)] bg-white p-1 dark:bg-slate-900">
          {languageExamples.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setLangId(lang.id)}
              aria-pressed={lang.id === langId}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                lang.id === langId
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {exampleScenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => setScenarioId(s.id)}
            aria-pressed={s.id === scenarioId}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              s.id === scenarioId
                ? "border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/40"
                : "border-[var(--border)] bg-white hover:border-slate-300 dark:bg-slate-900 dark:hover:border-slate-700"
            }`}
          >
            <p className={`text-sm font-semibold ${s.id === scenarioId ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-white"}`}>
              {s.label}
            </p>
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{scenario.description}</p>

      <div className="mt-3">
        {code ? (
          <CodeBlock code={code} label={language.label.toLowerCase()} />
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            This recipe is coming soon for {language.label}.
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {scenarioIcons[scenario.id]} · Replace sk_your_api_key with a key from the dashboard. Set
        SCREENSHOT_API_KEY as an environment variable instead of hard-coding keys.
      </p>
    </div>
  );
}
