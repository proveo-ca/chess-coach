// SPEC: _spec/packages/engine-core/entities.puml
// @chess-coach/engine-core — behaviour-defining orchestration logic shared by
// the browser (apps/ui) and the Bun server (apps/server). Pure TS, no external
// deps, no browser/Node APIs. The single source of truth for prompt construction
// per _spec/apps/server/behavior.md.
export * from "./llmPromptFormat";
export * from "./fenValidation";
