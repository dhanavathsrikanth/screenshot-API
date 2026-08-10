"use client";

const examples = [
  {
    lang: "cURL",
    code: `curl "https://screenshotapi.tech/api/take?url=https://example.com&format=png" \\
  -o screenshot.png`,
  },
  {
    lang: "Node.js",
    code: `const response = await fetch(
  "https://screenshotapi.tech/api/take?url=https://example.com&format=png"
);
const buffer = Buffer.from(await response.arrayBuffer());
require("fs").writeFileSync("screenshot.png", buffer);`,
  },
  {
    lang: "Python",
    code: `import requests
response = requests.get(
    "https://screenshotapi.tech/api/take",
    params={"url": "https://example.com", "format": "png"}
)
with open("screenshot.png", "wb") as f:
    f.write(response.content)`,
  },
  {
    lang: "JavaScript (Browser)",
    code: `const response = await fetch(
  "/api/take?url=https://example.com&format=png"
);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
// Display or download`,
  },
];

export function CodeExamples() {
  return (
    <section className="py-20 border-y border-[var(--border)] bg-zinc-50/30 dark:bg-zinc-950/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready in 30 seconds</h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            No SDK required. Works with any HTTP client.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {examples.map((ex) => (
            <div
              key={ex.lang}
              className="rounded-xl border border-[var(--border)] bg-zinc-950 dark:bg-zinc-900 overflow-hidden hover:border-indigo-500/50 transition-colors"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <span className="text-sm font-medium text-zinc-300">{ex.lang}</span>
                <button className="text-xs text-zinc-500 hover:text-white transition-colors">Copy</button>
              </div>
              <pre className="p-4 overflow-x-auto"><code className="text-sm text-green-400 whitespace-pre">{ex.code}</code></pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}