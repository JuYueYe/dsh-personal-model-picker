// Build the shipped browser bundle from the readable `src/` fragments.
//
// This repo has no bundler: `dist/client.cjs` is a single-file ModuleLoader
// bundle whose regions are the `src/*.js` fragments in a fixed order. This
// script reproduces that artifact byte-for-byte, so `src/` is the only place a
// change has to be made:
//
//   node scripts/build.mjs            # rewrite dist/client.cjs + dist/index.js
//   node scripts/build.mjs --verify   # exit 1 when dist/ is stale
//
// `scripts/build.mjs --verify` is cheap enough to run in CI/prepack; it is the
// regression guard against "edited src, forgot to rebuild".
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const BUNDLE_ID = "dsh-personal-model-picker";

/** `src/` fragments in bundle order; `imports.js` is the require block, not a region. */
const REGIONS = [
  "catalog.js",
  "directory.js",
  "service.js",
  "classnames.js",
  "styles.js",
  "model-select.js",
  "locales.js",
  "register.js"
];

const PRELUDE =
  `window.__ModuleLoader__.load({id:"${BUNDLE_ID}",factory:(require)=>{` +
  "const module={exports:{}};const exports=module.exports;";
const TAIL = "return module.exports;}});";

/** Read a UTF-8 file as LF-only text, mapping a missing file to a loud error. */
async function read(part) {
  try {
    const text = await readFile(part, "utf8");
    // .gitattributes pins eol=lf, but a Windows checkout or a hand edit can still
    // slip a CR in; normalizing here keeps the bundle identical on every machine.
    return text.replace(/\r\n?/g, "\n");
  } catch (error) {
    throw new Error(`build: cannot read ${part}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Strip trailing newlines so the joiner owns every separator. */
function trimEnd(text) {
  return text.replace(/\n+$/, "");
}

/** Render the full `dist/client.cjs` text. */
async function renderBundle() {
  const imports = trimEnd(await read(join(SRC, "imports.js")));
  const parts = [];
  for (const file of REGIONS) {
    const text = trimEnd(await read(join(SRC, file)));
    if (!text.startsWith("//#region ")) {
      throw new Error(`build: src/${file} must start with a //#region header`);
    }
    if (!text.includes("//#endregion")) {
      throw new Error(`build: src/${file} must contain its //#endregion terminator`);
    }
    parts.push(text);
  }
  return `${PRELUDE}\n${imports}\n\n${parts.join("\n\n")}\n${TAIL}\n`;
}

/** Render the host face: `dist/index.js` is `src/host.js` verbatim. */
async function renderHost() {
  return await read(join(SRC, "host.js"));
}

/** Write the artifacts, or compare them when `--verify` is set. */
async function main() {
  const verify = process.argv.includes("--verify");
  const artifacts = [
    { name: "dist/client.cjs", next: await renderBundle() },
    { name: "dist/index.js", next: await renderHost() }
  ];
  let stale = 0;
  for (const artifact of artifacts) {
    const path = join(DIST, artifact.name.slice("dist/".length));
    if (verify) {
      const current = await read(path).catch(() => null);
      if (current !== artifact.next) {
        stale += 1;
        process.stderr.write(`build: ${artifact.name} is stale — run \`npm run build\`\n`);
      } else {
        process.stdout.write(`build: ${artifact.name} up to date\n`);
      }
      continue;
    }
    await writeFile(path, artifact.next, "utf8");
    process.stdout.write(`build: wrote ${artifact.name} (${Buffer.byteLength(artifact.next)} bytes)\n`);
  }
  if (stale > 0) process.exitCode = 1;
}

await main();
