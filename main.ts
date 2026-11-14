import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
} from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

const entryRoot = fileURLToPath(new URL(".", import.meta.url));
const dossierLimits = {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 },
};

function optionValue(optionName: string, fallback: string): string {
  const flag = `--${optionName}`;
  const position = process.argv.indexOf(flag);
  if (position >= 0 && process.argv[position + 1]) {
    return process.argv[position + 1];
  }
  const joined = process.argv.find((argument) =>
    argument.startsWith(`${flag}=`),
  );
  return joined ? joined.slice(flag.length + 1) : fallback;
}

function snapshotLocation(input: string): string {
  return input.endsWith(".json") ? input : join(input, "snapshot.json");
}

function copyVisibleTree(source: string, destination: string): number {
  mkdirSync(destination, { recursive: true });
  let copiedFiles = 0;
  const entries = readdirSync(source).sort();
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const from = join(source, entry);
    const to = join(destination, entry);
    const details = statSync(from);
    if (details.isFile()) {
      copyFileSync(from, to);
      copiedFiles++;
      continue;
    }
    if (details.isDirectory()) copiedFiles += copyVisibleTree(from, to);
  }
  return copiedFiles;
}

function screenshotNames(folder: string): string[] {
  const names = readdirSync(folder)
    .filter((name) => !name.startsWith("."))
    .sort();
  if (names.length < 3) {
    throw Error(`screenshots requires at least 3; found ${names.length}`);
  }
  const safeName = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
  for (const name of names) {
    if (!safeName.test(name)) throw Error(`invalid screenshot name ${name}`);
  }
  return names;
}

function writeRadarFiles(output: string, board: unknown, radar: unknown): void {
  mkdirSync(output, { recursive: true });
  writeFileSync(
    join(output, "board.json"),
    JSON.stringify({ rows: board }) + "\n",
  );
  writeFileSync(join(output, "data.js"), dataScript(radar));
}

function writeDossierLast(output: string): void {
  const manifest = buildDossier(output, dossierLimits);
  writeFileSync(join(output, "dossier.json"), manifest);
}

function printSummary(
  protocolCount: number,
  watchlistCount: number,
  boardCount: number,
  earlyCount: number,
  liveCount: number,
  dashboardCount: number,
  screenshotCount: number,
): void {
  process.stdout.write(
    `${protocolCount} protocols; ${watchlistCount} watchlist; ${boardCount} rows (${earlyCount} early; ${liveCount} live)\n` +
      `Wrote board.json, data.js, dashboard (${dashboardCount} files), screenshots (${screenshotCount} files), dossier.json\n`,
  );
}

const inputArgument = optionValue("input", "/input");
const inputFile = snapshotLocation(inputArgument);
const outputDirectory = optionValue(
  "output",
  process.env.MAKEFUN_OUTPUT_DIR || "/output",
);

if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: snapshot not found: ${inputFile}\n`);
  process.exit(1);
}

const snapshot = parseSnapshot(readFileSync(inputFile, "utf8"));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue) {
  process.stderr.write(`token radar: ${issue}\n`);
  process.exit(1);
}

writeRadarFiles(outputDirectory, board, radar);
const dashboardCount = copyVisibleTree(
  join(entryRoot, "dashboard"),
  join(outputDirectory, "dashboard"),
);
const screenshotFolder = join(entryRoot, "screenshots");
screenshotNames(screenshotFolder);
const screenshotCount = copyVisibleTree(
  screenshotFolder,
  join(outputDirectory, "screenshots"),
);
writeDossierLast(outputDirectory);
printSummary(
  snapshot.protocols.length,
  snapshot.watchlist.length,
  board.length,
  radar.early_size,
  radar.live.length,
  dashboardCount,
  screenshotCount,
);
