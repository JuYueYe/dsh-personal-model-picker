//#region lib/types/client/selection-helpers.js
/**
* Keep the model's adapter default when a model row is selected. For the
* currently selected route, an explicit session effort takes precedence.
*/
function reasoningEffortForModel(current, provider, model) {
	if (current?.provider === provider && current.model === model.id) {
		return current.reasoningEffort ?? model.reasoning?.defaultEffort;
	}
	return model.reasoning?.defaultEffort;
}

/** Place a menu near its trigger while clamping its actual dimensions to the viewport. */
function menuPlacement(rect, viewport, measured, margins = {}) {
	const side = margins.side ?? 12;
	const gap = margins.gap ?? 8;
	const requestedHeight = measured.height;
	const availableAbove = Math.max(0, rect.top - side - gap);
	const availableBelow = Math.max(0, viewport.height - rect.bottom - side - gap);
	const placeBelow = availableAbove < requestedHeight && availableBelow > availableAbove;
	const height = Math.min(requestedHeight, placeBelow ? availableBelow : availableAbove);
	const width = Math.min(measured.width, Math.max(0, viewport.width - side * 2));
	const left = Math.max(side, Math.min(rect.left, viewport.width - width - side));
	const top = placeBelow ? rect.bottom + gap : rect.top - gap - height;
	return { left, top: Math.max(side, Math.min(top, viewport.height - side - height)), width, height };
}
//#endregion
