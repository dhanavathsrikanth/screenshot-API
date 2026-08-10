"use client";

import { useState, useCallback } from "react";

interface QuickStartProps {
  apiKeyPrefix: string | null;
}

const snippets = [
  {
    label: "cURL",
    code: (key: string) =>
      `curl "https://screenshotapi.tech/api/take?url=https://example.com&format=png" \\
  -H "Authorization: Bearer ${key}" \\
  --output screenshot.png`,
  },
  {
    label: "Node.js",
    code: (key: string) =>
      `const response = await fetch(
  "https://screenshotapi.tech/api/take?url=https://example.com&format=png",
  { headers: { Authorization: "Bearer ${key}" } }
);
const buffer = Buffer.from(await response.arrayBuffer());
require("fs").writeFileSync("screenshot.png", buffer);`,
  },
  {
    label: "Python",
    code: (key: string) =>
      `import requests

response = requests.get(
    "https://screenshotapi.tech/api/take",
    params={"url": "https://example.com", "format": "png"},
    headers={"Authorization": "Bearer ${key}"}
)
with open("screenshot.png", "wb") as f:
    f.write(response.content)`,
  },
];

export function QuickStart({ apiKeyPrefix }: QuickStartProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const displayKey = apiKeyPrefix ? `${apiKeyPrefix}...` : "YOUR_API_KEY";
  const fullKey = apiKeyPrefix ? `${apiKeyPrefix}${"x".repeat(40)}` : "YOUR_API_KEY";
  const code = snippets[activeTab].code(fullKey);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div>
      {!apiKeyPrefix && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 mb-4">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Create an API key below to get started with personalized code snippets.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {snippets.map((snippet, i) => (
            <button
              key={snippet.label}
              onClick={() => setActiveTab(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                i === activeTab
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {snippet.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 overflow-x-auto">
        <pre className="text-sm text-green-400 whitespace-pre">
          {code}
        </pre>
      </div>

      {apiKeyPrefix && (
        <p className="text-xs text-zinc-500 mt-2">
          Using key <span className="font-mono">{displayKey}</span>
        </p>
      )}
    </div>
  );
}
