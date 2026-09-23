// SPEC: _spec/_plans/chess-ui-primitives.puml
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)],
  );
const errors = [];
for (const file of [...walk(resolve(root, "src")), ...walk(resolve(root, ".storybook"))]) {
  const text = readFileSync(file, "utf8");
  if (/\.[cm]?[jt]sx?$/.test(file)) {
    for (const match of text.matchAll(/(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g)) {
      const outside =
        match[1].startsWith(".") &&
        relative(root, resolve(dirname(file), match[1])).startsWith("..");
      if (
        outside ||
        /^(~\/|@solidjs\/router$|@chess-coach\/(?!ui-web))|(?:^|\/)apps\//.test(match[1])
      ) {
        errors.push(`${file}: app dependency ${match[1]}`);
      }
    }
  }
  if (file.endsWith(".css") && /\[[^\]]*data-testid/.test(text))
    errors.push(`${file}: testid CSS selector`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log("ui-web: app-independent imports and CSS layout checks passed");
