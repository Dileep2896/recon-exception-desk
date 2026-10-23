import type { Explainer, ExplanationFacts } from "./types.js";
export class LlmExplainerStub implements Explainer {
  // A future model may rewrite supplied facts, never choose matches or alter cents.
  explain(_facts: ExplanationFacts): string {
    throw new Error(
      "NotConfigured: model explanations are disabled; use TemplateExplainer.",
    );
  }
}
