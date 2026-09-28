//#region lib/types/client/ModelSelect.js
/**
* ModelSelect: the composer's named model seat (`conversation.input.model`).
* Two-level selection per figma 496:26454's MenuDropdown: the root menu is
* the Model / Effort row pair (label + current value + a right chevron),
* each drilling into its own list — the provider-grouped model list over
* the shared directory, and the effort levels. The trigger (313:14108's
* ToggleButton) shows both: model name + effort in the caption tone.
* Data and submission ride the SAME per-session ModelDirectory as the
* /model popup; exact-model reasoning metadata and the selected effort come
* from the Host rather than a client-owned vocabulary. A rejected selection
* announces through the shared transient Toast anchored to the composer
* card; the in-menu strip with Retry remains the catalog-load surface.
*/
/** Unplaced portal card: hidden but laid out at a fixed origin so offsetWidth/offsetHeight are real (Menu primitive's measure pass). */
const MEASURE_STYLE = {
	visibility: "hidden",
	left: 0,
	top: 0
};

/**
* Fixed card height for the provider/model pane. place() anchors the card by its
* BOTTOM edge (top = trigger.top - 8 - measured height), so any height change
* while hovering also moves the card's top edge - and with it the provider rows
* under a stationary pointer, which flips the hover to another provider and
* starts a resize loop. A constant height (28px column header + 320px model
* column + the card's own padding) removes the loop: hovering a provider only
* swaps the right column's contents, which scroll.
*/
const MODEL_PANE_HEIGHT = 348;
/**
* Render the composer model seat.
* @param props - owner share (locked) + injected face (shared directory
* store/verbs) + the standard locale seat.
* @returns the trigger and, while open, the two-level menu.
*/
function ModelSelect({ locked, available, directory, load, select, t }) {
	const effortDisplayName = (value) => ({ off: "关闭", minimal: "最低", low: "低", medium: "中", high: "高", xhigh: "超高", max: "最高" })[String(value).toLowerCase()] ?? value;
	const state = (0, react.useSyncExternalStore)((fn) => directory.subscribe(fn), () => directory.getSnapshot());
	const [open, setOpen] = (0, react.useState)(false);
	const [pane, setPane] = (0, react.useState)("root");
	const lastActionRef = (0, react.useRef)("load");
	const [toast, setToast] = (0, react.useState)(null);
	const toastSeq = (0, react.useRef)(0);
	const rootRef = (0, react.useRef)(null);
	const triggerRef = (0, react.useRef)(null);
	const menuRef = (0, react.useRef)(null);
	const [menuPos, setMenuPos] = (0, react.useState)(null);
	const effortTriggerRef = (0, react.useRef)(null);
	const itemRefs = (0, react.useRef)([]);
	const id = (0, react.useId)();
	const choices = (0, react.useMemo)(() => state.groups.flatMap((group) => group.models.map((model) => ({
		group,
		model,
		selection: {
			provider: group.id,
			model: model.id,
			...model.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: model.reasoning.defaultEffort }
		}
	}))), [state.groups]);
	const currentChoice = choices[state.current === null ? -1 : choices.findIndex((c) => c.selection.provider === state.current?.provider && c.selection.model === state.current.model)];
	const reasoning = currentChoice?.model.reasoning;
	const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
	const effortLabel = reasoning === void 0 ? void 0 : effectiveEffort === void 0 ? t("effort.providerDefault") : effortDisplayName(reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort);
	const effortChoices = (0, react.useMemo)(() => reasoning === void 0 ? [] : [...reasoning.defaultEffort === void 0 ? [{
		key: "provider-default",
		effort: void 0,
		label: t("effort.providerDefault")
	}] : [], ...reasoning.efforts.map((effort) => ({
		key: `effort:${effort.id}`,
		effort: effort.id,
		label: effortDisplayName(effort.name)
	}))], [reasoning, t]);
	const busy = state.status === "selecting";
	const reload = () => {
		lastActionRef.current = "load";
		load();
	};
	(0, react.useEffect)(() => {
		if (!open) return;
		const closeOutside = (event) => {
			if (rootRef.current?.contains(event.target) === true) return;
			if (menuRef.current?.contains(event.target) === true) return;
			setOpen(false);
		};
		document.addEventListener("mousedown", closeOutside);
		return () => {
			document.removeEventListener("mousedown", closeOutside);
		};
	}, [open]);
	(0, react.useLayoutEffect)(() => {
		if (!open) {
			setMenuPos(null);
			return;
		}
		const place = () => {
			/* v8 ignore next 2 -- the trigger ref is attached whenever the menu is open. */
			const rect = (pane === "effort" ? effortTriggerRef.current : triggerRef.current)?.getBoundingClientRect();
			if (rect === void 0) return;
			const MARGIN = 12;
			const modelPane = pane.startsWith("model");
			const anchor = rootRef.current?.getBoundingClientRect();
			const width = Math.min(anchor?.width ?? 320, window.innerWidth - MARGIN * 2);
			// Measure after applying the constrained width; both columns share this card.
			if (menuRef.current && modelPane) {
				menuRef.current.style.width = `${width}px`;
				menuRef.current.style.minWidth = "0";
				menuRef.current.style.height = `${MODEL_PANE_HEIGHT}px`;
				menuRef.current.style.maxHeight = `${Math.max(80, rect.top - MARGIN - 8)}px`;
			}
			const lw = menuRef.current?.offsetWidth ?? width;
			const lh = menuRef.current?.offsetHeight ?? 196;
			const x = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - lw - MARGIN));
			const y = Math.max(MARGIN, rect.top - 8 - lh);
			setMenuPos({
				left: x, top: y, boxSizing: "border-box", overflow: "hidden",
				width: modelPane ? width : undefined, minWidth: modelPane ? 0 : undefined,
				height: modelPane ? MODEL_PANE_HEIGHT : undefined,
				maxHeight: Math.max(80, rect.top - MARGIN - 8), borderRadius: 12
			});
		};
		place();
		window.addEventListener("scroll", place, true);
		window.addEventListener("resize", place);
		return () => {
			window.removeEventListener("scroll", place, true);
			window.removeEventListener("resize", place);
		};
	}, [
		open,
		pane,
		state
	]);
	if (!available) return null;
	const show = () => {
		setPane("model");
		setOpen(true);
		reload();
	};
	const close = (restoreFocus = false) => {
		setOpen(false);
		setPane("root");
		if (restoreFocus) queueMicrotask(() => {
			triggerRef.current?.focus();
		});
	};
	const moveFocus = (offset) => {
		const items = itemRefs.current.filter((item) => item !== null);
		if (items.length === 0) return;
		const active = items.findIndex((item) => item === document.activeElement);
		items[(Math.max(active, 0) + offset + items.length) % items.length]?.focus();
	};
	const onRootKeyDown = (event) => {
		if (event.key === "Escape" && open) {
			event.preventDefault();
			close(true);
			return;
		}
		if (!open) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			moveFocus(event.key === "ArrowDown" ? 1 : -1);
		}
	};
	const onBlur = (event) => {
		if (event.relatedTarget instanceof Node && (rootRef.current?.contains(event.relatedTarget) === true || menuRef.current?.contains(event.relatedTarget) === true)) return;
		close();
	};
	const settleSelection = (accepted) => {
		if (accepted) {
			if (rootRef.current !== null) close(true);
			return;
		}
		const message = directory.getSnapshot().error;
		if (message !== null) {
			toastSeq.current += 1;
			setToast({
				seq: toastSeq.current,
				text: t("error.action", { message })
			});
		}
	};
	const choose = (selection) => {
		if (state.current?.provider === selection.provider && state.current.model === selection.model) {
			close(true);
			return;
		}
		lastActionRef.current = "select";
		select(selection).then(settleSelection);
	};
	const chooseEffort = (effort) => {
		if (state.current === null) return;
		if (effectiveEffort === effort) {
			close(true);
			return;
		}
		const selection = {
			provider: state.current.provider,
			model: state.current.model,
			...effort === void 0 ? {} : { reasoningEffort: effort }
		};
		lastActionRef.current = "select";
		select(selection).then(settleSelection);
	};
	const waiting = state.current === null && state.status === "loading";
	const modelLabel = waiting ? t("trigger.loading") : currentChoice?.model.name ?? (state.current === null ? t("trigger.fallback") : `${state.current.provider}/${state.current.model}`);
	const triggerLabel = effortLabel === void 0 ? modelLabel : `${modelLabel} · ${effortLabel}`;
	const triggerAria = waiting ? t("trigger.loading") : state.current === null ? t("trigger.selectAria") : effortLabel === void 0 ? t("trigger.aria", { model: modelLabel }) : t("trigger.ariaEffort", {
		model: modelLabel,
		effort: effortLabel
	});
	itemRefs.current = [];
	let itemIndex = 0;
	const activeProviderId = pane.startsWith("model:") ? pane.slice("model:".length) : state.current?.provider ?? state.groups[0]?.id;
	const activeGroup = state.groups.find((group) => group.id === activeProviderId);
	const modelEffortLabel = (model) => {
		const r = model.reasoning;
		if (r === void 0) return t("effort.placeholder");
		if (state.current?.provider === activeGroup?.id && state.current.model === model.id && effortLabel !== void 0) return effortLabel;
		const eff = r.defaultEffort;
		if (eff === void 0) return t("effort.providerDefault");
		return r.efforts.find((level) => level.id === eff)?.name ?? eff;
	};
	const itemRef = () => {
		const at = itemIndex++;
		return (node) => {
			itemRefs.current[at] = node;
		};
	};
	return (0, react_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		className: ModelSelect_module_css_default.root,
		style: { display: "flex", alignItems: "center", gap: 4 },
		onKeyDown: onRootKeyDown,
		onBlur,
		children: [
			(0, react_jsx_runtime.jsxs)("button", {
				ref: triggerRef,
				type: "button",
				className: ModelSelect_module_css_default.trigger,
				"aria-label": triggerAria,
				"aria-haspopup": "menu",
				"aria-expanded": open,
				"aria-controls": open ? `${id}-menu` : void 0,
				title: triggerLabel,
				disabled: locked,
				onClick: () => {
					if (open && pane !== "effort") close();
					else show();
				},
				children: [
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutline16, {
						className: ModelSelect_module_css_default.triggerIcon,
						size: 16
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: ModelSelect_module_css_default.triggerLabel,
						children: modelLabel
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: clsx(ModelSelect_module_css_default.chevron, open && ModelSelect_module_css_default.chevronOpen) })
				]
			}),
			(0, react_jsx_runtime.jsxs)("button", {
				ref: effortTriggerRef, type: "button", className: ModelSelect_module_css_default.trigger,
				"aria-label": "思考等级", "aria-haspopup": "menu", "aria-expanded": open && pane === "effort",
				disabled: locked || busy,
				title: effortChoices.length === 0 ? t("empty.efforts") : t("menu.effort"),
				onClick: () => { if (open && pane === "effort") close(); else { setPane("effort"); setOpen(true); reload(); } },
				children: ["思考等级：", effortLabel ?? t("effort.providerDefault"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {})]
			}),
			open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
				ref: menuRef,
				id: `${id}-menu`,
				className: ModelSelect_module_css_default.menu,
				style: menuPos ?? MEASURE_STYLE,
				role: "menu",
				"aria-label": t("menu.aria"),
				"aria-busy": state.status === "loading" || busy,
				children: [
					pane === "root" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("button", {
						ref: itemRef(),
						type: "button",
						role: "menuitem",
						className: ModelSelect_module_css_default.cell,
						onClick: () => {
							setPane("model");
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: ModelSelect_module_css_default.cellLabel,
								children: t("menu.model")
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: ModelSelect_module_css_default.cellValue,
								children: modelLabel
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: ModelSelect_module_css_default.cellChevron })
						]
					}), (0, react_jsx_runtime.jsxs)("button", {
						ref: itemRef(),
						type: "button",
						role: "menuitem",
						className: ModelSelect_module_css_default.cell,
						onClick: () => {
							setPane("effort");
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: ModelSelect_module_css_default.cellLabel,
								children: t("menu.effort")
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: ModelSelect_module_css_default.cellValue,
								children: effortLabel
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: ModelSelect_module_css_default.cellChevron })
						]
					})] }),
					pane.startsWith("model") && (0, react_jsx_runtime.jsxs)("div", {
						className: "personal-model-columns",
						style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 3fr)", gridTemplateRows: "28px minmax(0, 1fr)", width: "100%", height: "100%", minHeight: 0, overflow: "hidden" },
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: { gridColumn: 1, gridRow: 1, padding: "4px 6px", fontSize: 12 }, children: t("menu.provider") }),
							(0, react_jsx_runtime.jsxs)("div", {
								style: { gridColumn: 1, gridRow: 2, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 3px 2px 0" },
								children: [
									state.groups.map((group) => {
										const providerSelected = state.current?.provider === group.id;
										const providerActive = group.id === activeProviderId;
										return (0, react_jsx_runtime.jsxs)("button", {
											ref: itemRef(), title: group.name, type: "button", role: "menuitemradio", "aria-checked": providerSelected,
											className: clsx(ModelSelect_module_css_default.option, providerActive && ModelSelect_module_css_default.selected),
											style: { width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8 },
											onMouseEnter: () => { setPane(`model:${group.id}`); }, onFocus: () => { setPane(`model:${group.id}`); }, onClick: () => { setPane(`model:${group.id}`); },
											children: [(0, react_jsx_runtime.jsx)("span", { className: ModelSelect_module_css_default.optionCopy, children: (0, react_jsx_runtime.jsx)("span", { className: ModelSelect_module_css_default.modelName, children: group.name }) }), providerSelected && (0, react_jsx_runtime.jsx)("span", { className: ModelSelect_module_css_default.check, children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) })]
										}, group.id);
									}),
									state.failures.map((failure) => (0, react_jsx_runtime.jsx)("div", { className: ModelSelect_module_css_default.warning, children: t("warning.groupLoad", { name: failure.name, message: failure.message }) }, failure.id))
								]
							}),
							activeGroup !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
								key: activeGroup.id,
								style: { gridColumn: 2, gridRow: "1 / 3", minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 0 2px 4px", borderLeft: "1px solid var(--dsw-alias-border-l1)" },
								children: [(0, react_jsx_runtime.jsx)("div", { style: { position: "sticky", top: 0, background: "var(--dsw-specific-menu)", padding: "4px 6px", height: 28, boxSizing: "border-box", color: "var(--dsw-alias-label-secondary)", fontSize: 12, fontWeight: 600 }, children: t("menu.model") }), activeGroup.models.map((model) => {
									const selected = state.current?.provider === activeGroup.id && state.current.model === model.id;
									return (0, react_jsx_runtime.jsxs)("button", {
										ref: itemRef(), type: "button", role: "menuitemradio", "aria-checked": selected, className: clsx(ModelSelect_module_css_default.option, selected && ModelSelect_module_css_default.selected), title: model.name ?? model.id, disabled: busy,
										onClick: () => { choose({ provider: activeGroup.id, model: model.id }); },
										children: [(0, react_jsx_runtime.jsx)("span", { className: ModelSelect_module_css_default.optionCopy, style: { display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: model.name ?? model.id }), (0, react_jsx_runtime.jsx)("span", { className: ModelSelect_module_css_default.check, children: selected ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null })]
									}, model.id);
								})]
							})
						]
					}),
					pane === "effort" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state.error !== null && lastActionRef.current === "load" && (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSelect_module_css_default.error,
						children: [(0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ModelSelect_module_css_default.retry,
							onClick: reload,
							children: t("action.reload")
						})]
					}), effortChoices.length === 0 ? (0, react_jsx_runtime.jsx)("div", {
						className: ModelSelect_module_css_default.empty,
						children: t("empty.efforts")
					}) : effortChoices.map((level) => (0, react_jsx_runtime.jsxs)("button", {
						ref: itemRef(),
						type: "button",
						role: "menuitemradio",
						"aria-checked": effectiveEffort === level.effort,
						className: clsx(ModelSelect_module_css_default.option, effectiveEffort === level.effort && ModelSelect_module_css_default.selected),
						disabled: busy,
						onClick: () => {
							chooseEffort(level.effort);
						},
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: ModelSelect_module_css_default.optionCopy,
							children: (0, react_jsx_runtime.jsx)("span", {
								className: ModelSelect_module_css_default.modelName,
								children: level.label
							})
						}), (0, react_jsx_runtime.jsx)("span", {
							className: ModelSelect_module_css_default.check,
							children: effectiveEffort === level.effort ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null
						})]
					}, level.key))] })
				]
			}), document.body),
			toast !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: toast.text,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, {}),
				anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
				onDone: () => {
					setToast(null);
				}
			}, toast.seq)
		]
	});
}
//#endregion
