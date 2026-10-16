# starchess app — current status

**[Unverified] 2026-10-16 · current source inspection / lead observations; no fresh app verification in this docs task.**

## Responsibility

- Own the Solid application at [`apps/starchess/`](../../../apps/starchess/).
- Consume the canonical core registry for New Game selection and labels.
- Guard direct URLs and saved sessions against unavailable opponents.
- Preserve existing unavailable-state behavior without activating a learned opponent.

## Current findings

- The [manifest](../../../apps/starchess/package.json) depends on core, client-platform, and ui-web, not arena or training.
- The current ownership graph therefore has **no app→arena/training runtime dependency**.
- Only `naive` and `strategic` are playable.
- `machine-learning`, `rlhf`, and `rlcd` remain disabled placeholders.
- Selection, URL, and session guards already enforce unavailability; no new ML-specific UI defect or repair is assigned here.
- Partial private training/coordinator source does not create a playable app integration or learned weights.

## Latest suggested repairs

R4 mapping: [ordered integration verification](../R4.md#ordered-next-implementation--pending-source-owner-work), not a new ML activation repair.
Arena owns [P1](../R4.md#p1)–[P8](../R4.md#p8); the app preserves existing unavailable-state guards and later matching-build checks.

1. Preserve disabled placeholder choices and existing selection/URL/session regression coverage.
2. Revalidate app checks from the matching integrated build at the appropriate verification gate.
3. Do not activate or alias ML IDs, add a training/arena dependency, or weaken unavailable-state guards to hide backend blockers.

No new form row, picker option, gate, or layout changes in this task.
Existing logic/wireframe owners remain unchanged.
Any future ML integration remains inactive and outside this current-implementation graph.

## Verification + References

- No fresh app tests, typecheck, build, or CSS-layout check runs in this documentation task.
- Older app reports are revision-scoped history, not a current green result.
- [Registry](../../../packages/starchess-core/src/ai/definitions.ts).
- [New Game panel](../../../apps/starchess/src/components/features/NewGamePanel.tsx).
- [Single route](../../../apps/starchess/src/screens/SingleScreen.tsx).
- [Saved setup](../../../apps/starchess/src/store/newGameSetupStore.ts) and [session store](../../../apps/starchess/src/store/matchSessionStore.ts).
- [App availability regressions](../e2e/STATUS.md).
- [Registry/guard concern](../../packages/starchess-core/adjutant-definitions.puml).
- [Menu logic](../../apps/starchess/menu-flow.puml) and [existing wireframe](../../apps/starchess/wireframe.puml).
- [Current ownership overview](../overview.puml).
