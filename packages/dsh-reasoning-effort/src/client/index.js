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
 *
 * The two optional faces (`remote.llm`, `remote.session`) are filled by their
 * own `ctx.inject` waits and handed to the editor through getters. They must be
 * *declared* before they are read: Cordis refuses an undeclared service access,
 * so poking `scope.remote.llm` from the seat's own scope would silently yield
 * nothing — which is exactly how the first fetch-models build failed.
 * @param ctx - client root context.
 */
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "dsh-reasoning-effort: dictionaries");
	const t = ctx.locale.bind(NS);
	/** Live optional faces; the editor reads them at click time. */
	const faces = {};
	const readThrough = (scope, name) => () => {
		try {
			return scope.remote[name];
		} catch {
			return void 0;
		}
	};
	ctx.inject(["remote.llm"], (scope) => {
		faces.llm = readThrough(scope, "llm");
	});
	ctx.inject(["remote.session"], (scope) => {
		faces.session = readThrough(scope, "session");
	});
	ctx.inject(["slots", "remote.settings"], (scope) => {
		const Cell = (props) => h(EffortEditor, {
			...props,
			settings: scope.remote.settings,
			getLlm: () => faces.llm?.(),
			getSession: () => faces.session?.(),
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
