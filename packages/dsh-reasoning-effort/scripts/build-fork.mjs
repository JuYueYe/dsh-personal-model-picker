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
\t\t/** Upstream capability dataset: LiteLLM's model price/capacity table (MIT). */
\t\tconst GRAFT_PRESET_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
\t\tconst GRAFT_PRESET_KEY = "dsh-reasoning-effort/model-presets/v1";
\t\tconst GRAFT_PRESET_TTL = 1440 * 60 * 1000;
\t\t/** A positive integer fact, else 0. */
\t\tfunction graftPositive(value) {
\t\t\treturn typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
\t\t}
\t\t/** The id of one row, or an empty string. */
\t\tfunction graftId(row) {
\t\t\treturn row !== null && typeof row === "object" && typeof row.id === "string" ? row.id : "";
\t\t}
\t\t/**
\t\t* Compress the upstream dataset into \`model id -> [vision, reasoning, maxIn, maxOut]\`.
\t\t* Only \`mode === "chat"\` rows carrying a fact survive; 0 means "no fact".
\t\t*/
\t\tfunction graftPresetTable(payload) {
\t\t\tconst merged = /* @__PURE__ */ new Map();
\t\t\tif (payload === null || typeof payload !== "object") return {};
\t\t\tfor (const [key, value] of Object.entries(payload)) {
\t\t\t\tif (value === null || typeof value !== "object" || value.mode !== "chat") continue;
\t\t\t\tconst facts = [value.supports_vision === true ? 1 : 0, value.supports_reasoning === true ? 1 : 0, graftPositive(value.max_input_tokens), graftPositive(value.max_output_tokens)];
\t\t\t\tif (facts.every((fact) => fact === 0)) continue;
\t\t\t\tconst normalized = key.trim().toLowerCase();
\t\t\t\tconst slash = normalized.lastIndexOf("/");
\t\t\t\tconst bare = slash < 0 ? normalized : normalized.slice(slash + 1);
\t\t\t\tconst current = merged.get(bare);
\t\t\t\tmerged.set(bare, current === void 0 ? facts : [current[0] || facts[0], current[1] || facts[1], Math.max(current[2], facts[2]), Math.max(current[3], facts[3])]);
\t\t\t}
\t\t\treturn Object.fromEntries(merged);
\t\t}
\t\t/** Look one id up, falling back to shorter dash segments for dated releases. */
\t\tfunction graftPresetFor(table, id) {
\t\t\tlet key = String(id).trim().toLowerCase();
\t\t\tfor (;;) {
\t\t\t\tif (key in table) return table[key];
\t\t\t\tconst dash = key.lastIndexOf("-");
\t\t\t\tif (dash <= 0) return void 0;
\t\t\t\tkey = key.slice(0, dash);
\t\t\t}
\t\t}
\t\t/** Load the capability table, falling back to a day-old browser cache. */
\t\tasync function graftLoadPresets() {
\t\t\tlet cached;
\t\t\ttry {
\t\t\t\tcached = typeof localStorage === "undefined" ? void 0 : JSON.parse(localStorage.getItem(GRAFT_PRESET_KEY) ?? "null");
\t\t\t} catch {
\t\t\t\tcached = void 0;
\t\t\t}
\t\t\tif (cached !== null && typeof cached === "object" && typeof cached.at === "number" && Date.now() - cached.at < GRAFT_PRESET_TTL && cached.table !== void 0) return cached.table;
\t\t\tif (typeof fetch !== "function") return cached?.table;
\t\t\ttry {
\t\t\t\tconst response = await fetch(GRAFT_PRESET_URL, { cache: "no-store" });
\t\t\t\tif (!response.ok) return cached?.table;
\t\t\t\tconst table = graftPresetTable(await response.json());
\t\t\t\ttry {
\t\t\t\t\tlocalStorage?.setItem(GRAFT_PRESET_KEY, JSON.stringify({ at: Date.now(), table }));
\t\t\t\t} catch {}
\t\t\t\treturn table;
\t\t\t} catch {
\t\t\t\treturn cached?.table;
\t\t\t}
\t\t}
\t\t/**
\t\t* The partial write one row can learn from the endpoint and the table.
\t\t* Existing values always win, and a field no source actually knows stays
\t\t* untouched — otherwise an unknown row would silently lose image input.
\t\t* @param model - the row.
\t\t* @param endpoint - the endpoint's advertisement for it, if any.
\t\t* @param presets - the capability table.
\t\t* @returns the fields to merge into the row.
\t\t*/
\t\tfunction graftConfig(model, endpoint, presets) {
\t\t\tconst row = model !== null && typeof model === "object" ? model : {};
\t\t\tconst facts = presets === void 0 ? void 0 : graftPresetFor(presets, graftId(row));
\t\t\tconst add = {};
\t\t\tconst contextWindow = graftPositive(endpoint?.contextWindow) || graftPositive(facts?.[2]);
\t\t\tif (row.contextWindow === void 0 && contextWindow > 0) add.contextWindow = contextWindow;
\t\t\tconst maxTokens = graftPositive(endpoint?.maxTokens) || graftPositive(facts?.[3]);
\t\t\tif (row.maxTokens === void 0 && maxTokens > 0) add.maxTokens = maxTokens;
\t\t\tconst modalities = Array.isArray(endpoint?.inputModalities) ? endpoint.inputModalities : void 0;
\t\t\tif (row.input === void 0 && (modalities !== void 0 || facts !== void 0)) add.input = (modalities !== void 0 ? modalities.includes("image") : facts[0] === 1) ? ["text", "image"] : ["text"];
\t\t\tif (row.reasoningEfforts === void 0 && facts?.[1] === 1) add.reasoningEfforts = reasoningEffortsOf(REASONING_DEFAULT_LEVELS);
\t\t\treturn add;
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

// --- 3b. bulk thinking, above the pi-ai model list -----------------------------
const BULK = `\t\t/**
\t\t* Enable the default level set on several rows at once. Selecting only
\t\t* declaration-less rows keeps an existing choice untouched; like every other
\t\t* edit it rides the list's own \`onChange\`.
\t\t* @param props - the catalog rows plus the list-replacement action.
\t\t* @returns the bulk control.
\t\t*/
\t\tfunction ModelBulk({ models, disabled, t, onChange }) {
\t\t\tconst [open, setOpen] = (0, react.useState)(false);
\t\t\tconst [picked, setPicked] = (0, react.useState)(() => []);
\t\t\tconst eligible = models.map((model, index) => model !== null && typeof model === "object" && !(model.reasoningEfforts !== void 0 && model.reasoningEfforts !== false && Object.keys(model.reasoningEfforts).length > 0) ? index : -1).filter((index) => index >= 0);
\t\t\tconst apply = () => {
\t\t\t\tonChange(models.map((model, index) => picked.includes(index) ? {
\t\t\t\t\t...model ?? {},
\t\t\t\t\treasoningEfforts: reasoningEffortsOf(REASONING_DEFAULT_LEVELS)
\t\t\t\t} : model));
\t\t\t\tsetOpen(false);
\t\t\t\tsetPicked([]);
\t\t\t};
\t\t\tconst link = (label, action, off) => (0, react_jsx_runtime.jsx)("button", {
\t\t\t\ttype: "button",
\t\t\t\tclassName: ModelsSection_module_css_default["linkButton"],
\t\t\t\tdisabled: disabled || off,
\t\t\t\tonClick: action,
\t\t\t\tchildren: label
\t\t\t});
\t\t\treturn (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\tchildren: [link(t("bulkThinking"), () => {
\t\t\t\t\tsetOpen(!open);
\t\t\t\t\tsetPicked([]);
\t\t\t\t}, eligible.length === 0), open ? (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\t\tstyle: {
\t\t\t\t\t\tpadding: 12,
\t\t\t\t\t\tborder: "1px solid var(--dsw-alias-border-l1)",
\t\t\t\t\t\tborderRadius: 12,
\t\t\t\t\t\tmargin: "8px 0"
\t\t\t\t\t},
\t\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("p", {
\t\t\t\t\t\tchildren: t("bulkHint")
\t\t\t\t\t}), link(t("bulkSelectAll"), () => setPicked([...eligible])), " ", link(t("bulkClear"), () => setPicked([])), (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t\tstyle: {
\t\t\t\t\t\t\tmaxHeight: 240,
\t\t\t\t\t\t\toverflowY: "auto"
\t\t\t\t\t\t},
\t\t\t\t\t\tchildren: eligible.map((index) => (0, react_jsx_runtime.jsxs)("label", {
\t\t\t\t\t\t\tstyle: {
\t\t\t\t\t\t\t\tdisplay: "flex",
\t\t\t\t\t\t\t\tgap: 8,
\t\t\t\t\t\t\t\tpadding: 5
\t\t\t\t\t\t\t},
\t\t\t\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("input", {
\t\t\t\t\t\t\t\ttype: "checkbox",
\t\t\t\t\t\t\t\tdisabled,
\t\t\t\t\t\t\t\tchecked: picked.includes(index),
\t\t\t\t\t\t\t\tonChange: (event) => setPicked(event.target.checked ? [...picked, index] : picked.filter((at) => at !== index))
\t\t\t\t\t\t\t}), models[index]?.name ?? models[index]?.id ?? String(index + 1)]
\t\t\t\t\t\t}, String(index)))
\t\t\t\t\t}), link(t("bulkApply", {
\t\t\t\t\t\tcount: picked.length
\t\t\t\t\t}), apply, picked.length === 0), " ", link(t("bulkCancel"), () => setOpen(false))]}) : null]
\t\t\t});
\t\t}
\t\t//#region lib/types/client/ModelRow.js`;

patch("ModelBulk component", "\t\t//#region lib/types/client/ModelRow.js", BULK);

patch("bulk placement", `\t\t\t\t\t(0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t\tclassName: ModelsSection_module_css_default["modelList"],
\t\t\t\t\t\tchildren: models.map((model, index) => (0, react_jsx_runtime.jsx)(ModelRow, {`, `\t\t\t\t\t(0, react_jsx_runtime.jsx)(ModelBulk, {
\t\t\t\t\t\tmodels,
\t\t\t\t\t\tdisabled,
\t\t\t\t\t\tt,
\t\t\t\t\t\tonChange
\t\t\t\t\t}),
\t\t\t\t\t(0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t\tclassName: ModelsSection_module_css_default["modelList"],
\t\t\t\t\t\tchildren: models.map((model, index) => (0, react_jsx_runtime.jsx)(ModelRow, {`);

// --- 3c. per-row and catalog-wide configuration from the endpoint + table ------
patch("editor config actions", `\t\t\tconst closePicker = () => {`, `\t\t\t/** Ask the endpoint once, in the same shape the official fetch uses. */
\t\t\tconst graftDiscover = async () => {
\t\t\t\tconst answer = await operations.discoverModels(probe.settingsNs, {
\t\t\t\t\t...probe.provider === void 0 ? {} : { provider: probe.provider },
\t\t\t\t\t...probe.baseURL === void 0 || probe.baseURL.length === 0 ? {} : { baseURL: probe.baseURL },
\t\t\t\t\t...probe.api === void 0 ? {} : { api: probe.api },
\t\t\t\t\t...probe.apiKey === void 0 ? {} : { apiKey: probe.apiKey }
\t\t\t\t});
\t\t\t\treturn answer.kind === "found" ? answer.models : [];
\t\t\t};
\t\t\t/** Fill the rows a source actually knows something about. */
\t\t\tconst graftAll = async () => {
\t\t\t\tsetBusy(true);
\t\t\t\tsetFailure(void 0);
\t\t\t\ttry {
\t\t\t\t\tconst [found, presets] = await Promise.all([graftDiscover(), graftLoadPresets()]);
\t\t\t\t\tconst endpoint = new Map(found.map((model) => [model.id, model]));
\t\t\t\t\tlet touched = 0;
\t\t\t\t\tconst next = models.map((model) => {
\t\t\t\t\t\tconst add = graftConfig(model, endpoint.get(graftId(model)), presets);
\t\t\t\t\t\tif (Object.keys(add).length === 0) return model;
\t\t\t\t\t\ttouched += 1;
\t\t\t\t\t\treturn {
\t\t\t\t\t\t\t...model,
\t\t\t\t\t\t\t...add
\t\t\t\t\t\t};
\t\t\t\t\t});
\t\t\t\t\tif (touched === 0) {
\t\t\t\t\t\tsetFailure(t("configNone"));
\t\t\t\t\t\treturn;
\t\t\t\t\t}
\t\t\t\t\tonChange(next);
\t\t\t\t} finally {
\t\t\t\t\tsetBusy(false);
\t\t\t\t}
\t\t\t};
\t\t\t/** Fill exactly one row, leaving the rest alone. */
\t\t\tconst graftOne = async (index) => {
\t\t\t\tsetBusy(true);
\t\t\t\tsetFailure(void 0);
\t\t\t\ttry {
\t\t\t\t\tconst [found, presets] = await Promise.all([graftDiscover(), graftLoadPresets()]);
\t\t\t\t\tconst endpoint = new Map(found.map((model) => [model.id, model]));
\t\t\t\t\tconst add = graftConfig(models[index], endpoint.get(graftId(models[index])), presets);
\t\t\t\t\tif (Object.keys(add).length === 0) {
\t\t\t\t\t\tsetFailure(t("configNone"));
\t\t\t\t\t\treturn;
\t\t\t\t\t}
\t\t\t\t\tpatch(index, add);
\t\t\t\t} finally {
\t\t\t\t\tsetBusy(false);
\t\t\t\t}
\t\t\t};
\t\t\tconst closePicker = () => {`);

patch("auto-configure button", `\t\t\t\t\t\t\t\tchildren: busy ? t("fetching") : t("fetchModels")
\t\t\t\t\t\t\t})
\t\t\t\t\t\t]`, `\t\t\t\t\t\t\t\tchildren: busy ? t("fetching") : t("fetchModels")
\t\t\t\t\t\t\t}),
\t\t\t\t\t\t\t(0, react_jsx_runtime.jsx)("button", {
\t\t\t\t\t\t\t\ttype: "button",
\t\t\t\t\t\t\t\tclassName: ModelsSection_module_css_default["linkButton"],
\t\t\t\t\t\t\t\tdisabled: disabled || busy,
\t\t\t\t\t\t\t\ttitle: t("autoConfigureHint"),
\t\t\t\t\t\t\t\tonClick: () => {
\t\t\t\t\t\t\t\t\tgraftAll();
\t\t\t\t\t\t\t\t},
\t\t\t\t\t\t\t\tchildren: t("autoConfigureModels")
\t\t\t\t\t\t\t})
\t\t\t\t\t\t]`);

patch("per-row button", `\t\t\t\t\t\t(0, react_jsx_runtime.jsx)("button", {
\t\t\t\t\t\t\ttype: "button",
\t\t\t\t\t\t\tclassName: ModelsSection_module_css_default["iconButton"],
\t\t\t\t\t\t\t"aria-label": \`\${t("modelAdvanced")} \${String(position)}\`,`, `\t\t\t\t\t\tprops.onFetchConfig === void 0 ? null : (0, react_jsx_runtime.jsx)("button", {
\t\t\t\t\t\t\ttype: "button",
\t\t\t\t\t\t\tclassName: ModelsSection_module_css_default["linkButton"],
\t\t\t\t\t\t\tdisabled,
\t\t\t\t\t\t\ttitle: t("fetchModelConfigHint"),
\t\t\t\t\t\t\tonClick: props.onFetchConfig,
\t\t\t\t\t\t\tchildren: t("fetchModelConfig")
\t\t\t\t\t\t}),
\t\t\t\t\t\t(0, react_jsx_runtime.jsx)("button", {
\t\t\t\t\t\t\ttype: "button",
\t\t\t\t\t\t\tclassName: ModelsSection_module_css_default["iconButton"],
\t\t\t\t\t\t\t"aria-label": \`\${t("modelAdvanced")} \${String(position)}\`,`);

// --- 3d. image input becomes one switch ----------------------------------------
// The page ships a `switchThumb` class it never uses and no Switch primitive, so
// the knob is drawn inline; that keeps the control independent of any class the
// official stylesheet may rename.
patch("image switch", `\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("legend", {
\t\t\t\t\tclassName: ModelsSection_module_css_default["modelFieldLabel"],
\t\t\t\t\tchildren: t("modelInputTypes")
\t\t\t\t}), (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\tclassName: ModelsSection_module_css_default["modelInputChoices"],
\t\t\t\t\tchildren: ["text", "image"].map((modality) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
\t\t\t\t\t\tlabel: t(modality === "text" ? "modelInputText" : "modelInputImage"),
\t\t\t\t\t\tchecked: selected.includes(modality),
\t\t\t\t\t\tdisabled: disabled || selected.length === 1 && selected.includes(modality),
\t\t\t\t\t\tonChange: (checked) => {
\t\t\t\t\t\t\tconst nextSelected = ["text", "image"].filter((value) => value === modality ? checked : selected.includes(value));
\t\t\t\t\t\t\tconst next = {
\t\t\t\t\t\t\t\t...model,
\t\t\t\t\t\t\t\t[field]: nextSelected
\t\t\t\t\t\t\t};
\t\t\t\t\t\t\tif (field === "inputModalities" && !nextSelected.includes("image")) {
\t\t\t\t\t\t\t\tReflect.deleteProperty(next, "imagePixelBudget");
\t\t\t\t\t\t\t\tReflect.deleteProperty(next, "imageMaxBytes");
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonChange(next);
\t\t\t\t\t\t}
\t\t\t\t\t}, modality))
\t\t\t\t})]`, `\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("legend", {
\t\t\t\t\tclassName: ModelsSection_module_css_default["modelFieldLabel"],
\t\t\t\t\tchildren: t("imageInput")
\t\t\t\t}), (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\tclassName: ModelsSection_module_css_default["modelInputChoices"],
\t\t\t\t\tchildren: (0, react_jsx_runtime.jsx)("button", {
\t\t\t\t\t\ttype: "button",
\t\t\t\t\t\trole: "switch",
\t\t\t\t\t\t"aria-checked": selected.includes("image"),
\t\t\t\t\t\t"aria-label": \`\${t("imageInput")} \${String(position)}\`,
\t\t\t\t\t\ttitle: t("imageInput"),
\t\t\t\t\t\tdisabled,
\t\t\t\t\t\tonClick: () => {
\t\t\t\t\t\t\tconst checked = !selected.includes("image");
\t\t\t\t\t\t\tconst nextSelected = checked ? ["text", "image"] : ["text"];
\t\t\t\t\t\t\tconst next = {
\t\t\t\t\t\t\t\t...model,
\t\t\t\t\t\t\t\t[field]: nextSelected
\t\t\t\t\t\t\t};
\t\t\t\t\t\t\tif (field === "inputModalities" && !checked) {
\t\t\t\t\t\t\t\tReflect.deleteProperty(next, "imagePixelBudget");
\t\t\t\t\t\t\t\tReflect.deleteProperty(next, "imageMaxBytes");
\t\t\t\t\t\t\t}
\t\t\t\t\t\t\tonChange(next);
\t\t\t\t\t\t},
\t\t\t\t\t\tstyle: {
\t\t\t\t\t\t\twidth: 44,
\t\t\t\t\t\t\theight: 24,
\t\t\t\t\t\t\tflex: "0 0 auto",
\t\t\t\t\t\t\tborderRadius: 12,
\t\t\t\t\t\t\tborder: "none",
\t\t\t\t\t\t\tpadding: 2,
\t\t\t\t\t\t\tdisplay: "flex",
\t\t\t\t\t\t\talignItems: "center",
\t\t\t\t\t\t\tjustifyContent: selected.includes("image") ? "flex-end" : "flex-start",
\t\t\t\t\t\t\tbackground: selected.includes("image") ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-state-idle-primary)",
\t\t\t\t\t\t\tcursor: disabled ? "default" : "pointer",
\t\t\t\t\t\t\topacity: disabled ? 0.5 : 1
\t\t\t\t\t\t},
\t\t\t\t\t\tchildren: (0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\t\tstyle: {
\t\t\t\t\t\t\t\twidth: 20,
\t\t\t\t\t\t\t\theight: 20,
\t\t\t\t\t\t\t\tborderRadius: "50%",
\t\t\t\t\t\t\t\tbackground: "#fff",
\t\t\t\t\t\t\t\tdisplay: "block"
\t\t\t\t\t\t\t}
\t\t\t\t\t\t})
\t\t\t\t\t})
\t\t\t\t})]`);

// --- 4. feed it from the pi-ai editor (not the DeepSeek catalog) ---------------
patch("pi-ai row wiring", `\t\t\t\t\t\t\tonChange: (next) => {
\t\t\t\t\t\t\t\tonChange(models.map((row, at) => at === index ? next : row));
\t\t\t\t\t\t\t},`, `\t\t\t\t\t\t\tonChange: (next) => {
\t\t\t\t\t\t\t\tonChange(models.map((row, at) => at === index ? next : row));
\t\t\t\t\t\t\t},
\t\t\t\t\t\t\tthinking: {},
\t\t\t\t\t\t\tonFetchConfig: () => {
\t\t\t\t\t\t\t\tgraftOne(index);
\t\t\t\t\t\t\t},`);

// --- 5. dictionaries -----------------------------------------------------------
const EN_KEYS = `\t\t\tthinkingMode: "Thinking mode",
\t\t\tthinkingLevels: "Thinking levels",
\t\t\tbulkThinking: "Enable thinking in bulk",
\t\t\tbulkHint: "Tick the models you have confirmed support reasoning. Rows that already declare levels keep them; ticking only declares capability, it does not mean the endpoint accepts it.",
\t\t\tbulkSelectAll: "Select models without levels",
\t\t\tbulkClear: "Clear selection",
\t\t\tbulkApply: "Enable selected ({count})",
\t\t\tbulkCancel: "Cancel",
\t\t\timageInput: "Image input",
\t\t\tautoConfigureModels: "Configure all models",
\t\t\tautoConfigureHint: "Fill in context window, output cap, image input and thinking levels from the endpoint and the capability table for every model; existing values are kept",
\t\t\tfetchModelConfig: "Fetch config",
\t\t\tfetchModelConfigHint: "Fill in this model's caps, image input and thinking levels from the endpoint and the capability table; existing values are kept",
\t\t\tconfigNone: "Neither the endpoint nor the capability table had anything to write; existing values are unchanged.",
\t\t\t"level.off": "off（关闭）",
\t\t\t"level.minimal": "minimal（最低）",
\t\t\t"level.low": "low（低）",
\t\t\t"level.medium": "medium（中）",
\t\t\t"level.high": "high（高）",
\t\t\t"level.xhigh": "xhigh（很高）",
\t\t\t"level.max": "max（最高）",
`;
const ZH_KEYS = `\t\t\tthinkingMode: "思考模式",
\t\t\tthinkingLevels: "思考档位",
\t\t\tbulkThinking: "批量开启思考模式",
\t\t\tbulkHint: "请选择确认支持推理的模型。已有等级配置保持不变；勾选只声明能力，不代表端点实际支持。",
\t\t\tbulkSelectAll: "全选未开启模型",
\t\t\tbulkClear: "取消全选",
\t\t\tbulkApply: "开启所选（{count}）",
\t\t\tbulkCancel: "取消",
\t\t\timageInput: "支持图片输入",
\t\t\tautoConfigureModels: "自动配置所有模型",
\t\t\tautoConfigureHint: "从端点与模型能力表为每个模型补齐上下文窗口、输出上限、图片与思考档位；已有值保持不动",
\t\t\tfetchModelConfig: "获取配置",
\t\t\tfetchModelConfigHint: "从端点与模型能力表为这个模型补齐上限、图片与思考档位；已有值保持不动",
\t\t\tconfigNone: "端点与能力表都没有可写入的配置；已有值保持不变。",
\t\t\t"level.off": "off（关闭）",
\t\t\t"level.minimal": "minimal（最低）",
\t\t\t"level.low": "low（低）",
\t\t\t"level.medium": "medium（中）",
\t\t\t"level.high": "high（高）",
\t\t\t"level.xhigh": "xhigh（很高）",
\t\t\t"level.max": "max（最高）",
`;
patch("en dictionary", '\t\t\tmodelInputImage: "Image",\n', `\t\t\tmodelInputImage: "Image",\n${EN_KEYS}`);
patch("zh dictionary", '\t\t\tmodelInputImage: "图片",\n', `\t\t\tmodelInputImage: "图片",\n${ZH_KEYS}`);

writeFileSync(join(root, "dist", "client.cjs"), source, "utf8");
console.log(`dist/client.cjs written: ${String(Buffer.byteLength(source))} bytes`);
for (const name of applied) console.log(`  patched  ${name}`);
