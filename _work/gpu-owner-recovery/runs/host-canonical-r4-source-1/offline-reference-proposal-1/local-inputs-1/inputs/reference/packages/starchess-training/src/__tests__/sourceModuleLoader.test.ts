// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSourceMemoryFs } from "../coordinator/sourceMemoryFs";
import { sourceSnapshotFixture } from "./sourceSnapshotFixture";

type Loader = Readonly<{ load(path: string): any; assertCurrent(): void; epoch(): number; revoke(): void;
  loadingMembers(): readonly { path: string; byteLength: number; sha256: string }[] }>;
let f: ReturnType<typeof sourceSnapshotFixture>, createLoader: (memory: ReturnType<typeof createSourceMemoryFs>) => Loader;
const files = {
  "src/value.ts": "export let value = 1; export const increment = () => ++value; export const location = import.meta.url;\n",
  "src/main.ts": 'export {value, increment, location} from "./value";\n',
  "src/caught.ts": 'import fs from "node:fs"; try { fs.writeFileSync("/app/no", "x"); } catch {} export const passed = true;\n',
  "src/read.ts": 'import fs from "node:fs"; export const read = () => fs.readFileSync("/app/src/value.ts", "utf8");\n',
  "src/promises.ts": 'import { readFile } from "node:fs/promises"; export const read = () => readFile("/app/src/value.ts", "utf8");\n',
  "src/readflags.ts": 'import { readFile } from "node:fs/promises"; export const read = () => readFile("/app/src/value.ts", {flag: "w"});\n',
  "src/computed.ts": 'const name = "./value"; export const unused = () => require(name);\n',
  "src/cycle-a.ts": 'import "./cycle-b"; export const a = 1;\n',
  "src/cycle-b.ts": 'import "./cycle-a"; export const b = 1;\n',
  "src/native.ts": 'import "node:worker_threads"; export const passed = true;\n',
  "src/tla.ts": "export const value = await Promise.resolve(1);\n",
  "src/hash.ts": 'import SHA from "jssha/sha256"; export const hash = () => { const sha = new SHA("SHA-256", "TEXT"); sha.update("abc"); return sha.getHash("HEX"); };\n',
  "src/fflate.ts": 'import "fflate";\n',
  "src/callback.ts": 'const label = ["con", "structor"].join(""); let escaped = false; try { new URLSearchParams("x=1").forEach((value, key, parent) => { const acquired = parent[label][label]("return process")(); escaped = typeof acquired.getBuiltinModule === "function"; }); } catch {} export { escaped };\n',
  "src/mutable-intrinsics.ts": 'import fs from "node:fs"; const label = ["con", "structor"].join(""); Object.prototype.isPrototypeOf = () => true; Uint8Array.prototype.set = function(value) { try { const acquired = value[label][label]("return process")(); globalThis.escaped = typeof acquired.getBuiltinModule === "function"; } catch {} }; let escaped = false; try { const value = fs.readFileSync("/app/src/value.ts"); const acquired = value[label][label]("return process")(); escaped = typeof acquired.getBuiltinModule === "function"; } catch {} export { escaped };\n',
  "src/aliases.ts": 'import fs from "node:fs"; import path from "node:path"; import info from "./info.json"; const storage = new ArrayBuffer(4); const view = new Uint8Array(storage); const bytes = Buffer.from(storage); export const same = bytes.fill(7) === bytes; view[1] = 9; export const bits = Array.from(bytes); export const name = path.parse("/app/src/value.ts").name; export const names = fs.readdirSync("/app/src", {withFileTypes: true}).map(entry => entry.name); export { info };\n',
  "src/info.json": '{"name":"kept","length":7,"prototype":"data","arguments":"also-data"}',
  "src/buffer.ts": 'import fs from "node:fs"; import { createHash } from "node:crypto"; const bytes = Buffer.from("abc"); bytes.subarray(1)[0] = 120; export const changed = bytes.toString(); const binary = Buffer.alloc(4); binary.writeUInt16BE(258, 0); export const bits = Array.from(binary); const fd = fs.openSync("/app/src/value.ts", "r"); const read = Buffer.alloc(7); fs.readSync(fd, read, 0, 7, 0); fs.closeSync(fd); export const prefix = read.toString(); export const hash = createHash("sha256").update(Buffer.from("abc")).digest("hex"); export const names = fs.readdirSync("/app/src").sort();\n',
  "packages/starchess-training/src/coordinator/episodeWorker.ts": 'import { fileURLToPath } from "node:url"; let started = 0; export const count = () => started; export const startEpisodeWorker = async () => { started++; };\nif (process.argv[1] === fileURLToPath(import.meta.url)) await startEpisodeWorker();',
};
const escapes = {
  Buffer: "Buffer.constructor",
  TextEncoder: "TextEncoder.constructor",
  TextDecoder: "TextDecoder.constructor",
  URL: "URL.constructor",
  process: "process.cwd.constructor",
  timer: "setTimeout.constructor",
  fs: "fs.readFileSync.constructor",
  bytes: 'fs.readFileSync("/app/src/value.ts").constructor.constructor',
  stat: 'fs.statSync("/app/src/value.ts").isFile.constructor',
  constants: "fs.constants.constructor.constructor",
  directory: 'fs.readdirSync("/app/src").constructor.constructor',
  crypto: "crypto.createHash.constructor",
  hash: 'crypto.createHash("sha256").update.constructor',
  digest: 'crypto.createHash("sha256").digest().constructor.constructor',
  path: 'path.parse("/app/src/value.ts").constructor.constructor',
  util: "util.types.isProxy.constructor",
  require: "require.resolve.constructor",
  module: "module.constructor.constructor",
  exports: "exports.constructor.constructor",
  error: '(() => { try { fs.readFileSync("/app/missing.ts"); } catch (error) { return error.constructor.constructor; } })()',
};
const escapeFiles = Object.fromEntries(Object.entries(escapes).map(([name, expression]) => [`src/escape-${name}.ts`,
  `import fs from "node:fs"; import * as crypto from "node:crypto"; import * as path from "node:path"; import * as util from "node:util";
  let escaped = false; try { const acquired = (${expression})("return process")(); escaped = typeof acquired.getBuiltinModule === "function"; } catch {}
  export { escaped };`]));
const indirectEscapeFiles = Object.fromEntries(Object.entries(escapes).map(([name, expression]) => [`src/indirect-${name}.ts`,
  `import fs from "node:fs"; import * as crypto from "node:crypto"; import * as path from "node:path"; import * as util from "node:util";
  const label = ["con", "structor"].join(""); let escaped = false;
  try { const acquired = (${expression.replaceAll(".constructor", "[label]")})("return process")(); escaped = typeof acquired.getBuiltinModule === "function"; } catch {}
  export { escaped };`]));
beforeAll(async () => {
  const jsshaManifest = readFileSync(new URL("../../node_modules/jssha/package.json", import.meta.url), "utf8");
  const jsshaModule = readFileSync(new URL("../../node_modules/jssha/dist/sha256.mjs", import.meta.url), "utf8");
  const fflateManifest = readFileSync(new URL("../../../starchess-core/node_modules/fflate/package.json", import.meta.url), "utf8");
  const fflateModule = readFileSync(new URL("../../../starchess-core/node_modules/fflate/esm/index.mjs", import.meta.url), "utf8");
  const auditorFiles = Object.fromEntries(["packages/starchess-arena/src/challenge/sourceInventory.ts", "packages/starchess-arena/src/challenge/config.ts",
    "packages/starchess-arena/src/authorized/v1/canonical.ts", "packages/starchess-arena/hermetic/public-closure.mjs"]
    .map(path => [path, readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8")]));
  f = sourceSnapshotFixture({ ...files, ...escapeFiles, ...indirectEscapeFiles, ...auditorFiles, "node_modules/jssha/package.json": jsshaManifest, "node_modules/jssha/dist/sha256.mjs": jsshaModule,
    "node_modules/fflate/package.json": fflateManifest, "node_modules/fflate/esm/index.mjs": fflateModule }, true);
  const modulePath = "../coordinator/sourceModuleLoader.mjs";
  createLoader = (await import(modulePath)).createSourceModuleLoader;
});
describe("source-loader acquisition and startup-timeout regressions", () => {
  it("uses captured realm-admission and byte-copy intrinsics after receiving-realm mutation", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(() => loader.load("/app/src/mutable-intrinsics.ts")).toThrow("FORBIDDEN_ACQUISITION");
    expect(() => loader.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });
  it("keeps builtin callback receivers and arguments in the receiving realm", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(() => loader.load("/app/src/callback.ts")).toThrow("FORBIDDEN_ACQUISITION");
    expect(() => loader.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });
  it.each(Object.keys(escapes))("blocks dynamically selected host-constructor acquisition through %s", name => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(() => loader.load(`/app/src/indirect-${name}.ts`)).toThrow("FORBIDDEN_ACQUISITION");
    expect(() => loader.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });
  it.each(Object.keys(escapes))("rejects caught host-constructor acquisition through %s and latches the graph", name => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(() => loader.load(`/app/src/escape-${name}.ts`)).toThrow("FORBIDDEN_ACQUISITION");
    expect(() => loader.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });

  it("times out the invoked module body instead of only compiling its wrapper", () => {
    const program = `
      import { readFileSync } from "node:fs";
      import { createSourceModuleLoader } from ${JSON.stringify(new URL("../coordinator/sourceModuleLoader.mjs", import.meta.url).href)};
      const compiler = readFileSync(${JSON.stringify(f.repository + "/node_modules/typescript/lib/typescript.js")});
      const paths = new Map([["/app/node_modules/typescript/lib/typescript.js", compiler], ["/app/src/infinite.ts", Buffer.from("while (true) {} export const unreachable = true;")]]);
      const realpathSync = Object.assign(path => path, { native: path => path });
      const memory = { assertCurrent() {}, revoke() {}, forbid() { throw new Error("FORBIDDEN_ACQUISITION"); }, canonicalPath: path => path,
        fs: { promises: {}, realpathSync, existsSync: path => paths.has(path), statSync: path => {
          if (!paths.has(path)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
          return { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false };
        }, readFileSync: path => {
          if (!paths.has(path)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
          return Buffer.from(paths.get(path));
        } } };
      const loader = createSourceModuleLoader(memory, "/app/node_modules/typescript/lib/typescript.js");
      try { loader.load("/app/src/infinite.ts"); process.exitCode = 2; }
      catch (error) {
        if (error.code !== "ERR_SCRIPT_EXECUTION_TIMEOUT") { console.error(error); process.exitCode = 3; }
        else { try { loader.assertCurrent(); process.exitCode = 4; } catch { console.log("startup-timeout; graph-latched"); } }
      }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", program], { timeout: 14000, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("startup-timeout; graph-latched");
  }, 20000);
});
afterAll(() => { if (f) rmSync(f.directory, { recursive: true, force: true }); });
describe("verified-input immutable module-loader mechanics, not production authority", () => {
  it("retains native Buffer aliases and ordinary JSON/path/directory data fields", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime)), value = loader.load("/app/src/aliases.ts");
    expect(value.same).toBe(true); expect(value.bits).toEqual([7, 9, 7, 7]); expect(value.name).toBe("value");
    expect(value.names).toContain("info.json"); expect(value.info).toEqual({ name: "kept", length: 7, prototype: "data", arguments: "also-data" });
  });
  it("preserves receiving-realm Buffer writes, slice aliases, hashes and mutable directory copies", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime)), result = loader.load("/app/src/buffer.ts");
    expect(result.changed).toBe("axc"); expect(result.bits).toEqual([1, 2, 0, 0]); expect(result.prefix).toBe("export ");
    expect(result.hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(result.names).toEqual([...result.names].sort()); expect(() => loader.assertCurrent()).not.toThrow();
  });
  it("runs the captured physical TypeScript compiler with fixed transforms and a canonical live module cache", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime)), main = loader.load("/app/src/main.ts"), value = loader.load("/app/src/value.ts");
    expect(main.location).toBe("file:///app/src/value.ts");
    expect(main.value).toBe(1); value.increment(); expect(main.value).toBe(2);
    const epoch = loader.epoch();
    expect(loader.load("/app/src/value.ts")).toBe(value);
    expect(loader.epoch()).toBe(epoch);
    expect(loader.loadingMembers().find(member => member.path === "/app/node_modules/typescript/lib/typescript.js")?.byteLength).toBeGreaterThan(1000000);
    expect(() => loader.assertCurrent()).not.toThrow();
  });

  it("selects jssha/sha256's actual ESM export rather than the transformed CommonJS condition", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(loader.load("/app/src/hash.ts").hash()).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(loader.loadingMembers().some(member => member.path === "/app/node_modules/jssha/dist/sha256.mjs")).toBe(true);
  });

  it("retains default fs imports and confines fs/promises reads to the same memory snapshot", async () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(loader.load("/app/src/read.ts").read()).toBe(files["src/value.ts"]);
    expect(await loader.load("/app/src/promises.ts").read()).toBe(files["src/value.ts"]);
    expect(() => loader.assertCurrent()).not.toThrow();
  });

  it("dispatches previously loaded promise readers through the current snapshot and revocation gate", async () => {
    const captured = createSourceMemoryFs(f.source, f.runtime);
    let oldReads = 0, snapshotReads = 0;
    const initial = { ...captured.fs, promises: { __esModule: false,
      readFile: async () => { oldReads++; return "old-live-tree"; } } };
    const selected = { ...captured.fs, promises: { __esModule: false,
      readFile: async () => { snapshotReads++; return files["src/value.ts"]; } } };
    let fs = initial;
    const memory = { ...captured, get fs() { return fs; } };
    const loader = createLoader(memory), module = loader.load("/app/src/promises.ts");
    fs = selected;
    expect(await module.read()).toBe(files["src/value.ts"]);
    expect(oldReads).toBe(0); expect(snapshotReads).toBe(1);
    loader.revoke();
    await expect(module.read()).rejects.toThrow("REVOKED");
    expect(oldReads).toBe(0); expect(snapshotReads).toBe(1);
  });

  it("rejects writable promise-read options before invoking a pre-capture filesystem reader", async () => {
    const captured = createSourceMemoryFs(f.source, f.runtime);
    let calls = 0;
    const memory = { ...captured, fs: { ...captured.fs, promises: { __esModule: false,
      readFile: async () => { calls++; return "unexpected native call"; } } } };
    const loader = createLoader(memory), module = loader.load("/app/src/readflags.ts");
    await expect(module.read()).rejects.toThrow("FORBIDDEN_ACQUISITION");
    expect(calls).toBe(0); expect(() => loader.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });

  it.each(["caught", "computed", "cycle-a", "native", "tla"])("rejects %s and latches the loading context", name => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(() => loader.load(`/app/src/${name}.ts`)).toThrow("FORBIDDEN_ACQUISITION");
    expect(() => loader.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });

  it("identifies the Node fflate dead createRequire/Worker-eval production blocker without a browser alias", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    expect(() => loader.load("/app/src/fflate.ts")).toThrow("FFLATE_NODE_WORKER_EVAL_UNSUPPORTED");
    expect(() => loader.assertCurrent()).toThrow("FORBIDDEN_ACQUISITION");
  });

  it("loads both complete actual auditor modules through the same memory graph without fabricated reports", () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    const inventory = loader.load("/app/packages/starchess-arena/src/challenge/sourceInventory.ts");
    const closure = loader.load("/app/packages/starchess-arena/hermetic/public-closure.mjs");
    expect(typeof inventory.collectSourceInventory).toBe("function");
    expect(typeof closure.checkPublicClosure).toBe("function");
    expect(() => inventory.collectSourceInventory("/app")).toThrow("ENOENT");
    expect(() => closure.checkPublicClosure("/app")).toThrow("ENOENT");
    expect(loader.loadingMembers().filter(member => /(?:sourceInventory\.ts|public-closure\.mjs)$/.test(member.path))).toHaveLength(2);
  });

  it("handles only the fixed worker leaf await while preserving its main guard without launching it", async () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime));
    const worker = await loader.load("/app/packages/starchess-training/src/coordinator/episodeWorker.ts");
    expect(worker.count()).toBe(0);
    expect(() => loader.assertCurrent()).not.toThrow();
  });

  it("revokes reloads and exports no loading-context installer", async () => {
    const loader = createLoader(createSourceMemoryFs(f.source, f.runtime)); loader.revoke();
    expect(() => loader.load("/app/src/value.ts")).toThrow("REVOKED");
    const modulePath = "../coordinator/sourceModuleLoader.mjs";
    expect(Object.keys(await import(modulePath)).sort()).toEqual(["createSourceModuleLoader", "launchCapturedSourceBootstrap"]);
  });
});
