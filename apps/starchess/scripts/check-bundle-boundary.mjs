import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist/starchess");

const FORBIDDEN = [
  "apps/chess",
  "gameStore",
  "coachStore",
  "EnginePool",
  "stockfish",
  "web-llm",
  "@mlc-ai",
  "useChessBoard",
  "/chess/pieces/",
];

if (!fs.existsSync(distDir)) {
  console.error(
    `Missing build output at ${distDir}. Run \`pnpm --filter @chess-coach/starchess build\` first.`,
  );
  process.exit(1);
}

/** @param {string} dir */
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

const hits = [];

for (const file of walk(distDir)) {
  // Skip binary assets; scan text-ish build outputs.
  if (!/\.(js|mjs|cjs|css|html|map|json|txt|svg)$/i.test(file)) continue;
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const needle of FORBIDDEN) {
    if (content.includes(needle)) {
      hits.push({ file: path.relative(distDir, file), needle });
    }
  }
}

if (hits.length > 0) {
  console.error("Bundle boundary violations found in dist/starchess:");
  for (const { file, needle } of hits) {
    console.error(`  ${file}: forbidden substring "${needle}"`);
  }
  process.exit(1);
}

console.log("Bundle boundary check passed.");
