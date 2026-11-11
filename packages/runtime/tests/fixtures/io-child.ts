// SPEC: _spec/runtime-protocol.puml
export {};
const mode = process.argv[2];
let buffer = "";
for await (const chunk of Bun.stdin.stream()) {
  buffer += new TextDecoder().decode(chunk);
  const end = buffer.indexOf("\n");
  if (end < 0) continue;
  const json = buffer.slice(0, end); buffer = buffer.slice(end + 1);
  if (mode === "partial") { await Bun.write(Bun.stdout, "{"); break; }
  if (mode === "stderr") { await Bun.write(Bun.stderr, "x".repeat(8192)); break; }
  if (mode === "unsolicited") { await Bun.write(Bun.stdout, "{}\n{}\n"); break; }
  await Bun.write(Bun.stderr, "synthetic-fixture\n");
  await Bun.write(Bun.stdout, json + "\n");
  if (mode === "nonzero") { process.exitCode = 7; break; }
  if (JSON.parse(json).operation === "close") break;
}
