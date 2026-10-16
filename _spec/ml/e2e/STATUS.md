# e2e — current status

**[Unverified] 2026-10-16 · current declarative test source; no fresh browser run in this docs task.**

## Responsibility

- Own browser regression verification at [`apps/e2e/`](../../../apps/e2e/).
- Exercise the StarChess app through its Playwright harness.
- Verify opponent selection, direct URL handling, saved sessions, and live-match admission behavior.
- Supply browser evidence, not auditor completeness, native formal proof, or production runtime authority.

## Current findings

- [`starchess-opponents.spec.ts`](../../../apps/e2e/tests/starchess/starchess-opponents.spec.ts) already declares playable and unavailable-opponent cases.
- Cases cover all registry labels, disabled ML/RLHF/RLCD options, playable selection persistence, and unavailable direct URLs.
- Saved unavailable sessions preserve session/history/achievement data; setup normalization and strategic rematch behavior also have declared controls.
- The browser target is the app, **not** a manifest dependency on core, arena, or training.
- The [e2e manifest](../../../apps/e2e/package.json) declares no such workspace dependencies.
- No newly identified browser defect or current browser PASS follows from test-source presence.

## Latest suggested repairs

R4 mapping: [ordered integration verification](../R4.md#ordered-next-implementation--pending-source-owner-work) retains these existing unavailable-opponent regressions.
[P1](../R4.md#p1)–[P8](../R4.md#p8) are arena solver refinements, not browser-owned patterns or ML activation work.
Fresh browser evidence belongs to the matching integrated build; declared controls alone prove no current PASS.

1. Retain existing unavailable-opponent cases and their assertions.
2. Run existing browser checks against the matching app build at the appropriate integration gate.
3. Report actual failures and skips from that run; never substitute source inspection for execution.
4. Add no ML activation, weakened admission assertion, or package dependency as a workaround for unrelated auditor failures.

No new browser test implementation is authorized by this documentation projection.
The graph records an existing browser target, not a deployed model path.

## Verification + References

- No browser, Playwright, build, or runtime-image command runs in this task.
- Earlier browser results, if retained elsewhere, do not certify current source.
- [Current app status](../starchess/STATUS.md).
- [Existing test source](../../../apps/e2e/tests/starchess/starchess-opponents.spec.ts).
- [Playwright configuration](../../../apps/e2e/playwright.config.ts).
- [Registry and availability contract](../../packages/starchess-core/adjutant-definitions.puml).
- [Existing harness diagram](../../apps/e2e/nx-compose.puml).
- [Original roadmap](../../_plans/PLAN-ml-adjutant.md).
- [Current ownership overview](../overview.puml).
