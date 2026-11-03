// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scanRepository } from "./assert-no-python.mjs";

let root;
const language = ["py", "thon"].join("");
beforeEach(() => { root = mkdtempSync("/tmp/opencode/language-policy-"); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });
function fixture(path, source = "") {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, source);
}

test("checks untracked and hidden source without relying on gitignore", () => {
  fixture(".gitignore", "scratch/\n");
  fixture("scratch/ignored.py", "");
  fixture(".hidden/test.pyw", "");
  fixture("src/typed.pyi", "");
  expect(scanRepository(root).violations).toHaveLength(3);
});

test("rejects bytecode and dependency declarations", () => {
  fixture("compiled.pyc");
  fixture("pyproject.toml");
  fixture("requirements-dev.txt");
  expect(scanRepository(root).violations).toHaveLength(3);
});

test("rejects interpreter shebangs, embedded commands and task invocations", () => {
  fixture("tool", `#!/usr/bin/env ${language}3\n`);
  fixture("fake.mjs", `const fake = '#!/usr/bin/${language}3\\n';`);
  fixture("mise.toml", `run = '${language} -m unittest'`);
  fixture("package.json", JSON.stringify({ scripts: { test: `${language}3 test.py` } }));
  expect(scanRepository(root).violations).toHaveLength(4);
});

test("excludes installed dependencies, git internals and generated outputs", () => {
  for (const directory of ["node_modules", ".git", "target", "dist", "vendor"]) fixture(`${directory}/dep.py`);
  fixture("src/main.rs", "fn main() {}\n");
  expect(scanRepository(root).violations).toEqual([]);
});

test("retains historical prose without treating it as active code", () => {
  fixture("_spec/history.md", `Previously used ${language}3.\n`);
  fixture("src/allowed.mjs", "console.log('bun');\n");
  expect(scanRepository(root).violations).toEqual([]);
});

test("allows third-party build dependency packages but not interpreter commands", () => {
  fixture("Dockerfile", `RUN apt-get install -y meson ${language}3 libstdc++6\n`);
  expect(scanRepository(root).violations).toEqual([]);
  fixture("Dockerfile", `RUN apt-get install -y ${language}3 && ${language}3 app.py\n`);
  expect(scanRepository(root).violations).toHaveLength(1);
});
