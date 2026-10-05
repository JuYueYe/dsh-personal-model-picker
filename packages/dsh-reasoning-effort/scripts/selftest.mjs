// Offline self-test: load the built client bundle under a fake module loader, a
// minimal hook shim, and a tiny fake DOM, then exercise registration, reading,
// every write path, and the card takeover — without installing anything.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
function check(name, condition, detail) {
	if (condition) {
		console.log(`  ok   ${name}`);
		return;
	}
	failures.push(name);
	console.log(`  FAIL ${name}${detail === void 0 ? "" : ` :: ${detail}`}`);
}
function equal(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}
const tick = () => new Promise((resolve) => {
	setTimeout(resolve, 0);
});

// --- fake DOM ------------------------------------------------------------------
let observerCallback;
globalThis.MutationObserver = function MutationObserverStub(callback) {
	return {
		observe: () => {
			observerCallback = callback;
		},
		disconnect: () => {
			observerCallback = void 0;
		}
	};
};
/** One node with just enough DOM surface for the takeover effect. */
function domNode(tag, children = []) {
	const node = {
		tagName: tag,
		children: children.slice(),
		style: {},
		parent: null,
		contains(other) {
			for (let cursor = other; cursor !== null && cursor !== void 0; cursor = cursor.parent) if (cursor === node) return true;
			return false;
		},
		closest(selector) {
			for (let cursor = node; cursor !== null && cursor !== void 0; cursor = cursor.parent) if (cursor.tagName === selector) return cursor;
			return null;
		},
		compareDocumentPosition(other) {
			const order = [];
			(function visit(current) {
				order.push(current);
				for (const child of current.children) visit(child);
			})(node.parent ?? node);
			return order.indexOf(other) > order.indexOf(node) ? 4 : 2;
		}
	};
	for (const child of children) child.parent = node;
	return node;
}
/** A provider card: header, this seat's node, and the page editor while open. */
function makeCard() {
	const ourNode = domNode("div");
	const header = domNode("div");
	const editor = domNode("div");
	const card = domNode("li", [
		header,
		ourNode
	]);
	return {
		card,
		header,
		ourNode,
		editor,
		open() {
			if (!card.children.includes(editor)) {
				editor.parent = card;
				card.children.push(editor);
			}
			observerCallback?.();
		},
		close() {
			card.children = card.children.filter((child) => child !== editor);
			editor.parent = null;
			observerCallback?.();
		}
	};
}

// --- fake React with the hook subset the component uses ------------------------
function makeReact(state) {
	const sameDeps = (left, right) => {
		if (left === void 0 || right === void 0) return left === right;
		return left.length === right.length && left.every((value, at) => value === right[at]);
	};
	return {
		createElement(type, props, ...children) {
			const kids = children.length === 0 ? void 0 : children.length === 1 ? children[0] : children;
			return {
				type,
				props: {
					...(props ?? {}),
					children: kids
				}
			};
		},
		useRef(init) {
			const at = state.cursor++;
			if (!(at in state.hooks)) state.hooks[at] = { current: init };
			return state.hooks[at];
		},
		useState(init) {
			const at = state.cursor++;
			if (!(at in state.hooks)) state.hooks[at] = typeof init === "function" ? init() : init;
			return [state.hooks[at], (next) => {
				state.hooks[at] = typeof next === "function" ? next(state.hooks[at]) : next;
			}];
		},
		useCallback(fn, deps) {
			const at = state.cursor++;
			const previous = state.callbacks.get(at);
			if (previous !== void 0 && sameDeps(previous.deps, deps)) return previous.fn;
			state.callbacks.set(at, {
				fn,
				deps: deps === void 0 ? void 0 : [...deps]
			});
			return fn;
		},
		// Effects are collected and run by flushEffects, so the harness can attach
		// the root ref first — like a real commit phase.
		useEffect(fn, deps) {
			const at = state.cursor++;
			state.pending.push({
				at,
				fn,
				deps
			});
		}
	};
}
function walk(node, visit) {
	if (node === null || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const item of node) walk(item, visit);
		return;
	}
	if (typeof node.type !== "undefined") visit(node);
	walk(node.props?.children, visit);
}
function collect(tree, predicate) {
	const found = [];
	walk(tree, (node) => {
		if (predicate(node)) found.push(node);
	});
	return found;
}
const byType = (tree, type) => collect(tree, (node) => node.type === type);
const byAria = (tree, label) => collect(tree, (node) => node.props?.["aria-label"] === label);
const byText = (tree, text) => collect(tree, (node) => node.props?.children === text);

// --- fake translator -----------------------------------------------------------
function translator(dict) {
	return (key, params) => {
		let text = dict[key] ?? key;
		if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
		return text;
	};
}

// --- the settings remote stub (must exist before apply captures it) ------------
const MODELS = [
	{
		id: "gpt-5.2",
		name: "GPT 5.2",
		reasoningEfforts: {
			off: null,
			low: "low",
			medium: "medium",
			high: "high"
		}
	},
	{ id: "gpt-image-1" },
	{
		id: "claude-opus-5-5",
		reasoningEfforts: {
			off: null,
			minimal: "minimal",
			low: "low",
			medium: "medium",
			high: "high",
			xhigh: "xhigh",
			max: "max"
		}
	},
	{
		id: "weird",
		reasoningEfforts: false
	}
];
const calls = {
	describe: 0,
	mutate: []
};
let descriptor = {
	ns: "llm-pi-ai",
	revision: 42,
	value: {
		providers: {
			a9527: { models: MODELS }
		}
	}
};
const settings = {
	describe: async () => {
		calls.describe += 1;
		return {
			ok: true,
			value: {
				writable: true,
				namespaces: [descriptor]
			}
		};
	},
	mutate: async (ns, ops, revision) => {
		calls.mutate.push({
			ns,
			ops,
			revision
		});
		return {
			ok: true,
			value: void 0
		};
	}
};

const sessionStub = {
	modelCatalog: async () => ({
		ok: true,
		value: { groups: [] }
	})
};
const llmStub = {
	discoverModels: async () => ({
		ok: true,
		value: []
	})
};
let presetDataset = {};

// --- load the bundle -----------------------------------------------------------
const source = readFileSync(join(root, "dist", "client.cjs"), "utf8");
let definition;
const reactState = {
	cursor: 0,
	hooks: {},
	effects: new Map(),
	callbacks: new Map(),
	pending: []
};
const React = makeReact(reactState);
const requireStub = (id) => {
	if (id === "react") return React;
	throw new Error(`unexpected require: ${id}`);
};
new Function("window", "require", source)({
	__ModuleLoader__: {
		load: (value) => {
			definition = value;
		}
	}
}, requireStub);

console.log("bundle");
check("loader received a definition", definition !== void 0);
check("module id is the package name", definition?.id === "dsh-reasoning-effort", definition?.id);
const mod = definition.factory(requireStub);
check("exports apply", typeof mod.apply === "function");
check("exports inject", Array.isArray(mod.inject), JSON.stringify(mod.inject));
check("inject includes remote.settings", mod.inject.includes("remote.settings"));
check("inject includes slots", mod.inject.includes("slots"));

// --- capture the slot registration --------------------------------------------
let registration;
let slotKey;
let fakeScope;
const fakeCtx = {
	effect: (fn) => {
		fn();
	},
	locale: {
		register: () => () => {},
		bind: () => translator(dict.zh)
	},
	inject: (_keys, callback) => {
		callback(fakeScope);
	}
};
fakeScope = {
	remote: {
		settings,
		session: sessionStub,
		llm: llmStub
	},
	slots: {
		inject: (key, callback) => {
			slotKey = key;
			callback();
		},
		register: (options, component) => {
			registration = {
				options,
				component
			};
			return () => {};
		}
	}
};
// The source files are plain script fragments (the bundle concatenates them),
// so evaluate them as a function body to read the dictionaries.
const dict = new Function(`${readFileSync(join(root, "src", "client", "locales.js"), "utf8")}
return { NS, zh, en };`)();
check("zh dictionary is complete", Object.keys(dict.zh).length > 0);
check("en dictionary matches zh keys", equal(Object.keys(dict.zh).sort(), Object.keys(dict.en).sort()));

mod.apply(fakeCtx);
console.log("registration");
check("seat key is the settings namespace", registration?.options?.key === mod.PI_AI_SETTINGS_NS, registration?.options?.key);
check("seat name is the provider-card slot", slotKey === mod.PROVIDER_CARD_SLOT, slotKey);
check("registered a component", typeof registration?.component === "function");

// --- component harness ---------------------------------------------------------
const provider = {
	provider: "a9527",
	displayName: "2gpt-claude",
	settingsNs: "llm-pi-ai",
	settingsPath: [
		"providers",
		"a9527"
	],
	active: true
};
const t = translator(dict.zh);
let tree;
function resolveComponent(element) {
	let node = element;
	let depth = 0;
	while (node !== null && typeof node === "object" && typeof node.type === "function") {
		if (++depth > 8) throw new Error("too many component layers");
		reactState.cursor = 0;
		node = node.type(node.props);
	}
	return expand(node);
}
/** Replace nested component elements (the switch) with the elements they render. */
function expand(node) {
	if (node === null || typeof node !== "object") return node;
	if (Array.isArray(node)) return node.map(expand);
	if (typeof node.type === "function") {
		reactState.cursor = 0;
		return expand(node.type(node.props));
	}
	return {
		...node,
		props: {
			...node.props,
			children: expand(node.props?.children)
		}
	};
}
const render = () => {
	tree = resolveComponent(registration.component({
		provider,
		configured: true,
		keyConfigured: true,
		settings,
		t
	}));
};
/** Point the component's root ref at the fake node, then run collected effects. */
function attachRoot(node) {
	const ref = Object.values(reactState.hooks).find((value) => value !== null && typeof value === "object" && value.current === null);
	if (ref !== void 0 && node !== void 0) ref.current = node;
}
function flushEffects() {
	const pending = reactState.pending;
	reactState.pending = [];
	for (const { at, fn, deps } of pending) {
		const previous = reactState.effects.get(at);
		const same = previous !== void 0 && (previous.deps === void 0 && deps === void 0 || previous.deps !== void 0 && deps !== void 0 && previous.deps.length === deps.length && previous.deps.every((value, index) => value === deps[index]));
		if (same) continue;
		previous?.cleanup?.();
		const cleanup = fn();
		reactState.effects.set(at, {
			deps,
			cleanup: typeof cleanup === "function" ? cleanup : void 0
		});
	}
}
/** Fresh mount: tear down old effects, then render against the current DOM. */
async function mount(card) {
	for (const { cleanup } of reactState.effects.values()) cleanup?.();
	reactState.hooks = {};
	reactState.effects = new Map();
	reactState.callbacks = new Map();
	reactState.pending = [];
	observerCallback = void 0;
	render();
	attachRoot(card?.ourNode);
	flushEffects();
	await tick();
	await tick();
	render();
	attachRoot(card?.ourNode);
	flushEffects();
}
/** Re-render the current instance (for observer-driven changes). */
function rerender(card) {
	render();
	attachRoot(card?.ourNode);
	flushEffects();
}
/** Unmount: run every live effect cleanup, like a real fiber teardown. */
function unmount() {
	for (const { cleanup } of reactState.effects.values()) cleanup?.();
	reactState.effects = new Map();
	reactState.pending = [];
	observerCallback = void 0;
}
const switches = () => byType(tree, "button").filter((node) => node.props.role === "switch");
const boxes = () => byType(tree, "input").filter((node) => node.props.type === "checkbox");
const mark = () => calls.mutate.length;
const lastOps = (from) => calls.mutate[from]?.ops;
const card = makeCard();

await mount();
console.log("render");
check("one thinking switch per model", switches().length === MODELS.length * 2, String(switches().length));
check("levels render seven boxes per declared model", boxes().length === 14, String(boxes().length));
check("row with levels shows thinking on", switches()[1]?.props["aria-checked"] === true);
check("row without levels shows thinking off", switches()[3]?.props["aria-checked"] === false);
check("explicit false shows thinking off", switches()[7]?.props["aria-checked"] === false);
check("first level box is off and checked", boxes()[0]?.props.checked === true);
check("level labels are bilingual", collect(tree, (node) => node.type === "label").some((node) => Array.isArray(node.props.children) && node.props.children[1] === dict.zh["level.off"]));
check("name field shows the stored name", byAria(tree, dict.zh["card.modelName"])[0]?.props.value === "GPT 5.2");

console.log("writes");
let at = mark();
switches()[3].props.onClick();
await tick();
check("thinking on writes the default level set", equal(lastOps(at), [{
	op: "set",
	path: [
		"providers",
		"a9527",
		"models",
		"1",
		"reasoningEfforts"
	],
	value: {
		off: null,
		low: "low",
		medium: "medium",
		high: "high"
	}
}]), JSON.stringify(lastOps(at)));
at = mark();
switches()[1].props.onClick();
await tick();
check("thinking off unsets the declaration", equal(lastOps(at), [{
	op: "unset",
	path: [
		"providers",
		"a9527",
		"models",
		"0",
		"reasoningEfforts"
	]
}]), JSON.stringify(lastOps(at)));
at = mark();
boxes()[0].props.onChange();
await tick();
check("unticking a level drops just that key", equal(lastOps(at), [{
	op: "set",
	path: [
		"providers",
		"a9527",
		"models",
		"0",
		"reasoningEfforts"
	],
	value: {
		low: "low",
		medium: "medium",
		high: "high"
	}
}]), JSON.stringify(lastOps(at)));
at = mark();
switches()[0].props.onClick();
await tick();
check("image switch writes the input list", equal(lastOps(at), [{
	op: "set",
	path: [
		"providers",
		"a9527",
		"models",
		"0",
		"input"
	],
	value: [
		"text",
		"image"
	]
}]), JSON.stringify(lastOps(at)));
at = mark();
byAria(tree, dict.zh["card.contextWindow"])[0].props.onBlur({ target: { value: "512K" } });
await tick();
check("capacity K suffix parses to a count", equal(lastOps(at), [{
	op: "set",
	path: [
		"providers",
		"a9527",
		"models",
		"0",
		"contextWindow"
	],
	value: 524288
}]), JSON.stringify(lastOps(at)));
at = mark();
byAria(tree, dict.zh["card.contextWindow"])[0].props.onBlur({ target: { value: "abc" } });
await tick();
render();
check("invalid capacity writes nothing", calls.mutate.length === at, JSON.stringify(lastOps(at)));
check("invalid capacity reports an error", byType(tree, "p").some((node) => node.props.children === dict.zh["card.invalidCapacity"]));
at = mark();
byAria(tree, dict.zh["card.modelName"])[0].props.onBlur({ target: { value: "" } });
await tick();
check("clearing a name unsets it", equal(lastOps(at), [{
	op: "unset",
	path: [
		"providers",
		"a9527",
		"models",
		"0",
		"name"
	]
}]), JSON.stringify(lastOps(at)));
at = mark();
byAria(tree, dict.zh["card.modelId"])[0].props.onBlur({ target: { value: "  " } });
await tick();
check("an empty id writes nothing", calls.mutate.length === at, JSON.stringify(lastOps(at)));

console.log("catalog edits");
render();
at = mark();
byText(tree, "✕")[3].props.onClick();
await tick();
check("deleting a row rewrites the catalog", equal(lastOps(at), [{
	op: "set",
	path: [
		"providers",
		"a9527",
		"models"
	],
	value: MODELS.slice(0, 3)
}]), JSON.stringify(lastOps(at)));
render();
at = mark();
byAria(tree, dict.zh["card.addModelId"])[0].props.onChange({ target: { value: "new-model" } });
render();
byText(tree, dict.zh["card.addModel"])[0].props.onClick();
await tick();
check("adding a row appends to the catalog", equal(lastOps(at), [{
	op: "set",
	path: [
		"providers",
		"a9527",
		"models"
	],
	value: [...MODELS, { id: "new-model" }]
}]), JSON.stringify(lastOps(at)));

console.log("bulk");
await mount();
byText(tree, dict.zh["card.bulk"])[0].props.onClick();
render();
// The panel renders before the rows, so its own boxes come first: 2 eligible
// rows plus the 14 level boxes of the declared models.
check("bulk panel lists only models without levels", boxes().length === 14 + 2, String(boxes().length));
check("bulk rows start unpicked", boxes()[0].props.checked === false && boxes()[1].props.checked === false);
byText(tree, dict.zh["card.bulkSelectAll"])[0].props.onClick();
render();
check("select all picks both eligible rows", boxes()[0].props.checked === true && boxes()[1].props.checked === true);
at = mark();
const applyButton = byType(tree, "button").find((node) => typeof node.props.children === "string" && node.props.children.startsWith(dict.zh["card.bulkApply"].split("{")[0]));
check("bulk apply button exists", applyButton !== void 0);
applyButton.props.onClick();
await tick();
await tick();
check("bulk writes one op per picked row", lastOps(at)?.length === 2, JSON.stringify(lastOps(at)));
check("bulk targets the picked indices", equal(lastOps(at)?.map((op) => op.path[3]), ["1", "3"]), JSON.stringify(lastOps(at)?.map((op) => op.path[3])));
check("bulk writes the default level set", equal(lastOps(at)?.[0]?.value, {
	off: null,
	low: "low",
	medium: "medium",
	high: "high"
}));

console.log("card takeover");
await mount(card);
check("a shut card renders nothing of ours", switches().length === 0, String(switches().length));
check("a shut card leaves the page editor alone", card.editor.style.display === void 0, String(card.editor.style.display));
card.open();
rerender(card);
check("pressing Edit renders our editor", switches().length === MODELS.length * 2, String(switches().length));
check("pressing Edit hides the page's own editor", card.editor.style.display === "none", String(card.editor.style.display));
check("the card header is never hidden", card.header.style.display === void 0, String(card.header.style.display));
card.close();
rerender(card);
check("pressing Edit again hides this seat", switches().length === 0, String(switches().length));
card.open();
rerender(card);
check("reopening renders again", switches().length === MODELS.length * 2, String(switches().length));
await mount(card);
card.open();
rerender(card);
check("the page editor stays hidden while taken over", card.editor.style.display === "none", String(card.editor.style.display));
unmount();
check("unmount restores the page editor", card.editor.style.display === void 0, String(card.editor.style.display));

console.log("capability table");
presetDataset = {
	"gpt-5.2": {
		mode: "chat",
		supports_vision: true,
		supports_reasoning: true,
		max_input_tokens: 400000,
		max_output_tokens: 128000
	},
	"openai/gpt-image-1": {
		mode: "image_generation",
		supports_vision: true
	},
	"anthropic/claude-opus-5-5": {
		mode: "chat",
		supports_reasoning: true,
		max_input_tokens: 200000,
		max_output_tokens: 64000
	},
	"atria-dawn-preview": {
		mode: "chat",
		max_input_tokens: 100000,
		max_output_tokens: 8000
	},
	"factless-model": {
		mode: "chat"
	}
};
const table = mod.buildPresets(presetDataset);
check("non-chat rows are dropped", table["gpt-image-1"] === void 0);
check("factless rows are dropped", table["factless-model"] === void 0);
check("provider prefixes collapse to one bare key", equal(table["claude-opus-5-5"], [
	0,
	1,
	200000,
	64000
]));
check("capabilities are ordered vision, reasoning, in, out", equal(table["gpt-5.2"], [
	1,
	1,
	400000,
	128000
]));
check("exact lookup finds a row", equal(mod.presetFor(table, "gpt-5.2"), [
	1,
	1,
	400000,
	128000
]));
check("dated variants fall back to the family row", equal(mod.presetFor(table, "gpt-5.2-2026-01-01"), [
	1,
	1,
	400000,
	128000
]));
check("unknown ids resolve to undefined", mod.presetFor(table, "totally-unknown") === void 0);
check("levels come from the adapter catalog", equal(mod.levelsFromCatalog({ reasoning: { efforts: [
	{ id: "low" },
	{ id: "off" },
	{ id: "not-a-level" }
] } }), {
	low: "low",
	off: null
}));

console.log("auto configure");
globalThis.fetch = async () => ({
	ok: true,
	json: async () => presetDataset
});
llmStub.discoverModels = async () => ({
	ok: true,
	value: [{
		id: "gpt-5.2",
		contextWindow: 350000,
		maxTokens: 64000,
		inputModalities: ["text", "image"]
	}]
});
sessionStub.modelCatalog = async () => ({
	ok: true,
	value: {
		groups: [{
			id: "a9527",
			models: [{ id: "weird", reasoning: { efforts: [{ id: "low" }, { id: "high" }] } }]
		}]
	}
});
descriptor = {
	ns: "llm-pi-ai",
	revision: 42,
	value: {
		providers: {
			a9527: {
				baseURL: "https://example.invalid/v1",
				api: "openai-completions",
				models: MODELS
			}
		}
	}
};
settings.describe = async () => ({
	ok: true,
	value: {
		writable: true,
		namespaces: [descriptor]
	}
});
await mount();
at = mark();
byText(tree, dict.zh["card.autoConfigure"])[0].props.onClick();
await tick();
await tick();
await tick();
const auto = lastOps(at) ?? [];
check("auto configure writes only known fields", auto.every((op) => op.op === "set"), JSON.stringify(auto));
check("the endpoint beats the table for capacity", auto.some((op) => equal(op, {
	op: "set",
	path: [
		"providers",
		"a9527",
		"models",
		"0",
		"contextWindow"
	],
	value: 350000
})), JSON.stringify(auto.filter((op) => op.path[4] === "contextWindow")));
check("the table supplies capacity the endpoint omits", auto.some((op) => equal(op, {
	op: "set",
	path: [
		"providers",
		"a9527",
		"models",
		"2",
		"contextWindow"
	],
	value: 200000
})), JSON.stringify(auto.filter((op) => op.path[4] === "contextWindow")));
check("a row nothing knows about is left alone", auto.every((op) => !(op.path[3] === "1" && op.path[4] === "input")));
check("the table's reasoning fact is not written over a refusal", auto.every((op) => !(op.path[3] === "3" && op.path[4] === "reasoningEfforts")));
check("rows that already declare levels keep them", auto.every((op) => !(op.path[4] === "reasoningEfforts" && [
	"0",
	"2"
].includes(op.path[3]))), JSON.stringify(auto.filter((op) => op.path[4] === "reasoningEfforts")));
check("auto configure reports how many rows it touched", JSON.stringify(calls.mutate[at]?.ops).length > 0);

console.log("adopt");
llmStub.discoverModels = async () => ({
	ok: true,
	value: [
		{ id: "gpt-5.2", name: "GPT 5.2" },
		{
			id: "brand-new",
			name: "Brand New",
			contextWindow: 128000,
			inputModalities: ["text", "image"]
		}
	]
});
await mount();
byText(tree, dict.zh["card.fetchModels"])[0].props.onClick();
await tick();
await tick();
render();
const candidateBoxes = boxes();
check("the adopt dialog lists the endpoint models", candidateBoxes.length >= 2, String(candidateBoxes.length));
check("already-present ids are not picked", candidateBoxes[0].props.checked === false, String(candidateBoxes[0].props.checked));
check("new ids are picked by default", candidateBoxes[1].props.checked === true);
at = mark();
const adoptButton = byType(tree, "button").find((node) => typeof node.props.children === "string" && node.props.children.startsWith(dict.zh["card.fetchAdopt"].split("{")[0]));
check("the adopt button exists", adoptButton !== void 0);
adoptButton.props.onClick();
await tick();
const adopted = lastOps(at)?.[0]?.value;
check("adopting appends the new model", equal(adopted?.at(-1), {
	id: "brand-new",
	name: "Brand New",
	contextWindow: 128000,
	input: ["text", "image"]
}), JSON.stringify(adopted?.at(-1)));
check("adopting keeps every existing row", adopted?.length === MODELS.length + 1, String(adopted?.length));

console.log("edge states");
// Regression: an undeclared `remote.llm` must fail loudly, not silently.
const savedLlm = fakeScope.remote.llm;
fakeScope.remote.llm = void 0;
descriptor = {
	ns: "llm-pi-ai",
	revision: 20,
	value: {
		providers: {
			a9527: { models: MODELS }
		}
	}
};
settings.describe = async () => ({
	ok: true,
	value: {
		writable: true,
		namespaces: [descriptor]
	}
});
await mount();
byText(tree, dict.zh["card.fetchModels"])[0].props.onClick();
await tick();
await tick();
render();
check("a missing discovery face reports an error", byType(tree, "p").some((node) => node.props.children === dict.zh["card.noLlm"]), JSON.stringify(byType(tree, "p").map((node) => node.props.children)));
fakeScope.remote.llm = savedLlm;
settings.describe = async () => ({
	ok: false,
	error: {
		code: "settings/refused",
		message: "nope"
	}
});
await mount(card);
check("a failed read renders nothing of ours", switches().length === 0);
check("a failed read leaves the page editor visible", card.editor.style.display === void 0, String(card.editor.style.display));
settings.describe = async () => ({
	ok: true,
	value: {
		writable: true,
		namespaces: []
	}
});
await mount();
check("missing namespace renders nothing of ours", switches().length === 0);
descriptor = {
	ns: "llm-pi-ai",
	revision: 7,
	value: {
		providers: {
			a9527: {}
		}
	}
};
settings.describe = async () => ({
	ok: true,
	value: {
		writable: true,
		namespaces: [descriptor]
	}
});
await mount(card);
check("no custom catalog renders nothing of ours", switches().length === 0);
check("no custom catalog leaves the page editor visible", card.editor.style.display === void 0, String(card.editor.style.display));
descriptor = {
	ns: "llm-pi-ai",
	revision: 8,
	value: {
		providers: {
			a9527: { models: MODELS }
		}
	}
};
settings.describe = async () => ({
	ok: true,
	value: {
		writable: false,
		namespaces: [descriptor]
	}
});
await mount();
check("read-only disables every control", [
	...switches(),
	...boxes(),
	...byType(tree, "input")
].every((node) => node.props.disabled === true));
check("legacy bare-array payload still renders rows", await (async () => {
	settings.describe = async () => ({
		ok: true,
		value: [descriptor]
	});
	await mount();
	return switches().length === MODELS.length * 2;
})(), String(switches().length));

console.log("");
if (failures.length > 0) {
	console.log(`${failures.length} check(s) FAILED: ${failures.join(", ")}`);
	process.exitCode = 1;
} else {
	console.log("all checks passed");
}
