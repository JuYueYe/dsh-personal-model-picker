// Smoke-test the forked bundle: it must own our module id, export the official
// plugin surface, and still register the shipped `models` section — that last
// one is what keeps the sidebar entry and its label identical after the fork.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
function check(name, condition, detail) {
	if (condition) console.log(`  ok   ${name}`);
	else {
		failures.push(name);
		console.log(`  FAIL ${name}${detail === void 0 ? "" : ` :: ${detail}`}`);
	}
}

const source = readFileSync(join(root, "dist", "client.cjs"), "utf8");
let definition;
const react = {
	createElement: () => ({}),
	useState: (value) => [value, () => {}],
	useRef: (value) => ({ current: value }),
	useEffect: () => {},
	useMemo: (fn) => fn(),
	useCallback: (fn) => fn()
};
const windowStub = {
	__ModuleLoader__: {
		load: (value) => {
			definition = value;
		}
	}
};
new Function("window", "require", source)(windowStub, (id) => id === "react" ? react : {});

console.log("fork bundle");
check("owns our module id", definition?.id === "dsh-reasoning-effort", definition?.id);
const mod = definition.factory((id) => id === "react" ? react : {});
check("exports apply", typeof mod.apply === "function");
check("exports inject", Array.isArray(mod.inject), JSON.stringify(mod.inject));
check("declares the settings remotes the page needs", [
	"remote.settings",
	"remote.llm",
	"remote.session"
].every((key) => mod.inject.includes(key)), JSON.stringify(mod.inject));
check("still registers the shipped models section", /settings\.section[\s\S]{0,200}?id: "models"/.test(source));
check("keeps the official provider-card seat", source.includes('"settings.models.provider-card"'));
console.log("grafted controls");
check("defines ModelThinking", source.includes("function ModelThinking"));
check("feeds it from the pi-ai editor", source.includes("thinking: {}"));
check("renders it in the row", source.includes("(0, react_jsx_runtime.jsx)(ModelThinking, {"));
check("defines ModelBulk", source.includes("function ModelBulk"));
check("places bulk above the pi-ai model list", source.includes("(0, react_jsx_runtime.jsx)(ModelBulk, {"));
check("turns image input into a switch", source.includes('role: "switch"') && source.includes("graftConfig") && source.includes('t("imageInput")'));
check("no longer renders the two input checkboxes", !source.includes('t(modality === "text" ? "modelInputText" : "modelInputImage")'));check("defines the config grafts", source.includes("function graftConfig"));
check("wires the editor actions", source.includes("const graftAll = async () =>"));
check("adds the auto-configure button", source.includes('t("autoConfigureModels")'));
check("adds the per-row fetch-config button", source.includes('t("fetchModelConfig")'));check("carries the bulk dictionary", source.includes("bulkThinking"));
check("carries bilingual level labels", source.includes('"level.xhigh"') && source.includes("xhigh（很高）"));
check("keeps the official reset control", source.includes('t("resetModels")'));
check("keeps the official fetch control", source.includes('t("fetchModels")'));

console.log("");
if (failures.length > 0) {
	console.log(`${failures.length} check(s) FAILED: ${failures.join(", ")}`);
	process.exitCode = 1;
} else {
	console.log("all checks passed");
}
