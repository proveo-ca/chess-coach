// SPEC: _spec/apps/starchess/vfx-tier.puml
export type VfxTier = "full" | "lite";

export type ProbeVerdict = VfxTier | "inconclusive";

export type ProbeMetrics = { lagMedianMs: number; jankRatio: number };
