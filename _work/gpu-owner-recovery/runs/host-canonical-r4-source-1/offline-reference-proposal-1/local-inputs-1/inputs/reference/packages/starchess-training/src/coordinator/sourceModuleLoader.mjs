// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import * as crypto from "node:crypto";
import * as nativeFs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import * as util from "node:util";
import { isBuiltin } from "node:module";
import { Script, createContext } from "node:vm";

const SOURCE = "/app/packages/starchess-training/src/coordinator/";
const INVENTORY = "/app/packages/starchess-arena/src/challenge/sourceInventory.ts";
const CLOSURE = "/app/packages/starchess-arena/hermetic/public-closure.mjs";
const COMPILER = "/app/packages/starchess-training/node_modules/typescript/lib/typescript.js";
const WORKER = `${SOURCE}episodeWorker.ts`;
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const reject = (code, detail = "") => { throw Object.assign(new Error(`${code}${detail ? `: ${detail}` : ""}`), { code }); };
const readOnly = value => Object.freeze(Object.assign(Object.create(null), value));

const realmBoundary = (realm, forbid) => {
  const local = new Script("({Object,Array,Function,Error,Promise,ArrayBuffer,Uint8Array})").runInContext(realm);
  const factory = new Script("invoke => function(...args) { return invoke(this, new.target, args); }").runInContext(realm);
  const objectPrototype = local.Object.prototype, createObject = local.Object.create, defineObject = local.Object.defineProperty;
  const freezeObject = local.Object.freeze, setObjectPrototype = local.Object.setPrototypeOf;
  const isLocalObject = Object.prototype.isPrototypeOf.bind(objectPrototype);
  const isLocalFunction = Function.prototype[Symbol.hasInstance].bind(local.Function);
  const isLocalError = Function.prototype[Symbol.hasInstance].bind(local.Error);
  const isLocalBuffer = Function.prototype[Symbol.hasInstance].bind(local.ArrayBuffer);
  const setBytes = local.Uint8Array.prototype.set;
  const typedPrototype = Object.getPrototypeOf(local.Uint8Array.prototype);
  const getBuffer = Object.getOwnPropertyDescriptor(typedPrototype, "buffer").get;
  const getOffset = Object.getOwnPropertyDescriptor(typedPrototype, "byteOffset").get;
  const getLength = Object.getOwnPropertyDescriptor(typedPrototype, "byteLength").get;
  const wrapped = new WeakMap(), originals = new WeakMap(), buffers = new WeakSet();
  const callbacks = new WeakMap(), typePredicates = new Set(Object.values(util.types));
  let bufferPrototype;
  const field = (object, key, value) => defineObject(object, key,
    { __proto__: null, value, enumerable: true, writable: false, configurable: false });
  const unwrap = (value, callback = false, aliases) => {
    if (callback && typeof value === "function" && isLocalFunction(value)) {
      let fn = callbacks.get(value);
      if (!fn) {
        fn = function(...args) { return unwrap(Reflect.apply(value, wrap(this), args.map(wrap))); };
        callbacks.set(value, fn);
      }
      return fn;
    }
    if (value && typeof value === "object" && buffers.has(value)) {
      const result = Buffer.from(Reflect.apply(getBuffer, value, []), Reflect.apply(getOffset, value, []), Reflect.apply(getLength, value, []));
      if (aliases) aliases.set(result, value);
      return result;
    }
    return value && (typeof value === "object" || typeof value === "function") && originals.has(value) ? originals.get(value) : value;
  };
  const realmError = error => {
    if (isLocalError(error)) return error;
    const result = new local.Error(typeof error?.message === "string" ? error.message : "builtin failure");
    if (typeof error?.code === "string") field(result, "code", error.code);
    return result;
  };
  const invoke = (target, receiver, construct, args) => {
    try {
      const aliases = new Map(), actual = args.map(value => unwrap(value, !typePredicates.has(target), aliases));
      const result = construct ? Reflect.construct(target, actual) : Reflect.apply(target, unwrap(receiver, false, aliases), actual);
      if (aliases.has(result)) return aliases.get(result);
      return wrap(result);
    } catch (error) { throw realmError(error); }
  };
  const wrap = value => {
    if (value === null || typeof value !== "object" && typeof value !== "function") return value;
    if (isLocalObject(value)) return value;
    if (Object.getPrototypeOf(value) === null && Object.isFrozen(value) && Reflect.ownKeys(value).length === 0) return value;
    const known = wrapped.get(value);
    if (known) return known;
    if (Buffer.isBuffer(value)) {
      const storage = value.buffer;
      const result = isLocalBuffer(storage) ? new local.Uint8Array(storage, value.byteOffset, value.length) : new local.Uint8Array(value.length);
      if (!isLocalBuffer(storage)) Reflect.apply(setBytes, result, [value]);
      setObjectPrototype(result, bufferPrototype); buffers.add(result); wrapped.set(value, result);
      return result;
    }
    if (ArrayBuffer.isView(value)) {
      const result = new local.Uint8Array(value.byteLength);
      Reflect.apply(setBytes, result, [new Uint8Array(value.buffer, value.byteOffset, value.byteLength)]);
      wrapped.set(value, result); return result;
    }
    if (util.types.isAnyArrayBuffer(value)) {
      if (util.types.isSharedArrayBuffer(value)) return forbid("shared builtin output");
      const bytes = new local.Uint8Array(value.byteLength); Reflect.apply(setBytes, bytes, [new Uint8Array(value)]);
      wrapped.set(value, bytes.buffer); return bytes.buffer;
    }
    if (Array.isArray(value)) {
      const result = new local.Array(value.length); wrapped.set(value, result);
      for (let i = 0; i < value.length; i++) defineObject(result, String(i),
        { __proto__: null, value: wrap(value[i]), writable: true, enumerable: true, configurable: true });
      return Object.isFrozen(value) ? freezeObject(result) : result;
    }
    if (util.types.isPromise(value)) {
      const result = new local.Promise((resolve, reject) => {
        Promise.resolve(value).then(value => resolve(wrap(value)), error => reject(realmError(error)));
      });
      wrapped.set(value, result); return result;
    }
    const result = typeof value === "function" ? factory((receiver, construct, args) => invoke(value, receiver, construct, args)) : createObject(objectPrototype);
    wrapped.set(value, result); originals.set(result, value);
    if (typeof value === "function" && value.prototype) {
      const prototype = value === Buffer ? bufferPrototype : createObject(objectPrototype);
      if (value !== Buffer) field(prototype, "constructor", result);
      defineObject(result, "prototype", { __proto__: null, value: prototype, writable: false, configurable: false });
    }
    const seen = new Set();
    for (let source = value; source && source !== Object.prototype && source !== Function.prototype; source = Object.getPrototypeOf(source)) {
      for (const key of Reflect.ownKeys(source)) {
        if (seen.has(key) || key === "constructor" && source !== value || typeof value === "function" &&
            ["constructor", "prototype", "name", "length", "caller", "arguments", "__proto__"].includes(key)) continue;
        seen.add(key);
        const descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (Object.hasOwn(descriptor, "value")) field(result, key, wrap(descriptor.value));
        else defineObject(result, key, { __proto__: null, enumerable: descriptor.enumerable, configurable: false,
          get: descriptor.get ? factory(() => { try { return wrap(Reflect.get(value, key)); } catch (error) { throw realmError(error); } }) : undefined,
          set: descriptor.set ? factory((_, __, args) => { try { Reflect.set(value, key, unwrap(args[0])); } catch (error) { throw realmError(error); } }) : undefined });
      }
    }
    return freezeObject(result);
  };
  bufferPrototype = createObject(local.Uint8Array.prototype);
  for (const key of Reflect.ownKeys(Buffer.prototype)) {
    if (typeof key !== "string" || ["constructor", "parent", "offset", "slice", "subarray"].includes(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(Buffer.prototype, key);
    if (typeof descriptor?.value === "function") field(bufferPrototype, key, wrap(descriptor.value));
  }
  for (const key of ["slice", "subarray"]) field(bufferPrototype, key, factory((receiver, _, args) => {
    const length = Reflect.apply(getLength, receiver, []);
    const position = (value, fallback) => {
      if (value === undefined) return fallback;
      const integer = Math.trunc(+value);
      return Number.isNaN(integer) ? 0 : integer < 0 ? Math.max(0, length + integer) : Math.min(length, integer);
    };
    const start = position(args[0], 0), end = position(args[1], length);
    const result = new local.Uint8Array(Reflect.apply(getBuffer, receiver, []), Reflect.apply(getOffset, receiver, []) + start, Math.max(0, end - start));
    setObjectPrototype(result, bufferPrototype); buffers.add(result); return result;
  }));
  const safeBuffer = wrap(Buffer); field(bufferPrototype, "constructor", safeBuffer);
  const denyCode = factory(() => { try { return forbid("dynamic code acquisition"); } catch (error) { throw realmError(error); } });
  defineObject(local.Function.prototype, "constructor", { __proto__: null, value: denyCode, writable: false, configurable: false });
  return { wrap, object: () => createObject(objectPrototype), array: values => {
    const result = new local.Array(values.length);
    for (let i = 0; i < values.length; i++) field(result, String(i), wrap(values[i]));
    return freezeObject(result);
  }, safeBuffer, denyCode, error: realmError };
};

const createLoader = (memory, compilerPath, loading) => {
  const cache = new Map(), members = new Map(), edges = new Map();
  let active = true, failed = false, compiler, epoch = 0;
  const current = () => {
    if (!active) reject("REVOKED");
    if (failed) reject("FORBIDDEN_ACQUISITION");
    memory.assertCurrent();
  };
  const forbid = detail => { failed = true; try { memory.forbid(); } catch {} reject("FORBIDDEN_ACQUISITION", detail); };
  const processFacade = readOnly({ argv: Object.freeze(["/usr/local/bin/node", ""]), execArgv: Object.freeze([]), env: readOnly({}),
    platform: "linux", versions: readOnly({ node: process.versions.node }), version: process.version,
    cwd: () => "/app", nextTick: () => forbid("process.nextTick"), stdout: readOnly({ isTTY: false, write: () => forbid("stdout") }),
    stderr: readOnly({ write: () => forbid("stderr") }), hrtime: readOnly({ bigint: () => process.hrtime.bigint() }) });
  const realm = createContext({}, { codeGeneration: { strings: false, wasm: false } });
  const boundary = realmBoundary(realm, forbid);
  Object.assign(realm, { Buffer: boundary.safeBuffer, TextEncoder: boundary.wrap(TextEncoder), TextDecoder: boundary.wrap(TextDecoder),
    URL: boundary.wrap(URL), URLSearchParams: boundary.wrap(URLSearchParams), process: boundary.wrap(processFacade), Function: boundary.denyCode,
    setTimeout: boundary.wrap(() => forbid("setTimeout")), clearTimeout: boundary.wrap(() => forbid("clearTimeout")),
    setImmediate: boundary.wrap(() => forbid("setImmediate")), clearImmediate: boundary.wrap(() => forbid("clearImmediate")),
    console: boundary.wrap(readOnly({ log: () => forbid("console"), error: () => forbid("console") })) });
  const readOptions = options => {
    if (options === undefined || options === null || typeof options === "string") return options;
    if (typeof options !== "object" || util.types.isProxy(options) || Array.isArray(options)) return forbid("filesystem read options");
    const result = Object.create(null), keys = Reflect.ownKeys(options);
    if (keys.length > 2 || keys.some(key => key !== "encoding" && key !== "flag")) return forbid("filesystem read options");
    for (const key of keys) {
      const field = Object.getOwnPropertyDescriptor(options, key);
      if (!field || !Object.hasOwn(field, "value")) return forbid("filesystem read accessor");
      if (key === "flag" && field.value !== "r") return forbid("writable read acquisition");
      if (key === "encoding" && field.value !== undefined && field.value !== null && typeof field.value !== "string") return forbid("filesystem encoding");
      result[key] = field.value;
    }
    result.flag = "r";
    return Object.freeze(result);
  };
  const dispatchFs = name => (...args) => {
    current();
    if (name === "openSync" && !["r", 0, 0x20000 | 0x800].includes(args[1])) return forbid("writable descriptor acquisition");
    if (name === "readFileSync") args[1] = readOptions(args[1]);
    return Reflect.apply(memory.fs[name], memory.fs, args);
  };
  const realpath = Object.freeze(Object.assign(dispatchFs("realpathSync"), { native: (...args) => {
    current(); return Reflect.apply(memory.fs.realpathSync.native, memory.fs.realpathSync, args);
  } }));
  const promiseMethods = readOnly({ __esModule: false, ...Object.fromEntries(["readFile", "readdir", "stat", "lstat", "realpath", "readlink"].map(name =>
    [name, async (...args) => {
      current();
      if (name === "readFile") args[1] = readOptions(args[1]);
      return Reflect.apply(memory.fs.promises[name], memory.fs.promises, args);
    }])) });
  const fsMethods = readOnly({ __esModule: false, constants: readOnly({ O_RDONLY: 0, O_NOFOLLOW: 0x20000, O_NONBLOCK: 0x800 }),
    ...Object.fromEntries(["readFileSync", "readdirSync", "statSync", "lstatSync", "readlinkSync", "existsSync", "openSync", "fstatSync", "closeSync", "readSync"]
      .map(name => [name, dispatchFs(name)])), realpathSync: realpath, promises: promiseMethods });
  const builtins = new Map([
    ["fs", fsMethods], ["fs/promises", promiseMethods], ["path", readOnly(path)], ["url", readOnly(url)],
    ["crypto", readOnly({ createHash: crypto.createHash, Hash: crypto.Hash })], ["util", readOnly({ types: readOnly(util.types) })],
    ["os", readOnly({ platform: () => "linux", release: () => "", arch: () => "x64", EOL: "\n", tmpdir: () => "/tmp" })],
    ["perf_hooks", readOnly({ performance: readOnly({ now: () => Number(process.hrtime.bigint()) / 1000000 }) })],
  ]);
  const consumed = selected => {
    current();
    const canonical = memory.canonicalPath(selected), bytes = memory.fs.readFileSync(canonical);
    const member = readOnly({ path: canonical, byteLength: bytes.length, sha256: digest(bytes) });
    const prior = members.get(canonical);
    if (prior && (prior.byteLength !== member.byteLength || prior.sha256 !== member.sha256)) forbid("changed loading member");
    members.set(canonical, member);
    return { canonical, bytes };
  };
  const exists = selected => memory.fs.existsSync(selected);
  const resolveFile = selected => {
    const candidates = path.posix.extname(selected) ? [selected] : [selected, `${selected}.ts`, `${selected}.mts`, `${selected}.cts`,
      `${selected}.js`, `${selected}.mjs`, `${selected}.cjs`, `${selected}.json`, `${selected}/index.ts`, `${selected}/index.js`];
    const found = candidates.filter(candidate => exists(candidate) && memory.fs.statSync(candidate).isFile());
    if (found.length !== 1) forbid(`missing or ambiguous module ${selected}`);
    const canonical = memory.canonicalPath(found[0]);
    if (!/\.(?:[cm]?[jt]s|json)$/.test(canonical)) forbid(`unsupported module ${canonical}`);
    return canonical;
  };
  const json = selected => JSON.parse(consumed(selected).bytes.toString("utf8"));
  const select = (value, conditions) => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object" || Array.isArray(value)) forbid("unsupported package conditions");
    for (const [condition, target] of Object.entries(value)) if (conditions.has(condition)) return select(target, conditions);
    forbid("unresolved package conditions");
  };
  const resolveModule = (importer, specifier, esm = false) => {
    current();
    if (typeof specifier !== "string" || !specifier || specifier.includes("\\") || specifier.includes("\0")) forbid("computed module acquisition");
    if (isBuiltin(specifier)) {
      const name = specifier.replace(/^node:/, "");
      if (!builtins.has(name) && name !== "module") forbid(`unsupported builtin ${specifier}`);
      return `node:${name}`;
    }
    if (specifier.startsWith(".")) return resolveFile(path.posix.resolve(path.posix.dirname(importer), specifier));
    if (specifier.startsWith("/") || specifier.includes(":")) forbid(`alternate module location ${specifier}`);
    const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
    let directory = path.posix.dirname(importer), base;
    while (directory.startsWith("/app")) {
      const candidate = `${directory}/node_modules/${name}`;
      if (exists(candidate)) { base = memory.canonicalPath(candidate); break; }
      if (directory === "/app") break;
      directory = path.posix.dirname(directory);
    }
    if (!base) forbid(`missing installed dependency ${specifier}`);
    const manifest = json(`${base}/package.json`), subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
    if (manifest.name !== name) forbid(`dependency identity ${specifier}`);
    let target;
    if (manifest.exports !== undefined) {
      const exports = manifest.exports;
      const branch = typeof exports === "object" && Object.keys(exports).some(key => key.startsWith(".")) ? exports[subpath] : subpath === "." ? exports : undefined;
      target = select(branch, new Set(esm ? ["node", "import", "module", "default"] : ["node", "require", "default"]));
    } else target = subpath === "." ? manifest.main ?? "./index.js" : `./${specifier.slice(name.length + 1)}`;
    if (typeof target !== "string" || target.includes("\\") || target.split("/").some(part => part === ".." || part === "*") || target.startsWith("/")) forbid("unsafe dependency export");
    if (specifier === "jssha/sha256" && (!esm || manifest.version !== "3.3.2" || target !== "./dist/sha256.mjs")) forbid("jssha/sha256 requires its original ESM target");
    return resolveFile(path.posix.resolve(base, target));
  };
  const builtin = (name, importer) => {
    if (name === "node:fs" || name === "node:fs/promises") {
      const source = builtins.get(name.slice(5)), target = boundary.wrap(source);
      return new Proxy(target, { get: (target, key, receiver) => {
        if (Reflect.has(target, key)) return Reflect.get(target, key, receiver);
        try { return forbid(`unsupported filesystem capability ${String(key)}`); } catch (error) { throw boundary.error(error); }
      } });
    }
    if (name !== "node:module") return boundary.wrap(builtins.get(name.slice(5)));
    if (importer !== INVENTORY && importer !== CLOSURE) forbid(`module acquisition in ${importer}`);
    return boundary.wrap(readOnly({ isBuiltin, createRequire: base => {
      if (base !== url.pathToFileURL(importer).href) forbid("createRequire alternate base");
      const resolve = specifier => {
        const target = resolveModule(importer, specifier);
        edges.set(`${importer}\0${specifier}`, readOnly({ importer, specifier, target }));
        return target;
      };
      const require = specifier => load(resolve(specifier));
      require.resolve = resolve;
      return Object.freeze(require);
    } }));
  };
  const execute = (canonical, text, esmSpecifiers = new Set(), asyncEntry = false) => {
    epoch++;
    const module = boundary.object(); module.exports = boundary.object();
    const record = { module, state: "loading" };
    cache.set(canonical, record);
    const require = specifier => {
      const target = resolveModule(canonical, specifier, esmSpecifiers.has(specifier));
      edges.set(`${canonical}\0${specifier}`, readOnly({ importer: canonical, specifier, target }));
      const loaded = target.startsWith("node:") ? builtin(target, canonical) : load(target);
      if (loaded instanceof Promise) forbid(`async leaf imported by ${canonical}`);
      return loaded;
    };
    require.resolve = specifier => resolveModule(canonical, specifier, esmSpecifiers.has(specifier));
    Object.freeze(require);
    const wrapper = new Script(`(${asyncEntry ? "async " : ""}function(exports,require,module,__filename,__dirname,__sourceLoadingContext){\n${text}\n})`, { filename: canonical });
    const fn = wrapper.runInContext(realm, { timeout: 10000 });
    const priorFunction = realm.__sourceInvocation, priorArguments = realm.__sourceArguments;
    realm.__sourceInvocation = fn;
    realm.__sourceArguments = boundary.array([module.exports, require, module, canonical, path.posix.dirname(canonical), canonical === `${SOURCE}sourceBootstrap.ts` ? loading : undefined]);
    let result;
    try { result = new Script("Reflect.apply(__sourceInvocation, undefined, __sourceArguments)").runInContext(realm, { timeout: 10000 }); }
    finally { realm.__sourceInvocation = priorFunction; realm.__sourceArguments = priorArguments; }
    if (asyncEntry) return Promise.resolve(result).then(() => { current(); record.state = "loaded"; return module.exports; }, error => { failed = true; throw error; });
    current();
    record.state = "loaded";
    return module.exports;
  };
  const load = selected => {
    current();
    const { canonical, bytes } = consumed(selected), prior = cache.get(canonical);
    if (prior) {
      if (prior.state !== "loaded") forbid(`unsupported module cycle ${canonical}`);
      return prior.module.exports;
    }
    if (canonical.endsWith(".json")) {
      epoch++;
      const module = boundary.object(); module.exports = boundary.wrap(JSON.parse(bytes.toString("utf8")));
      cache.set(canonical, { module, state: "loaded" });
      return module.exports;
    }
    if (canonical === compilerPath) return execute(canonical, bytes.toString("utf8"));
    if (!compiler) forbid("compiler unavailable");
    const source = compiler.createSourceFile(canonical, bytes.toString("utf8"), compiler.ScriptTarget.Latest, true,
      /\.[cm]?js$/.test(canonical) ? compiler.ScriptKind.JS : compiler.ScriptKind.TS);
    if (source.parseDiagnostics.length) forbid(`invalid source ${canonical}`);
    const esmSpecifiers = new Set();
    const topAwaits = [];
    const scan = (node, functionDepth = 0) => {
      if ((compiler.isImportDeclaration(node) || compiler.isExportDeclaration(node)) && node.moduleSpecifier) esmSpecifiers.add(node.moduleSpecifier.text);
      if (compiler.isAwaitExpression(node) && functionDepth === 0) topAwaits.push(node);
      if (compiler.isCallExpression(node) && (node.expression.kind === compiler.SyntaxKind.ImportKeyword ||
          compiler.isIdentifier(node.expression) && node.expression.text === "require") &&
          (node.arguments.length !== 1 || !compiler.isStringLiteralLike(node.arguments[0]))) forbid(`computed loading in ${canonical}`);
      if (compiler.isIdentifier(node) && node.text === "require" &&
          !(compiler.isCallExpression(node.parent) && node.parent.expression === node) &&
          !(compiler.isPropertyAccessExpression(node.parent) && node.parent.expression === node && node.parent.name.text === "resolve")) {
        forbid(`escaped require binding in ${canonical}`);
      }
      if (compiler.isIdentifier(node) && ["eval", "Function"].includes(node.text) || compiler.isPropertyAccessExpression(node) &&
          ["constructor", "register", "registerHooks", "_compile", "_load", "dlopen"].includes(node.name.text)) forbid(`unsupported code acquisition in ${canonical}`);
      if (canonical.includes("/fflate/") && compiler.isIdentifier(node) && ["createRequire", "Worker"].includes(node.text)) {
        forbid(`FFLATE_NODE_WORKER_EVAL_UNSUPPORTED ${canonical}`);
      }
      compiler.forEachChild(node, child => scan(child, functionDepth + (compiler.isFunctionLike(node) ? 1 : 0)));
    };
    scan(source);
    const topAwait = topAwaits.length > 0;
    if (topAwait && (canonical !== WORKER || topAwaits.length !== 1 ||
        source.statements.at(-1)?.getText(source) !== "if (process.argv[1] === fileURLToPath(import.meta.url)) await startEpisodeWorker();")) {
      forbid(`unsupported top-level await ${canonical}`);
    }
    const lowerMeta = context => {
      const visit = node => compiler.isPropertyAccessExpression(node) && node.name.text === "url" && compiler.isMetaProperty(node.expression) &&
        node.expression.keywordToken === compiler.SyntaxKind.ImportKeyword ? context.factory.createStringLiteral(url.pathToFileURL(canonical).href)
        : compiler.isMetaProperty(node) ? forbid(`unsupported import.meta in ${canonical}`) : compiler.visitEachChild(node, visit, context);
      return node => compiler.visitNode(node, visit);
    };
    const transformName = canonical.replace(/\.(?:mjs|cjs)$/, ".js").replace(/\.(?:mts|cts)$/, ".ts");
    const transformed = compiler.transpileModule(source.text, { fileName: transformName, reportDiagnostics: true,
      compilerOptions: { target: compiler.ScriptTarget.ES2022, module: compiler.ModuleKind.CommonJS, esModuleInterop: true,
        sourceMap: false, inlineSourceMap: false, importHelpers: false }, transformers: { before: [lowerMeta] } });
    if (transformed.diagnostics?.some(diagnostic => diagnostic.category === compiler.DiagnosticCategory.Error)) forbid(`transform failure ${canonical}`);
    return execute(canonical, transformed.outputText, esmSpecifiers, topAwait);
  };
  compilerPath = memory.canonicalPath(compilerPath);
  if (!compilerPath.endsWith("/typescript/lib/typescript.js")) forbid("compiler physical entry");
  compiler = load(compilerPath);
  if (compiler.version !== "5.9.3") forbid("compiler version");
  return Object.freeze({ load: selected => {
    try { return load(selected); } catch (error) { failed = true; throw error; }
  }, assertCurrent: current, epoch: () => { current(); return epoch; }, revoke: () => { active = false; memory.revoke(); },
  loadingMembers: () => { current(); return Object.freeze([...members.values()].sort((a, b) => a.path < b.path ? -1 : 1)); },
  loadingEdges: () => { current(); return Object.freeze([...edges.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))); } });
};

export const createSourceModuleLoader = (memory, compilerPath = COMPILER) => createLoader(memory, compilerPath);

export const launchCapturedSourceBootstrap = async (selection) => {
  if (process.execArgv.length || process.env.NODE_OPTIONS || process.env.NODE_PATH) reject("FORBIDDEN_ACQUISITION", "hooks or preloads");
  if (selection === null || typeof selection !== "object" || util.types.isProxy(selection) ||
      Object.keys(selection).sort().join(",") !== "artifacts,policy,repositoryRoot") reject("SOURCE_INPUT");
  if (selection.repositoryRoot !== "/app") reject("SOURCE_INPUT", "cold launcher requires the selected /app runtime");
  if (!Array.isArray(selection.artifacts)) reject("PROVENANCE");
  const artifacts = new Map();
  for (const artifact of selection.artifacts) {
    if (!artifact || typeof artifact !== "object" || util.types.isProxy(artifact) ||
        Object.keys(artifact).sort().join(",") !== "bytes,ref,role" || artifacts.has(artifact.role) || !(artifact.bytes instanceof Uint8Array) ||
        artifact.bytes.buffer instanceof SharedArrayBuffer || artifact.bytes.buffer.resizable || artifact.bytes.buffer.detached) reject("PROVENANCE");
    const bytes = Buffer.from(artifact.bytes);
    if (bytes.length > 1048576 || !artifact.ref || bytes.length !== artifact.ref.byteLength || digest(bytes) !== artifact.ref.sha256) reject("PROVENANCE");
    artifacts.set(artifact.role, { bytes, ref: readOnly({ byteLength: bytes.length, sha256: digest(bytes) }) });
  }
  const manifest = JSON.parse(artifacts.get("source")?.bytes.toString("utf8") ?? reject("PROVENANCE"));
  const compilerArtifact = nativeFs.readFileSync(nativeFs.realpathSync(COMPILER));
  const dependencies = JSON.parse(artifacts.get("installedTree")?.bytes.toString("utf8") ?? reject("PROVENANCE"));
  const compilerPhysical = nativeFs.realpathSync(COMPILER);
  const compilerMember = dependencies.installed?.flatMap(tree => tree.entries.map(entry => ({ ...entry, absolute: `${tree.root}/${entry.path}` })))
    .find(entry => entry.absolute === compilerPhysical);
  if (compilerMember?.type !== "file" || compilerMember.bytes !== compilerArtifact.length || compilerMember.sha256 !== digest(compilerArtifact)) reject("RUNTIME", "uncaptured compiler");
  const sourceBytes = new Map();
  for (const entry of manifest.entries ?? []) if (entry.type === "file") {
    const selected = path.posix.resolve("/app", entry.path);
    if (!selected.startsWith("/app/") || entry.path.split("/").some(part => !part || part === "." || part === "..")) reject("PATH");
    const bytes = nativeFs.readFileSync(selected);
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) reject("MANIFEST");
    sourceBytes.set(selected, bytes);
  }
  let closed;
  const captureFs = new Proxy({}, { get: (_, key) => closed ? closed.fs[key] : nativeFs[key] });
  const initial = { fs: captureFs, canonicalPath: selected => closed ? closed.canonicalPath(selected) : nativeFs.realpathSync(selected),
    assertCurrent: () => closed?.assertCurrent(), forbid: () => closed ? closed.forbid() : reject("FORBIDDEN_ACQUISITION"), revoke: () => closed?.revoke() };
  const loading = { identity: Object.freeze(Object.create(null)), get epoch() { return graph.epoch(); }, snapshot: undefined, runtimeSnapshot: undefined,
    requireCurrent: () => { if (!closed) reject("SOURCE_INPUT"); graph.assertCurrent(); },
    inventory: policy => graph.load(INVENTORY).collectSourceInventory("/app", policy),
    publicClosure: policy => graph.load(CLOSURE).checkPublicClosure("/app", policy),
    loadingMembers: () => graph.loadingMembers(), loadingEdges: () => graph.loadingEdges() };
  const graph = createLoader({ ...initial, fs: new Proxy({}, { get: (_, key) => key === "readFileSync" ? (selected, options) => {
    if (closed) return closed.fs.readFileSync(selected, options);
    const bytes = selected === compilerPhysical ? compilerArtifact : sourceBytes.get(selected);
    if (!bytes) reject("SOURCE_INPUT", `uncaptured startup module ${selected}`);
    return options === "utf8" ? bytes.toString("utf8") : Buffer.from(bytes);
  } : captureFs[key] }) }, compilerPhysical, loading);
  const sourceManifest = graph.load(`${SOURCE}sourceManifest.ts`), runtime = graph.load(`${SOURCE}sourceRuntimeSnapshot.ts`);
  const snapshot = sourceManifest.captureFilesystemSourceSnapshot("/app"), runtimeSnapshot = runtime.captureFilesystemRuntimeSnapshot("/app", "/pnpm/store", "/opt/pnpm");
  closed = graph.load(`${SOURCE}sourceMemoryFs.ts`).createSourceMemoryFs(snapshot, runtimeSnapshot);
  loading.snapshot = snapshot;
  loading.runtimeSnapshot = runtimeSnapshot;
  Object.freeze(loading);
  sourceManifest.verifyCapturedSourceManifest(snapshot, artifacts.get("source").bytes);
  runtime.verifyCapturedRuntimeManifest(runtimeSnapshot, artifacts.get("installedTree").bytes);
  const kernel = graph.load("/app/packages/starchess-training/src/economic/ownedKernel.ts"), registered = graph.load(`${SOURCE}registeredBytes.ts`);
  const owner = registered.createRegisteredByteStore(), references = new Map();
  for (const [role, artifact] of artifacts) {
    const ref = kernel.constructRef(artifact.ref.byteLength, artifact.ref.sha256);
    owner.register(role, ref, new Uint8Array(artifact.bytes));
    references.set(role, ref);
  }
  const bootstrap = graph.load(`${SOURCE}sourceBootstrap.ts`);
  const configuration = { snapshot, policy: selection.policy,
    provenance: Object.fromEntries(["source", "sourceInventory", "sourcePolicy"].map(role => [role, references.get(role)])),
    runtime: Object.fromEntries(["dependencyLock", "installedTree", "frozenStore", "toolTree", "image", "runtimeConfiguration"].map(role => [role, references.get(role)])) };
  const context = bootstrap.constructSourceBootstrapContext(owner.seal(), configuration);
  const input = bootstrap.constructUnverifiedSourceInput(context, { kind: "immutableMemory", snapshot });
  const seal = bootstrap.bootstrapSourceAuthority(context, input);
  bootstrap.requireVerifiedSourceSeal(seal);
  reject("RUNTIME_IMAGE_BINDING_UNSUPPORTED", "no independently measured current image execution binding or production dispatch adapter");
};
