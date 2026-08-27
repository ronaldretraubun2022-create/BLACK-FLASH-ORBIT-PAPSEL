import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirs = new Set([
  ".git",
  ".gradle",
  ".netlify",
  "coverage",
  "dist",
  "node_modules",
]);
const syntaxCheckDirs = new Set(["api", "scripts", "server", "tests"]);
const syntaxCheckExtensions = new Set([".cjs", ".js", ".mjs"]);
const sourceScanExtensions = new Set([".cjs", ".css", ".html", ".js", ".jsx", ".mjs"]);
const conflictMarkers = [
  "<".repeat(7),
  "=".repeat(7),
  ">".repeat(7),
];
const errors = [];

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;

    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(absolutePath, files);
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function relativePath(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function shouldSyntaxCheck(filePath) {
  const relative = relativePath(filePath);
  const [topLevelDir] = relative.split("/");

  return (
    syntaxCheckDirs.has(topLevelDir) &&
    syntaxCheckExtensions.has(path.extname(filePath))
  );
}

function checkSyntax(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    errors.push(
      `${relativePath(filePath)} failed node --check:\n${result.stderr || result.stdout}`,
    );
  }
}

async function scanSource(filePath) {
  if (!sourceScanExtensions.has(path.extname(filePath))) return;

  const relative = relativePath(filePath);
  const source = await readFile(filePath, "utf8");

  if (conflictMarkers.some((marker) => source.includes(marker))) {
    errors.push(`${relative} contains unresolved merge conflict markers.`);
  }

  if (
    relative.startsWith("apps/web/src/") &&
    source.includes('from "./apiUrlUtils.cjs"')
  ) {
    errors.push(`${relative} imports CommonJS apiUrlUtils from browser code.`);
  }

  if (
    relative.startsWith("apps/web/src/") &&
    source.includes("process.env.SUPABASE_SERVICE_ROLE")
  ) {
    errors.push(`${relative} references service-role env from browser code.`);
  }
}

const files = await walk(rootDir);

for (const filePath of files.filter(shouldSyntaxCheck)) {
  checkSyntax(filePath);
}

for (const filePath of files) {
  await scanSource(filePath);
}

if (errors.length > 0) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log(`Lint passed (${files.length} files scanned).`);
