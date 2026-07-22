import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FRAME_PRESET_CATEGORIES,
  findFramePreset,
  listFramePresets,
} from './framePresets.js';
import { createScreen } from './schema.js';

describe('framePresets', () => {
  it('tem categorias e presets com dimensões positivas', () => {
    assert.ok(FRAME_PRESET_CATEGORIES.length >= 5);
    for (const cat of FRAME_PRESET_CATEGORIES) {
      assert.ok(cat.presets.length >= 1, cat.id);
      for (const p of cat.presets) {
        assert.ok(p.width > 0, p.id);
        assert.ok(p.height > 0, p.id);
      }
    }
  });

  it('findFramePreset resolve ipad e retorna null para desconhecido', () => {
    const ipad = findFramePreset('ipad');
    assert.equal(ipad?.width, 820);
    assert.equal(ipad?.height, 1180);
    assert.equal(findFramePreset('nope'), null);
  });

  it('createScreen usa dims do preset quando passado width/height', () => {
    const p = findFramePreset('desktop');
    const screen = createScreen({
      name: p.name,
      width: p.width,
      height: p.height,
    });
    assert.equal(screen.width, 1440);
    assert.equal(screen.height, 1024);
    assert.equal(screen.name, 'Desktop');
  });

  it('listFramePresets é plano', () => {
    assert.ok(listFramePresets().length >= 10);
  });
});
