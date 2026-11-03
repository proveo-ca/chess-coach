// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const excludedDirectories = new Set([
  ".git", "node_modules", ".pnpm-store", ".bun", ".cache", ".nx",
  "target", "dist", "dist-ssr", "build", "out", "coverage", "coverage-full",
  "playwright-report", "test-results", "storybook-static", ".gradle", ".wrangler",
  "vendor", "third_party", "third-party",
]);
const codeExtensions = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx",
  ".sh", ".bash", ".fish", ".ps1", ".cmd", ".bat", ".rs", ".toml", ".json", ".yaml", ".yml",
]);
const interpreter = ["py", "thon"].join("");
const alternative = ["py", "py"].join("");
const installer = ["pi", "p"].join("");
const manager = ["poe", "try"].join("");
const forbiddenInvocation = new RegExp(
  `(?<![\\w.-])(?:${interpreter}(?:\\d+(?:\\.\\d+)*)?|${alternative}\\d*|${installer}\\d*|${installer}env|${manager}|uv\\s+(?:run|sync|${installer}))(?![\\w.-])`,
  "i",
);
const forbiddenFiles = /\.(?:py|pyw|pyi|pyc|pyo|pyz|ipynb)$/i;
const dependencyFiles = new RegExp(`^(?:pyproject\\.toml|requirements(?:[._-].*)?\\.txt|Pipfile(?:\\.lock)?|${manager}\\.lock|uv\\.lock|tox\\.ini|\\.${interpreter}-version)$`, "i");

function allowBuildDependencies(source) {
  return source.replace(/\\\r?\n/g, " ").replace(
    /\b(?:apt-get|apt|apk|dnf|yum)\s+(?:install|add)\b[^;&|\n]*/g,
    (install) => install.replace(new RegExp(`\\b${interpreter}\\d*(?:[.][0-9]+)*(?:-[a-z0-9-]+)?\\b`, "gi"), "dependency-runtime"),
  );
}

function sourceText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString("utf16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff && bytes.length % 2 === 0) return Buffer.from(bytes.subarray(2)).swap16().toString("utf16le");
  return bytes.toString("utf8");
}

export function scanRepository(root) {
  const violations = [];
  let checked = 0;
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const display = relative(root, path);
      if (forbiddenFiles.test(entry.name) || dependencyFiles.test(entry.name) || entry.name === "__pycache__") {
        violations.push(`${display}: disallowed source, bytecode or dependency declaration`);
        continue;
      }
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      checked++;
      if (/^\.env(?:\.|$)/.test(entry.name) || /\.(?:key|pem)$/.test(entry.name)) continue;
      const details = lstatSync(path);
      if (!codeExtensions.has(extname(entry.name).toLowerCase()) && extname(entry.name) !== "" && !/^Dockerfile(?:\.|$)/.test(entry.name) && !(details.mode & 0o111)) continue;
      if (/lock(?:\.json)?$/.test(entry.name)) continue;
      if (details.size > 16 * 1024**2) {
        violations.push(`${display}: source exceeds inspection limit`);
        continue;
      }
      let source = sourceText(readFileSync(path));
      if (source.includes("\0")) {
        if (codeExtensions.has(extname(entry.name).toLowerCase())) violations.push(`${display}: unsupported source encoding`);
        continue;
      }
      if (/^Dockerfile(?:\.|$)/.test(entry.name)) source = allowBuildDependencies(source);
      if (forbiddenInvocation.test(source)) violations.push(`${display}: disallowed interpreter or package command`);
    }
  }
  walk(root);
  return { checked, violations: violations.sort() };
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 2) throw new Error("this check accepts no arguments");
    const result = scanRepository(dirname(dirname(fileURLToPath(import.meta.url))));
    for (const violation of result.violations) console.error(violation);
    console.log(`NO_PYTHON=${result.violations.length ? "FAIL" : "PASS"}`);
    console.log("SCOPE=FIRST_PARTY; DEPENDENCIES=ALLOWED");
    console.log(`FIRST_PARTY_FILES_CHECKED=${result.checked}`);
    process.exitCode = result.violations.length ? 1 : 0;
  } catch (error) {
    console.error(`NO_PYTHON=FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
