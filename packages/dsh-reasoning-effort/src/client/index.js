//#region plugin
/**
 * Client services this plugin needs. `remote.settings` is the generated
 * `ctx.remote.settings` sub-service installed by
 * `@deepseek-ai/dsh-api-settings-controller`; `locale` owns our dictionaries.
 */
const inject = [
	"slots",
	"remote",
	"remote.settings",
	"locale"
];
/**
 * Client plugin body: register the dictionaries, then fill the provider-card
 * seat. The seat belongs to the settings-models page, so `slots.inject` waits
 * for that page's declaration instead of assuming load order.
 * @param ctx - client root context.
 */
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "dsh-reasoning-effort: dictionaries");
	const t = ctx.locale.bind(NS);
	ctx.inject(["slots", "remote.settings"], (scope) => {
		// `remote.session` (the adapter's model catalog) and `remote.llm`
		// (endpoint discovery) are mounted by the same api-remotes entry as
		// `remote.settings`, but they are read defensively: the editor degrades to
		// the settings document alone when either is missing.
		const read = (name) => {
			try {
				return scope.remote[name];
			} catch {
				return void 0;
			}
		};
		const Cell = (props) => h(EffortEditor, {
			...props,
			settings: scope.remote.settings,
			session: read("session"),
			llm: read("llm"),
			t
		});
		scope.slots.inject(PROVIDER_CARD_SLOT, () => scope.slots.register({
			name: PROVIDER_CARD_SLOT,
			key: PI_AI_SETTINGS_NS
		}, Cell));
	});
}
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.NS = NS;
exports.EffortEditor = EffortEditor;
exports.PROVIDER_CARD_SLOT = PROVIDER_CARD_SLOT;
exports.PI_AI_SETTINGS_NS = PI_AI_SETTINGS_NS;
// Exported for the offline self-test only; not part of the public surface.
exports.buildPresets = buildPresets;
exports.presetFor = presetFor;
exports.levelsFromCatalog = levelsFromCatalog;
exports.parseCapacity = parseCapacity;
exports.formatCapacity = formatCapacity;
