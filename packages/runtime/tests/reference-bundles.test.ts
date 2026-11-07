// SPEC: _spec/runtime-protocol.puml, _spec/gate-closure.puml
import { mkdtempSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { buildReferenceBundles } from "../../../tooling/build-reference";
import { referenceProofDriver } from "../src/reference-driver";
import { auditPinnedCorpus } from "../src/corpus";
import fixture from "./fixtures/native-reference-proof.json";
import expected from "./fixtures/reference-sources.json";
import { StrategicDriver } from "../src/strategic";
import { deriveStream } from "../src/rng";
import { initializeGame, openGame } from "../../contracts/src/game-session";

test("C14 standard Bun bundles retain six pinned source APIs and bounded in-process reference fingerprints", async () => {
  const source = "/home/gu1lty/Projects/proveo/chess-coach", root = `${mkdtempSync("/tmp/opencode/chess-coach-ii-reference-bundles-")}/reference`;
  const outputs = buildReferenceBundles(source, root);
  expect(outputs).toHaveLength(6);
  expect(outputs.every(output => output.inputs.every(input => !input.path.includes("packages/game-core") && !input.path.startsWith("../")))).toBe(true);
  const load = (path: string) => import(`${root}/${path}`);
  const [core, session, admission, bank, strategic, corpus] = await Promise.all([
    load("packages/starchess-core/src/index.ts"), load("packages/starchess-arena/src/challenge/r3Session.ts"), load("packages/starchess-arena/src/challenge/admission.ts"),
    load("packages/starchess-arena/src/run/bank.ts"), load("packages/starchess-arena/src/players/strategic.ts"), load("packages/starchess-arena/src/challenge/corpus.ts"),
  ]);
  expect(typeof strategic.strategicScript).toBe("function");
  for (const side of ["w", "b"] as const) {
    const initial = initializeGame(), opened = openGame(initial), rng = deriveStream(101, "opponent");
    const driver = new StrategicDriver("synthetic", side, initial.snapshot, rng, { strategicScript: strategic.strategicScript,
      seedKvsForOpening: core.seedKvsForOpening, seedCcIntelForOpening: core.seedCcIntelForOpening, seedRunnerMemory: core.seedRunnerMemory, seedAttackerMemory: core.seedAttackerMemory,
      updateKvsForSnap: core.updateKvsForSnap, updateCcIntelForSnap: core.updateCcIntelForSnap, updateRunnersForSnap: core.updateRunnersForSnap,
      updateAttackersForSnap: core.updateAttackersForSnap, witnessFromEndTurn: core.witnessFromEndTurn }, () => 0n, 100_000_000_000n);
    driver.advance(opened);
    const journal = await driver.plan(JSON.stringify({ version: "chess-coach.plan-permit.v1", attemptId: "synthetic", permitId: `synthetic:plan:0:${side}`,
      planningOrdinal: 0, turn: 0, side, role: "strategic", issuedNs: "0", deadlineNs: "10000000000" }));
    expect(createHash("sha256").update(journal).digest("hex")).toBe(expected.strategic.find(entry => entry.side === side)!.digest);
  }
  const driver = referenceProofDriver({ parseScFen: core.parseScFen, initializeR3Session: session.initializeR3Session, stageR3Begin: session.stageR3Begin,
    stageR3Settlement: session.stageR3Settlement, verifyAndCommitR3: session.verifyAndCommitR3, stageQueue: admission.stageQueue, grantStoredIncome: bank.grantStoredIncome });
  const initialized = driver.initialize(), opened = driver.open(driver.commit!(initialized.state)), settled = driver.settle(driver.commit!(opened.state), { w: [], b: [] });
  driver.commit!(settled.state);
  for (const [index, result] of [initialized, opened, settled].entries()) {
    const bytes = Buffer.from(JSON.stringify(result.boundary));
    expect(bytes.byteLength).toBe(fixture.stages[index]!.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.stages[index]!.sha256);
  }
  const audited = await auditPinnedCorpus(readFileSync(`${source}/_spec/corpora/ml-adjutant-corpus.manifest.json`),
    readFileSync(`${source}/starchess-match-history-20260929-203446.json`), corpus.auditCorpus);
  expect(audited.window(0, 0)?.planningOrdinal).toBe(0);
  expect(() => buildReferenceBundles(source, root)).toThrow();
}, 30_000);
