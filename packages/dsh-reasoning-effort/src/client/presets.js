//#region presets
/**
 * The seven levels `@deepseek-ai/dsh-llm-pi-ai` accepts as `reasoningEfforts`
 * keys, in ascending order. `reasoningEfforts` maps each supported level to the
 * spelling this route must actually send, so the object declares a capability —
 * it is not one selected level.
 */
const LEVEL_ORDER = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
/** The level set the thinking switch installs, and the one bulk mode applies. */
const DEFAULT_LEVELS = [
	"off",
	"low",
	"medium",
	"high"
];
/**
 * The wire spelling used for one level. `off` is the only level allowed to map
 * to null: it means "send no reasoning parameter".
 * @param level - one level key.
 * @returns the value the adapter sends for that level.
 */
function wireOf(level) {
	return level === "off" ? null : level;
}
/**
 * Build one capability object from a set of levels.
 * @param levels - level keys to declare.
 * @returns the `reasoningEfforts` value.
 */
function effortsOf(levels) {
	const value = {};
	for (const level of levels) value[level] = wireOf(level);
	return value;
}
/**
 * Read a model's declared capability object.
 * @param model - one catalog row.
 * @returns the stored object, or undefined when the row declares nothing.
 */
function levelsOf(model) {
	const value = model === null || typeof model !== "object" ? void 0 : model.reasoningEfforts;
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
/**
 * Whether a row already declares at least one level.
 * @param model - one catalog row.
 * @returns true when the row carries a usable level declaration.
 */
function hasLevels(model) {
	const value = levelsOf(model);
	return value !== void 0 && Object.keys(value).length > 0;
}
/**
 * Whether a row opts out of reasoning explicitly.
 * @param model - one catalog row.
 * @returns true for the exact `false` declaration.
 */
function deniesReasoning(model) {
	return (model === null || typeof model !== "object" ? void 0 : model.reasoningEfforts) === false;
}
//#endregion
