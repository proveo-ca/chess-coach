// SPEC: _spec/tooling/native-ingress/gate0-checker.puml
import { createHash } from "node:crypto";
import fs from "node:fs";
import { isAbsolute, posix, resolve } from "node:path";
import { parseArgs } from "node:util";

export const LIMITS = Object.freeze({ inputBytes: 1048576, totalBytes: 2097152, depth: 32, rows: 8192,
  stringBytes: 4096, nodes: 200000, edges: 65536, ledgerLines: 32768, blockers: 256 });
export const REQUIRED_RECORD_IDS = Object.freeze([
  "PLAN", "INPUTS", "UNITS", "PRODUCERS", "RECIPE", "TRUST", "INVOICE", "FIT", "AUDITS", "OUTPUT_METHOD", "VERIFICATION",
  "U-ROOT", "U-RESOLVE", "U-PRODUCER", "U-QUERY", "U-GENERATED", "U-MACRO", "U-METADATA", "U-LINK", "U-NATIVE", "U-ENFORCE", "U-BOUNDS", "U-HANDOFF",
  "G1", "S0", "FIRST_EFFECT", "CREATOR.A", "INIT.B", "NODE.MAIN", "NODE.REFERENCE",
  "FD.MAIN.0", "FD.MAIN.1", "FD.MAIN.2", "FD.REFERENCE.0", "FD.REFERENCE.1", "FD.REFERENCE.2",
]);
const ACTORS = ["G1", "S0", "FIRST_EFFECT", "CREATOR.A", "INIT.B", "NODE.MAIN", "NODE.REFERENCE"];
const REQUIRED = new Set(REQUIRED_RECORD_IDS);
const AUTHORITY = Object.freeze({ gate0: "OPEN", f9Qualified: false, trainingReady: false });
const SHA = /^[0-9a-f]{64}$/;
const ID = /^[A-Z][A-Z0-9_.:-]{0,63}$/;
const REVIEW = Object.freeze(["INPUT_AUTHENTICITY", "EXHAUSTIVE_SELECTED_CLOSURE", "SOURCE_AND_API_ASSIGNMENTS",
  "PROTECTED_BACKING_AND_ORIGINAL_S0", "FIRST_CREDITOR_AND_DISJOINT_TARIFFS", "PHYSICAL_ENFORCEMENT_AND_OVERLAP",
  "CURRENT_AUDIT_TRUTH", "POST_BUILD_REGISTRATION_METHOD", "INDEPENDENT_RECORD_ACCEPTANCE"]);
const NEXT = Object.freeze({
  PROFILE_REQUIRED: "Supply --profile ABS and --ledger ABS for the proposed record inventory.",
  LEDGER_REQUIRED: "Supply the explicit canonical section-8 ledger snapshot with --ledger ABS.",
  ARGUMENTS_INVALID: "Use --plan alone or --profile ABS --ledger ABS with optional --finalize.",
  INPUT_INVALID: "Supply bounded UTF-8 input bytes without a BOM.",
  INPUT_TOO_LARGE: "Keep each explicit input within the declared development software caps.",
  INPUT_READ_FAILED: "Supply a readable regular non-symlink input leaf.",
  INPUT_CHANGED: "Supply a stable input snapshot; no retry or replacement is automatic.",
  JSON_INVALID: "Correct duplicate keys, forbidden keys, encoding, numbers, nesting or JSON syntax.",
  LEDGER_INVALID: "Supply one unfenced section-8 heading and bounded original ledger lines.",
  PROFILE_INVALID: "Supply the exact proposed f9-gate0-profile-v1 schema and bounded tables.",
  ROW_INVALID: "Complete the exact typed row shape without unknown fields or duplicate references.",
  DUPLICATE_ID: "Assign globally unique declared IDs across all profile tables.",
  MISSING_RECORD: "Describe the named obligation without fabricating evidence or acceptance.",
  RECORD_OPEN: "Resolve the proposed record content for independent review; do not infer acceptance.",
  RECORD_UNDESCRIBED: "Provide a nonempty description and explicit source references.",
  DANGLING_REFERENCE: "Complete the declared cross-reference graph.",
  RECORD_UNREFERENCED: "Connect the detail record to a required record or supporting row.",
  MISSING_FILES: "Declare the exact source, test and tool file/API plan.",
  MISSING_INPUTS: "Declare independent source, tool and reference input identities.",
  MISSING_UNITS: "Populate the selected Rust, Node and native build-unit inventory.",
  MISSING_PRODUCERS: "Describe selected producer methods, failures, outputs and consumers.",
  MISSING_KIND: "Include every required file, input and unit kind in the declared inventory.",
  IDENTITY_INVALID: "Declare identities only at the permitted profile stage.",
  OUTPUT_IDENTITY_FORBIDDEN: "Keep planned-output identities null; actual outputs follow approved production.",
  OUTPUT_OWNERSHIP_INVALID: "Give each logical planned output exactly one declared producer.",
  PRODUCER_CONSUMER_MISSING: "Connect each producer and independent input to a declared consuming unit.",
  DEPENDENCY_CYCLE: "Resolve the declared build-unit or producer dependency cycle.",
  INVOICE_INVALID: "Provide safe integer quantities, positive coefficients and checked invoice terms.",
  INVOICE_CAP_EXCEEDED: "Fit new work plus existing-ledger and unchanged F1 maxima within 1048576 units.",
  PHYSICAL_PEAK_INVALID: "Declare finite resource maxima, time bounds and enforcement records.",
  PHYSICAL_ROLE_COVERAGE_MISSING: "Cover every declared unit and required actor label across the peak rows.",
  DECISION_BINDING_MISSING: "Propose one exact section-8 binding per required record.",
  DECISION_BINDING_INVALID: "Bind the exact record, canonical profile, raw ledger and original-byte excerpt.",
  LEDGER_MARKER_MISSING: "Propose the standalone record marker within section 8; never auto-insert acceptance.",
  LEDGER_MARKER_DUPLICATE: "Resolve duplicate unfenced record markers in the section-8 snapshot.",
  ACCEPTANCE_PROTOCOL_UNAPPROVED: "Independently approve an acceptance protocol before implementing trusted finalization.",
});
const faults = new WeakMap();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, names) => object(value) && Object.keys(value).length === names.length
  && names.every((key) => Object.hasOwn(value, key));
const identity = (value) => exact(value, ["bytes", "sha256"]) && integer(value.bytes) && value.bytes > 0
  && typeof value.sha256 === "string" && SHA.test(value.sha256);

function refuse(code) {
  const error = new Error("GATE0_CHECK_REFUSED");
  faults.set(error, code);
  throw error;
}

function decode(bytes) {
  if (!Buffer.isBuffer(bytes)) refuse("INPUT_INVALID");
  if (bytes.length > LIMITS.inputBytes) refuse("INPUT_TOO_LARGE");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { refuse("INPUT_INVALID"); }
  if (text.startsWith("\ufeff")) refuse("INPUT_INVALID");
  return text;
}

function uniqueJson(text) {
  let offset = 0, nodes = 0;
  const bad = () => refuse("JSON_INVALID");
  const whitespace = () => { while (/[\t\n\r ]/.test(text[offset] ?? "!")) offset++; };
  const string = () => {
    const start = offset++;
    while (offset < text.length) {
      const character = text[offset++];
      if (character === "\\") { offset++; continue; }
      if (character !== '"') continue;
      let result;
      try { result = JSON.parse(text.slice(start, offset)); } catch { bad(); }
      if (Buffer.byteLength(result) > LIMITS.stringBytes || /[\x00-\x1f\x7f-\x9f]/.test(result)
        || Buffer.from(result).toString("utf8") !== result) bad();
      return result;
    }
    bad();
  };
  const value = (depth) => {
    if (depth > LIMITS.depth || ++nodes > LIMITS.nodes) bad();
    whitespace();
    const character = text[offset];
    if (character === '"') return string();
    if (character === "{" || character === "[") {
      const keyed = character === "{", end = keyed ? "}" : "]", result = keyed ? Object.create(null) : [];
      offset++; whitespace();
      if (text[offset] === end) { offset++; return result; }
      while (offset < text.length) {
        let key;
        if (keyed) {
          if (text[offset] !== '"') bad();
          key = string();
          if (["__proto__", "prototype", "constructor"].includes(key) || Object.hasOwn(result, key)) bad();
          whitespace();
          if (text[offset++] !== ":") bad();
        }
        const entry = value(depth + 1);
        if (keyed) result[key] = entry; else result.push(entry);
        whitespace();
        if (text[offset] === end) { offset++; return result; }
        if (text[offset++] !== ",") bad();
        whitespace();
      }
      bad();
    }
    for (const [literal, result] of [["null", null], ["true", true], ["false", false]]) {
      if (text.startsWith(literal, offset)) { offset += literal.length; return result; }
    }
    const token = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(offset))?.[0];
    if (!token) bad();
    const result = Number(token);
    if (!Number.isSafeInteger(result) || Object.is(result, -0)) bad();
    const parts = /^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(token);
    let digits = (parts[2] + (parts[3] ?? "")).replace(/^0+/, "");
    if (digits) {
      const scale = Number(parts[4] ?? 0) - (parts[3]?.length ?? 0);
      if (!Number.isSafeInteger(scale) || digits.length + scale < 1 || digits.length + scale > 16) bad();
      if (scale < 0) {
        if (/[^0]/.test(digits.slice(digits.length + scale))) bad();
        digits = digits.slice(0, digits.length + scale);
      } else digits += "0".repeat(scale);
      if (BigInt(parts[1] + digits) !== BigInt(result)) bad();
    }
    offset += token.length;
    return result;
  };
  const result = value(0);
  whitespace();
  if (offset !== text.length) bad();
  return result;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function normalizedPath(value, absoluteOnly = false) {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= 4096
    && !/[\\\x00-\x1f\x7f-\x9f]/.test(value) && Buffer.from(value).toString("utf8") === value
    && (!absoluteOnly || isAbsolute(value)) && posix.normalize(value) === value
    && value !== "/" && !value.endsWith("/") && !value.split("/").some((part) => part === "." || part === "..");
}

function ledgerSection(bytes) {
  const text = decode(bytes), lines = [];
  let offset = 0, byteOffset = 0, fence = null;
  while (offset < text.length) {
    if (lines.length === LIMITS.ledgerLines) refuse("LEDGER_INVALID");
    const lf = text.indexOf("\n", offset), end = lf < 0 ? text.length : lf + 1;
    const raw = text.slice(offset, end), content = raw.replace(/\r?\n$/, ""), width = Buffer.byteLength(raw);
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    const wasFenced = fence !== null;
    if (fence) {
      if (opening && opening[1][0] === fence[0] && opening[1].length >= fence.length && !opening[2].trim()) fence = null;
    } else if (opening) fence = opening[1];
    lines.push({ content, start: byteOffset, end: byteOffset + width, fenced: wasFenced || opening !== null });
    byteOffset += width; offset = end;
  }
  const levelTwo = (line) => !line.fenced && /^ {0,3}##(?:[ \t]+(.*)|$)/.exec(line.content);
  const headings = lines.flatMap((line, index) => levelTwo(line)?.[1]?.startsWith("8 · Explicit acceptance checklist:") ? [index] : []);
  if (headings.length !== 1) refuse("LEDGER_INVALID");
  const start = headings[0];
  const following = lines.findIndex((line, index) => index > start && levelTwo(line));
  const end = following < 0 ? lines.length : following, markers = new Map();
  for (let index = start + 1; index < end; index++) {
    const match = !lines[index].fenced && /^<!-- gate0-record:([A-Z][A-Z0-9_.:-]{0,63}) -->$/.exec(lines[index].content);
    if (match) {
      if (!markers.has(match[1])) markers.set(match[1], []);
      markers.get(match[1]).push(index);
    }
  }
  return { lines, start, end, markers };
}

function emptyReport() {
  return { schema: "f9-gate0-report-v1", scope: "OFFLINE_STRUCTURAL_CONSISTENCY_ONLY", mechanical: "BLOCKED",
    finalization: "NOT_REQUESTED", acceptanceProtocol: "UNAPPROVED", ledgerTrust: "UNAUTHENTICATED_SNAPSHOT",
    blockers: [], omittedBlockers: 0, profileSha256: null, profileBytesSha256: null, ledgerSha256: null,
    requiredRecordIds: [...REQUIRED_RECORD_IDS], reviewObligations: [...REVIEW], ...AUTHORITY };
}

function addBlocker(report, code, recordId = null, index = null) {
  const entry = { code, recordId: REQUIRED.has(recordId) ? recordId : null,
    index: integer(index) ? index : null, nextArtifact: NEXT[code] };
  if (report.blockers.length < LIMITS.blockers) report.blockers.push(entry);
  else report.omittedBlockers++;
}

function validateProfile(profile, ledgerBytes, section, report) {
  const add = (code, recordId, index) => addBlocker(report, code, recordId, index);
  const fields = ["schema", "stage", "records", "files", "inputs", "units", "producers", "invoice", "physicalPeaks", "decisionBindings"];
  if (!exact(profile, fields) || profile.schema !== "f9-gate0-profile-v1" || !["anticipated", "implemented"].includes(profile.stage)) {
    add("PROFILE_INVALID"); return;
  }
  const withoutBindings = Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "decisionBindings"));
  report.profileSha256 = hash(canonical(withoutBindings));
  const rows = (value) => {
    if (!Array.isArray(value) || value.length > LIMITS.rows) { add("PROFILE_INVALID"); return []; }
    return value;
  };
  const global = new Set(), records = new Map(), files = new Map(), inputs = new Map(), units = new Map(), producers = new Map();
  const recordRoots = new Set(REQUIRED_RECORD_IDS), recordEdges = new Map(), rowIndices = new WeakMap();
  let edges = 0;
  const declare = (row, names, map, index) => {
    if (!exact(row, names) || typeof row.id !== "string" || !ID.test(row.id)) { add("ROW_INVALID", null, index); return false; }
    if (global.has(row.id)) { add("DUPLICATE_ID", row.id, index); return false; }
    global.add(row.id); map?.set(row.id, row); rowIndices.set(row, index); return true;
  };
  const list = (values, nonempty = false, index = null) => {
    if (!Array.isArray(values) || values.length > LIMITS.rows || (nonempty && !values.length)
      || values.some((id) => typeof id !== "string" || !ID.test(id)) || new Set(values).size !== values.length) {
      add("ROW_INVALID", null, index); return [];
    }
    edges += values.length;
    if (edges > LIMITS.edges) refuse("PROFILE_INVALID");
    return values;
  };
  const reference = (id, map, index = null) => {
    if (typeof id !== "string" || !ID.test(id) || !map.has(id)) { add("DANGLING_REFERENCE", id, index); return false; }
    return true;
  };
  const recordRef = (id, index) => {
    if (reference(id, records, index)) recordRoots.add(id);
  };
  rows(profile.records).forEach((row, index) => {
    if (!declare(row, ["id", "state", "text", "refs", "sourceRefs"], records, index)) return;
    if (!["OPEN", "DESCRIBED"].includes(row.state)) add("ROW_INVALID", row.id, index);
    else if (row.state === "OPEN") add("RECORD_OPEN", row.id, index);
    if (typeof row.text !== "string" || !row.text.trim() || !Array.isArray(row.sourceRefs) || !row.sourceRefs.length) {
      add("RECORD_UNDESCRIBED", row.id, index);
    }
    rows(row.sourceRefs).forEach((source) => {
      if (!exact(source, ["path", "anchor"]) || !normalizedPath(source.path)
        || typeof source.anchor !== "string" || !/^[A-Za-z0-9_.:-]{1,256}$/.test(source.anchor)) add("ROW_INVALID", row.id, index);
    });
  });
  for (const id of REQUIRED_RECORD_IDS) if (!records.has(id)) add("MISSING_RECORD", id);
  for (const row of records.values()) {
    const index = rowIndices.get(row);
    recordEdges.set(row.id, list(row.refs, false, index).filter((id) => reference(id, records, index)));
  }
  const requiredLinks = { PLAN: ["RECIPE", "VERIFICATION"], INPUTS: ["UNITS", "RECIPE"],
    UNITS: ["U-ROOT", "U-RESOLVE"], PRODUCERS: ["U-PRODUCER", "U-QUERY", "U-GENERATED", "U-MACRO", "U-METADATA", "U-LINK", "U-NATIVE", "U-ENFORCE"],
    RECIPE: ["UNITS", "PRODUCERS"], TRUST: [...ACTORS, ...REQUIRED_RECORD_IDS.filter((id) => id.startsWith("FD."))],
    INVOICE: ["U-BOUNDS", "FIRST_EFFECT"], FIT: ["U-BOUNDS", "U-ENFORCE"], AUDITS: ["VERIFICATION", "U-ENFORCE"], OUTPUT_METHOD: ["U-HANDOFF"] };
  for (const [id, targets] of Object.entries(requiredLinks)) {
    if (records.has(id) && targets.some((target) => !recordEdges.get(id).includes(target))) add("DANGLING_REFERENCE", id, rowIndices.get(records.get(id)));
  }
  rows(profile.files).forEach((row, index) => {
    if (!declare(row, ["id", "path", "role", "apiIds", "identity"], files, index)) return;
    if (!normalizedPath(row.path) || !["source", "test", "tool", "planned-output"].includes(row.role)) add("ROW_INVALID", null, index);
    for (const id of list(row.apiIds, true, index)) recordRef(id, index);
    if (row.role === "planned-output") {
      if (row.identity !== null) add("OUTPUT_IDENTITY_FORBIDDEN", null, index);
    } else if (profile.stage === "anticipated" ? row.identity !== null : !identity(row.identity)) add("IDENTITY_INVALID", null, index);
  });
  rows(profile.inputs).forEach((row, index) => {
    if (!declare(row, ["id", "kind", "bytes", "sha256", "recordId"], inputs, index)) return;
    if (!["source", "tool", "reference"].includes(row.kind) || !identity({ bytes: row.bytes, sha256: row.sha256 })) add("IDENTITY_INVALID", null, index);
    recordRef(row.recordId, index);
  });
  rows(profile.units).forEach((row, index) => {
    if (!declare(row, ["id", "kind", "fileId", "inputIds", "dependencyIds", "producerIds", "configRecordId"], units, index)) return;
    if (!["rust", "node", "native"].includes(row.kind)) add("ROW_INVALID", null, index);
    if (reference(row.fileId, files, index) && files.get(row.fileId).role === "planned-output") add("ROW_INVALID", null, index);
    recordRef(row.configRecordId, index);
  });
  rows(profile.producers).forEach((row, index) => {
    if (!declare(row, ["id", "kind", "unitId", "predecessorIds", "outputIds", "methodRecordId", "failureRecordId"], producers, index)) return;
    if (!["build-script", "compiler", "proc-macro", "query", "metadata", "link", "copy", "validator", "native-helper"].includes(row.kind)) add("ROW_INVALID", null, index);
    reference(row.unitId, units, index); recordRef(row.methodRecordId, index); recordRef(row.failureRecordId, index);
  });
  for (const [map, code, property, kinds] of [[files, "MISSING_FILES", "role", ["source", "test", "tool"]],
    [inputs, "MISSING_INPUTS", "kind", ["source", "tool", "reference"]], [units, "MISSING_UNITS", "kind", ["rust", "node", "native"]]]) {
    if (!map.size) add(code);
    if (kinds.some((kind) => ![...map.values()].some((row) => row[property] === kind))) add("MISSING_KIND");
  }
  if (!producers.size) add("MISSING_PRODUCERS");
  const consumedInputs = new Set(), consumedProducers = new Set(), unitEdges = new Map(), producerEdges = new Map(), owners = new Map();
  for (const row of units.values()) {
    const index = rowIndices.get(row);
    for (const id of list(row.inputIds, true, index)) if (reference(id, inputs, index)) consumedInputs.add(id);
    for (const id of list(row.producerIds, false, index)) if (reference(id, producers, index)) consumedProducers.add(id);
    unitEdges.set(row.id, list(row.dependencyIds, false, index).filter((id) => reference(id, units, index)));
  }
  for (const row of producers.values()) {
    const index = rowIndices.get(row);
    for (const id of list(row.outputIds, true, index)) {
      if (!reference(id, files, index) || files.get(id).role !== "planned-output") { add("OUTPUT_OWNERSHIP_INVALID", null, index); continue; }
      owners.set(id, (owners.get(id) ?? 0) + 1);
    }
    producerEdges.set(row.id, list(row.predecessorIds, false, index).filter((id) => reference(id, producers, index)));
  }
  if ([...inputs.keys()].some((id) => !consumedInputs.has(id)) || [...producers.keys()].some((id) => !consumedProducers.has(id))) add("PRODUCER_CONSUMER_MISSING");
  if ([...files.values()].some((row) => row.role === "planned-output" && owners.get(row.id) !== 1)) add("OUTPUT_OWNERSHIP_INVALID");
  for (const graph of [unitEdges, producerEdges]) {
    const incoming = new Map([...graph.keys()].map((id) => [id, 0])), followers = new Map([...graph.keys()].map((id) => [id, []]));
    for (const [id, deps] of graph) for (const dep of deps) { incoming.set(id, incoming.get(id) + 1); followers.get(dep).push(id); }
    const queue = [...incoming].filter(([, count]) => !count).map(([id]) => id);
    for (let index = 0; index < queue.length; index++) for (const follower of followers.get(queue[index])) {
      incoming.set(follower, incoming.get(follower) - 1);
      if (!incoming.get(follower)) queue.push(follower);
    }
    if (queue.length !== graph.size) add("DEPENDENCY_CYCLE");
  }
  if (!exact(profile.invoice, ["terms", "existingLedgerMax", "F1Max"]) || !integer(profile.invoice.existingLedgerMax) || !integer(profile.invoice.F1Max)) add("INVOICE_INVALID");
  else {
    let total = BigInt(profile.invoice.existingLedgerMax) + BigInt(profile.invoice.F1Max);
    const terms = rows(profile.invoice.terms);
    if (!terms.length) add("INVOICE_INVALID");
    terms.forEach((row, index) => {
      if (!declare(row, ["id", "quantity", "coefficient", "recordId"], null, index)) return;
      recordRef(row.recordId, index);
      if (!integer(row.quantity) || !integer(row.coefficient) || row.coefficient === 0) { add("INVOICE_INVALID", null, index); return; }
      const product = BigInt(row.quantity) * BigInt(row.coefficient);
      total += product;
      if (product > BigInt(Number.MAX_SAFE_INTEGER) || total > BigInt(Number.MAX_SAFE_INTEGER)) add("INVOICE_INVALID", null, index);
    });
    if (total > 1048576n) add("INVOICE_CAP_EXCEEDED", "INVOICE");
  }
  const neededRoles = new Set([...units.keys(), ...ACTORS]), coveredRoles = new Set();
  const peaks = rows(profile.physicalPeaks), peakNames = ["id", "roleIds", "cpuMillis", "rssBytes", "pids", "fds", "bytes", "inodes", "outputBytes", "elapsedMillis", "enforcementRecordId"];
  if (!peaks.length) add("PHYSICAL_PEAK_INVALID", "FIT");
  peaks.forEach((row, index) => {
    if (!declare(row, peakNames, null, index)) return;
    if (peakNames.slice(2, -1).some((key) => !integer(row[key])) || row.elapsedMillis < 1 || row.elapsedMillis > 300000) add("PHYSICAL_PEAK_INVALID", "FIT", index);
    recordRef(row.enforcementRecordId, index);
    for (const id of list(row.roleIds, true, index)) {
      if (!neededRoles.has(id)) add("PHYSICAL_PEAK_INVALID", "FIT", index); else coveredRoles.add(id);
    }
  });
  if ([...neededRoles].some((id) => !coveredRoles.has(id))) add("PHYSICAL_ROLE_COVERAGE_MISSING", "FIT");
  const connectedRecords = new Set(recordRoots), recordQueue = [...recordRoots];
  for (let index = 0; index < recordQueue.length; index++) for (const id of recordEdges.get(recordQueue[index]) ?? []) {
    if (!connectedRecords.has(id)) { connectedRecords.add(id); recordQueue.push(id); }
  }
  for (const id of records.keys()) if (!connectedRecords.has(id)) add("RECORD_UNREFERENCED", id, rowIndices.get(records.get(id)));
  const bound = new Set();
  rows(profile.decisionBindings).forEach((row, index) => {
    const names = ["recordId", "recordSha256", "profileSha256", "ledgerSha256", "ledgerSection", "startLine", "endLine", "excerptSha256"];
    if (!exact(row, names) || !records.has(row.recordId) || bound.has(row.recordId)) { add("DECISION_BINDING_INVALID", row?.recordId, index); return; }
    bound.add(row.recordId);
    const markers = section.markers.get(row.recordId) ?? [];
    if (!markers.length) add("LEDGER_MARKER_MISSING", row.recordId, index);
    if (markers.length > 1) add("LEDGER_MARKER_DUPLICATE", row.recordId, index);
    const ranged = integer(row.startLine) && integer(row.endLine) && row.startLine > section.start + 1
      && row.endLine >= row.startLine && row.endLine <= section.end;
    let valid = ranged && row.ledgerSection === "8" && markers.length === 1
      && markers[0] >= row.startLine - 1 && markers[0] <= row.endLine - 1;
    if (valid) valid = SHA.test(row.excerptSha256) && row.excerptSha256 === hash(ledgerBytes.subarray(
      section.lines[row.startLine - 1].start, section.lines[row.endLine - 1].end));
    if (!valid || !SHA.test(row.recordSha256) || row.recordSha256 !== hash(canonical(records.get(row.recordId)))
      || row.profileSha256 !== report.profileSha256 || row.ledgerSha256 !== report.ledgerSha256) add("DECISION_BINDING_INVALID", row.recordId, index);
  });
  for (const id of REQUIRED_RECORD_IDS) {
    if (!bound.has(id)) add("DECISION_BINDING_MISSING", id);
    const markers = section.markers.get(id) ?? [];
    if (!bound.has(id) && !markers.length) add("LEDGER_MARKER_MISSING", id);
    if (!bound.has(id) && markers.length > 1) add("LEDGER_MARKER_DUPLICATE", id);
  }
}

export function checkProfile(profileBytes, ledgerBytes, { finalize = false } = {}) {
  const report = emptyReport();
  try {
    if (typeof finalize !== "boolean") refuse("ARGUMENTS_INVALID");
    if (!Buffer.isBuffer(profileBytes) || !Buffer.isBuffer(ledgerBytes)) refuse("INPUT_INVALID");
    if (profileBytes.length + ledgerBytes.length > LIMITS.totalBytes) refuse("INPUT_TOO_LARGE");
    const text = decode(profileBytes);
    report.profileBytesSha256 = hash(profileBytes);
    decode(ledgerBytes); report.ledgerSha256 = hash(ledgerBytes);
    validateProfile(uniqueJson(text), ledgerBytes, ledgerSection(ledgerBytes), report);
  } catch (error) { addBlocker(report, faults.get(error) ?? "PROFILE_INVALID"); }
  report.mechanical = report.blockers.length || report.omittedBlockers ? "BLOCKED" : "READY_FOR_REVIEW";
  if (finalize === true) { report.finalization = "BLOCKED"; addBlocker(report, "ACCEPTANCE_PROTOCOL_UNAPPROVED"); }
  return report;
}

export function readGate0Input(path, io = fs) {
  if (!normalizedPath(path, true) || resolve(path) !== path) refuse("ARGUMENTS_INVALID");
  let fd, failed = false;
  try {
    fd = io.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = io.fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.size < 0n) refuse("INPUT_READ_FAILED");
    if (before.size > BigInt(LIMITS.inputBytes)) refuse("INPUT_TOO_LARGE");
    const buffer = Buffer.alloc(Number(before.size) + 1);
    let count = 0;
    while (count < buffer.length) {
      const received = io.readSync(fd, buffer, count, buffer.length - count, null);
      if (!Number.isSafeInteger(received) || received < 0 || received > buffer.length - count) refuse("INPUT_READ_FAILED");
      if (!received) break;
      count += received;
    }
    const after = io.fstatSync(fd, { bigint: true });
    if (BigInt(count) !== before.size || !after.isFile()
      || ["dev", "ino", "uid", "gid", "mode", "nlink", "size", "mtimeNs", "ctimeNs"].some((key) => before[key] !== after[key])) refuse("INPUT_CHANGED");
    return buffer.subarray(0, count);
  } catch (error) { failed = true; if (faults.has(error)) throw error; refuse("INPUT_READ_FAILED"); }
  finally {
    if (fd !== undefined) {
      try { io.closeSync(fd); } catch { if (!failed) refuse("INPUT_READ_FAILED"); }
    }
  }
}

function plan() {
  return { schema: "f9-gate0-plan-v1", result: "PLAN_ONLY", scope: "OFFLINE_STRUCTURAL_CONSISTENCY_ONLY",
    profileSchema: "f9-gate0-profile-v1", stages: ["anticipated", "implemented"], requiredRecords: [...REQUIRED_RECORD_IDS],
    limits: { ...LIMITS }, acceptanceProtocol: "UNAPPROVED", finalization: "BLOCKED",
    previewEffects: { reads: false, subprocesses: false, writes: false, network: false }, ...AUTHORITY };
}

export async function main(argv, { output = console.log, read = readGate0Input } = {}) {
  let report, exit = 2, finalizing = false;
  try {
    const { values, tokens } = parseArgs({ args: argv, strict: true, allowPositionals: false, tokens: true, options: {
      plan: { type: "boolean" }, profile: { type: "string" }, ledger: { type: "string" }, finalize: { type: "boolean" },
    } });
    finalizing = values.finalize === true;
    if (tokens.some((token) => token.kind !== "option") || new Set(tokens.map((token) => token.name)).size !== tokens.length) refuse("ARGUMENTS_INVALID");
    if (values.plan) {
      if (tokens.length !== 1) refuse("ARGUMENTS_INVALID");
      report = plan(); exit = 0;
    } else if (!tokens.length) { report = emptyReport(); addBlocker(report, "PROFILE_REQUIRED"); }
    else {
      if (!values.profile) refuse("PROFILE_REQUIRED");
      if (!values.ledger) refuse("LEDGER_REQUIRED");
      if (!normalizedPath(values.profile, true) || !normalizedPath(values.ledger, true)) refuse("ARGUMENTS_INVALID");
      report = checkProfile(await read(values.profile), await read(values.ledger), { finalize: values.finalize ?? false });
      exit = report.mechanical === "READY_FOR_REVIEW" && report.finalization === "NOT_REQUESTED" ? 0 : 2;
    }
  } catch (error) { report = emptyReport(); addBlocker(report, faults.get(error) ?? "ARGUMENTS_INVALID"); }
  if (finalizing && report.finalization !== "BLOCKED") {
    report.finalization = "BLOCKED"; addBlocker(report, "ACCEPTANCE_PROTOCOL_UNAPPROVED"); exit = 2;
  }
  try { output(JSON.stringify(report)); } catch { return 2; }
  return exit;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
