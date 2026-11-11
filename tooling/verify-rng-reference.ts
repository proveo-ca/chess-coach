// SPEC: _spec/policy-runtime.puml
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { deriveRoster, drawStream } from "../packages/runtime/src/rng";
import fixture from "../packages/runtime/tests/fixtures/rng-reference.json";

const referenceRoot = "/home/gu1lty/Projects/proveo/chess-coach";
const { mulberry32 } = await import(`${referenceRoot}/${fixture.source}`);
const results = [];
for (const [index, entry] of deriveRoster().entries()) {
  const expected = fixture.roots[index]!, reference = mulberry32(entry.stream.root), draws: number[] = [];
  let stream = { ...entry.stream, status: "active" as const };
  for (let i = 0; i < fixture.drawsPerRoot; i++) {
    const value: number = reference(), actual = drawStream(stream);
    if (actual.uniform !== value) throw new Error("Reference RNG parity mismatch");
    stream = { ...actual.after, status: "active" };
    draws.push(value);
  }
  results.push({ master: entry.master, label: entry.label, root: entry.stream.root, drawsSha256: createHash("sha256").update(JSON.stringify(draws)).digest("hex") });
  if (!isDeepStrictEqual(results.at(-1), expected)) throw new Error("Reference RNG fingerprint mismatch");
}
console.log(JSON.stringify({ scope: "BOUNDED_STATIC_RNG_FIXTURE_ONLY", reference: fixture.reference, draws: results.length * fixture.drawsPerRoot, results }));
