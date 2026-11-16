// SPEC: _spec/packages/starchess-core/adjutant-definitions.puml
export const ADJUTANT_DEFINITIONS = [
  { id: "naive", label: "Adjutant (Script)", status: "ready" },
  { id: "strategic", label: "Adjutant (Strategic)", status: "ready" },
  { id: "machine-learning", label: "Adjutant (Machine Learning)", status: "placeholder" },
  { id: "rlhf", label: "Adjutant (RLHF)", status: "placeholder" },
  { id: "rlcd", label: "Adjutant (RLCD)", status: "placeholder" },
] as const;

export type AdjutantDefinition = (typeof ADJUTANT_DEFINITIONS)[number];
export type AdjutantKind = AdjutantDefinition["id"];
export type PlayableAdjutantKind = Extract<AdjutantDefinition, { status: "ready" }>["id"];

export const ADJUTANT_KINDS: readonly AdjutantKind[] = ADJUTANT_DEFINITIONS.map(
  (definition) => definition.id,
);

export const isAdjutantKind = (value: unknown): value is AdjutantKind =>
  ADJUTANT_DEFINITIONS.some((definition) => definition.id === value);

export const isPlayableAdjutantKind = (value: unknown): value is PlayableAdjutantKind =>
  ADJUTANT_DEFINITIONS.some(
    (definition) => definition.id === value && definition.status === "ready",
  );
