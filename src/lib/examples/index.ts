import type { LanguageExample } from "./types";
import { curlExamples } from "./curl";
import { nodejsExamples } from "./nodejs";
import { pythonExamples } from "./python";
import { goExamples } from "./go";
import { phpExamples } from "./php";
import { rubyExamples } from "./ruby";
import { javaExamples } from "./java";
import { csharpExamples } from "./csharp";
import { rustExamples } from "./rust";

export type { ExampleScenario, LanguageExample, ScenarioId } from "./types";
export { exampleScenarios } from "./types";

export const languageExamples: LanguageExample[] = [
  curlExamples,
  nodejsExamples,
  pythonExamples,
  goExamples,
  phpExamples,
  rubyExamples,
  javaExamples,
  csharpExamples,
  rustExamples,
];

export function getLanguageExample(id: string): LanguageExample | undefined {
  return languageExamples.find((lang) => lang.id === id);
}
