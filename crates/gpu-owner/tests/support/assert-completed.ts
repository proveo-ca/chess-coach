// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [registrationPath] = Bun.argv.slice(2);
const registered = JSON.parse(readFileSync(registrationPath!, "utf8"));
const db = new Database(join(registered.layout.stateRoot, "private.sqlite"), { readonly: true });
let result;
try {
  result = { attempts: db.query("SELECT id,ordinal,status FROM attempts").all(), masters: db.query("SELECT master,pending,status FROM masters").all(),
    control: db.query("SELECT aborted FROM control").get() };
} finally { db.close(); }
const attempt = join(registered.layout.stateRoot, "packet-00", `attempt-${registered.attemptId}`);
const journalName = readdirSync(attempt).find(name => name.endsWith("verified-journal.bin"));
const events = readFileSync(join(attempt, journalName!), "utf8").trimEnd().split("\n").map(line => JSON.parse(line).event);
console.log(JSON.stringify({ ...result, matchExit: events.find(event => event.kind === "match-exit")?.value,
  learnersClosed: events.find(event => event.kind === "learners-closed")?.value }));
