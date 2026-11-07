// SPEC: _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { auditPinnedCorpus, CORPUS_SOURCE_BYTES } from "../packages/runtime/src/corpus";
import expected from "../packages/runtime/tests/fixtures/reference-sources.json";

const root = "/home/gu1lty/Projects/proveo/chess-coach";
const apiPath = `${root}/packages/starchess-arena/src/challenge/corpus.ts`;
const { auditCorpus } = await import(apiPath);
if (statSync(`${root}/_spec/corpora/ml-adjutant-corpus.manifest.json`).size > 1048576 || statSync(`${root}/starchess-match-history-20260929-203446.json`).size !== CORPUS_SOURCE_BYTES) throw new Error("Corpus static audit: FILE_BOUND");
const manifest = readFileSync(`${root}/_spec/corpora/ml-adjutant-corpus.manifest.json`);
const source = readFileSync(`${root}/starchess-match-history-20260929-203446.json`);
const corpus = await auditPinnedCorpus(manifest, source, auditCorpus);
let windows = 0, actions = 0;
const normalized = [];
for (let index = 0; index < 18; index++) {
  const prefix = [];
  for (let ordinal = 0; ordinal < 64; ordinal++) {
    const window = corpus.window(index, ordinal);
    if (window === null) break;
    windows++; actions += window.actions.length;
    prefix.push(window);
  }
  corpus.checkConsumedPrefix(index, prefix);
  normalized.push({ caseIndex: index, windows: prefix.length, normalizedPrefixSha256: createHash("sha256").update(JSON.stringify(prefix)).digest("hex") });
}
if (JSON.stringify(normalized) !== JSON.stringify(expected.corpus) || windows !== 282 || actions !== 576) throw new Error("Corpus static audit: FROZEN_EXPECTATIONS");
console.log(JSON.stringify({ scope: "READ_ONLY_EXISTING_CORPUS_STATIC_CODEC_AUDIT", reference: expected.reference,
  cases: 18, windows, actions, normalized, newGameRollouts: 0, trainingEpisodes: 0 }));
