import { siteConfig } from "@/lib/site";

export type ScenarioId = "quickstart" | "advanced" | "bulk" | "async";

export type ExampleScenario = {
  id: ScenarioId;
  label: string;
  description: string;
};

export type LanguageExample = {
  id: string;
  label: string;
  scenarios: Record<ScenarioId, string>;
};

export const exampleScenarios: ExampleScenario[] = [
  {
    id: "quickstart",
    label: "Quickstart",
    description: "Capture a PNG of any URL and save it to disk, with proper error handling.",
  },
  {
    id: "advanced",
    label: "Full page + options",
    description: "Full-page WebP at 2x scale in dark mode — common options in one request.",
  },
  {
    id: "bulk",
    label: "Bulk capture",
    description: "Screenshot up to 100 URLs in one call with concurrency control.",
  },
  {
    id: "async",
    label: "Async job (recommended)",
    description: "Create a v1 job, poll until complete, download the stored screenshot.",
  },
];

export function absoluteApiUrl(path: string): string {
  return `${siteConfig.apiUrl}${path}`;
}
