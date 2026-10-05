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
		const settings = scope.remote.settings;
		const Cell = (props) => h(EffortEditor, {
			...props,
			settings,
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
