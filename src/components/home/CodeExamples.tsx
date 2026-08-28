"use client";

import { useState } from "react";
import { siteConfig } from "@/lib/site";

const examples = [
  {
    lang: "cURL",
    code: `curl "${siteConfig.apiUrl}/api/take?url=https://example.com&format=png" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -o screenshot.png`,
  },
  {
    lang: "Node.js",
    code: `import fs from "node:fs";

const response = await fetch(
  "${siteConfig.apiUrl}/api/take?url=https://example.com&format=png",
  { headers: { Authorization: "Bearer YOUR_API_KEY" } }
);

fs.writeFileSync("screenshot.png", Buffer.from(await response.arrayBuffer()));`,
  },
  {
    lang: "Python",
    code: `import requests

response = requests.get(
    "${siteConfig.apiUrl}/api/take",
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
    "io"
    "net/http"
    "os"
)

func main() {
    req, err := http.NewRequest(
        "GET", "${siteConfig.apiUrl}/api/take?url=https://example.com&format=png", nil)
    if err != nil {
        panic(err)
    }
    req.Header.Set("Authorization", "Bearer YOUR_API_KEY")

    resp, err := http.DefaultClient.Do(req)
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
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          works with any HTTP client
        </h2>
        <p className="mb-6 text-[13px] leading-[1.55] text-[var(--dim)]">
          No SDK required. No browser setup. Just an authenticated GET request.
        </p>

        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white dark:bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--muted)] pl-3 pr-2">
            <div className="flex flex-wrap">
              {examples.map((ex, i) => (
                <button
                  key={ex.lang}
                  onClick={() => {
                    setActive(i);
                    setCopied(false);
                  }}
                  className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                    i === active
                      ? "text-[var(--ink)]"
                      : "text-[var(--dim)] hover:text-[var(--ink)]"
                  }`}
                >
                  {ex.lang}
                  {i === active && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-[var(--dim)] transition-colors hover:text-[var(--ink)]"
            >
              {copied ? (
                <>
                  <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
          <pre className="overflow-x-auto p-4">
            <code className="font-mono text-[13px] leading-relaxed text-[var(--ink)]">{examples[active].code}</code>
          </pre>
        </div>

        <p className="mt-4 text-[13px] text-[var(--dim)]">
          Copy your API key from the{" "}
          <a href="/dashboard/api-keys" className="font-medium underline underline-offset-2 hover:text-[var(--ink)]">
            dashboard
          </a>{" "}
          and replace <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-[12px]">YOUR_API_KEY</code>.
        </p>
      </div>
    </section>
  );
}
