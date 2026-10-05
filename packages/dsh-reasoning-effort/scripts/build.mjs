// Build the client bundle: concatenate src/client in dependency order inside the
// `window.__ModuleLoader__` factory wrapper the Web shell expects.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const ORDER = ["imports.js", "locales.js", "presets.js", "editor.js", "index.js"];

const body = ORDER
	.map((name) => `//#region src/client/${name}\n${readFileSync(join(root, "src", "client", name), "utf8").trimEnd()}\n//#endregion`)
	.join("\n\n");

const bundle = `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;
${body}

return module.exports;}});
`;

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "client.additive.cjs"), bundle, "utf8");
console.log(`dist/client.cjs written: ${String(Buffer.byteLength(bundle))} bytes`);
