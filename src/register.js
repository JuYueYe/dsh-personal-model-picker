//#region lib/types/client/index.js
/** One selectable row's id: an opaque row key (resolved by lookup, never parsed). */
function rowId(providerId, modelId) {
	return `${providerId}/${modelId}`;
}
const BUILTIN_DESCRIPTION_KEYS = {
	"deepseek-official/deepseek-v4-flash": "option.deepseekV4Flash.description",
	"deepseek-official/deepseek-v4-pro": "option.deepseekV4Pro.description"
};
function descriptionOf(providerId, model, t) {
	const key = BUILTIN_DESCRIPTION_KEYS[rowId(providerId, model.id)];
	return key !== void 0 && model.description === en[key] ? t(key) : model.description;
}
/** Flatten the directory into popup rows; failure rows are listed for visibility but never selectable. */
function optionsOf(directory, t) {
	const rows = [];
	for (const group of directory.groups) for (const model of group.models) {
		const description = descriptionOf(group.id, model, t);
		rows.push({
			id: rowId(group.id, model.id),
			label: model.name,
			detail: description !== void 0 ? `${group.name} · ${description}` : group.name,
			...directory.current !== null && directory.current.provider === group.id && directory.current.model === model.id ? { active: true } : {}
		});
	}
	for (const failure of directory.failures) rows.push({
		id: `failure/${failure.id}`,
		label: failure.name,
		detail: t("option.loadError", { message: failure.message })
	});
	return rows;
}
/**
* Resolve a picked row back to its model selection by matching against the loaded
* groups (the same data the rows were built from — ids stay opaque).
* @param state - the session's directory snapshot.
* @param id - the picked row id.
* @returns the row's model selection, or undefined for failure rows / stale ids.
*/
function selectionOf(state, id) {
	for (const group of state.groups) for (const model of group.models) {
		if (rowId(group.id, model.id) !== id) continue;
		const reasoningEffort = state.current?.provider === group.id && state.current.model === model.id ? state.current?.reasoningEffort ?? model.reasoning?.defaultEffort : model.reasoning?.defaultEffort;
		return {
			provider: group.id,
			model: model.id,
			...reasoningEffort === void 0 ? {} : { reasoningEffort }
		};
	}
}
/** Dictionary namespace owned by this plugin. */
const NS = "model";
/** Required services: the contribution registry, the seat's slot registry, locale, and the service's own faces. */
const inject = [
	"commandUi",
	"locale",
	"sessions",
	"slots",
	"remote",
	"remote.session"
];
/**
* Client plugin body: mount ModelDirectoryResolver, register the `model` dictionaries,
* then register the /model popup contribution and the composer model seat
* over the service.
* @param ctx - client root context.
*/
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh,
		en
	}), "ui-model-selection: dictionaries");
	const t = ctx.locale.bind(NS);
	ctx.plugin(ModelDirectoryResolver, { blockReason: () => t("blocked.composer") });
	ctx.inject(["commandUi", "modelDirectories"], (scope) => {
		const command = scope.get("commandUi");
		const models = scope.modelDirectories;
		const sessions = scope.sessions;
		scope.effect(() => command.register({
			name: "model",
			description: () => t("command.description"),
			available: (session) => sessions.subagentAddress(session.sessionId) === void 0,
			ui: {
				kind: "popupSelect",
				options: async (session) => {
					if (sessions.subagentAddress(session.sessionId) !== void 0) throw new Error("model selection is unavailable for addressed subagent sessions");
					return optionsOf(await models.directoryFor(session.sessionId).load(), t);
				},
				onSelect: async (option, session) => {
					if (sessions.subagentAddress(session.sessionId) !== void 0) throw new Error("model selection is unavailable for addressed subagent sessions");
					const directory = models.directoryFor(session.sessionId);
					const selection = selectionOf(directory.store.getSnapshot(), option.id);
					if (selection === void 0) throw new Error("this provider's catalog failed to load — pick a model from a loaded group");
					await directory.select(selection);
				}
			}
		}), "ui-model-selection: /model contribution");
	});
	ctx.inject(["slots", "modelDirectories"], (scope) => {
		const models = scope.modelDirectories;
		const sessions = scope.sessions;
		scope.slots.inject("conversation.input.model", () => scope.slots.register({
			name: "conversation.input.model",
			locale: NS,
			inject: (sessionId) => {
				const directory = models.directoryFor(sessionId);
				const available = sessions.subagentAddress(sessionId) === void 0;
				return {
					available,
					directory: directory.store,
					load: () => {
						if (available) directory.load().catch(() => {});
					},
					select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false)
				};
			}
		}, ModelSelect));
	});
}
//#endregion
exports.ModelDirectory = ModelDirectory;
exports.ModelDirectoryResolver = ModelDirectoryResolver;
exports.apply = apply;
exports.inject = inject;