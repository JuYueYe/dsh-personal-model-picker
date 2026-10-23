import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/selection-helpers.js', import.meta.url), 'utf8');
const script = `${source}\n;({ reasoningEffortForModel, menuPlacement })`;
const { reasoningEffortForModel, menuPlacement } = vm.runInNewContext(script);

assert.equal(reasoningEffortForModel(null, 'provider', { id: 'model', reasoning: { defaultEffort: 'high' } }), 'high');
assert.equal(reasoningEffortForModel({ provider: 'provider', model: 'model', reasoningEffort: 'max' }, 'provider', { id: 'model', reasoning: { defaultEffort: 'high' } }), 'max');
assert.equal(reasoningEffortForModel({ provider: 'other', model: 'model', reasoningEffort: 'max' }, 'provider', { id: 'model' }), undefined);

const smallViewport = menuPlacement({ left: 120, top: 300, bottom: 328 }, { width: 800, height: 400 }, { width: 500, height: 348 });
assert.ok(smallViewport.top >= 12);
assert.ok(smallViewport.top + smallViewport.height <= 388);
assert.ok(smallViewport.height < 348);
assert.equal(smallViewport.width, 500);

const bottomTrigger = menuPlacement({ left: 500, top: 350, bottom: 378 }, { width: 900, height: 800 }, { width: 500, height: 348 });
assert.ok(bottomTrigger.top >= 12);
assert.ok(bottomTrigger.top + bottomTrigger.height <= 788);
assert.ok(bottomTrigger.top >= 386, 'menu should open below when there is more room below');
console.log('selection helper regression tests passed');

