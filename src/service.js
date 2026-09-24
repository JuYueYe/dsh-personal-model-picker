//#region lib/types/client/service.js
/**
* ModelDirectoryResolver (`ctx.modelDirectories`): the root owner of per-session
* {@link ModelDirectory} instances. Both selection entries (the /model popup
* and the composer model seat) resolve their session's directory through
* this service, which is what makes the dual entry one shared state.
*
* Per-session storage follows the client service pattern (InputTriggerService /
* CommandUiRuntime): a lazy service-internal map whose entry is deleted by the
* owning scope's disposer. The host `dsh-scope` ScopedLayers registry does
* does not belong here: it derives scope from the host carrier mechanism
* (object-keyed), while client scopes tag contexts with branded SessionId
* strings, and it models global+shadow named registries — this is a
* per-session singleton with no global layer to merge.
*/
/** The `ctx.modelDirectories` session model-selection service. */
var ModelDirectoryResolver = class extends _deepseek_ai_cordis.Service {
	static inject = [
		"sessions",
		"remote",
		"remote.session"
	];
	live = { directories: /* @__PURE__ */ new Map() };
	catalog;
	/** Localized composer-block copy; this plugin owns the string it raises. */
	blockReason;
	/**
	* @param ctx - owning root context (the service registers itself as `models`).
	* @param config - the bound translator for this plugin's own dictionary.
	*/
	constructor(ctx, config) {
		super(ctx, "modelDirectories");
		this.blockReason = config.blockReason;
		this.catalog = new ModelCatalogDirectory(ctx);
		this.catalog.load().catch(() => {});
		ctx.on("connection/reset", () => {
			this.catalog.resetGeneration();
			for (const directory of this.live.directories.values()) directory.resetConnected();
		});
		ctx.remote.$on("llm/adapters-updated", () => {
			this.catalog.refresh();
		});
		ctx.remote.$on("settings/document-updated", () => {
			this.catalog.refresh();
		});
		ctx.remote.$on("credentials/reference-updated", () => {
			this.catalog.refresh();
		});
	}
	/**
	* Resolve the per-session shared directory (lazy; the scope disposer
	* removes and disposes it). Unknown sessions fail loud.
	* @param sessionId - the owning session.
	* @returns the resident directory both entries share.
	*/
	directoryFor(sessionId) {
		const { live } = this;
		const existing = live.directories.get(sessionId);
		if (existing !== void 0) return existing;
		const sessions = this.ctx.sessions;
		const actx = sessions.scope(sessionId);
		if (actx === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no scope`);
		const binding = sessions.binding(sessionId);
		if (binding === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no binding`);
		const directory = new ModelDirectory(this.ctx.remote.session, sessionId, () => sessions.subagentAddress(sessionId) === void 0, this.catalog, binding.session.projections.faceOf("modelSelection"));
		live.directories.set(sessionId, directory);
		const conversation = this.ctx.get("conversation");
		if (conversation !== void 0) {
			const publish = () => {
				conversation.blocks.set(sessionId, directory.store.getSnapshot().routable === false ? { reason: this.blockReason() } : void 0);
			};
			publish();
			actx.effect(() => {
				const stop = directory.store.subscribe(publish);
				return () => {
					stop();
					conversation.blocks.set(sessionId, void 0);
				};
			}, "ui-model-selection: composer block");
		}
		actx.effect(() => () => {
			directory.dispose();
			live.directories.delete(sessionId);
		}, "ui-model-selection: session directory");
		return directory;
	}
};
//#endregion
