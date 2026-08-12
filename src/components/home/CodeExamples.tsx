"use client";

import { useState } from "react";

const examples = [
  {
    lang: "cURL",
    code: `curl "https://screenshotapi.tech/api/take?url=https://example.com&format=png" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -o screenshot.png`,
  },
  {
    lang: "Node.js",
    code: `import fs from "node:fs";

const response = await fetch(
  "https://screenshotapi.tech/api/take?url=https://example.com&format=png",
  { headers: { Authorization: "Bearer YOUR_API_KEY" } }
);

fs.writeFileSync("screenshot.png", Buffer.from(await response.arrayBuffer()));`,
  },
  {
    lang: "Python",
    code: `import requests

response = requests.get(
    "https://screenshotapi.tech/api/take",
    params={"url": "https://example.com", "format": "png"},
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)

with open("screenshot.png", "wb") as f:
    f.write(response.content)`,
  },
  {
    lang: "Go",
    code: `package main

import (
    "net/http"
    "os"
)

func main() {
    resp, err := http.Get(
        "https://screenshotapi.tech/api/take?url=https://example.com&format=png")
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    data, err := io.ReadAll(resp.Body)
    if err != nil {
        panic(err)
    }
    os.WriteFile("screenshot.png", data, 0644)
}`,
  },
];

export function CodeExamples() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(examples[active].code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="border-b border-[var(--border)] py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Get started in 30 seconds
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Works with any HTTP client
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            No SDK required. No browser setup. Just an authenticated GET request.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--border)] bg-zinc-950 shadow-2xl shadow-zinc-900/20">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 pl-4 pr-2">
            <div className="flex flex-wrap">
              {examples.map((ex, i) => (
                <button
                  key={ex.lang}
                  onClick={() => {
                    setActive(i);
                    setCopied(false);
                  }}
                  className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                    i === active
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {ex.lang}
                  {i === active && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-indigo-500" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              {copied ? (
                <>
                  <svg className="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto p-5">
            <code className="font-mono text-[13px] leading-relaxed text-green-400">{examples[active].code}</code>
          </pre>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Copy your API key from the{" "}
          <a href="/dashboard/api-keys" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            dashboard
          </a>{" "}
          and replace <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">YOUR_API_KEY</code>.
        </p>
      </div>
    </section>
  );
}
