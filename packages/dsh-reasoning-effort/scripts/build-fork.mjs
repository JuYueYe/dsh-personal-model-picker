// Build the forked client bundle: take the shipped
// `@deepseek-ai/dsh-client-ui-settings-models` client verbatim and graft the
// reasoning-effort controls onto it, so the page stays byte-identical to the
// official one everywhere except the few controls we add.
//
// Every edit asserts a single match. A re-fork against a newer core is meant to
// fail loudly here rather than ship a silently mangled page.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let source = readFileSync(join(root, "vendor", "official-client.cjs"), "utf8");
const applied = [];

/**
 * Replace one literal, asserting it occurs exactly once.
 * @param name - patch label reported on failure.
 * @param from - the literal to find.
 * @param to - its replacement.
 */
function patch(name, from, to) {
	const count = source.split(from).length - 1;
	if (count !== 1) throw new Error(`${name}: expected 1 match, found ${String(count)}`);
	source = source.replace(from, to);
	applied.push(name);
}

// --- 1. own the module id ------------------------------------------------------
patch("module id", 'id: "@deepseek-ai/dsh-client-ui-settings-models",', 'id: "dsh-reasoning-effort",');

// --- 2. the reasoning-effort control -------------------------------------------
/** Levels `@deepseek-ai/dsh-llm-pi-ai` accepts as `reasoningEfforts` keys. */
const THINKING = `\t\t/** Levels the pi-ai adapter accepts as \`reasoningEfforts\` keys, ascending. */
\t\tconst REASONING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
\t\t/** The level set the thinking switch installs. */
\t\tconst REASONING_DEFAULT_LEVELS = ["off", "low", "medium", "high"];
\t\t/** The wire value one level sends; only \`off\` may map to null. */
\t\tfunction reasoningWire(level) {
\t\t\treturn level === "off" ? null : level;
\t\t}
\t\t/** Build a capability object from a level set. */
\t\tfunction reasoningEffortsOf(levels) {
\t\t\tconst value = {};
\t\t\tfor (const level of levels) value[level] = reasoningWire(level);
\t\t\treturn value;
\t\t}
\t\t/** The declared capability object, or undefined when the row declares none. */
\t\tfunction reasoningLevels(model) {
\t\t\tconst value = model.reasoningEfforts;
\t\t\treturn value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
\t\t}
\t\t/**
\t\t* Declare a pi-ai model's reasoning capability: one switch for the whole
\t\t* declaration, then one box per level it offers. The write rides the row's own
\t\t* \`onChange\`, so it inherits the page's path-op plumbing and conflict handling.
\t\t* @param props - the row plus the row-replacement action.
\t\t* @returns the thinking control.
\t\t*/
\t\tfunction ModelThinking({ model, position, disabled, t, onChange }) {
\t\t\tconst levels = reasoningLevels(model);
\t\t\tconst on = levels !== void 0 && Object.keys(levels).length > 0;
\t\t\tconst write = (next) => {
\t\t\t\tconst copy = {
\t\t\t\t\t...model
\t\t\t\t};
\t\t\t\tif (next === void 0) Reflect.deleteProperty(copy, "reasoningEfforts");
\t\t\t\telse copy.reasoningEfforts = next;
\t\t\t\tonChange(copy);
\t\t\t};
\t\t\treturn (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\tclassName: ModelsSection_module_css_default["modelField"],
\t\t\t\tchildren: [(0, react_jsx_runtime.jsxs)("label", {
\t\t\t\t\tclassName: ModelsSection_module_css_default["modelFieldLabel"],
\t\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("input", {
\t\t\t\t\t\ttype: "checkbox",
\t\t\t\t\t\tchecked: on,
\t\t\t\t\t\tdisabled,
\t\t\t\t\t\t"aria-label": \`\${t("thinkingMode")} \${String(position)}\`,
\t\t\t\t\t\tonChange: (event) => {
\t\t\t\t\t\t\twrite(event.target.checked ? reasoningEffortsOf(REASONING_DEFAULT_LEVELS) : void 0);
\t\t\t\t\t\t}
\t\t\t\t\t}), t("thinkingMode")]
\t\t\t\t}), on ? (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\tclassName: ModelsSection_module_css_default["modelInputChoices"],
\t\t\t\t\trole: "group",
\t\t\t\t\t"aria-label": \`\${t("thinkingLevels")} \${String(position)}\`,
\t\t\t\t\tchildren: REASONING_LEVELS.map((level) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
\t\t\t\t\t\tlabel: t(\`level.\${level}\`),
\t\t\t\t\t\tchecked: level in levels,
\t\t\t\t\t\tdisabled,
\t\t\t\t\t\tonChange: (checked) => {
\t\t\t\t\t\t\tconst next = {
\t\t\t\t\t\t\t\t...levels
\t\t\t\t\t\t\t};
\t\t\t\t\t\t\tif (checked) next[level] = reasoningWire(level);
\t\t\t\t\t\t\telse delete next[level];
\t\t\t\t\t\t\twrite(Object.keys(next).length === 0 ? void 0 : next);
\t\t\t\t\t\t}
\t\t\t\t\t}, level))
\t\t\t\t}) : null]
\t\t\t});
\t\t}
\t\t//#region lib/types/client/ModelRow.js`;

patch("ModelThinking component", "\t\t//#region lib/types/client/ModelRow.js", THINKING);

// --- 3. render it in the row's expanded area -----------------------------------
patch("ModelRow slot", `\t\t\t\t\t\tonChange: props.onChange
\t\t\t\t\t})]
\t\t\t\t}) : null]`, `\t\t\t\t\t\tonChange: props.onChange
\t\t\t\t\t}), props.thinking === void 0 ? null : (0, react_jsx_runtime.jsx)(ModelThinking, {
\t\t\t\t\t\tmodel,
\t\t\t\t\t\tposition,
\t\t\t\t\t\tdisabled,
\t\t\t\t\t\tt,
\t\t\t\t\t\tonChange: props.onChange
\t\t\t\t\t})]
\t\t\t\t}) : null]`);

// --- 4. feed it from the pi-ai editor (not the DeepSeek catalog) ---------------
patch("pi-ai row wiring", `\t\t\t\t\t\t\tonChange: (next) => {
\t\t\t\t\t\t\t\tonChange(models.map((row, at) => at === index ? next : row));
\t\t\t\t\t\t\t},`, `\t\t\t\t\t\t\tonChange: (next) => {
\t\t\t\t\t\t\t\tonChange(models.map((row, at) => at === index ? next : row));
\t\t\t\t\t\t\t},
\t\t\t\t\t\t\tthinking: {},`);

// --- 5. dictionaries -----------------------------------------------------------
const EN_KEYS = `\t\t\tthinkingMode: "Thinking mode",
\t\t\tthinkingLevels: "Thinking levels",
\t\t\t"level.off": "off（关闭）",
\t\t\t"level.minimal": "minimal（最低）",
\t\t\t"level.low": "low（低）",
\t\t\t"level.medium": "medium（中）",
\t\t\t"level.high": "high（高）",
\t\t\t"level.xhigh": "xhigh（很高）",
\t\t\t"level.max": "max（最高）",
`;
const ZH_KEYS = EN_KEYS.replace('"Thinking mode"', '"思考模式"').replace('"Thinking levels"', '"思考档位"');
patch("en dictionary", '\t\t\tmodelInputImage: "Image",\n', `\t\t\tmodelInputImage: "Image",\n${EN_KEYS}`);
patch("zh dictionary", '\t\t\tmodelInputImage: "图片",\n', `\t\t\tmodelInputImage: "图片",\n${ZH_KEYS}`);

writeFileSync(join(root, "dist", "client.cjs"), source, "utf8");
console.log(`dist/client.cjs written: ${String(Buffer.byteLength(source))} bytes`);
for (const name of applied) console.log(`  patched  ${name}`);
