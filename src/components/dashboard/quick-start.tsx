"use client";

import { useState, useCallback } from "react";
import { siteConfig } from "@/lib/site";

interface QuickStartProps {
  apiKeyPrefix: string | null;
}

type ApiMode = "sync" | "async" | "bulk";
type LangTab = "curl" | "node" | "python";

const KEY_PLACEHOLDER = "YOUR_API_KEY";

function displayKey(apiKeyPrefix: string | null): string {
  return apiKeyPrefix ? `${apiKeyPrefix}...` : KEY_PLACEHOLDER;
}

const SNIPPETS: Record<
  ApiMode,
  Record<LangTab, (key: string, base: string) => string>
> = {
  sync: {
    curl: (key, base) =>
      `curl "${base}/api/take?url=https://example.com&format=png" \\
  -H "Authorization: Bearer ${key}" \\
  --output screenshot.png`,
    node: (key, base) =>
      `const response = await fetch(
  "${base}/api/take?url=https://example.com&format=png",
  { headers: { Authorization: "Bearer ${key}" } }
);
const buffer = Buffer.from(await response.arrayBuffer());
require("fs").writeFileSync("screenshot.png", buffer);`,
    python: (key, base) =>
      `import requests

response = requests.get(
    "${base}/api/take",
    params={"url": "https://example.com", "format": "png"},
    headers={"Authorization": "Bearer ${key}"}
)
with open("screenshot.png", "wb") as f:
    f.write(response.content)`,
  },
  async: {
    curl: (key, base) =>
      `# 1. Create job
curl -X POST "${base}/api/v1/screenshots" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com","format":"png"}'

# 2. Poll until status is "completed"
curl "${base}/api/v1/screenshots/JOB_ID" \\
  -H "Authorization: Bearer ${key}"`,
    node: (key, base) =>
      `const create = await fetch("${base}/api/v1/screenshots", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${key}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ url: "https://example.com", format: "png" }),
});
const { data: job } = await create.json();

while (true) {
  const poll = await fetch(\`${base}\${job.status_url}\`, {
    headers: { Authorization: "Bearer ${key}" },
  });
  const { data } = await poll.json();
  if (data.status === "completed") {
    console.log(data.screenshot.url);
    break;
  }
  if (data.status === "failed") throw new Error(data.error?.message);
  await new Promise((r) => setTimeout(r, 1500));
}`,
    python: (key, base) =>
      `import time
import requests

headers = {"Authorization": "Bearer ${key}"}
job = requests.post(
    "${base}/api/v1/screenshots",
    json={"url": "https://example.com", "format": "png"},
    headers=headers,
).json()["data"]

while True:
    data = requests.get(f"${base}{job['status_url']}", headers=headers).json()["data"]
    if data["status"] == "completed":
        print(data["screenshot"]["url"])
        break
    if data["status"] == "failed":
        raise RuntimeError(data["error"]["message"])
    time.sleep(1.5)`,
  },
  bulk: {
    curl: (key, base) =>
      `curl -X POST "${base}/api/take/bulk" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "urls": [
      "https://example.com",
      "https://example.org"
    ],
    "format": "png",
    "concurrency": 3
  }'`,
    node: (key, base) =>
      `const response = await fetch("${base}/api/take/bulk", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${key}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    urls: ["https://example.com", "https://example.org"],
    format: "png",
    concurrency: 3,
  }),
});
const { successful, failed, creditsUsed, results } = await response.json();
console.log({ successful, failed, creditsUsed, results });`,
    python: (key, base) =>
      `import requests

response = requests.post(
    "${base}/api/take/bulk",
    json={
        "urls": ["https://example.com", "https://example.org"],
        "format": "png",
        "concurrency": 3,
    },
    headers={"Authorization": "Bearer ${key}"},
)
data = response.json()
print(data["successful"], "ok,", data["failed"], "failed")`,
  },
};

const MODE_LABELS: { id: ApiMode; label: string; hint: string }[] = [
  { id: "sync", label: "Sync", hint: "GET/POST /api/take — immediate response" },
  { id: "async", label: "Async v1", hint: "POST /api/v1/screenshots — job + poll" },
  { id: "bulk", label: "Bulk", hint: "POST /api/take/bulk — up to 100 URLs" },
];

const LANG_TABS: { id: LangTab; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
];

export function QuickStart({ apiKeyPrefix }: QuickStartProps) {
  const [apiMode, setApiMode] = useState<ApiMode>("sync");
  const [langTab, setLangTab] = useState<LangTab>("curl");
  const [copied, setCopied] = useState(false);

  const key = displayKey(apiKeyPrefix);
  const base = siteConfig.apiUrl;
  const code = SNIPPETS[apiMode][langTab](key, base);

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
            Create an API key to personalize snippets with your key prefix. Replace{" "}
            <span className="font-mono">{KEY_PLACEHOLDER}</span> with your full key when running examples.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {MODE_LABELS.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setApiMode(mode.id)}
            className={`rounded-lg px-3 py-2 text-left border transition-colors ${
              apiMode === mode.id
                ? "border-orange-500/50 bg-orange-50 dark:bg-orange-950/30"
                : "border-[var(--border)] hover:bg-[var(--muted)]"
            }`}
          >
            <span className="block text-xs font-semibold">{mode.label}</span>
            <span className="block text-[10px] text-[var(--dim)] mt-0.5">{mode.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {LANG_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLangTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                langTab === tab.id
                  ? "bg-[var(--muted)] text-[var(--ink)]"
                  : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="code-block">
        <div className="code-block-body">
          <pre className="text-[var(--ink)] whitespace-pre">{code}</pre>
        </div>
      </div>

      {apiKeyPrefix ? (
        <p className="text-xs text-[var(--dim)] mt-2">
          Snippets use your key prefix <span className="font-mono">{key}</span> — paste your full key when calling the API.
        </p>
      ) : (
        <p className="text-xs text-[var(--dim)] mt-2">
          <a href="/dashboard/api-keys" className="text-orange-600 dark:text-orange-400 hover:underline">
            Create an API key
          </a>{" "}
          to see your prefix here.
        </p>
      )}
    </div>
  );
}
