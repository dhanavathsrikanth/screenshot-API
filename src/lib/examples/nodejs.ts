import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const nodejsExamples: LanguageExample = {
  id: "nodejs",
  label: "Node.js",
  scenarios: {
    quickstart: `import { writeFile } from "node:fs/promises";

const response = await fetch(
  "${API}/api/take?url=https://example.com&format=png",
  { headers: { Authorization: "Bearer " + process.env.SCREENSHOT_API_KEY } }
);

if (!response.ok) {
  const body = await response.json();
  throw new Error(body.error.code + ": " + body.error.message);
}

await writeFile("screenshot.png", Buffer.from(await response.arrayBuffer()));`,
    advanced: `import { writeFile } from "node:fs/promises";

const params = new URLSearchParams({
  url: "https://example.com",
  format: "webp",
  quality: "90",
  full_page: "true",
  dark_mode: "true",
  viewport_width: "1920",
  viewport_height: "1080",
  device_scale_factor: "2",
});

const response = await fetch("${API}/api/take?" + params, {
  headers: { Authorization: "Bearer " + process.env.SCREENSHOT_API_KEY },
});

if (!response.ok) throw new Error("Capture failed: HTTP " + response.status);
await writeFile("screenshot.webp", Buffer.from(await response.arrayBuffer()));`,
    bulk: `const response = await fetch("${API}/api/take/bulk", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.SCREENSHOT_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    urls: ["https://example.com", "https://vercel.com", "https://stripe.com"],
    format: "png",
    full_page: true,
    concurrency: 5,
    max_retries: 2,
  }),
});

if (!response.ok) throw new Error("Bulk capture failed: HTTP " + response.status);

const body = await response.json();
console.log(body.successful + "/" + body.total + " succeeded, " + body.creditsUsed + " credits");
for (const result of body.results) {
  if (result.success) console.log("OK  ", result.url);
  else console.log("FAIL", result.url, "-", result.error);
}`,
    async: `import { writeFile } from "node:fs/promises";

const KEY = "Bearer " + process.env.SCREENSHOT_API_KEY;
const BASE = "${API}";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(path, init) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: KEY, ...(init?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "HTTP " + res.status);
  return body.data;
}

let job = await getJson("/api/v1/screenshots", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com", format: "png", full_page: true }),
});

while (job.status === "queued" || job.status === "processing") {
  await sleep(2000);
  job = await getJson("/api/v1/screenshots/" + job.id);
}
if (job.status !== "completed") throw new Error("Job failed");

const image = await fetch(job.screenshot.url);
await writeFile("screenshot.png", Buffer.from(await image.arrayBuffer()));`,
  },
};
