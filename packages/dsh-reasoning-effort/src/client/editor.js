//#region editor
/** The official keyed seat this plugin fills: one area inside each provider card. */
const PROVIDER_CARD_SLOT = "settings.models.provider-card";
/** The settings namespace whose cards we take over. pi-ai is the adapter that reads `reasoningEfforts`. */
const PI_AI_SETTINGS_NS = "llm-pi-ai";
const h = react.createElement;
const M = 1048576;
const K = 1024;
/** Inline styles built from the published `--dsw-*` alias tokens. */
const S = {
	wrap: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		marginTop: 8
	},
	/** Collapsed posture: the card is shut, so this seat contributes nothing. */
	closed: {
		display: "none"
	},
	head: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		flexWrap: "wrap"
	},
	title: {
		fontSize: 13,
		fontWeight: 600,
		color: "var(--dsw-alias-label-primary)"
	},
	meta: {
		fontSize: 11,
		color: "var(--dsw-alias-label-secondary)"
	},
	button: {
		fontSize: 12,
		padding: "4px 10px",
		borderRadius: 8,
		border: "1px solid var(--dsw-alias-border-l1)",
		background: "transparent",
		color: "var(--dsw-alias-label-primary)",
		cursor: "pointer"
	},
	danger: {
		fontSize: 12,
		padding: "4px 10px",
		borderRadius: 8,
		border: "none",
		background: "transparent",
		color: "var(--dsw-alias-state-error-primary)",
		cursor: "pointer"
	},
	panel: {
		padding: 12,
		border: "1px solid var(--dsw-alias-border-l1)",
		borderRadius: 12,
		background: "var(--dsw-alias-bg-layer-1)"
	},
	row: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		padding: "10px 12px",
		border: "1px solid var(--dsw-alias-border-l1)",
		borderRadius: 10,
		background: "var(--dsw-alias-bg-layer-1)",
		marginBottom: 8
	},
	rowTop: {
		display: "grid",
		gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto auto",
		gap: 8,
		alignItems: "center"
	},
	rowMid: {
		display: "grid",
		gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto auto",
		gap: 16,
		alignItems: "end"
	},
	cell: {
		display: "flex",
		flexDirection: "column",
		gap: 4,
		minWidth: 0
	},
	label: {
		fontSize: 11,
		color: "var(--dsw-alias-label-secondary)"
	},
	input: {
		width: "100%",
		boxSizing: "border-box",
		fontSize: 12,
		padding: "5px 8px",
		borderRadius: 8,
		border: "1px solid var(--dsw-alias-border-l2)",
		background: "var(--dsw-alias-bg-base)",
		color: "var(--dsw-alias-label-primary)"
	},
	switchRow: {
		display: "flex",
		alignItems: "center",
		gap: 8
	},
	switchLabel: {
		fontSize: 12,
		color: "var(--dsw-alias-label-primary)",
		whiteSpace: "nowrap"
	},
	levels: {
		display: "flex",
		flexWrap: "wrap",
		gap: 12,
		paddingTop: 2
	},
	level: {
		display: "flex",
		alignItems: "center",
		gap: 5,
		fontSize: 12,
		color: "var(--dsw-alias-label-primary)"
	},
	notice: {
		fontSize: 11
	}
};
/**
 * Read one path out of a plain JSON value.
 * @param root - the value to descend.
 * @param path - path segments.
 * @returns the addressed value, or undefined when the path does not resolve.
 */
function readPath(root, path) {
	let node = root;
	for (const key of path) {
		if (node === null || typeof node !== "object") return void 0;
		node = node[key];
	}
	return node;
}
/**
 * Parse the capacity text the capacity fields accept: a plain count, or one
 * suffixed with K / M.
 * @param text - the raw field text.
 * @returns the count, undefined for an empty field, or null when invalid.
 */
function parseCapacity(text) {
	const raw = String(text).trim();
	if (raw === "") return void 0;
	const match = /^(\d+(?:\.\d+)?)\s*([kKmM]?)$/.exec(raw);
	if (match === null) return null;
	const scale = match[2] === "" ? 1 : match[2].toLowerCase() === "k" ? K : M;
	const value = Number(match[1]) * scale;
	return Number.isInteger(value) && value > 0 ? value : null;
}
/**
 * Render a capacity the way the field shows it.
 * @param value - the stored count.
 * @returns the display text.
 */
function formatCapacity(value) {
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return "";
	if (value % M === 0) return `${String(value / M)}M`;
	if (value % K === 0) return `${String(value / K)}K`;
	return String(value);
}
/** One row's plain string field, or an empty string. */
function textOf(model, key) {
	const value = model === null || typeof model !== "object" ? void 0 : model[key];
	return typeof value === "string" ? value : "";
}
/** One row's declared input types, or undefined while it inherits them. */
function inputsOf(model) {
	const value = model === null || typeof model !== "object" ? void 0 : model.input;
	return Array.isArray(value) ? value : void 0;
}
/** A switch modelled on the settings page's own toggles. */
function Switch(props) {
	return h("button", {
		type: "button",
		role: "switch",
		"aria-checked": props.checked === true,
		"aria-label": props.label,
		title: props.label,
		disabled: props.disabled === true,
		onClick: props.onChange,
		style: {
			width: 44,
			height: 24,
			flex: "0 0 auto",
			borderRadius: 12,
			border: "none",
			padding: 2,
			display: "flex",
			alignItems: "center",
			justifyContent: props.checked === true ? "flex-end" : "flex-start",
			background: props.checked === true ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-state-idle-primary)",
			cursor: props.disabled === true ? "default" : "pointer",
			opacity: props.disabled === true ? 0.5 : 1
		}
	}, h("span", {
		style: {
			width: 20,
			height: 20,
			borderRadius: "50%",
			background: "#fff",
			display: "block"
		}
	}));
}
/**
 * One provider card's model-catalog editor.
 *
 * The seat hands us the card's directory row, so `settingsNs` and
 * `settingsPath` are the settings address to read and write. Every edit is a
 * path-addressed single-field op, so unrelated fields survive untouched. Once
 * the catalog is readable, the effect below hides the official editor that the
 * page renders *after* this seat inside the same card, which is what makes this
 * block the card's editor rather than a second one beside it.
 * @param props - the seat's owner props plus the bound remote and translator.
 * @returns the editor area.
 */
function EffortEditor(props) {
	const provider = props.provider !== null && typeof props.provider === "object" ? props.provider : {};
	const settings = props.settings;
	const t = props.t;
	const ns = typeof provider.settingsNs === "string" ? provider.settingsNs : "";
	const base = Array.isArray(provider.settingsPath) ? provider.settingsPath.map(String) : [];
	const baseKey = base.join("/");
	const alive = react.useRef(true);
	const rootRef = react.useRef(null);
	/**
	 * Whether the page's own editor is currently mounted after this seat, i.e.
	 * whether the user has the card open. Defaults to true so a seat that cannot
	 * find its card (no DOM, unexpected markup) still renders instead of vanishing.
	 */
	const [hostOpen, setHostOpen] = react.useState(true);
	const [state, setState] = react.useState({
		status: "loading",
		models: [],
		revision: void 0,
		writable: true,
		error: void 0,
		message: void 0,
		busy: false,
		bulkOpen: false,
		picked: [],
		drafts: {},
		newId: ""
	});
	const patch = (next) => setState((current) => ({
		...current,
		...next
	}));
	react.useEffect(() => () => {
		alive.current = false;
	}, []);
	/** Read the provider's current catalog and revision from the settings remote. */
	const load = react.useCallback(async () => {
		if (settings === void 0) {
			setState((current) => ({
				...current,
				status: "error",
				error: t("card.noRemote")
			}));
			return;
		}
		try {
			const response = await settings.describe();
			if (!alive.current) return;
			if (!response.ok) {
				setState((current) => ({
					...current,
					status: "error",
					error: t("card.readError", { message: response.error.message })
				}));
				return;
			}
			// The settings remote answers `{ writable, namespaces: [...] }`; a bare
			// namespace array is the older shape, so both are accepted.
			const payload = response.value;
			const views = Array.isArray(payload) ? payload : payload?.namespaces;
			if (!Array.isArray(views)) {
				setState((current) => ({
					...current,
					status: "error",
					error: t("card.readError", { message: "unexpected describe payload" })
				}));
				return;
			}
			const descriptor = views.find((candidate) => String(candidate.ns) === ns);
			if (descriptor === void 0) {
				setState((current) => ({
					...current,
					status: "error",
					error: t("card.noNamespace", { ns })
				}));
				return;
			}
			const list = readPath(descriptor.value, [...base, "models"]);
			setState((current) => ({
				...current,
				status: "ready",
				models: Array.isArray(list) ? list : [],
				revision: descriptor.revision,
				writable: Array.isArray(payload) ? true : payload.writable !== false,
				error: void 0,
				message: void 0,
				picked: [],
				drafts: {}
			}));
		} catch (cause) {
			if (!alive.current) return;
			setState((current) => ({
				...current,
				status: "error",
				error: t("card.readError", { message: cause instanceof Error ? cause.message : String(cause) })
			}));
		}
	}, [
		ns,
		baseKey,
		settings,
		t
	]);
	react.useEffect(() => {
		load();
	}, [load]);
	/**
	 * Send one batch of path ops, then reread so the revision and the shown
	 * values match what the Host actually stored.
	 * @param ops - ordered settings path operations.
	 * @param done - optional message key shown after a successful write.
	 * @param clearDraft - optional draft key removed once the write settles.
	 */
	const send = async (ops, done, clearDraft) => {
		if (settings === void 0 || ops.length === 0) return;
		patch({ busy: true });
		try {
			const response = await settings.mutate(ns, ops, state.revision);
			if (!alive.current) return;
			if (clearDraft !== void 0) setState((current) => {
				const drafts = {
					...current.drafts
				};
				delete drafts[clearDraft];
				return {
					...current,
					drafts
				};
			});
			if (!response.ok) {
				const conflict = response.error.code === "settings/conflict";
				patch({
					error: conflict ? t("card.conflict") : t("card.writeError", { message: response.error.message }),
					message: void 0,
					busy: false
				});
				if (conflict) await load();
				return;
			}
			await load();
			if (!alive.current) return;
			patch({
				message: done === void 0 ? t("card.saved") : done,
				busy: false
			});
		} catch (cause) {
			if (!alive.current) return;
			patch({
				error: t("card.writeError", { message: cause instanceof Error ? cause.message : String(cause) }),
				busy: false
			});
		}
	};
	/** The op addressing one field of one model row. */
	const opFor = (index, field, value) => {
		const path = [
			...base,
			"models",
			String(index),
			field
		];
		return value === void 0 ? {
			op: "unset",
			path
		} : {
			op: "set",
			path,
			value
		};
	};
	/** Replace the whole catalog (add / delete), preserving every other field. */
	const setCatalog = (rows) => send([{
		op: "set",
		path: [
			...base,
			"models"
		],
		value: rows
	}]);
	const draftKey = (index, field) => `${String(index)}:${field}`;
	const draftOf = (index, field, fallback) => {
		const key = draftKey(index, field);
		return key in state.drafts ? state.drafts[key] : fallback;
	};
	const setDraft = (index, field, text) => setState((current) => ({
		...current,
		drafts: {
			...current.drafts,
			[draftKey(index, field)]: text
		}
	}));
	/** Commit a plain text field; an empty value clears it. */
	const commitText = (index, field, text, required) => {
		const trimmed = String(text).trim();
		const key = draftKey(index, field);
		if (required === true && trimmed === "") {
			setState((current) => {
				const drafts = {
					...current.drafts
				};
				delete drafts[key];
				return {
					...current,
					drafts
				};
			});
			return;
		}
		send([opFor(index, field, trimmed === "" ? void 0 : trimmed)], void 0, key);
	};
	/** Commit a capacity field; invalid text is refused without writing. */
	const commitCapacity = (index, field, text) => {
		const parsed = parseCapacity(text);
		const key = draftKey(index, field);
		if (parsed === null) {
			patch({ error: t("card.invalidCapacity") });
			return;
		}
		send([
			parsed === void 0 ? {
				op: "unset",
				path: [
					...base,
					"models",
					String(index),
					field
				]
			} : opFor(index, field, parsed)
		], void 0, key);
	};
	/** Flip this row's image-input declaration. */
	const toggleImage = (index, model) => {
		const list = inputsOf(model);
		const has = list !== void 0 && list.includes("image");
		send([opFor(index, "input", has ? ["text"] : [
			"text",
			"image"
		])]);
	};
	/** Flip this row's thinking declaration. Off restores adapter inheritance. */
	const toggleThinking = (index, model) => {
		send([opFor(index, "reasoningEfforts", hasLevels(model) ? void 0 : effortsOf(DEFAULT_LEVELS))]);
	};
	/** Add or remove one level, preserving every other declared level. */
	const toggleLevel = (index, model, level) => {
		const next = typeof levelsOf(model) === "object" ? {
			...levelsOf(model)
		} : {};
		if (level in next) delete next[level];
		else next[level] = wireOf(level);
		send([opFor(index, "reasoningEfforts", Object.keys(next).length === 0 ? void 0 : next)]);
	};
	const rows = state.models;
	const bulkEligible = rows.map((model, index) => hasLevels(model) ? -1 : index).filter((index) => index >= 0);
	/** Enable the default level set on every picked row in one write. */
	const applyBulk = () => {
		const ops = state.picked.filter((index) => bulkEligible.includes(index)).map((index) => opFor(index, "reasoningEfforts", effortsOf(DEFAULT_LEVELS)));
		send(ops, t("card.bulkDone", { count: ops.length })).then(() => patch({
			bulkOpen: false,
			picked: []
		}));
	};
	// Take the card over: the page mounts its own editor AFTER this seat exactly
	// while the card is open, so that sibling is both the open/closed signal and
	// the thing to hide. Watching the card keeps the two in step as the user
	// presses Edit.
	const takeover = state.status === "ready" && rows.length > 0;
	react.useEffect(() => {
		const node = rootRef.current;
		if (node === null || typeof node.closest !== "function") return void 0;
		const card = node.closest("li") ?? node.parentElement;
		if (card === null) return void 0;
		const hidden = new Map();
		const sync = () => {
			let open = false;
			for (const child of Array.from(card.children)) {
				if (child === node || child.contains(node)) continue;
				// Only siblings rendered AFTER this seat belong to the page's editor.
				if ((node.compareDocumentPosition(child) & 4) === 0) continue;
				open = true;
				if (takeover !== true) continue;
				if (!hidden.has(child)) hidden.set(child, child.style.display);
				child.style.display = "none";
			}
			setHostOpen(open);
		};
		sync();
		const observer = typeof MutationObserver === "function" ? new MutationObserver(sync) : void 0;
		observer?.observe(card, { childList: true });
		return () => {
			observer?.disconnect();
			for (const [child, display] of hidden) child.style.display = display;
		};
	}, [takeover]);
	const disabled = state.busy || !state.writable || rows.length === 0;
	const notices = [];
	if (state.message !== void 0) notices.push(h("p", {
		key: "ok",
		role: "status",
		style: {
			...S.notice,
			color: "var(--dsw-alias-state-success-primary)"
		}
	}, state.message));
	if (state.error !== void 0) notices.push(h("p", {
		key: "err",
		style: {
			...S.notice,
			color: "var(--dsw-alias-state-error-primary)"
		}
	}, state.error));
	const header = h("div", { style: S.head }, [
		h("span", { key: "t", style: S.title }, t("card.title")),
		h("span", { key: "m", style: S.meta }, rows.length === 0 ? t("card.inherited") : t("card.customized")),
		h("button", {
			key: "bulk",
			type: "button",
			style: S.button,
			disabled,
			onClick: () => patch({
				bulkOpen: !state.bulkOpen,
				picked: [],
				message: void 0
			})
		}, t("card.bulk"))
	]);
	const bulkPanel = state.bulkOpen !== true ? null : h("div", { style: S.panel }, [
		h("p", {
			key: "hint",
			style: S.meta
		}, t("card.bulkHint")),
		h("div", {
			key: "acts",
			style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap",
				margin: "8px 0"
			}
		}, [
			h("button", {
				key: "all",
				type: "button",
				style: S.button,
				disabled: disabled || bulkEligible.length === 0,
				onClick: () => patch({ picked: [...bulkEligible] })
			}, t("card.bulkSelectAll")),
			h("button", {
				key: "none",
				type: "button",
				style: S.button,
				disabled: disabled || state.picked.length === 0,
				onClick: () => patch({ picked: [] })
			}, t("card.bulkClear"))
		]),
		bulkEligible.length === 0 ? h("p", {
			key: "empty",
			style: S.meta
		}, t("card.bulkNone")) : h("div", {
			key: "list",
			style: {
				maxHeight: 240,
				overflowY: "auto"
			}
		}, bulkEligible.map((index) => {
			const model = rows[index] ?? {};
			return h("label", {
				key: String(index),
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: 4,
					fontSize: 12,
					color: "var(--dsw-alias-label-primary)"
				}
			}, [
				h("input", {
					key: "c",
					type: "checkbox",
					disabled,
					checked: state.picked.includes(index),
					onChange: (event) => patch({
						picked: event.target.checked ? [...state.picked, index] : state.picked.filter((at) => at !== index)
					})
				}),
				textOf(model, "name") !== "" ? textOf(model, "name") : textOf(model, "id")
			]);
		})),
		h("div", {
			key: "go",
			style: {
				display: "flex",
				gap: 8,
				marginTop: 8
			}
		}, [
			h("button", {
				key: "apply",
				type: "button",
				style: S.button,
				disabled: disabled || state.picked.length === 0,
				onClick: applyBulk
			}, t("card.bulkApply", { count: state.picked.length })),
			h("button", {
				key: "cancel",
				type: "button",
				style: S.button,
				onClick: () => patch({
					bulkOpen: false,
					picked: []
				})
			}, t("card.bulkCancel"))
		])
	]);
	let body;
	if (state.status === "loading") body = h("p", { style: S.meta }, t("card.loading"));
	else if (rows.length === 0) body = h("p", { style: S.meta }, t("card.empty"));
	else body = h("div", null, rows.map((model, index) => {
		const row = model !== null && typeof model === "object" ? model : {};
		const levels = levelsOf(row);
		const on = hasLevels(row);
		const list = inputsOf(row);
		return h("div", {
			key: String(index),
			style: S.row
		}, [
			h("div", {
				key: "top",
				style: S.rowTop
			}, [
				h("input", {
					key: "id",
					style: S.input,
					type: "text",
					"aria-label": t("card.modelId"),
					placeholder: t("card.modelId"),
					disabled,
					value: draftOf(index, "id", textOf(row, "id")),
					onChange: (event) => setDraft(index, "id", event.target.value),
					onBlur: (event) => commitText(index, "id", event.target.value, true)
				}),
				h("input", {
					key: "name",
					style: S.input,
					type: "text",
					"aria-label": t("card.modelName"),
					placeholder: t("card.modelNamePlaceholder"),
					disabled,
					value: draftOf(index, "name", textOf(row, "name")),
					onChange: (event) => setDraft(index, "name", event.target.value),
					onBlur: (event) => commitText(index, "name", event.target.value, false)
				}),
				h("button", {
					key: "rm",
					type: "button",
					style: S.danger,
					disabled,
					"aria-label": t("card.removeModel"),
					title: t("card.removeModel"),
					onClick: () => setCatalog(rows.filter((_row, at) => at !== index))
				}, "✕")
			]),
			h("div", {
				key: "mid",
				style: S.rowMid
			}, [
				h("label", {
					key: "cw",
					style: S.cell
				}, [
					h("span", {
						key: "l",
						style: S.label
					}, t("card.contextWindow")),
					h("input", {
						key: "i",
						style: S.input,
						type: "text",
						inputMode: "numeric",
						"aria-label": t("card.contextWindow"),
						placeholder: t("card.capacityPlaceholder"),
						disabled,
						value: draftOf(index, "contextWindow", formatCapacity(row.contextWindow)),
						onChange: (event) => setDraft(index, "contextWindow", event.target.value),
						onBlur: (event) => commitCapacity(index, "contextWindow", event.target.value)
					})
				]),
				h("label", {
					key: "mt",
					style: S.cell
				}, [
					h("span", {
						key: "l",
						style: S.label
					}, t("card.maxTokens")),
					h("input", {
						key: "i",
						style: S.input,
						type: "text",
						inputMode: "numeric",
						"aria-label": t("card.maxTokens"),
						placeholder: t("card.capacityPlaceholder"),
						disabled,
						value: draftOf(index, "maxTokens", formatCapacity(row.maxTokens)),
						onChange: (event) => setDraft(index, "maxTokens", event.target.value),
						onBlur: (event) => commitCapacity(index, "maxTokens", event.target.value)
					})
				]),
				h("div", {
					key: "img",
					style: S.switchRow
				}, [
					h("span", {
						key: "l",
						style: S.switchLabel
					}, t("card.imageInput")),
					h(Switch, {
						key: "s",
						checked: list !== void 0 && list.includes("image"),
						disabled,
						label: t("card.imageInput"),
						onChange: () => toggleImage(index, row)
					})
				]),
				h("div", {
					key: "think",
					style: S.switchRow
				}, [
					h("span", {
						key: "l",
						style: S.switchLabel
					}, t("card.thinkingMode")),
					h(Switch, {
						key: "s",
						checked: on,
						disabled,
						label: t("card.thinkingMode"),
						onChange: () => toggleThinking(index, row)
					})
				])
			]),
			on ? h("div", {
				key: "levels",
				style: S.levels,
				role: "group",
				"aria-label": t("card.thinkingLevels")
			}, LEVEL_ORDER.map((level) => h("label", {
				key: level,
				style: S.level
			}, [
				h("input", {
					key: "c",
					type: "checkbox",
					disabled,
					checked: levels !== void 0 && level in levels,
					onChange: () => toggleLevel(index, row, level)
				}),
				t(`level.${level}`)
			]))) : null
		]);
	}));
	const addRow = h("div", {
		style: {
			display: "flex",
			gap: 8,
			alignItems: "center"
		}
	}, [
		h("input", {
			key: "i",
			style: S.input,
			type: "text",
			placeholder: t("card.addModelId"),
			"aria-label": t("card.addModelId"),
			disabled,
			value: state.newId,
			onChange: (event) => patch({ newId: event.target.value })
		}),
		h("button", {
			key: "b",
			type: "button",
			style: S.button,
			disabled: disabled || state.newId.trim() === "",
			onClick: () => {
				const id = state.newId.trim();
				patch({ newId: "" });
				setCatalog([
					...rows.map((row) => row !== null && typeof row === "object" ? {
						...row
					} : {}),
					{ id }
				]);
			}
		}, t("card.addModel"))
	]);
	// The card is shut: contribute nothing, and let the page's own collapsed card
	// look exactly as it always does.
	const open = rows.length > 0 && hostOpen === true;
	return h("div", {
		ref: rootRef,
		style: open ? S.wrap : S.closed
	}, open ? [
		header,
		...notices,
		bulkPanel,
		body,
		addRow
	] : null);
}
//#endregion
