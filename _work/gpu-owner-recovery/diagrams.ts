// SPEC: _spec/recovery.md
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { environment, prepare, repository, work } from "./provision";
import { runBounded } from "./verify";

const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const paths = ["_spec/gpu-owner.puml", "_spec/gpu-cooperative-policy.puml", "_spec/reference/object-graph-authentication.puml"];

async function main() {
  const [label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 3 || !/^[a-z0-9-]{1,48}$/.test(label ?? "")) throw Error("UNIQUE_DIAGRAM_LABEL_REQUIRED");
  await prepare();
  const directory = resolve(work, "runs", label!), output = resolve(work, "scratch", label!);
  await mkdir(directory, { mode: 0o700 });
  await mkdir(output, { mode: 0o700 });
  const sources = await Promise.all(paths.map(async path => {
    const bytes = await readFile(resolve(repository, path));
    if (bytes.byteLength > 65_536 || /^\s*!/m.test(bytes.toString("utf8"))) throw Error("BOUNDED_OFFLINE_DIAGRAM_REQUIRED");
    return { path, sha256: hash(bytes) };
  }));
  await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const argv = ["/opt/jre/bin/java", `-Djava.io.tmpdir=${environment.TMPDIR}`, "-Djava.awt.headless=true", "-jar", "/opt/plantuml.jar", "-charset", "UTF-8", "-tsvg", "-nometadata", "-failfast2", "-o", output, ...paths.map(path => resolve(repository, path))];
  const result = await runBounded(argv, directory, 60_000, { cwd: repository, environment: { ...environment, PLANTUML_SECURITY_PROFILE: "SANDBOX" } });
  const sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
  const outputs = await Promise.all((await readdir(output)).filter(name => name.endsWith(".svg")).sort().map(async name => {
    const path = resolve(output, name), bytes = await readFile(path);
    return { path: relative(repository, path), byteLength: bytes.byteLength, sha256: hash(bytes), validSvg: bytes.includes(Buffer.from("<svg")) };
  }));
  if (sourceChanged || outputs.length !== paths.length || outputs.some(output => !output.validSvg)) {
    result.status = "FAIL"; result.failure ??= sourceChanged ? "SOURCE_CHANGED_DURING_VERIFICATION" : "DIAGRAM_OUTPUT_MISMATCH";
  }
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ version: "chess-coach.offline-diagram.v1", argv, ...result, sources, sourceChanged, outputs,
    offline: true, securityProfile: "SANDBOX", actualHostExecuted: false, cudaGpuCodeExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ receipt: relative(repository, resolve(directory, "receipt.json")), status: result.status, trainingReady: false }));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (import.meta.main) await main();
